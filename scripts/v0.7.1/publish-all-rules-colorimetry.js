#!/usr/bin/env node

/**
 * @fileoverview Batch publish all colorimetry RuleDef JSONs to a sphere
 * @module scripts/v0.7.1/publish-all-rules-colorimetry
 *
 * Publishes and registers 17 new colorimetry rules + re-publishes 10 existing
 * rules upgraded with semantics grounding (Suresh & Jain, 2015).
 *
 * Phase order:
 *   1. Re-publish 10 existing rules as v2 (with semantics)
 *   2. Publish 6 tertiary light-domain rules
 *   3. Publish 8 CMYK transform rules
 *   4. Publish 1 KEY entity rule
 *   5. Publish 2 IsDividedInto ontological rules
 *
 * Usage:
 *   node scripts/v0.7.1/publish-all-rules-colorimetry.js --sphere <name> [--dry-run] [--new-only]
 *
 * Options:
 *   --sphere <name>  Sphere name (required)
 *   --dry-run        Print what would be done without executing
 *   --new-only       Skip re-publishing existing rules (only publish new rules)
 */

import {
  Client,
  PrivateKey,
} from "@hashgraph/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";
import { getOperatorConfig } from "../v0.6.3/lib/config.js";
import { canonicalizeJSON } from "../v0.6.3/lib/canonicalize.js";
import { loadSphereConfig } from "../v0.7/lib/sphere-config.js";
import { submitRuleDef, createRegistryEntry } from "../v0.7/publish_rule.js";
import { computeRuleUriHash } from "../v0.7/lib/resolve.js";
import * as logger from "../v0.6.3/lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Existing rules upgraded with semantics (re-publish as v2)
const EXISTING_RULES = [
  "ruleDef-red-green-yellow.json",
  "ruleDef-green-blue-cyan.json",
  "ruleDef-red-blue-magenta.json",
  "ruleDef-white-entity.json",
  "ruleDef-black-light-entity.json",
  "ruleDef-cyan-magenta-blue.json",
  "ruleDef-cyan-yellow-green.json",
  "ruleDef-magenta-yellow-red.json",
  "ruleDef-black-entity.json",
  "ruleDef-white-paint-entity.json",
];

// New colorimetry rules
const NEW_RULES = [
  // Tertiary light-domain
  "ruleDef-red-yellow-orange.json",
  "ruleDef-yellow-green-chartreuse.json",
  "ruleDef-green-cyan-spring-green.json",
  "ruleDef-cyan-blue-azure.json",
  "ruleDef-blue-magenta-violet.json",
  "ruleDef-magenta-red-rose.json",
  // CMYK transforms
  "ruleDef-red-transform.json",
  "ruleDef-green-transform.json",
  "ruleDef-blue-transform.json",
  "ruleDef-yellow-transform.json",
  "ruleDef-cyan-transform.json",
  "ruleDef-magenta-transform.json",
  "ruleDef-white-transform.json",
  "ruleDef-black-to-key.json",
  // CMYK entity
  "ruleDef-key-from-cmy.json",
  // Ontological classification (ColourModes IsDividedInto — Suresh & Jain Fig. 3 & 5)
  "ruleDef-color-isdividedinto-rgb.json",
  "ruleDef-color-isdividedinto-cmyk.json",
];

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const sphereName = getArg("--sphere");
  const dryRun = args.includes("--dry-run");
  const newOnly = args.includes("--new-only");

  if (!sphereName) {
    console.error("Usage: node publish-all-rules-colorimetry.js --sphere <name> [--dry-run] [--new-only]");
    process.exit(1);
  }

  const filesToPublish = newOnly ? NEW_RULES : [...EXISTING_RULES, ...NEW_RULES];

  logger.section("Colorimetry Batch Rule Publisher");
  logger.info("Reference: Suresh & Jain (2015) doi:10.1016/j.procs.2015.08.062");
  console.log(`Sphere: ${sphereName}`);
  console.log(`Rules:  ${filesToPublish.length} (${newOnly ? "new only" : `${EXISTING_RULES.length} re-publish + ${NEW_RULES.length} new`})`);
  console.log(`Dry Run: ${dryRun}`);

  const examplesDir = path.join(__dirname, "..", "..", "examples", "v07");

  // Verify all files exist
  for (const file of filesToPublish) {
    const fullPath = path.join(examplesDir, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`Missing RuleDef: ${fullPath}`);
      process.exit(1);
    }
  }

  const sphereConfig = loadSphereConfig(sphereName);
  console.log(`\nRULE_DEFS_TOPIC:    ${sphereConfig.ruleDefsTopicId}`);
  console.log(`RULE_REGISTRY_TOPIC: ${sphereConfig.ruleRegistryTopicId}`);

  if (dryRun) {
    logger.subsection("DRY RUN — Would publish:");
    for (const file of filesToPublish) {
      const ruleDef = JSON.parse(fs.readFileSync(path.join(examplesDir, file), "utf8"));
      const isExisting = EXISTING_RULES.includes(file);
      console.log(`  ${isExisting ? "[v2]" : "[new]"} ${file}`);
      console.log(`    ruleId: ${ruleDef.ruleId}`);
      console.log(`    domain: ${ruleDef.domain}`);
      console.log(`    semantics: ${ruleDef.semantics?.class || "none"}`);
    }
    console.log(`\nTotal: ${filesToPublish.length} rules to publish + register`);
    return;
  }

  const operatorConfig = getOperatorConfig();
  const privateKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  const results = [];

  try {
    for (let i = 0; i < filesToPublish.length; i++) {
      const file = filesToPublish[i];
      const ruleDef = JSON.parse(fs.readFileSync(path.join(examplesDir, file), "utf8"));
      const isExisting = EXISTING_RULES.includes(file);

      console.log(`\n[${i + 1}/${filesToPublish.length}] ${isExisting ? "[v2] " : ""}${ruleDef.ruleId}`);
      console.log(`  domain: ${ruleDef.domain}`);
      console.log(`  semantics: ${ruleDef.semantics?.class || "none"} (${ruleDef.semantics?.relation || "none"})`);

      const enhancedRuleDef = {
        ...ruleDef,
        createdAt: new Date().toISOString(),
        author: operatorConfig.id,
        status: "active",
      };

      // Submit to HCS
      console.log("  Publishing to HCS...");
      const { ruleUri, sequenceNumber } = await submitRuleDef(
        client,
        sphereConfig.ruleDefsTopicId,
        enhancedRuleDef,
        privateKey
      );

      const ruleUriHash = computeRuleUriHash(ruleUri);
      const preSubmit = { ...enhancedRuleDef };
      delete preSubmit.ruleUri;
      delete preSubmit.ruleUriHash;
      delete preSubmit.contentHash;
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(preSubmit)));

      console.log(`  ruleUri: ${ruleUri}`);
      console.log(`  HCS Seq: ${sequenceNumber}`);

      // Register
      console.log("  Registering...");
      const { sequenceNumber: registrySeq } = await createRegistryEntry(
        client,
        sphereConfig,
        enhancedRuleDef,
        ruleUri,
        privateKey
      );
      console.log(`  Registry Seq: ${registrySeq}`);

      results.push({
        file,
        ruleId: ruleDef.ruleId,
        domain: ruleDef.domain,
        semantics: ruleDef.semantics?.class || "-",
        ruleUri,
        hcsSeq: sequenceNumber,
        registrySeq,
        contentHash,
        isV2: isExisting,
      });
    }

    // Summary
    logger.section("Published Rules Summary");
    console.log("| #  | Ver | Domain         | Class | ruleId                                         | HCS | Reg |");
    console.log("|----|-----|----------------|-------|------------------------------------------------|-----|-----|");
    results.forEach((r, i) => {
      const ver = r.isV2 ? "v2" : "v1";
      const domain = r.domain.padEnd(14);
      const cls = r.semantics.padEnd(5);
      const ruleId = r.ruleId.padEnd(46);
      console.log(`| ${String(i + 1).padStart(2)} | ${ver}  | ${domain} | ${cls} | ${ruleId} | ${String(r.hcsSeq).padStart(3)} | ${String(r.registrySeq).padStart(3)} |`);
    });

    console.log(`\nTotal: ${results.length} rules published and registered on sphere "${sphereName}"`);

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("Colorimetry batch publish failed", err);
  process.exit(1);
});
