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

  // GitLab configuration
  gitlab: {
    token: process.env.GITLAB_TOKEN || process.env.GITLAB_PERSONAL_ACCESS_TOKEN || "",
    apiUrl: process.env.GITLAB_API_URL || "https://gitlab.com/api/v4",
    projectId: process.env.GITLAB_PROJECT_ID || "",
    allowedProjectIds: process.env.GITLAB_ALLOWED_PROJECT_IDS || "",
    // OAuth settings
    useOAuth: process.env.GITLAB_USE_OAUTH === "true",
    oauthClientId: process.env.GITLAB_OAUTH_CLIENT_ID || "",
    oauthRedirectUri: process.env.GITLAB_OAUTH_REDIRECT_URI || "http://127.0.0.1:8888/callback",
    // Feature flags
    readOnlyMode: process.env.GITLAB_READ_ONLY_MODE !== "false", // Default true for safety
    useWiki: process.env.USE_GITLAB_WIKI === "true",
    useMilestone: process.env.USE_MILESTONE === "true",
    usePipeline: process.env.USE_PIPELINE === "true",
  },

  // Claude API configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
  },

  // Recce configuration
  recce: {
    enabled: process.env.RECCE_ENABLED !== "false",
    projectPath: process.env.RECCE_PROJECT_PATH || ".",
    yamlPath: process.env.RECCE_YAML_PATH || "",  // Empty means use projectPath/recce.yml
    executePresetChecks: process.env.RECCE_EXECUTE_PRESET_CHECKS !== "false",
    targetPath: process.env.RECCE_TARGET_PATH || "target",
    targetBasePath: process.env.RECCE_TARGET_BASE_PATH || "target-base",
  },

  // Debug mode
  debug: process.env.DEBUG === "true",

  // Provider configuration
  provider: (process.env.PROVIDER || "github") as "github" | "gitlab" | "bitbucket",

  // Output format
  outputFormat: (process.env.OUTPUT_FORMAT || "markdown") as "markdown" | "slack" | "json" | "html" | "pr-summary",

  // Template options
  template: {
    includeFilePatches: process.env.INCLUDE_PATCHES === "true",
    maxPatchLines: parseInt(process.env.MAX_PATCH_LINES || "50"),
  },

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

  // Validate provider-specific tokens
  if (config.provider === "github" && !config.github.token) {
    errors.push("GITHUB_TOKEN environment variable is not set");
  }

  if (config.provider === "gitlab" && !config.gitlab.token && !config.gitlab.useOAuth) {
    errors.push("GITLAB_TOKEN or GITLAB_PERSONAL_ACCESS_TOKEN environment variable is not set (or enable GITLAB_USE_OAUTH)");
  }

  // Always require Claude API key
  if (!config.claude.apiKey) {
    errors.push("ANTHROPIC_API_KEY environment variable is not set");
  }

  if (errors.length > 0) {
    console.error("Configuration validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }
}
