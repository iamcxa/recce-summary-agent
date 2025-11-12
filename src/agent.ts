/**
 * Main Agent - PR Analysis Orchestrator
 *
 * Uses Claude Agent SDK with subagent architecture:
 * - github-context: Fetches PR metadata and file changes
 * - recce-analysis: Analyzes dbt model changes using Recce MCP tools
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from './config.js';
import type { PRAnalysisResult } from './types/index.js';
import { createAgentLogger } from './logging/agent_logger.js';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ReccePresetService } from './recce/preset_service.js';
import { PromptBuilder } from './prompts/index.js';
import { ProviderFactory } from './providers/index.js';
import { TemplateFactory, type TemplateData } from './templates/index.js';

// ============================================================================
// MCP Server Configuration
// ============================================================================

/**
 * Build MCP server configuration using provider abstraction
 */
function buildMCPConfig(context: {
  owner: string;
  repo: string;
  prNumber: number;
}) {
  // Get provider instance
  const provider = ProviderFactory.create(config.provider);

  // Get the appropriate token based on provider
  const providerToken =
    config.provider === 'gitlab' ? config.gitlab.token : config.github.token;

  // Get provider-specific MCP config
  const providerMcpConfig = provider.getMcpConfig(providerToken);

  // Add Recce MCP Server (SSE)
  return {
    ...providerMcpConfig,
    recce: {
      type: 'sse' as const,
      url: 'http://0.0.0.0:8080/sse',
    },
  };
}

// ============================================================================
// Subagent Definitions - Retrieved from PromptBuilder
// ============================================================================
// Subagent configurations are now managed by PromptBuilder in src/prompts/index.ts
// This provides modularity and allows for provider-specific customization

// ============================================================================
// Main Agent Execution
// ============================================================================

export async function createAndAnalyzePR(
  owner: string,
  repo: string,
  prNumber: number,
  recceEnabled: boolean = true,
  githubToken: string = '',
): Promise<PRAnalysisResult> {
  const startTime = Date.now();

  // Get provider instance for generating URLs
  const provider = ProviderFactory.create(config.provider);

  // Build context
  const context = {
    owner,
    repo,
    prNumber,
    includeRecce: recceEnabled && config.recce.enabled,
  };

  // Load preset checks from recce.yml (if enabled)
  let presetChecks = null;
  let presetChecksPrompt = undefined;

  if (context.includeRecce && config.recce.executePresetChecks) {
    try {
      presetChecks = await ReccePresetService.loadPresetChecks(
        config.recce.yamlPath,
        config.recce.projectPath,
      );

      if (presetChecks && presetChecks.checks.length > 0) {
        presetChecksPrompt = ReccePresetService.formatForPrompt(presetChecks);
        console.log(
          `📋 Loaded ${presetChecks.checks.length} preset checks from recce.yml`,
        );
        console.log(`   ${ReccePresetService.getSummary(presetChecks)}`);
      }
    } catch (error) {
      console.warn(
        '⚠️  Failed to load preset checks:',
        (error as Error).message,
      );
      // Continue without preset checks
    }
  }

  // Initialize logger
  const logTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logger = await createAgentLogger(
    {
      owner,
      repo,
      prNumber,
      githubToken: githubToken || config.github.token,
      recceEnabled: context.includeRecce,
    },
    'main-agent',
    logTimestamp,
  );

  // Setup raw JSONL log
  const logDir = join(process.cwd(), 'logs');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  const rawLogPath = join(
    logDir,
    `${logTimestamp}-main-agent-${owner}-${repo}-pr-${prNumber}-raw.jsonl`,
  );
  writeFileSync(rawLogPath, '');

  // Log agent start
  logger.logSystemInit('main-agent', config.claude.model, process.cwd());
  logger.logAgentStart({ owner, repo, prNumber });

  try {
    // Initialize PromptBuilder
    const promptBuilder = new PromptBuilder();

    // Build configuration
    const mcpServers = buildMCPConfig(context);
    const systemPrompt = promptBuilder.buildSystemPrompt({
      provider: config.provider,
      features: config.features,
      userIntent: 'pr_analysis',
      owner,
      repo,
      prNumber,
      presetChecks: presetChecks, // Pass RecceYaml object, not formatted string
      outputFormat: config.outputFormat,
    });
    // Build user prompt
    const userPrompt = promptBuilder.buildUserPrompt({
      provider: config.provider,
      features: config.features,
      userIntent: 'pr_analysis',
      owner,
      repo,
      prNumber,
      presetChecks: presetChecks, // Pass RecceYaml object, not formatted string
      outputFormat: config.outputFormat,
    });

    // Log configuration
    logger.logMCPConfigBuilt(Object.keys(mcpServers));
    console.log(
      '📋 MCP Servers configured:',
      Object.keys(mcpServers).join(', '),
    );

    // Define subagents using PromptBuilder
    // Use provider-context subagent that adapts to the configured provider
    const contextSubagentName =
      config.provider === 'gitlab' ? 'gitlab-context' : 'github-context';

    const agents = {
      [contextSubagentName]: promptBuilder.getProviderContextSubagent(
        config.provider,
      ),
      ...(context.includeRecce && {
        'recce-analysis': promptBuilder.getRecceAnalysisSubagent(),
      }),
      ...(presetChecks &&
        presetChecks.checks.length > 0 && {
          'preset-check-executor':
            promptBuilder.getPresetCheckExecutorSubagent(),
        }),
    };

    logger.logger.info(`🤖 Subagents: ${Object.keys(agents).join(', ')}`);

    // Build allowed tools list - include all MCP tools that subagents need
    const allowedTools: string[] = [
      // Recce MCP tools (for recce-analysis and preset-check-executor subagents)
      'mcp__recce__get_lineage_diff',
      'mcp__recce__lineage_diff',
      'mcp__recce__schema_diff',
      'mcp__recce__row_count_diff',
      'mcp__recce__query',
      'mcp__recce__query_diff',
      'mcp__recce__profile_diff',
      // GitHub MCP tools (for github-context subagent)
      'mcp__github__get_pull_request',
      'mcp__github__get_pull_request_files',
      'mcp__github__get_pull_request_status',
      'mcp__github__get_pull_request_comments',
      'mcp__github__get_pull_request_reviews',
      'mcp__github__list_pull_requests',
      'mcp__github__search_issues',
      'mcp__github__search_code',
    ];

    // Execute agent with Claude SDK
    const result = query({
      prompt: userPrompt,
      options: {
        model: config.claude.model,
        systemPrompt,
        cwd: process.cwd(),
        maxTurns: 20,
        mcpServers: mcpServers as any,
        allowedTools, // Pre-grant permissions for all MCP tools
        agents, // Subagents with tool permissions
      },
    });

    // Process message stream
    let finalResult = '';
    let totalTokens = 0;
    let totalCost = 0;
    let turnCount = 0;
    let rawAgentData: any = {}; // Store structured data from subagents

    for await (const message of result) {
      // Log to raw JSONL
      appendFileSync(
        rawLogPath,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          type: message.type,
          data: message,
        }) + '\n',
      );

      if (message.type === 'system') {
        handleSystemMessage(message, logger);
      }

      if (message.type === 'assistant') {
        turnCount++;
        const assistantMsg = message as any;
        const content = assistantMsg.message?.content || [];

        logger.logTurnStart(turnCount);

        // Log text blocks (thinking)
        content
          .filter((c: any) => c.type === 'text')
          .forEach((block: any) => {
            if (block.text) {
              logger.logThinking(turnCount, block.text);
            }
          });

        // Log tool calls (subagent delegations)
        content
          .filter((c: any) => c.type === 'tool_use')
          .forEach((tc: any) => {
            logger.logToolCall(turnCount, tc.name, tc.input);
          });

        logger.logTurnEnd(turnCount, {
          tool_calls: content.filter((c: any) => c.type === 'tool_use').length,
          duration_ms: 0,
        });
      }

      if (message.type === 'result') {
        if (message.subtype === 'success') {
          finalResult =
            typeof message.result === 'string'
              ? message.result
              : JSON.stringify(message.result);

          totalTokens =
            ((message.usage as any)?.input_tokens || 0) +
            ((message.usage as any)?.output_tokens || 0);
          totalCost = (message as any).total_cost_usd || 0;

          logger.logResultReceived(finalResult.substring(0, 200));
        } else {
          throw new Error((message as any).error || 'Agent execution failed');
        }
      }
    }

    const elapsedSeconds = (Date.now() - startTime) / 1000;

    // Log completion
    logger.logAgentComplete({
      total_turns: turnCount,
      total_tokens: totalTokens,
      total_cost: totalCost,
      elapsed_seconds: elapsedSeconds,
      tool_call_count: turnCount,
    });

    logger.close();

    // Parse agent result to extract structured data
    // The finalResult from the agent is markdown summary, but we may have captured
    // structured data in rawAgentData if we implemented parsing in the message loop

    // For now, we'll use the agent's markdown output as-is since it already synthesizes
    // the data. In the future, we could parse [GITHUB-CONTEXT], [RECCE-ANALYSIS] tags
    // to extract structured data and pass to templates.

    // Apply template formatting if configured
    let formattedSummary = finalResult;

    if (config.outputFormat !== 'markdown') {
      // For non-markdown formats, we would need to parse the agent output
      // or restructure to capture structured data during agent execution
      // For now, log a warning and return markdown
      console.warn(
        `⚠️  Output format '${config.outputFormat}' requested but structured data parsing not yet implemented.`,
      );
      console.warn(
        `   Returning markdown format. To use templates, implement structured data extraction.`,
      );
    }

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
        url: provider.getPRUrl(owner, repo, prNumber),
      },
      diff: {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        changedFilesCount: 0,
      },
      summary: formattedSummary,
    };
  } catch (error) {
    logger.logError('agent_execution', error as Error);
    logger.close();
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function handleSystemMessage(message: any, logger: any): void {
  const tools = message.tools || [];

  // Group tools by server
  const byServer: Record<string, number> = {};
  tools.forEach((t: any) => {
    const match = t.name?.match(/^mcp__([^_]+)__/);
    if (match) {
      const server = match[1];
      byServer[server] = (byServer[server] || 0) + 1;
    }
  });

  logger.logToolsAvailable(tools.length, byServer);

  // Log MCP server connection status
  if (message.mcp_servers) {
    message.mcp_servers.forEach((srv: any) => {
      if (srv.status === 'connected') {
        const toolCount = byServer[srv.name] || 0;
        logger.logMCPConnectSuccess(srv.name, toolCount, 0);
      } else {
        // Enhanced error logging
        logger.logMCPConnectFailed(
          srv.name,
          srv.error || srv.status || 'Connection failed',
          JSON.stringify(srv, null, 2),
        );

        console.error(`❌ MCP Server '${srv.name}' failed to connect:`);
        console.error(`   Status: ${srv.status}`);
        if (srv.error) console.error(`   Error: ${srv.error}`);
        if (srv.message) console.error(`   Message: ${srv.message}`);
        if (srv.stderr) console.error(`   Stderr: ${srv.stderr}`);
        if (srv.stdout) console.error(`   Stdout: ${srv.stdout}`);

        if (config.debug) {
          console.error('   Full server object:', JSON.stringify(srv, null, 2));
        }
      }
    });

    // Console status summary
    const serverStatus = message.mcp_servers
      .map((srv: any) => {
        if (srv.status === 'connected') {
          return `   • ${srv.name}: ✅ ${srv.status}`;
        } else {
          return `   • ${srv.name}: ❌ ${srv.status}`;
        }
      })
      .join('\n');
    logger.logger.info(`🔌 MCP Servers:\n${serverStatus}`);
  }
}

// Export types for external use
export type { PRAnalysisResult } from './types/index.js';
