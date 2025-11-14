/**
 * Agent execution module
 * Handles Claude Agent SDK query execution and message stream processing
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { AgentLogger } from '../logging/agent_logger.js';
import { config } from '../config.js';
import { handleSystemMessage } from './message-handler.js';

export interface AgentExecutionOptions {
  userPrompt: string;
  systemPrompt: string;
  mcpServers: Record<string, any>;
  allowedTools: string[];
  agents: Record<string, any>;
  logger: AgentLogger;
}

export interface AgentExecutionResult {
  summary: string;
  turnCount: number;
  totalTokens: number;
  totalCost: number;
  elapsedSeconds: number;
}

/**
 * Execute agent with Claude SDK and process message stream
 *
 * @param options - Agent execution configuration
 * @param startTime - Execution start timestamp for metrics
 * @returns Execution result with summary and metrics
 */
export async function executeAgent(
  options: AgentExecutionOptions,
  startTime: number,
): Promise<AgentExecutionResult> {
  const { userPrompt, systemPrompt, mcpServers, allowedTools, agents, logger } = options;

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

  for await (const message of result) {
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
          typeof message.result === 'string' ? message.result : JSON.stringify(message.result);

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

  return {
    summary: finalResult,
    turnCount,
    totalTokens,
    totalCost,
    elapsedSeconds,
  };
}

/**
 * Suppress Agent SDK verbose logging if not in debug mode
 * Returns a cleanup function to restore original stderr
 */
export function suppressSDKLogging(): (() => void) | null {
  if (config.debug) {
    return null;
  }

  const originalStderrWrite = process.stderr.write;
  process.stderr.write = ((chunk: any, encoding?: any, callback?: any) => {
    const str = chunk.toString();
    // Filter out SDK debug messages and spawn messages
    if (
      !str.includes('[DEBUG]') &&
      !str.includes('Spawning Claude Code process') &&
      !str.includes('[ERROR]')
    ) {
      return originalStderrWrite.call(process.stderr, chunk, encoding, callback);
    }
    if (typeof callback === 'function') callback();
    return true;
  }) as typeof process.stderr.write;

  // Return cleanup function
  return () => {
    process.stderr.write = originalStderrWrite;
  };
}
