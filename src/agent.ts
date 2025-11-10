/**
 * Main Claude Agent using the Agent SDK
 *
 * This agent uses the Claude Agent SDK's query() function to:
 * 1. Fetch PR information from GitHub
 * 2. Identify dbt model changes
 * 3. Call Recce MCP tools to analyze data changes
 * 4. Generate a comprehensive markdown summary
 *
 * The agent loop is handled by the SDK, allowing Claude to decide
 * which tools to call and when to stop.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { config } from "./config.js";
import { logger } from "./logger.js";
import {
  AgentContext,
  PRAnalysisResult,
} from "./types/index.js";

export interface AgentOptions {
  maxTurns?: number;
  timeout?: number;
}

export class PRAnalysisAgent {
  private context: AgentContext;
  private options: Required<AgentOptions>;

  constructor(context: AgentContext, options: AgentOptions = {}) {
    this.context = context;
    this.options = {
      maxTurns: options.maxTurns || 20,
      timeout: options.timeout || 300000, // 5 minutes
    };

    logger.info("PR Analysis Agent initialized (Agent SDK)", {
      owner: context.owner,
      repo: context.repo,
      prNumber: context.prNumber,
      model: config.claude.model,
    });
  }

  /**
   * Execute the PR analysis using the Claude Agent SDK
   */
  async analyze(): Promise<PRAnalysisResult> {
    const startTime = Date.now();
    logger.info("Starting PR analysis with Claude Agent SDK");

    try {
      // Build the analysis prompt
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt();

      logger.debug("Analysis prompt prepared", {
        owner: this.context.owner,
        repo: this.context.repo,
        prNumber: this.context.prNumber,
      });

      // Run the agent with Claude Agent SDK
      let finalResult = "";
      let totalTokens = 0;
      let totalCost = 0;

      const result = query({
        prompt: userPrompt,
        options: {
          model: config.claude.model,
          systemPrompt,
          cwd: process.cwd(),
          maxTurns: this.options.maxTurns,
          settingSources: ["local", "project"] as const,
          // Configure MCP servers for Recce tools
          mcpServers: this.buildMCPServerConfig() as any,
          // Define subagents for context isolation
          agents: this.buildSubagents() as any,
          allowedTools: ["mcp__recce"],
        },
      });

      // Initialize message log file (JSONL format)
      const logFilePath = join(process.cwd(), "agent_log.jsonl");
      writeFileSync(logFilePath, ""); // Clear previous log

      // Helper function to append JSONL
      const appendLog = (data: any) => {
        const line = JSON.stringify({
          timestamp: new Date().toISOString(),
          ...data,
        }) + "\n";
        appendFileSync(logFilePath, line);
      };

      appendLog({ event: "agent_start", context: { owner: this.context.owner, repo: this.context.repo, prNumber: this.context.prNumber } });

      // Process the agent loop
      let turnCount = 0;
      for await (const message of result) {
        // Log message immediately to JSONL
        appendLog({
          event: "message_received",
          type: message.type,
          subtype: (message as any).subtype,
          data: message,
        });
        // Log system messages (initialization)
        if (message.type === "system") {
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          logger.info("🤖 AGENT SYSTEM INITIALIZED");
          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          logger.info(`Model: ${(message as any).model}`);
          const sysData = (message as any);
          if (sysData.tools) {
            const recceTools = sysData.tools.filter((t: string) => t.startsWith("mcp__recce__"));
            logger.info(`Available Tools: ${sysData.tools.length} total`);
            logger.info(`Recce MCP Tools: ${recceTools.length}`);
            if (recceTools.length > 0) {
              recceTools.forEach((tool: string) => {
                logger.info(`  ✓ ${tool}`);
              });
            }
          }
          if (sysData.mcp_servers) {
            logger.info(`MCP Servers Connected:`);
            sysData.mcp_servers.forEach((srv: any) => {
              logger.info(`  ✓ ${srv.name}: ${srv.status}`);
            });
          }
        }

        // Log user messages (input)
        if (message.type === "user") {
          const userData = (message as any);
          const msgContent = userData.message?.content || [];

          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          if (userData.subagent_type) {
            logger.info(`📝 USER MESSAGE [subagent: ${userData.subagent_type}]`);
          } else {
            logger.info("📝 USER MESSAGE");
          }          

          // Print each content item
          for (const item of msgContent) {
            if (item.type === "tool_result") {
              const toolContent = item.content;
              logger.info(`👤 USER (tool_result): ${typeof toolContent === 'string' ? toolContent.substring(0, 100) : JSON.stringify(toolContent).substring(0, 100)}${typeof toolContent === 'string' && toolContent.length > 100 ? "..." : ""}`);
              logger.info(`Tool Result: ${item.tool_use_id}`);
              logger.info(`Content: ${toolContent}`);
            } else if (item.type === "text") {
              const textContent = item.text;
              logger.info(`👤 USER (text): ${textContent.substring(0, 100)}${textContent.length > 100 ? "..." : ""}`);
              logger.info(`Text: ${textContent}`);
            } else {
              logger.info(`${item.type}: ${JSON.stringify(item).substring(0, 200)}`);
            }
          }
        }

        // Log assistant messages (Claude's response/reasoning)
        if (message.type === "assistant") {
          turnCount++;
          const assistantMsg = message as any;
          const content = assistantMsg.message?.content || [];

          // Count tool uses
          const toolCalls = content.filter((c: any) => c.type === "tool_use") || [];
          const textBlocks = content.filter((c: any) => c.type === "text") || [];

          logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
          if (assistantMsg.subagent_type) {
            logger.info(`💭 AGENT TURN ${turnCount}: CLAUDE THINKING [subagent: ${assistantMsg.subagent_type}]`);
          } else {
            logger.info(`💭 AGENT TURN ${turnCount}: CLAUDE THINKING`);
          }

          // Detect subagent usage from response text
          let subagentTag = "";
          for (const textBlock of textBlocks) {
            const text = (textBlock.text || "").trim();
            if (text.includes("[GITHUB-CONTEXT]")) {
              subagentTag = "🌐 [GITHUB-CONTEXT]";
              break;
            } else if (text.includes("[RECCE-VALIDATION]")) {
              subagentTag = "📊 [RECCE-VALIDATION]";
              break;
            }
          }

          // Show Claude's reasoning
          for (const textBlock of textBlocks) {
            const text = (textBlock.text || "").trim();
            if (text.length > 0) {
              const thinkingPrefix = subagentTag ? `${subagentTag} ` : "";
              logger.info(`📌 Claude's Thinking: ${thinkingPrefix}${text.substring(0, 400)}${text.length > 400 ? "...[truncated]" : ""}`);
            }
          }

          // Show tool calls
          if (toolCalls.length > 0) {
            logger.info(`🔧 Claude will call ${toolCalls.length} tool(s):`);
            for (const toolCall of toolCalls) {
              logger.info(`  └─ ${toolCall.name}`);
              const inputStr = JSON.stringify(toolCall.input, null, 2);
              const preview = inputStr.substring(0, 200);
              logger.info(`     Input: ${preview}${inputStr.length > 200 ? "...[truncated]" : ""}`);
            }
          }
        }

        // Log tool progress
        if (message.type === "tool_progress") {
          const toolName = (message as any).tool_name || "unknown";
          const status = (message as any).status || "processing";
          logger.info(`⏳ Tool Progress: ${toolName} - ${status}`);
        }

        // Log final result
        if (message.type === "result") {
          // Extract the final result
          if (message.subtype === "success") {
            finalResult =
              typeof message.result === "string"
                ? message.result
                : JSON.stringify(message.result);
            totalTokens = message.usage?.total_tokens || 0;
            totalCost = message.total_cost_usd || 0;

            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            logger.info("✅ AGENT ANALYSIS COMPLETED SUCCESSFULLY");
            logger.info(`Total Turns: ${turnCount}`);
            logger.info(`Tokens Used: ${totalTokens}`);
            logger.info(`Estimated Cost: $${totalCost.toFixed(4)}`);
            logger.info(`Result Size: ${finalResult.length} characters`);

            logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");            
            logger.info("📄 GENERATED SUMMARY PREVIEW:");
            logger.info(finalResult.substring(0, 800) + (finalResult.length > 800 ? "\n\n...[truncated - full summary available in output]" : ""));
          } else {
            logger.warn("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");            
            logger.warn("\n❌ AGENT ANALYSIS FAILED");
            logger.warn(`Status: ${message.subtype}`);
            logger.warn(`Total Turns: ${turnCount}`);
            if ((message as any).error) {
              logger.warn(`Error: ${(message as any).error}`);
            }
          }
        }
      }

      const elapsedTime = (Date.now() - startTime) / 1000;
      logger.info(`PR analysis completed in ${elapsedTime}s`);

      // Write final summary to summary.md
      const summaryFilePath = join(process.cwd(), "summary.md");
      writeFileSync(summaryFilePath, finalResult);
      logger.info(`📄 Summary written to: ${summaryFilePath}`);

      // Final log event
      appendLog({ event: "agent_complete", elapsedSeconds: elapsedTime });
      logger.info(`📋 Agent message log written to: ${logFilePath}`);

      // Parse and return the result
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
          url: `https://github.com/${this.context.owner}/${this.context.repo}/pull/${this.context.prNumber}`,
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
        summary: finalResult,
      };
    } catch (error) {
      logger.error("PR analysis pipeline failed", error);
      throw error;
    }
  }

  /**
   * Build the system prompt for the agent
   */
  private buildSystemPrompt(): string {
    return `You are an expert data engineer specializing in dbt and data quality analysis.

Your role is to orchestrate dbt model change analysis by delegating to specialized subagents.

IMPORTANT - PERMISSION RESTRICTION:
Recce MCP tools are ONLY accessible through the 'recce-validation' subagent. You do NOT have direct access to them.

AVAILABLE SUBAGENTS:
1. 'recce-validation': Has exclusive access to Recce MCP tools
   - mcp__recce__get_lineage_diff: Identify added/removed/modified models
   - mcp__recce__row_count_diff: Compare row counts (target/ vs target-base/)
   - mcp__recce__profile_diff: Analyze column statistics changes
   - mcp__recce__query: Execute queries
   - mcp__recce__query_diff: Compare query results

2. 'github-context': For GitHub PR operations (if needed)

WORKFLOW - YOU MUST DELEGATE:
1. Delegate to 'recce-validation' subagent to analyze dbt model changes
2. Receive its findings with [RECCE-VALIDATION] tag
3. Synthesize insights into professional markdown summary
4. Include: Overview, dbt Changes, Data Insights, Risk Assessment, Quality, Recommendations

CRITICAL: Always delegate Recce analysis to 'recce-validation' subagent. Do not attempt direct tool calls.`;
  }

  /**
   * Build the user prompt for the analysis task
   */
  private buildUserPrompt(): string {
//     return `Analyze dbt model changes and generate a comprehensive data quality summary.

// **Context:**
// - dbt compiled models in: target/ (current) and target-base/ (baseline)
// - Recce MCP tools are available through 'recce-validation' subagent only

// **REQUIRED ANALYSIS STEPS (use subagent delegation):**
// YOU MUST delegate the following analysis to the @agent-recce-validation:
// 1. Use mcp__recce__get_lineage_diff to identify model changes
// 2. Use mcp__recce__row_count_diff to analyze row count differences
// 3. Use mcp__recce__profile_diff for key modified models to analyze column changes
// 4. Synthesize findings into comprehensive markdown

// **How to delegate:**
// Ask the @agent-recce-validation to:
// - Identify all dbt models that were added, removed, or modified
// - Compare row counts between target-base/ (baseline) and target/ (current)
// - Analyze column statistics for key models
// - Detect data anomalies and quality issues

// **Output Format (final synthesis):**
// Generate a professional markdown document with:
// 1. Overview - Analysis scope and key findings
// 2. dbt Model Changes - Added/removed/modified models with counts
// 3. Data Insights - Row count changes (current vs baseline), percentages, direction (📈/📉)
// 4. Risk Assessment - Risk level (LOW/MEDIUM/HIGH) with factors
// 5. Data Quality - Anomalies and warnings detected
// 6. Actionable Recommendations - Next steps for reviewers`;
    return 'Use @agent-recce-validation to analyze dbt model changes and generate a comprehensive data quality summary as per the specified analysis steps and output format.';
  }

  /**
   * Build MCP server configuration for Recce
   */
  private buildMCPServerConfig(): Record<string, unknown> {
    // Configure Recce MCP server
    // The server should be running at: recce mcp-server
    return {
      recce: {
        type: "stdio",
        command: "recce",
        args: ["mcp-server"],
      },
    };
  }

  /**
   * Build subagents with isolated context
   */
  private buildSubagents(): Record<string, unknown> {
    return {
      "github-context": {
        description: "GitHub PR operations - fetch PR metadata, files, and dbt model changes",
        prompt: `You are a GitHub specialist. When asked, fetch PR information and identify dbt model changes.

Context:
- Repository: ${this.context.owner}/${this.context.repo}
- PR Number: ${this.context.prNumber}

IMPORTANT: Start your response with [GITHUB-CONTEXT] so logs can track which subagent is being used.

Your role is to:
1. Use GitHub APIs to fetch PR metadata (title, description, author, state, timestamps)
2. Identify all files changed in the PR
3. Extract dbt-specific changes (SQL files in models/, schema.yml, dbt_project.yml, etc.)
4. Classify changes as added, removed, or modified
5. Return structured information about dbt model changes

Focus exclusively on GitHub operations. Do not attempt Recce analysis - that's handled by another subagent.`,
      },
      "recce-validation": {
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
        tools: [
          "mcp__recce",
        ],
      },
    };
  }
}

/**
 * Create and execute a PR analysis agent
 */
export async function createAndAnalyzePR(
  owner: string,
  repo: string,
  prNumber: number,
  recceEnabled: boolean = true,
  githubToken: string = ""
): Promise<PRAnalysisResult> {
  const context: AgentContext = {
    owner,
    repo,
    prNumber,
    githubToken: githubToken || config.github.token,
    recceEnabled,
  };

  const agent = new PRAnalysisAgent(context);
  return agent.analyze();
}
