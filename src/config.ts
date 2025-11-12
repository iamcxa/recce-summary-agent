/**
 * Configuration and environment variable management
 */

import dotenv from "dotenv";

dotenv.config();

export const config = {
  // GitHub configuration
  github: {
    token: process.env.GITHUB_TOKEN || "",
    apiVersion: "2022-11-28",
  },

  // Claude API configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.CLAUDE_MODEL || "claude-haiku-4-5",
  },

  // Recce configuration
  recce: {
    enabled: process.env.RECCE_ENABLED !== "false",
    projectPath: process.env.RECCE_PROJECT_PATH || ".",
  },

  // Debug mode
  debug: process.env.DEBUG === "true",

  // Provider configuration
  provider: (process.env.PROVIDER || "github") as "github" | "gitlab" | "bitbucket",

  // Feature flags
  features: {
    githubContext: process.env.ENABLE_GITHUB_CONTEXT !== "false",
    recceValidation: process.env.ENABLE_RECCE_VALIDATION !== "false",
  },

  // Logging configuration
  logging: {
    perTurnFiles: process.env.LOG_PER_TURN !== "false",
    logDir: process.env.LOG_DIR || "logs",
    prettifyConsole: process.env.LOG_PRETTY !== "false",
  },
};

/**
 * Validate that all required environment variables are set
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.github.token) {
    errors.push("GITHUB_TOKEN environment variable is not set");
  }

  if (!config.claude.apiKey) {
    errors.push("ANTHROPIC_API_KEY environment variable is not set");
  }

  if (errors.length > 0) {
    console.error("Configuration validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
}
