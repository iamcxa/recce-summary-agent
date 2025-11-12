#!/usr/bin/env node

/**
 * Claude Agent PR Summary Tool - Main Entry Point
 *
 * Usage: pnpm summary <owner> <repo> <pr-number>
 */

import { config, validateConfig } from "./config.js";
import { logger } from "./logger.js";
import { createAndAnalyzePR } from "./agent.js";
import fs from "fs";

interface CLIArgs {
  owner?: string;
  repo?: string;
  prNumber?: number;
  outputPath?: string;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error("Usage: pnpm summary <owner> <repo> <pr-number> [output-path]");
    console.error("\nExample: pnpm summary anthropic anthropic 123");
    console.error("Example: pnpm summary anthropic anthropic 123 ./summary.md");
    console.error("\nConfiguration:");
    console.error("  Set OUTPUT_FORMAT=json|slack|markdown in .env to change output format");
    console.error("  Set PROVIDER=github|gitlab|bitbucket in .env to change provider");
    process.exit(1);
  }

  const [owner, repo, prNumber, outputPath] = args;

  return {
    owner,
    repo,
    prNumber: parseInt(prNumber, 10),
    outputPath,
  };
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Parse CLI arguments
    const args = parseArgs();

    if (!args.owner || !args.repo || !args.prNumber) {
      logger.error("Invalid arguments provided");
      process.exit(1);
    }

    logger.info("Claude Agent PR Summary Tool");
    logger.info("============================");
    logger.info(`PR Information:`, {
      owner: args.owner,
      repo: args.repo,
      prNumber: args.prNumber,
    });

    if (args.outputPath) {
      logger.info(`Output Path: ${args.outputPath}`);
    }

    logger.info(`Configuration:`, {
      model: config.claude.model,
      recceEnabled: config.recce.enabled,
      debugMode: config.debug,
      provider: config.provider,
      outputFormat: config.outputFormat,
    });

    logger.info("Starting PR analysis...");

    // Execute the PR analysis agent
    const result = await createAndAnalyzePR(
      args.owner,
      args.repo,
      args.prNumber,
      config.recce.enabled,
      config.github.token
    );

    // Output the summary
    if (args.outputPath) {
      logger.info(`Writing summary to ${args.outputPath}`);
      fs.writeFileSync(args.outputPath, result.summary || "");
      logger.info("Summary written successfully");
    } else {
      console.log("\n" + "=".repeat(60));
      console.log(result.summary);
      console.log("=".repeat(60) + "\n");
    }

    logger.info("PR analysis completed successfully");
  } catch (error) {
    logger.error("Fatal error", error);
    process.exit(1);
  }
}

main();
