/**
 * Configuration and environment variable management
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Git provider authentication (token passed via CLI or environment)
  git: {
    token: process.env.GIT_TOKEN || process.env.GITHUB_TOKEN || process.env.GITLAB_TOKEN || '',
  },

  // Claude API configuration
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
  },

  // Recce configuration
  recce: {
    enabled: process.env.RECCE_ENABLED !== 'false',
    projectPath: process.env.RECCE_PROJECT_PATH || '.',
    yamlPath: process.env.RECCE_YAML_PATH || '', // Empty means use projectPath/recce.yml
    executePresetChecks: process.env.RECCE_EXECUTE_PRESET_CHECKS !== 'false',
    targetPath: process.env.RECCE_TARGET_PATH || 'target',
    targetBasePath: process.env.RECCE_TARGET_BASE_PATH || 'target-base',
  },

  // Debug mode
  debug: process.env.DEBUG === 'true',

  // Logging configuration
  logging: {
    prettifyConsole: process.env.LOG_PRETTY !== 'false',
  },
};

/**
 * Validate that all required environment variables are set
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Validate Claude API key (always required)
  if (!config.claude.apiKey) {
    errors.push('ANTHROPIC_API_KEY environment variable is not set');
  }

  // Git token will be validated at runtime based on the repo URL provided
  // We don't validate it here since it can also be passed via CLI

  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach((error) => {
      console.error(`  - ${error}`);
    });
    process.exit(1);
  }
}
