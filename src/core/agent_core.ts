/**
 * Agent Core - Main execution engine with dependency injection
 * Integrates PromptBuilder, LifecycleManager, Logger, and Provider
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { config } from "../config.js";
import { AgentContext, PRAnalysisResult } from "../types/index.js";
import { PromptBuilder } from "../prompts/index.js";
import { LifecycleManager } from "./lifecycle.js";
import { AgentLogger } from "../logging/agent_logger.js";
import { Provider } from "../types/providers.js";
import { AgentMetrics } from "../types/hooks.js";

export interface AgentOptions {
  maxTurns?: number;
  timeout?: number;
}

export class AgentCore {
  private promptBuilder: PromptBuilder;
  private lifecycle: LifecycleManager;
  private logger: AgentLogger;
  private provider: Provider;
  private context: AgentContext;
  private options: Required<AgentOptions>;

  constructor(
    context: AgentContext,
    promptBuilder: PromptBuilder,
    lifecycle: LifecycleManager,
    logger: AgentLogger,
    provider: Provider,
    options: AgentOptions = {}
  ) {
    this.context = context;
    this.promptBuilder = promptBuilder;
    this.lifecycle = lifecycle;
    this.logger = logger;
    this.provider = provider;
    this.options = {
      maxTurns: options.maxTurns || 20,
      timeout: options.timeout || 300000, // 5 minutes
    };
  }

  /**
   * Execute the agent analysis
   */
  async execute(): Promise<PRAnalysisResult> {
    const startTime = Date.now();
    let finalResult = "";
    let totalTokens = 0;
    let totalCost = 0;
    let turnCount = 0;
    let toolCallCount = 0;

    try {
      // 1. Emit onStart hook
      await this.lifecycle.emitStart(this.context);
      this.logger.logger.info("Starting PR analysis with Agent Core");

      // 2. Build prompts
      const { system, user, metadata } = this.promptBuilder.build();
      await this.lifecycle.emitPromptAssembly(system, user);
      this.logger.logger.debug({ metadata }, "Prompts assembled");

      // 3. Build MCP server config (combine provider + recce)
      const mcpServers = this.buildMCPServerConfig();

      // 4. Build subagents
      const agents = this.buildSubagents();

      // 5. Initialize JSONL log file
      const logFilePath = join(process.cwd(), "agent_log.jsonl");
      writeFileSync(logFilePath, "");
      const appendLog = (data: any) => {
        const line = JSON.stringify({
          timestamp: new Date().toISOString(),
          ...data,
        }) + "\n";
        appendFileSync(logFilePath, line);
      };

      appendLog({
        event: "agent_start",
        context: {
          owner: this.context.owner,
          repo: this.context.repo,
          prNumber: this.context.prNumber,
        },
      });

      // 6. Run agent with Claude Agent SDK
      const result = query({
        prompt: user,
        options: {
          model: config.claude.model,
          systemPrompt: system,
          cwd: process.cwd(),
          maxTurns: this.options.maxTurns,
          settingSources: ["local", "project"] as const,
          mcpServers: mcpServers as any,
          agents: agents as any,
          allowedTools: ["mcp__recce"],
        },
      });

      // 7. Process agent loop
      for await (const message of result) {
        // Log to JSONL
        appendLog({
          event: "message_received",
          type: message.type,
          subtype: (message as any).subtype,
          data: message,
        });

        // Handle system messages
        if (message.type === "system") {
          await this.handleSystemMessage(message);
        }

        // Handle user messages
        if (message.type === "user") {
          await this.handleUserMessage(message);
        }

        // Handle assistant messages (turns)
        if (message.type === "assistant") {
          turnCount++;
          await this.lifecycle.emitTurnStart(turnCount, message);
          this.logger.startTurn(turnCount);

          const assistantMsg = message as any;
          const content = assistantMsg.message?.content || [];
          const toolCalls = content.filter((c: any) => c.type === "tool_use") || [];
          const textBlocks = content.filter((c: any) => c.type === "text") || [];

          // Extract thinking
          const thinking: string[] = [];
          for (const textBlock of textBlocks) {
            const text = (textBlock.text || "").trim();
            if (text.length > 0) {
              thinking.push(text);
              this.logger.logThinking(text);
            }
          }

          // Process tool calls
          for (const toolCall of toolCalls) {
            toolCallCount++;
            await this.lifecycle.emitToolCall(toolCall.name, toolCall.input);
            this.logger.logToolCall(toolCall.name, toolCall.input);
          }

          // Log turn summary
          this.logger.logTurn({
            turn: turnCount,
            message: assistantMsg,
            toolCalls: toolCalls.map((tc: any) => ({
              name: tc.name,
              args: tc.input,
            })),
            thinking,
            timestamp: new Date().toISOString(),
          });

          await this.lifecycle.emitTurnEnd(turnCount, message);
          this.logger.endTurn();
        }

        // Handle tool progress
        if (message.type === "tool_progress") {
          const toolName = (message as any).tool_name || "unknown";
          const status = (message as any).status || "processing";
          this.logger.logger.info({ tool: toolName, status }, "Tool progress");
        }

        // Handle final result
        if (message.type === "result") {
          if (message.subtype === "success") {
            finalResult =
              typeof message.result === "string"
                ? message.result
                : JSON.stringify(message.result);
            totalTokens = message.usage?.total_tokens || 0;
            totalCost = message.total_cost_usd || 0;

            const elapsedTime = (Date.now() - startTime) / 1000;
            const metrics: AgentMetrics = {
              totalTurns: turnCount,
              totalTokens,
              totalCost,
              elapsedSeconds: elapsedTime,
              toolCallCount,
            };

            // Log completion with formatted summary
            this.logger.logCompletion(metrics);
            await this.lifecycle.emitComplete(finalResult, metrics);

            // Write summary file
            const summaryFilePath = join(process.cwd(), 'summary.md');
            writeFileSync(summaryFilePath, finalResult);
            this.logger.logger.info(`\n💾 Summary written to: ${summaryFilePath}`);

            // Log result preview
            this.logger.logResultPreview(finalResult);

            appendLog({ event: "agent_complete", elapsedSeconds: elapsedTime });
          } else {
            const error = new Error((message as any).error || 'Unknown error');
            await this.lifecycle.emitError(error, { turnCount, message });
            this.logger.logSection('Analysis Failed', '❌');
            this.logger.logger.error(
              { error: error.message, turnCount },
              `Status: ${message.subtype}`,
            );
          }
        }
      }

      // 8. Cleanup
      this.logger.close();

      // 9. Return result
      return this.buildResult(finalResult);
    } catch (error) {
      await this.lifecycle.emitError(error as Error, { context: this.context });
      this.logger.logger.error({ error }, "PR analysis pipeline failed");
      throw error;
    }
  }

  /**
   * Handle system message
   */
  private async handleSystemMessage(message: any): Promise<void> {
    const recceTools = message.tools
      ? message.tools.filter((t: string) => t.startsWith('mcp__recce__'))
      : [];

    this.logger.logSystemInit(
      message.model || 'unknown',
      message.tools?.length || 0,
      recceTools.length,
    );

    if (message.mcp_servers) {
      const serverStatus = message.mcp_servers
        .map((srv: any) => `   • ${srv.name}: ${srv.status}`)
        .join('\n');
      this.logger.logger.info(`\n🔌 MCP Servers:\n${serverStatus}`);
    }
  }

  /**
   * Handle user message
   */
  private async handleUserMessage(message: any): Promise<void> {
    const userData = message as any;
    const msgContent = userData.message?.content || [];

    this.logger.logSection(
      userData.subagent_type
        ? `User Message [${userData.subagent_type}]`
        : 'User Message',
      '📝',
    );

    // Log tool results in debug mode
    if (config.debug) {
      for (const item of msgContent) {
        if (item.type === 'tool_result') {
          this.logger.logger.debug(
            { toolUseId: item.tool_use_id },
            '🔧 Tool result received',
          );
        } else if (item.type === 'text') {
          this.logger.logger.debug('📄 User text received');
        }
      }
    }
  }

  /**
   * Build MCP server configuration
   */
  private buildMCPServerConfig(): Record<string, unknown> {
    const configs: Record<string, unknown> = {};

    // Add Recce MCP server
    if (this.context.recceEnabled) {
      configs.recce = {
        type: "stdio",
        command: "recce",
        args: ["mcp-server"],
      };
    }

    // Add provider-specific MCP config
    const providerMcpConfig = this.provider.getMcpConfig();
    Object.assign(configs, providerMcpConfig);

    return configs;
  }

  /**
   * Build subagents configuration
   */
  private buildSubagents(): Record<string, unknown> {
    const agents: Record<string, unknown> = {};

    // Recce validation subagent
    if (this.context.recceEnabled) {
      agents["recce-validation"] = {
        description: "Recce MCP tool operations - analyze data changes using row_count_diff, profile_diff, and get_lineage_diff",
        prompt: `You are a data quality specialist with access to Recce MCP tools.

IMPORTANT: Start your response with [RECCE-VALIDATION] so logs can track which subagent is being used.

Your role is to:
1. Use Recce MCP tools to analyze dbt model changes:
   - get_lineage_diff: Identify which models were added, removed, or modified
   - row_count_diff: Compare row counts between baseline (target-base/) and current (target/)
   - profile_diff: Analyze column statistics changes
2. Detect data anomalies and quality issues
3. Assess data impact and risk level
4. Provide insights on data quality implications

Focus exclusively on Recce MCP analysis using the available tools. Do not fetch GitHub data - that's handled by another subagent.`,
        tools: ["mcp__recce"],
      };
    }

    // Provider-specific subagent
    const providerSubagentName = `${this.provider.type}-context`;
    agents[providerSubagentName] = {
      description: `${this.provider.name} PR operations - fetch PR metadata, files, and dbt model changes`,
      prompt: `You are a ${this.provider.name} specialist. When asked, fetch PR information and identify dbt model changes.

Context:
- Repository: ${this.context.owner}/${this.context.repo}
- PR Number: ${this.context.prNumber}

IMPORTANT: Start your response with [${this.provider.name.toUpperCase()}-CONTEXT] so logs can track which subagent is being used.

Your role is to:
1. Use ${this.provider.name} APIs to fetch PR metadata (title, description, author, state, timestamps)
2. Identify all files changed in the PR
3. Extract dbt-specific changes (SQL files in models/, schema.yml, dbt_project.yml, etc.)
4. Classify changes as added, removed, or modified
5. Return structured information about dbt model changes

Focus exclusively on ${this.provider.name} operations. Do not attempt Recce analysis - that's handled by another subagent.`,
    };

    return agents;
  }

  /**
   * Build result object
   */
  private buildResult(summary: string): PRAnalysisResult {
    return {
      pr: {
        owner: this.context.owner,
        repo: this.context.repo,
        number: this.context.prNumber,
        title: "PR Analysis",
        description: "",
        author: "unknown",
        state: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        url: `https://${this.provider.type}.com/${this.context.owner}/${this.context.repo}/pull/${this.context.prNumber}`,
      },
      diff: {
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
        changedFilesCount: 0,
      },
      dbtChanges: {
        added: [],
        removed: [],
        modified: [],
        dependencies: {},
      },
      dataProfiles: [],
      validationChecks: [],
      summary,
    };
  }
}

