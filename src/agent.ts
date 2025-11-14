/**
 * Main Agent Module (Refactored)
 * Clean Architecture: Thin wrapper that delegates to specialized modules
 * Maintains backward compatibility with existing API
 */

import { analyzePR } from './agent/pr-analyzer.js';
import type { AgentPromptOptions } from './agent/types.js';
import type { PRAnalysisResult } from './types/index.js';
import { config } from './config.js';
import { formatCommandsForPrompt, loadSlashCommands } from './commands/index.js';
import { createAgentLogger, logInfo, logWarn } from './logging/agent_logger.js';
import { PromptBuilder } from './prompts/index.js';
import { GitProviderResolver } from './providers/index.js';
import { executeAgent, suppressSDKLogging } from './agent/agent-executor.js';

// Re-export types for backward compatibility
export type { AgentPromptOptions, PRAnalysisResult };

/**
 * Analyze a PR with dbt model changes using Claude Agent SDK
 * @deprecated Use analyzePR from './agent/index.js' instead
 *
 * @param recceMcpUrl - Recce MCP server URL
 * @param repoUrl - Repository URL
 * @param prNumber - Pull request number
 * @param recceEnabled - Whether to enable Recce features
 * @param promptOptions - Optional prompt customization
 * @returns Analysis result with PR metadata and summary
 */
export async function createAndAnalyzePR(
  recceMcpUrl: string,
  repoUrl: string,
  prNumber: number,
  recceEnabled = true,
  promptOptions?: AgentPromptOptions,
): Promise<PRAnalysisResult> {
  // Delegate to the new implementation
  return analyzePR(recceMcpUrl, repoUrl, prNumber, recceEnabled, promptOptions);
}

/**
 * Analyze a repository's current state (main branch)
 * Note: This mode does NOT use Recce as there is no base/current comparison.
 * It only provides GitHub/GitLab repository metadata and overview.
 *
 * @param _recceMcpUrl - Recce MCP URL (not used in this mode, kept for interface consistency)
 * @param repoUrl - Repository URL
 * @param options - Optional configuration
 * @returns Analysis result
 */
export async function analyzeMainBranch(
  _recceMcpUrl: string,
  repoUrl: string,
  options?: AgentPromptOptions,
): Promise<PRAnalysisResult> {
  const startTime = Date.now();

  // Parse repository URL
  const repoInfo = GitProviderResolver.parseGitUrl(repoUrl);
  const { provider, owner, repo, providerInstance } = repoInfo;

  // Get git token
  const gitToken = config.git.token;
  if (!gitToken) {
    throw new Error('Git token not found. Please set GIT_TOKEN environment variable.');
  }

  logInfo('📊 Repository Analysis Mode (Recce disabled)');
  logInfo(`   Repository: ${owner}/${repo}`);
  logInfo(`   Provider: ${provider}`);

  // Initialize logger
  const logTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = await createAgentLogger(
    {
      owner,
      repo,
      prNumber: 0, // No PR for main branch analysis
      githubToken: gitToken,
      recceEnabled: false,
      recceYamlPath: config.recce.yamlPath,
      executePresetChecks: false,
    },
    'main-branch-agent',
    logTimestamp,
  );

  // Log agent start
  logger.logSystemInit('main-branch-agent', config.claude.model, process.cwd());
  logger.logAgentStart({
    owner,
    repo,
    prNumber: 0,
    githubToken: gitToken,
    recceEnabled: false,
  });

  let restoreStderr: (() => void) | null = null;

  try {
    const promptBuilder = new PromptBuilder();

    // Build MCP configuration (only provider, no Recce)
    const providerMcpConfig = providerInstance.getMcpConfig(gitToken);
    const mcpServers = providerMcpConfig;

    logger.logMCPConfigBuilt(Object.keys(mcpServers));
    logInfo(`📋 MCP Servers configured: ${Object.keys(mcpServers).join(', ')}`);

    // Load slash commands if path provided
    let commandsSection = '';
    if (options?.promptCommandsPath) {
      try {
        const commands = loadSlashCommands(options.promptCommandsPath);
        if (commands.count > 0) {
          commandsSection = '\n\n' + formatCommandsForPrompt(commands);
          logInfo(`📝 Loaded ${commands.count} slash commands from ${commands.source}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logWarn(`⚠️  Failed to load slash commands: ${errorMsg}`);
      }
    }

    // Build system prompt for repo overview (or use custom if provided)
    if (options?.systemPrompt) {
      logInfo('⚙️  Using custom system prompt');
    }
    const defaultSystemPrompt = `You are a repository analysis assistant. Analyze the given repository and provide a comprehensive overview.

## Your Task
Fetch repository metadata and generate a structured overview including:
1. Repository information (description, stars, forks, language)
2. Recent activity (commits, contributors)
3. File structure and key files
4. README highlights

## Workflow
1. **Delegate to ${providerInstance.getContextSubagentName()} subagent**:
   - Fetch repository metadata
   - Get recent commits and contributors
   - Retrieve README content
   - Tag response: [${provider.toUpperCase()}-CONTEXT]

2. **Synthesize overview**:
   - Combine insights into markdown
   - Focus on high-level repository state
   - Highlight key information for new contributors

## Output Format
- Use clear markdown headers
- Keep overview concise but informative
- Include actionable insights`;

    const systemPrompt = options?.systemPrompt
      ? options.systemPrompt + commandsSection
      : defaultSystemPrompt + commandsSection;

    const userPrompt = options?.userPrompt ||
      `Analyze the repository at ${owner}/${repo} and provide a comprehensive overview.`;

    // Define subagents
    const contextSubagentName = providerInstance.getContextSubagentName();
    const agents = {
      [contextSubagentName]: promptBuilder.getProviderContextSubagent(provider),
    };

    logger.logger.info(`🤖 Subagents: ${Object.keys(agents).join(', ')}`);

    // Allowed tools for main branch analysis (only provider tools, no Recce)
    const allowedTools: string[] = [
      'mcp__github__get_file_contents',
      'mcp__github__list_commits',
      'mcp__github__search_code',
      'mcp__github__issue_read',
    ];

    // If showSystemPrompt is enabled, output the prompts and exit
    if (options?.showSystemPrompt) {
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

    // Return result
    return {
      pr: {
        owner,
        repo,
        number: 0,
        title: '',
        description: '',
        author: '',
        state: 'open',
        createdAt: '',
        updatedAt: '',
        url: repoUrl,
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
