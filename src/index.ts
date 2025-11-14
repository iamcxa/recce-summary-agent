/**
 * Recce Agent - AI-powered Git Analysis Tool for dbt Projects
 *
 * A CLI tool that uses Claude AI to analyze Git repositories and Pull Requests,
 * with optional integration with Recce MCP for dbt metadata validation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { analyzeMainBranch, createAndAnalyzePR } from './agent.js';
import { config, validateConfig } from './config.js';
import { logger } from './logger.js';
import { logError, logInfo, logWarn } from './logging/agent_logger.js';
import { GitProviderResolver, type ParsedPRInfo } from './providers/index.js';
import type { PRAnalysisResult, ProviderType } from './types/index.js';
import {
  printGitProviderVerificationResult,
  printRecceMcpVerificationResult,
} from './verification/formatters.js';
import { verifyGitProviderMcp } from './verification/git_provider_verifier.js';
import { verifyRecceMcp } from './verification/recce_verifier.js';

const program = new Command();

program
  .name('recce-agent')
  .version('0.1.0')
  .description('AI-powered Data Quality Analysis tool for dbt projects with Recce AI')
  .argument('[git-url]', 'Git repository or PR URL (not required for verification commands)')
  .option('--recce-mcp-url <url>', 'Recce MCP server URL', 'http://localhost:8080/sse')
  .option(
    '--recce-config <path>',
    'Path to recce.yml configuration file (default: auto-detect in current directory)',
  )
  .option('--user-prompt <text>', 'Custom user prompt (overrides default user prompt)')
  .option('--system-prompt <text>', 'Custom system prompt (overrides default system prompt)')
  .option('--prompt-commands-path <path>', 'Path to directory containing slash command definitions')
  .option('--show-system-prompt', 'Display the final system + user prompt without executing')
  .option('-o, --output <path>', 'Save analysis summary to specified file path')
  .option(
    '--verify-recce-mcp [url]',
    'Verify Recce MCP server connectivity (uses --recce-mcp-url if not specified)',
  )
  .option('--verify-git-mcp <provider>', 'Verify Git provider MCP (github|gitlab|bitbucket)')
  .option('--debug', 'Enable debug logging (shows detailed execution information)')
  .addHelpText(
    'after',
    `
Examples:
  # Analyze a Pull Request (using default Recce MCP URL)
  $ recce-agent https://github.com/dbt-labs/jaffle_shop/pull/123

  # Analyze a Repository (main branch overview)
  $ recce-agent https://github.com/dbt-labs/jaffle_shop

  # With custom Recce MCP URL
  $ recce-agent https://github.com/org/repo/pull/3 --recce-mcp-url http://localhost:9000/sse

  # With custom Recce config
  $ recce-agent https://github.com/org/repo/pull/3 --recce-config ./custom-recce.yml

  # With custom user prompt
  $ recce-agent https://github.com/org/repo/pull/3 --user-prompt "Focus on schema changes and data quality impacts"

  # With custom system prompt
  $ recce-agent https://github.com/org/repo/pull/3 --system-prompt "You are a senior data engineer..."

  # Show final prompt without executing
  $ recce-agent https://github.com/org/repo/pull/3 --show-system-prompt

  # With custom slash commands
  $ recce-agent https://github.com/org/repo/pull/3 --prompt-commands-path ./my-commands

  # Save output to file
  $ recce-agent https://github.com/org/repo/pull/123 --output ./summary.md

  # Combine multiple options
  $ recce-agent https://github.com/org/repo/pull/3 \\
                --recce-mcp-url http://localhost:8080/sse \\
                --recce-config ./custom-recce.yml \\
                --user-prompt "Highlight breaking changes" \\
                --output ./pr-summary.md

Verification Commands:
  # Verify Recce MCP server (default URL)
  $ recce-agent --verify-recce-mcp

  # Verify Recce MCP server (custom URL)
  $ recce-agent --verify-recce-mcp http://localhost:9000/sse

  # Verify GitHub MCP server
  $ recce-agent --verify-git-mcp github

  # Verify GitLab MCP server
  $ recce-agent --verify-git-mcp gitlab

Supported Git URL Formats:
  - GitHub PR:   https://github.com/owner/repo/pull/123
  - GitLab MR:   https://gitlab.com/owner/repo/-/merge_requests/456
  - Bitbucket:   https://bitbucket.org/owner/repo/pull-requests/789
  - GitHub Repo: https://github.com/owner/repo
  - GitLab Repo: https://gitlab.com/owner/repo

Environment Variables:
  GIT_TOKEN         Authentication token for Git provider (required)
  ANTHROPIC_API_KEY Claude API key (required)
  CLAUDE_MODEL      Claude model to use (default: claude-haiku-4-5-20251001)
  RECCE_ENABLED     Enable Recce MCP integration (default: true)
  DEBUG             Enable debug logging (default: false)
`,
  )
  .action(
    async (
      gitUrl: string | undefined,
      options: {
        recceMcpUrl: string;
        recceConfig?: string;
        userPrompt?: string;
        systemPrompt?: string;
        promptCommandsPath?: string;
        showSystemPrompt?: boolean;
        output?: string;
        verifyRecceMcp?: boolean | string;
        verifyGitMcp?: string;
        debug?: boolean;
      },
    ) => {
      try {
        // Apply CLI debug flag to config (overrides environment variable)
        if (options.debug !== undefined) {
          config.debug = options.debug;
        }

        // Validate and prepare output file if --output is specified
        if (options.output) {
          try {
            // Ensure parent directory exists
            const outputDir = path.dirname(options.output);
            if (!fs.existsSync(outputDir)) {
              logger.info(`Creating output directory: ${outputDir}`);
              fs.mkdirSync(outputDir, { recursive: true });
            }

            // Test write permissions by creating an empty file
            logger.info(`Validating output path: ${options.output}`);
            fs.writeFileSync(options.output, '');
            logger.info('✓ Output path is writable');
          } catch (error) {
            logError(
              `\n❌ Error: Cannot write to output path "${options.output}": ${(error as Error).message}\n`,
            );
            process.exit(1);
          }
        }

        // Handle verification commands first
        if (options.verifyRecceMcp !== undefined) {
          const url =
            typeof options.verifyRecceMcp === 'string'
              ? options.verifyRecceMcp
              : options.recceMcpUrl;

          logger.info(`Verifying Recce MCP server at ${url}...`);
          const result = await verifyRecceMcp(url);
          printRecceMcpVerificationResult(result);
          process.exit(result.success ? 0 : 1);
        }

        if (options.verifyGitMcp) {
          const provider = options.verifyGitMcp.toLowerCase() as ProviderType;
          if (!['github', 'gitlab', 'bitbucket'].includes(provider)) {
            logError(
              `\n❌ Error: Invalid provider "${options.verifyGitMcp}". Must be one of: github, gitlab, bitbucket\n`,
            );
            process.exit(1);
          }

          logger.info(`Verifying ${provider.toUpperCase()} MCP server...`);
          const result = await verifyGitProviderMcp(provider);
          printGitProviderVerificationResult(result);
          process.exit(result.success ? 0 : 1);
        }

        // Normal analysis mode: git-url is required
        if (!gitUrl) {
          logError('\n❌ Error: git-url argument is required for analysis mode\n');
          program.help();
          process.exit(1); // Explicit exit to satisfy TypeScript
        }

        // Validate configuration for normal analysis
        validateConfig();

        // Parse Git URL to detect type and extract PR number if present
        // At this point, gitUrl is guaranteed to be defined
        let parsed: ParsedPRInfo;
        try {
          parsed = GitProviderResolver.parseGitUrl(gitUrl);
        } catch (error) {
          logError(`\n❌ Error: ${(error as Error).message}`);
          process.exit(1);
        }

        // Validate PR-specific arguments
        if (parsed.urlType === 'pr' && !parsed.prNumber) {
          logger.error('PR URL detected but PR number could not be extracted');
          process.exit(1);
        }

        // Display analysis header
        logger.info('Recce Agent - Git Analysis Tool');
        logger.info('================================');
        logger.info(`Recce MCP Server: ${options.recceMcpUrl}`);
        logger.info(`Git URL: ${gitUrl}`);
        logger.info(
          `Analysis Mode: ${parsed.urlType === 'pr' ? 'PR Diff' : 'Repository Overview'}`,
        );

        if (parsed.urlType === 'pr' && parsed.prNumber) {
          logger.info(`PR Number: ${parsed.prNumber}`);
        }

        if (options.userPrompt) {
          logger.info(`Custom User Prompt: ${options.userPrompt}`);
        }

        if (options.systemPrompt) {
          logger.info(`Custom System Prompt: ${options.systemPrompt}`);
        }

        if (options.promptCommandsPath) {
          logger.info(`Slash Commands Path: ${options.promptCommandsPath}`);
        }

        if (options.output) {
          logger.info(`Output Path: ${options.output}`);
        }

        logger.info(`Configuration:`, {
          model: config.claude.model,
          recceEnabled: config.recce.enabled,
          debugMode: config.debug,
        });

        // Route to appropriate analysis function
        let result: PRAnalysisResult;

        if (parsed.urlType === 'pr' && parsed.prNumber) {
          logger.info('🔍 Starting PR diff analysis...');

          result = await createAndAnalyzePR(
            options.recceMcpUrl,
            gitUrl,
            parsed.prNumber,
            config.recce.enabled,
            {
              recceConfig: options.recceConfig,
              userPrompt: options.userPrompt,
              systemPrompt: options.systemPrompt,
              promptCommandsPath: options.promptCommandsPath,
              showSystemPrompt: options.showSystemPrompt,
            },
          );

          logger.info('PR analysis completed successfully');
        } else if (parsed.urlType === 'repo') {
          logger.info('📊 Starting repository overview analysis...');

          result = await analyzeMainBranch(options.recceMcpUrl, gitUrl, {
            recceConfig: options.recceConfig,
            userPrompt: options.userPrompt,
            systemPrompt: options.systemPrompt,
            promptCommandsPath: options.promptCommandsPath,
            showSystemPrompt: options.showSystemPrompt,
          });

          logger.info('Repository analysis completed successfully');
        } else {
          logger.error(`Unsupported URL type: ${parsed.urlType}`);
          process.exit(1);
        }

        // Output the summary
        if (options.output) {
          try {
            logger.info(`📝 Writing summary to ${options.output}`);
            const content = result.summary || '';
            fs.writeFileSync(options.output, content);

            // Verify file was written and get stats
            const stats = fs.statSync(options.output);
            const fileSizeKB = (stats.size / 1024).toFixed(2);

            logger.info(`✓ Summary written successfully (${fileSizeKB} KB)`);
            logger.info(`📄 File location: ${path.resolve(options.output)}`);
          } catch (error) {
            logger.error(`Failed to write summary to ${options.output}:`, error);
            throw error;
          }
        } else {
          console.log(`\n${'='.repeat(60)}`);
          console.log(result.summary);
          console.log(`${'='.repeat(60)}\n`);
        }
      } catch (error) {
        logger.error('Fatal error', error);
        process.exit(1);
      }
    },
  );

// Parse command-line arguments
program.parse();
