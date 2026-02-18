/**
 * @fileoverview Create HCS topic for Ontologic reasoning proofs
 * @module scripts/create_topic
 *
 * This script creates a Hedera Consensus Service (HCS) topic for storing
 * consensus-backed reasoning proofs. This implements Layer 3 (HCS MESSAGE)
 * of the three-layer provenance architecture.
 *
 * Topic configuration:
 * - Memo: "Ontologic Reasoning Proof Alpha Tree"
 * - Submit key: Operator key (allows proof submissions)
 * - Messages: Canonical proof JSON with keccak256 hash verification
 */

import {
  Client,
  PrivateKey,
  TopicCreateTransaction,
} from "@hashgraph/sdk";
import { getOperatorConfig } from "./lib/config.js";
import * as logger from "./lib/logger.js";

/**
 * Create an HCS topic for reasoning proofs
 * @param {string} [memo="Ontologic Reasoning Proof Alpha Tree"] - Topic memo
 * @returns {Promise<string>} Topic ID (e.g., "0.0.7194982")
 * @throws {Error} If topic creation fails
 */
async function createReasoningTopic(memo = "Ontologic Reasoning Proof Alpha Tree") {
  const operatorConfig = getOperatorConfig();
  const operatorKey = PrivateKey.fromStringDer(operatorConfig.derKey);
  const client = Client.forTestnet().setOperator(operatorConfig.id, operatorKey);

  logger.info("Creating HCS topic for reasoning proofs...", {
    memo,
    submitKey: operatorConfig.id,
  });

  const transaction = await new TopicCreateTransaction()
    .setTopicMemo(memo)
    .setSubmitKey(operatorKey)
    .execute(client);

  const receipt = await transaction.getReceipt(client);
  const topicId = receipt.topicId;

  if (!topicId) {
    throw new Error("Topic creation failed: no topic ID returned");
  }

  logger.success("HCS topic created", {
    topicId: topicId.toString(),
    purpose: "Consensus-backed reasoning provenance (Layer 3)",
  });

  return topicId.toString();
}

/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function main() {
  try {
    logger.section("Create HCS Topic");

    const topicId = await createReasoningTopic();

    logger.subsection("Next Steps");
    logger.info("Add the following to your .env file:");
    console.log(`HCS_TOPIC_ID=${topicId}`);

    logger.subsection("Topic Purpose");
    logger.info(
      "This topic will store consensus-backed reasoning proofs.\n" +
      "Each successful reasoning operation will submit a canonical proof JSON\n" +
      "to this topic, creating an independent, ordered, append-only reasoning record."
    );

  } catch (err) {
    logger.error("Failed to create HCS topic", err);
    process.exit(1);
  }
}

// Export for programmatic use
export { createReasoningTopic };

// Run if executed directly
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ||
    import.meta.url.endsWith('create_topic.js')) {
  main();
}
