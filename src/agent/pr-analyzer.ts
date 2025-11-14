/**
 * PR Analyzer Orchestrator
 * Main entry point that coordinates all agent modules
 * Clean Architecture: High-level policy that orchestrates lower-level modules
 */

import { config } from '../config.js';
import { formatCommandsForPrompt, loadSlashCommands } from '../commands/index.js';
import { createAgentLogger, logInfo, logWarn } from '../logging/agent_logger.js';
import { PromptBuilder } from '../prompts/index.js';
import { GitProviderResolver } from '../providers/index.js';
import type { PRAnalysisResult } from '../types/index.js';
import type { AgentPromptOptions } from './types.js';
import { checkRecceMcpConnection, buildMCPConfig } from './mcp-connector.js';
import { loadPresetChecks } from './preset-loader.js';
import { executeAgent, suppressSDKLogging } from './agent-executor.js';

/**
 * Analyze a PR with dbt model changes using Claude Agent SDK
 * Coordinates MCP connection, preset loading, prompt building, and agent execution
 *
 * @param recceMcpUrl - Recce MCP server URL
 * @param repoUrl - Repository URL (e.g., https://github.com/owner/repo)
 * @param prNumber - Pull request number
 * @param recceEnabled - Whether to enable Recce features
 * @param promptOptions - Optional prompt customization
 * @returns Analysis result with PR metadata and summary
 */
export async function analyzePR(
  recceMcpUrl: string,
  repoUrl: string,
  prNumber: number,
  recceEnabled = true,
  promptOptions?: AgentPromptOptions,
): Promise<PRAnalysisResult> {
  const startTime = Date.now();

  // Parse repository URL to extract provider and metadata
  const repoInfo = GitProviderResolver.parseRepoUrl(repoUrl);
  const { provider, owner, repo, providerInstance } = repoInfo;

  // Get git token from config
  const gitToken = config.git.token;
  if (!gitToken) {
    throw new Error(
      'Git token not found. Please set GIT_TOKEN environment variable or pass it via CLI.',
    );
  }

  // Build context
  let includeRecce = recceEnabled && config.recce.enabled;

  // Pre-flight check: Verify Recce MCP server is reachable
  if (includeRecce) {
    logInfo('🔍 Checking Recce MCP server connectivity...');
    const recceReachable = await checkRecceMcpConnection(recceMcpUrl);

    if (recceReachable) {
      logInfo('✅ Recce MCP server connected');
    } else {
      logWarn('⚠️  Recce MCP server unreachable - disabling Recce features');
      logWarn(`   Server URL: ${recceMcpUrl}`);
      logWarn(`   Tip: Ensure Recce server is running with 'recce mcp-server --sse'`);
      includeRecce = false;
    }
  }

  const context = {
    owner,
    repo,
    prNumber,
    includeRecce,
  };

  // Load preset checks from recce.yml (if enabled)
  let presetChecks = null;
  if (context.includeRecce && config.recce.executePresetChecks) {
    const yamlPath = promptOptions?.recceConfig || config.recce.yamlPath || undefined;
    presetChecks = await loadPresetChecks(yamlPath, config.recce.projectPath);
  }

  // Initialize logger
  const logTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = await createAgentLogger(
    {
      owner,
      repo,
      prNumber,
      githubToken: gitToken,
      recceEnabled: context.includeRecce,
      recceYamlPath: config.recce.yamlPath,
      executePresetChecks: config.recce.executePresetChecks,
    },
    'main-agent',
    logTimestamp,
  );

  // Log agent start
  logger.logSystemInit('main-agent', config.claude.model, process.cwd());
  logger.logAgentStart({
    owner,
    repo,
    prNumber,
    githubToken: gitToken,
    recceEnabled: context.includeRecce,
    recceYamlPath: config.recce.yamlPath,
    executePresetChecks: config.recce.executePresetChecks,
  });

  let restoreStderr: (() => void) | null = null;

  try {
    // Initialize PromptBuilder
    const promptBuilder = new PromptBuilder();

    // Build MCP configuration dynamically
    const mcpServers = buildMCPConfig(repoUrl, gitToken, recceMcpUrl);

    // Remove Recce MCP if disabled after pre-flight check
    if (!context.includeRecce && mcpServers.recce) {
      delete mcpServers.recce;
      logger.logger.info('ℹ️  Recce MCP removed from configuration (disabled or unreachable)');
    }

    // Load slash commands if path provided
    let commandsSection = '';
    if (promptOptions?.promptCommandsPath) {
      try {
        const commands = loadSlashCommands(promptOptions.promptCommandsPath);
        if (commands.count > 0) {
          commandsSection = '\n\n' + formatCommandsForPrompt(commands);
          logInfo(`📝 Loaded ${commands.count} slash commands from ${commands.source}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logWarn(`⚠️  Failed to load slash commands: ${errorMsg}`);
      }
    }

    // Build system prompt (or use custom if provided)
    if (promptOptions?.systemPrompt) {
      logInfo('⚙️  Using custom system prompt');
    }
    const systemPrompt = promptOptions?.systemPrompt
      ? promptOptions.systemPrompt + commandsSection
      : promptBuilder.buildSystemPrompt({
          provider,
          features: {
            githubContext: true,
            recceValidation: context.includeRecce,
          },
          userIntent: 'pr_analysis',
          owner,
          repo,
          prNumber,
          presetChecks: presetChecks,
        }) + commandsSection;

    // Build user prompt (or use custom if provided)
    if (promptOptions?.userPrompt) {
      logInfo('⚙️  Using custom user prompt');
    }
    const userPrompt = promptBuilder.buildUserPrompt({
      provider,
      features: {
        githubContext: true,
        recceValidation: context.includeRecce,
      },
      userIntent: 'pr_analysis',
      owner,
      repo,
      prNumber,
      presetChecks: presetChecks,
      customPrompt: promptOptions?.userPrompt,
    });

    // Log configuration
    logger.logMCPConfigBuilt(Object.keys(mcpServers));
    logInfo(`📋 MCP Servers configured: ${Object.keys(mcpServers).join(', ')}`);

    // Define subagents using PromptBuilder
    const contextSubagentName = providerInstance.getContextSubagentName();
    const agents = {
      [contextSubagentName]: promptBuilder.getProviderContextSubagent(provider),
      ...(context.includeRecce && {
        'recce-analysis': promptBuilder.getRecceAnalysisSubagent(),
      }),
      ...(presetChecks &&
        presetChecks.checks.length > 0 && {
          'preset-check-executor': promptBuilder.getPresetCheckExecutorSubagent(),
        }),
    };

    logger.logger.info(`🤖 Subagents: ${Object.keys(agents).join(', ')}`);

    // Build allowed tools list - include all MCP tools that subagents need
    const allowedTools: string[] = [
      // Recce MCP tools
      'mcp__recce__get_lineage_diff',
      'mcp__recce__lineage_diff',
      'mcp__recce__schema_diff',
      'mcp__recce__row_count_diff',
      'mcp__recce__query',
      'mcp__recce__query_diff',
      'mcp__recce__profile_diff',
      // GitHub MCP tools
      'mcp__github__pull_request_read',
      'mcp__github__get_file_contents',
      'mcp__github__list_commits',
      'mcp__github__search_code',
      'mcp__github__issue_read',
    ];

    // If showSystemPrompt is enabled, output the prompts and exit
    if (promptOptions?.showSystemPrompt) {
      console.log('\n' + '='.repeat(80));
      console.log('SYSTEM PROMPT');
      console.log('='.repeat(80));
      console.log(systemPrompt);
      console.log('\n' + '='.repeat(80));
      console.log('USER PROMPT');
      console.log('='.repeat(80));
      console.log(userPrompt);
      console.log('='.repeat(80) + '\n');
      process.exit(0);
    }

    // Suppress Agent SDK verbose logging if not in debug mode
    restoreStderr = suppressSDKLogging();

    // Execute agent with Claude SDK
    const executionResult = await executeAgent(
      {
        userPrompt,
        systemPrompt,
        mcpServers,
        allowedTools,
        agents,
        logger,
      },
      startTime,
    );

    logger.close();

    // Return result in PRAnalysisResult format
    return {
      pr: {
        owner,
        repo,
        number: prNumber,
        title: '',
        description: '',
        author: '',
        state: 'open',
        createdAt: '',
        updatedAt: '',
        url: providerInstance.getPRUrl(owner, repo, prNumber),
      },
      diff: {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        changedFilesCount: 0,
      },
      summary: executionResult.summary,
    };
  } finally {
    // Restore original stderr write if it was suppressed
    if (restoreStderr) {
      restoreStderr();
    }
  }
}
