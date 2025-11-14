/**
 * Agent-specific logger using pino with multistream support
 * Outputs to three destinations:
 * 1. Console - Custom formatted output for real-time monitoring
 * 2. logs/recce-agent-raw.jsonl - Raw JSONL for machine processing
 * 3. logs/recce-agent.log - Human-readable format for debugging
 */

import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';
import pino from 'pino';
import { config } from '../config.js';
import type { AgentContext } from '../types/index.js';

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
  logToolResult(
    turn: number,
    tool: string,
    success: boolean,
    result: unknown,
  ): void;
  logAssistantResponse(turn: number, text: string): void;
  logTurnEnd(turn: number, metrics: TurnMetrics): void;
  logResultReceived(resultPreview: string): void;
  logAgentComplete(metrics: AgentMetrics): void;

  // System log methods (infrastructure)
  logSystemInit(agentName: string, model: string, cwd: string): void;
  logEnvLoaded(vars: string[]): void;
  logMCPConfigBuilt(servers: string[]): void;
  logMCPConnectStart(server: string, config: unknown): void;
  logMCPConnectSuccess(
    server: string,
    toolCount: number,
    duration_ms: number,
  ): void;
  logMCPConnectFailed(server: string, error: string, details?: string): void;
  logToolsAvailable(total: number, byServer: Record<string, number>): void;
  logToolCallStart(tool: string, requestId: string): void;
  logToolCallSuccess(
    tool: string,
    requestId: string,
    duration_ms: number,
    resultSize: number,
  ): void;
  logToolCallSlow(
    tool: string,
    duration_ms: number,
    threshold_ms: number,
  ): void;
  logToolCallError(tool: string, error: string, details?: unknown): void;
  logMCPDisconnect(server: string, status: string): void;
  logError(context: string, error: Error): void;

  close(): void;
}

/**
 * Create agent logger with multistream support
 * Automatically writes to console, raw JSONL, and human-readable log files
 */
export async function createAgentLogger(
  context: AgentContext,
  agentName = 'agent',
  _timestamp?: string,
): Promise<AgentLogger> {
  // Ensure logs directory exists
  const logsDir = 'logs';
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const formatter = createCustomFormatter();
  const readableFormatter = createReadableFormatter();

  // Stream 1: Console with custom formatter
  const consoleStream = new (class extends Writable {
    _write(chunk: Buffer, _encoding: string, callback: () => void) {
      try {
        const obj = JSON.parse(chunk.toString());
        const formatted = formatter(obj);
        process.stdout.write(`${formatted}\n`);
      } catch {
        process.stdout.write(chunk);
      }
      callback();
    }
  })();

  // Stream 2: Raw JSONL file (always at debug level for complete logs)
  const rawLogStream = fs.createWriteStream(
    path.join(logsDir, 'recce-agent-raw.jsonl'),
    { flags: 'a' },
  );

  // Stream 3: Human-readable log file (always at debug level for complete logs)
  const readableLogStream = new (class extends Writable {
    _write(chunk: Buffer, _encoding: string, callback: () => void) {
      try {
        const obj = JSON.parse(chunk.toString());
        const formatted = readableFormatter(obj);
        fs.appendFileSync(
          path.join(logsDir, 'recce-agent.log'),
          `${formatted}\n`,
        );
      } catch (error) {
        // Silent fail for log formatting errors
      }
      callback();
    }
  })();

  // Create multistream with different log levels per destination
  const streams = [
    { level: config.debug ? 'debug' : 'info', stream: consoleStream },
    { level: 'debug', stream: rawLogStream }, // Always log everything to file
    { level: 'debug', stream: readableLogStream }, // Always log everything to file
  ];

  // Create logger options
  const loggerOptions: pino.LoggerOptions = {
    level: 'debug', // Set to debug to capture all events
    base: {
      owner: context.owner,
      repo: context.repo,
      prNumber: context.prNumber,
    },
  };

  // Create logger with multistream
  const logger = pino(loggerOptions, pino.multistream(streams));

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
      return logger;
    },

    // Agent log methods (conversation flow)
    logAgentStart(context: AgentContext) {
      logger.info({
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
      logger.info({
        event: 'prompts_built',
        system_prompt_length: systemPromptLength,
        user_prompt_length: userPromptLength,
      });
    },

    logAllowedTools(tools: string[]) {
      logger.info({
        event: 'allowed_tools',
        tools,
      });
    },

    logTurnStart(turn: number) {
      logger.info({ event: 'turn_start', turn });
    },

    logThinking(turn: number, text: string) {
      logger.info({ event: 'assistant_thinking', turn, text });
    },

    logToolCall(turn: number, tool: string, args: unknown) {
      logger.info({ event: 'tool_call', turn, tool, args });
    },

    logToolResult(
      turn: number,
      tool: string,
      success: boolean,
      result: unknown,
    ) {
      logger.info({
        event: 'tool_result',
        turn,
        tool,
        success,
        result_summary: formatResultSummary(result),
      });
    },

    logAssistantResponse(turn: number, text: string) {
      logger.info({ event: 'assistant_response', turn, text });
    },

    logTurnEnd(turn: number, metrics: TurnMetrics) {
      logger.info({ event: 'turn_end', turn, metrics });
    },

    logResultReceived(resultPreview: string) {
      logger.info({
        event: 'result_received',
        result_preview: resultPreview.substring(0, 200),
      });
    },

    logAgentComplete(metrics: AgentMetrics) {
      logger.info({ event: 'agent_complete', metrics });
    },

    // System log methods (infrastructure)
    logSystemInit(agentName: string, model: string, cwd: string) {
      logger.info({
        event: 'system_init',
        agent: agentName,
        model,
        cwd,
      });
    },

    logEnvLoaded(vars: string[]) {
      logger.info({ event: 'env_loaded', vars });
    },

    logMCPConfigBuilt(servers: string[]) {
      logger.info({ event: 'mcp_config_built', servers });
    },

    logMCPConnectStart(server: string, config: unknown) {
      logger.info({ event: 'mcp_connect_start', server, config });
    },

    logMCPConnectSuccess(
      server: string,
      toolCount: number,
      duration_ms: number,
    ) {
      logger.info({
        event: 'mcp_connect_success',
        server,
        tools: toolCount,
        duration_ms,
      });
    },

    logMCPConnectFailed(server: string, error: string, details?: string) {
      logger.error({
        event: 'mcp_connect_failed',
        server,
        error,
        details,
      });
    },

    logToolsAvailable(total: number, byServer: Record<string, number>) {
      logger.info({
        event: 'tools_available',
        total,
        by_server: byServer,
      });
    },

    logToolCallStart(tool: string, requestId: string) {
      logger.info({ event: 'tool_call_start', tool, request_id: requestId });
    },

    logToolCallSuccess(
      tool: string,
      requestId: string,
      duration_ms: number,
      resultSize: number,
    ) {
      logger.info({
        event: 'tool_call_success',
        tool,
        request_id: requestId,
        duration_ms,
        result_size: resultSize,
      });
    },

    logToolCallSlow(tool: string, duration_ms: number, threshold_ms: number) {
      logger.warn({
        event: 'tool_call_slow',
        tool,
        duration_ms,
        threshold_ms,
      });
    },

    logToolCallError(tool: string, error: string, details?: unknown) {
      logger.error({ event: 'tool_call_error', tool, error, details });
    },

    logMCPDisconnect(server: string, status: string) {
      logger.info({ event: 'mcp_disconnect', server, status });
    },

    logError(context: string, error: Error) {
      logger.error({
        event: 'error',
        context,
        error: error.message,
        stack: error.stack,
      });
    },

    close() {
      // No-op: console streams don't need to be closed
      // All file logging is handled by the unified logger
    },
  };

  return loggerWrapper;
}

/**
 * Create human-readable formatter for log files
 * Format: [HH:mm:ss] symbol message (with optional metadata)
 */
function createReadableFormatter() {
  // Symbol mapping for log levels
  const levelSymbols: Record<string, string> = {
    info: '•',
    debug: '→',
    warn: '⚠',
    error: '✗',
  };

  return (obj: any): string => {
    const level = obj.level;
    const time = new Date(obj.time);
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');
    const timestamp = `[${hours}:${minutes}:${seconds}]`;

    // Determine level name and symbol
    let levelName = 'info';
    if (level >= 50) {
      levelName = 'error';
    } else if (level >= 40) {
      levelName = 'warn';
    } else if (level >= 30) {
      levelName = 'info';
    } else if (level >= 20) {
      levelName = 'debug';
    }

    const symbol = levelSymbols[levelName] || '•';

    // Extract message or event
    let message = obj.msg || '';
    if (!message && obj.event) {
      message = obj.event;

      // Add contextual information for specific events
      if (obj.event === 'tool_call' && obj.tool) {
        message = `tool_call - ${obj.tool}`;
      } else if (obj.event === 'assistant_thinking' && obj.text) {
        const thinkingPreview = obj.text.substring(0, 100).replace(/\n/g, ' ');
        message = `assistant_thinking - ${thinkingPreview}${
          obj.text.length > 100 ? '...' : ''
        }`;
      } else if (obj.event === 'tool_result' && obj.tool) {
        message = `tool_result - ${obj.tool} (${
          obj.success ? 'success' : 'failed'
        })`;
      } else if (obj.event === 'assistant_response' && obj.text) {
        const responsePreview = obj.text.substring(0, 80).replace(/\n/g, ' ');
        message = `assistant_response - ${responsePreview}${
          obj.text.length > 80 ? '...' : ''
        }`;
      }
    }

    // Format: [HH:mm:ss] symbol message
    // For multi-line messages, indent continuation lines to align with the message start
    // Use 2 tabs for consistent indentation across different environments
    const formattedMessage = message.replace(/\n/g, '\n\t\t\t\t');

    return `${timestamp} ${symbol} ${formattedMessage}`;
  };
}

/**
 * Custom log formatter with simplified timestamp and symbols (for console)
 */
function createCustomFormatter() {
  // Symbol mapping for log levels
  const levelSymbols: Record<string, string> = {
    info: '•',
    debug: '→',
    warn: '⚠',
    error: '✗',
  };

  // ANSI color codes
  const colors = {
    reset: '\x1b[0m',
    gray: '\x1b[90m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
  };

  return (obj: any): string => {
    const level = obj.level;
    const time = new Date(obj.time);
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');
    const timestamp = `[${hours}:${minutes}:${seconds}]`;

    // Determine level name and symbol
    let levelName = 'info';
    if (level >= 50) levelName = 'error';
    else if (level >= 40) levelName = 'warn';
    else if (level >= 30) levelName = 'info';
    else if (level >= 20) levelName = 'debug';

    const symbol = levelSymbols[levelName] || '•';

    // Apply color based on level
    let color = colors.reset;
    if (levelName === 'debug') color = colors.cyan;
    else if (levelName === 'warn') color = colors.yellow;
    else if (levelName === 'error') color = colors.red;

    // Extract message or event
    let message = obj.msg || '';
    if (!message && obj.event) {
      message = obj.event;

      // Add contextual information for specific events
      if (obj.event === 'tool_call' && obj.tool) {
        message = `tool_call - ${obj.tool}`;
        if (obj.args && levelName === 'debug') {
          // Show args only in debug mode
          const argsStr = JSON.stringify(obj.args, null, 0).substring(0, 100);
          message += ` ${argsStr}`;
        }
      } else if (obj.event === 'assistant_thinking' && obj.text) {
        // Show first 100 chars of thinking
        const thinkingPreview = obj.text.substring(0, 100).replace(/\n/g, ' ');
        message = `assistant_thinking - ${thinkingPreview}${
          obj.text.length > 100 ? '...' : ''
        }`;
      } else if (obj.event === 'tool_result' && obj.tool) {
        message = `tool_result - ${obj.tool} (${
          obj.success ? 'success' : 'failed'
        })`;
      } else if (obj.event === 'assistant_response' && obj.text) {
        const responsePreview = obj.text.substring(0, 80).replace(/\n/g, ' ');
        message = `assistant_response - ${responsePreview}${
          obj.text.length > 80 ? '...' : ''
        }`;
      }
    }

    // Format: [HH:mm:ss] symbol message
    // For multi-line messages, indent continuation lines to align with the message start
    // Use 2 tabs for consistent indentation across different environments
    const formattedMessage = message.replace(/\n/g, '\n\t\t');

    return `${colors.gray}${timestamp}${colors.reset} ${color}${symbol}${colors.reset} ${formattedMessage}`;
  };
}

/**
 * Simple wrapper logger for general application logging
 * Uses custom formatter without pino-pretty
 */
let simpleLogger: pino.Logger | null = null;

function getSimpleLogger(): pino.Logger {
  if (!simpleLogger) {
    const formatter = createCustomFormatter();

    // Create custom writable stream that uses our formatter
    const customStream = new (class extends Writable {
      _write(chunk: any, _encoding: string, callback: () => void) {
        try {
          const obj = JSON.parse(chunk.toString());
          const formatted = formatter(obj);
          process.stdout.write(formatted + '\n');
        } catch {
          // Fallback to raw output if parsing fails
          process.stdout.write(chunk);
        }
        callback();
      }
    })();

    simpleLogger = pino(
      {
        level: config.debug ? 'debug' : 'info',
      },
      customStream,
    );
  }
  return simpleLogger;
}

/**
 * Simple logging wrapper functions for general application logging
 */
export function logInfo(message: string, context?: object): void {
  const logger = getSimpleLogger();
  if (context) {
    logger.info(context, message);
  } else {
    logger.info(message);
  }
}

export function logWarn(message: string, context?: object): void {
  const logger = getSimpleLogger();
  if (context) {
    logger.warn(context, message);
  } else {
    logger.warn(message);
  }
}

export function logError(message: string, context?: object): void {
  const logger = getSimpleLogger();
  if (context) {
    logger.error(context, message);
  } else {
    logger.error(message);
  }
}

export function logDebug(message: string, context?: object): void {
  const logger = getSimpleLogger();
  if (context) {
    logger.debug(context, message);
  } else {
    logger.debug(message);
  }
}
