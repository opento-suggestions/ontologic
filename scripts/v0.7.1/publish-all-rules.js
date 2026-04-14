#!/usr/bin/env node

/**
 * @fileoverview Batch publish all RuleDef JSONs to a sphere
 * @module scripts/v0.7.1/publish-all-rules
 *
 * Publishes and registers all 8 color rules (4 light + 4 paint)
 * to the specified sphere in a single run.
 *
 * Usage:
 *   node scripts/v0.7.1/publish-all-rules.js --sphere <name> [--dry-run]
 *
 * Options:
 *   --sphere <name>  Sphere name (required)
 *   --dry-run        Print what would be done without executing
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

// All RuleDef files in publication order: light domain first, then paint
const RULE_DEF_FILES = [
  // Light domain (additive)
  "ruleDef-red-green-yellow.json",
  "ruleDef-green-blue-cyan.json",
  "ruleDef-red-blue-magenta.json",
  "ruleDef-white-entity.json",
  // Paint domain (subtractive)
  "ruleDef-cyan-magenta-blue.json",
  "ruleDef-cyan-yellow-green.json",
  "ruleDef-magenta-yellow-red.json",
  "ruleDef-black-entity.json",
];

async function main() {
  const args = process.argv.slice(2);

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  };

  const sphereName = getArg("--sphere");
  const dryRun = args.includes("--dry-run");

  if (!sphereName) {
    console.error("Usage: node publish-all-rules.js --sphere <name> [--dry-run]");
    process.exit(1);
  }

  logger.section("v0.7.1 Batch Rule Publisher");
  console.log(`Sphere: ${sphereName}`);
  console.log(`Rules:  ${RULE_DEF_FILES.length}`);
  console.log(`Dry Run: ${dryRun}`);

  // Resolve examples directory
  const examplesDir = path.join(__dirname, "..", "..", "examples", "v07");

  // Verify all files exist before starting
  for (const file of RULE_DEF_FILES) {
    const fullPath = path.join(examplesDir, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`Missing RuleDef: ${fullPath}`);
      process.exit(1);
    }
  }

  // Load sphere config
  const sphereConfig = loadSphereConfig(sphereName);
  console.log(`\nRULE_DEFS_TOPIC:    ${sphereConfig.ruleDefsTopicId}`);
  console.log(`RULE_REGISTRY_TOPIC: ${sphereConfig.ruleRegistryTopicId}`);

  if (dryRun) {
    logger.subsection("DRY RUN — Would publish:");
    for (const file of RULE_DEF_FILES) {
      const ruleDef = JSON.parse(fs.readFileSync(path.join(examplesDir, file), "utf8"));
      console.log(`  ${file}`);
      console.log(`    ruleId: ${ruleDef.ruleId}`);
      console.log(`    domain: ${ruleDef.domain}`);
    }
    console.log(`\nTotal: ${RULE_DEF_FILES.length} rules to publish + register`);
    return;
  }

  // Initialize client
  const operatorConfig = getOperatorConfig();
  const privateKey = PrivateKey.fromString(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, privateKey);

  const results = [];

  try {
    for (let i = 0; i < RULE_DEF_FILES.length; i++) {
      const file = RULE_DEF_FILES[i];
      const ruleDef = JSON.parse(fs.readFileSync(path.join(examplesDir, file), "utf8"));

      console.log(`\n[${i + 1}/${RULE_DEF_FILES.length}] ${ruleDef.ruleId}`);
      console.log(`  domain: ${ruleDef.domain}`);

      // Enhance RuleDef with metadata
      const enhancedRuleDef = {
        ...ruleDef,
        createdAt: new Date().toISOString(),
        author: operatorConfig.id,
        status: "active",
      };

      // 1. Submit to HCS
      console.log("  Publishing to HCS...");
      const { ruleUri, sequenceNumber } = await submitRuleDef(
        client,
        sphereConfig.ruleDefsTopicId,
        enhancedRuleDef,
        privateKey
      );

      // Compute hashes
      const ruleUriHash = computeRuleUriHash(ruleUri);
      const preSubmit = { ...enhancedRuleDef };
      delete preSubmit.ruleUri;
      delete preSubmit.ruleUriHash;
      delete preSubmit.contentHash;
      const contentHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalizeJSON(preSubmit)));

      console.log(`  ruleUri: ${ruleUri}`);
      console.log(`  HCS Seq: ${sequenceNumber}`);

      // 2. Register
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
        ruleUri,
        hcsSeq: sequenceNumber,
        registrySeq,
        contentHash,
      });
    }

    // Print summary table
    logger.section("Published Rules Summary");
    console.log("| # | Domain       | ruleId                                    | HCS | Reg |");
    console.log("|---|--------------|-------------------------------------------|-----|-----|");
    results.forEach((r, i) => {
      const domain = r.domain.padEnd(12);
      const ruleId = r.ruleId.padEnd(41);
      console.log(`| ${i + 1} | ${domain} | ${ruleId} | ${r.hcsSeq.padStart(3)} | ${r.registrySeq.padStart(3)} |`);
    });

    console.log(`\nTotal: ${results.length} rules published and registered on sphere "${sphereName}"`);

  } finally {
    client.close();
  }
}

main().catch((err) => {
  logger.error("Batch publish failed", err);
  process.exit(1);
});
