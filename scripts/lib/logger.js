/**
 * @fileoverview Structured logging utilities for Ontologic scripts
 * @module scripts/lib/logger
 */

/**
 * Log levels for structured output
 * @enum {string}
 */
const LogLevel = {
  INFO: "INFO",
  SUCCESS: "SUCCESS",
  WARNING: "WARNING",
  ERROR: "ERROR",
};

/**
 * Format a log message with consistent structure
 * @param {string} level - Log level
 * @param {string} message - Message to log
 * @param {Object} [details] - Optional additional details
 * @returns {string} Formatted log message
 */
function formatMessage(level, message, details) {
  const timestamp = new Date().toISOString();
  let output = `[${timestamp}] [${level}] ${message}`;

  if (details && Object.keys(details).length > 0) {
    output += "\n" + JSON.stringify(details, null, 2);
  }

  return output;
}

/**
 * Log an informational message
 * @param {string} message - Message to log
 * @param {Object} [details] - Optional details object
 */
export function info(message, details) {
  console.log(formatMessage(LogLevel.INFO, message, details));
}

/**
 * Log a success message
 * @param {string} message - Message to log
 * @param {Object} [details] - Optional details object
 */
export function success(message, details) {
  console.log(formatMessage(LogLevel.SUCCESS, `✅ ${message}`, details));
}

/**
 * Log a warning message
 * @param {string} message - Message to log
 * @param {Object} [details] - Optional details object
 */
export function warn(message, details) {
  console.warn(formatMessage(LogLevel.WARNING, `⚠️  ${message}`, details));
}

/**
 * Log an error message
 * @param {string} message - Message to log
 * @param {Error|Object} [error] - Optional error object or details
 */
export function error(message, error) {
  const details = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : error;

  console.error(formatMessage(LogLevel.ERROR, `❌ ${message}`, details));
}

/**
 * Log a JSON line (for machine-readable output)
 * @param {Object} obj - Object to log as JSON
 */
export function line(obj) {
  console.log(JSON.stringify(obj));
}

/**
 * Log a section header for better output organization
 * @param {string} title - Section title
 */
export function section(title) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * Log a subsection header
 * @param {string} title - Subsection title
 */
export function subsection(title) {
  console.log(`\n--- ${title} ---\n`);
}

/**
 * Log key-value pairs in a formatted table
 * @param {Object} data - Key-value pairs to display
 */
export function table(data) {
  const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));

  Object.entries(data).forEach(([key, value]) => {
    const paddedKey = key.padEnd(maxKeyLength);
    console.log(`  ${paddedKey} : ${value}`);
  });
}

/**
 * Log verification links for Hedera transactions
 * @param {string} txHash - Transaction hash
 * @param {string} [topicId] - Optional HCS topic ID
 */
export function verificationLinks(txHash, topicId) {
  subsection("Verification Links");
  table({
    "Mirror Node": `https://testnet.mirrornode.hedera.com/api/v1/transactions/${txHash}`,
    "HashScan": `https://hashscan.io/testnet/transaction/${txHash}`,
  });

  if (topicId) {
    console.log(`  ${"HCS Topic".padEnd(11)} : https://testnet.mirrornode.hedera.com/api/v1/topics/${topicId}/messages`);
  }
}
