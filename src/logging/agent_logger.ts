/**
 * Agent-specific logger using pino
 * Supports console output, main log file, and per-turn log files
 */

import pino from 'pino';
import type { AgentContext } from '../types/index.js';
import { config } from '../config.js';
import type { LogDestination } from './destinations.js';
import {
  createConsoleDestination,
  createAgentLogDestination,
  createSystemLogDestination,
} from './destinations.js';
import type { TurnData } from './formatters.js';
import {
  formatTurnSummary,
  formatTurnStart,
  formatTurnEnd,
  formatSystemInit,
  formatCompletionSummary,
  formatResultPreview,
  formatSectionHeader,
} from './formatters.js';

export interface TurnMetrics {
  tool_calls: number;
  tokens?: { input: number; output: number };
  duration_ms: number;
}

export interface AgentMetrics {
  total_turns: number;
  total_tokens: number;
  total_cost: number;
  elapsed_seconds: number;
  tool_call_count: number;
}

export interface AgentLogger {
  logger: pino.Logger;

  // Agent log methods (conversation flow)
  logAgentStart(context: AgentContext): void;
  logPromptsBuilt(systemPromptLength: number, userPromptLength: number): void;
  logAllowedTools(tools: string[]): void;
  logTurnStart(turn: number): void;
  logThinking(turn: number, text: string): void;
  logToolCall(turn: number, tool: string, args: unknown): void;
  logToolResult(turn: number, tool: string, success: boolean, result: unknown): void;
  logAssistantResponse(turn: number, text: string): void;
  logTurnEnd(turn: number, metrics: TurnMetrics): void;
  logResultReceived(resultPreview: string): void;
  logAgentComplete(metrics: AgentMetrics): void;

  // System log methods (infrastructure)
  logSystemInit(agentName: string, model: string, cwd: string): void;
  logEnvLoaded(vars: string[]): void;
  logMCPConfigBuilt(servers: string[]): void;
  logMCPConnectStart(server: string, config: unknown): void;
  logMCPConnectSuccess(server: string, toolCount: number, duration_ms: number): void;
  logMCPConnectFailed(server: string, error: string, details?: string): void;
  logToolsAvailable(total: number, byServer: Record<string, number>): void;
  logToolCallStart(tool: string, requestId: string): void;
  logToolCallSuccess(tool: string, requestId: string, duration_ms: number, resultSize: number): void;
  logToolCallSlow(tool: string, duration_ms: number, threshold_ms: number): void;
  logToolCallError(tool: string, error: string, details?: unknown): void;
  logMCPDisconnect(server: string, status: string): void;
  logError(context: string, error: Error): void;

  close(): void;
}

/**
 * Create agent logger with separate agent and system log destinations
 */
export async function createAgentLogger(
  context: AgentContext,
  agentName: string = 'agent',
  timestamp?: string,
): Promise<AgentLogger> {
  type PinoStreamEntry = {
    level: string;
    stream: NodeJS.WritableStream;
  };

  const destinations: LogDestination[] = [];

  // Console destination (with pino-pretty if enabled)
  const consoleDest = createConsoleDestination();
  destinations.push(consoleDest);

  // Agent log file destination (conversation flow)
  const agentLogDest = createAgentLogDestination(context, agentName, timestamp);
  destinations.push(agentLogDest);

  // System log file destination (infrastructure)
  const systemLogDest = createSystemLogDestination(agentName, timestamp);
  destinations.push(systemLogDest);

  // Console streams (with pino-pretty if enabled)
  let consoleStream: PinoStreamEntry;
  if (config.logging?.prettifyConsole) {
    try {
      const pinoPretty = await import('pino-pretty');
      const pinoPrettyStream = pinoPretty.default({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      });
      consoleStream = {
        level: config.debug ? 'debug' : 'info',
        stream: pinoPrettyStream,
      };
    } catch {
      console.warn('pino-pretty not available, using regular console');
      consoleStream = {
        level: config.debug ? 'debug' : 'info',
        stream: consoleDest.stream,
      };
    }
  } else {
    consoleStream = {
      level: config.debug ? 'debug' : 'info',
      stream: consoleDest.stream,
    };
  }

  // Create agent logger (writes to console + agent log file)
  const agentLoggerOptions: pino.LoggerOptions = {
    level: config.debug ? 'debug' : 'info',
    base: {
      owner: context.owner,
      repo: context.repo,
      prNumber: context.prNumber,
    },
  };

  const agentLogger = pino(
    agentLoggerOptions,
    pino.multistream([
      consoleStream,
      { level: 'info', stream: agentLogDest.stream },
    ])
  );

  // Create system logger (writes to console + system log file)
  const systemLogger = pino(
    agentLoggerOptions,
    pino.multistream([
      consoleStream,
      { level: 'info', stream: systemLogDest.stream },
    ])
  );

  // Helper to format result summary
  const formatResultSummary = (result: unknown): string => {
    if (typeof result === 'string') {
      return result.substring(0, 100);
    }
    return JSON.stringify(result).substring(0, 100);
  };

  // Create logger wrapper with all methods
  const loggerWrapper: AgentLogger = {
    get logger() {
      return agentLogger;
    },

    // Agent log methods (conversation flow)
    logAgentStart(context: AgentContext) {
      agentLogger.info({
        event: 'agent_start',
        agent: agentName,
        context: {
          owner: context.owner,
          repo: context.repo,
          prNumber: context.prNumber,
        },
      });
    },

    logPromptsBuilt(systemPromptLength: number, userPromptLength: number) {
      agentLogger.info({
        event: 'prompts_built',
        system_prompt_length: systemPromptLength,
        user_prompt_length: userPromptLength,
      });
    },

    logAllowedTools(tools: string[]) {
      agentLogger.info({
        event: 'allowed_tools',
        tools,
      });
    },

    logTurnStart(turn: number) {
      agentLogger.info({ event: 'turn_start', turn });
    },

    logThinking(turn: number, text: string) {
      agentLogger.info({ event: 'assistant_thinking', turn, text });
    },

    logToolCall(turn: number, tool: string, args: unknown) {
      agentLogger.info({ event: 'tool_call', turn, tool, args });
    },

    logToolResult(turn: number, tool: string, success: boolean, result: unknown) {
      agentLogger.info({
        event: 'tool_result',
        turn,
        tool,
        success,
        result_summary: formatResultSummary(result),
      });
    },

    logAssistantResponse(turn: number, text: string) {
      agentLogger.info({ event: 'assistant_response', turn, text });
    },

    logTurnEnd(turn: number, metrics: TurnMetrics) {
      agentLogger.info({ event: 'turn_end', turn, metrics });
    },

    logResultReceived(resultPreview: string) {
      agentLogger.info({
        event: 'result_received',
        result_preview: resultPreview.substring(0, 200),
      });
    },

    logAgentComplete(metrics: AgentMetrics) {
      agentLogger.info({ event: 'agent_complete', metrics });
    },

    // System log methods (infrastructure)
    logSystemInit(agentName: string, model: string, cwd: string) {
      systemLogger.info({
        event: 'system_init',
        agent: agentName,
        model,
        cwd,
      });
    },

    logEnvLoaded(vars: string[]) {
      systemLogger.info({ event: 'env_loaded', vars });
    },

    logMCPConfigBuilt(servers: string[]) {
      systemLogger.info({ event: 'mcp_config_built', servers });
    },

    logMCPConnectStart(server: string, config: unknown) {
      systemLogger.info({ event: 'mcp_connect_start', server, config });
    },

    logMCPConnectSuccess(server: string, toolCount: number, duration_ms: number) {
      systemLogger.info({
        event: 'mcp_connect_success',
        server,
        tools: toolCount,
        duration_ms,
      });
    },

    logMCPConnectFailed(server: string, error: string, details?: string) {
      systemLogger.error({
        event: 'mcp_connect_failed',
        server,
        error,
        details,
      });
    },

    logToolsAvailable(total: number, byServer: Record<string, number>) {
      systemLogger.info({
        event: 'tools_available',
        total,
        by_server: byServer,
      });
    },

    logToolCallStart(tool: string, requestId: string) {
      systemLogger.info({ event: 'tool_call_start', tool, request_id: requestId });
    },

    logToolCallSuccess(
      tool: string,
      requestId: string,
      duration_ms: number,
      resultSize: number
    ) {
      systemLogger.info({
        event: 'tool_call_success',
        tool,
        request_id: requestId,
        duration_ms,
        result_size: resultSize,
      });
    },

    logToolCallSlow(tool: string, duration_ms: number, threshold_ms: number) {
      systemLogger.warn({
        event: 'tool_call_slow',
        tool,
        duration_ms,
        threshold_ms,
      });
    },

    logToolCallError(tool: string, error: string, details?: unknown) {
      systemLogger.error({ event: 'tool_call_error', tool, error, details });
    },

    logMCPDisconnect(server: string, status: string) {
      systemLogger.info({ event: 'mcp_disconnect', server, status });
    },

    logError(context: string, error: Error) {
      systemLogger.error({
        event: 'error',
        context,
        error: error.message,
        stack: error.stack,
      });
    },

    close() {
      // Close all destinations
      destinations.forEach((dest) => {
        if (dest.close) {
          dest.close();
        }
      });
    },
  };

  return loggerWrapper;
}
