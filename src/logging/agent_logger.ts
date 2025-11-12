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
  createMainLogDestination,
  createTurnFileStream,
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

export interface AgentLogger {
  logger: pino.Logger;
  startTurn(turnNumber: number): void;
  endTurn(): void;
  logTurn(turnData: TurnData): void;
  logToolCall(toolName: string, args: unknown): void;
  logThinking(text: string): void;
  logSystemInit(model: string, toolCount: number, recceToolCount: number): void;
  logCompletion(metrics: {
    totalTurns: number;
    totalTokens: number;
    totalCost: number;
    elapsedSeconds: number;
    toolCallCount: number;
  }): void;
  logResultPreview(result: string): void;
  logSection(title: string, emoji?: string): void;
  close(): void;
}

/**
 * Create agent logger with multiple destinations
 */
export async function createAgentLogger(
  context: AgentContext,
): Promise<AgentLogger> {
  type PinoStreamEntry = {
    level: string;
    stream: NodeJS.WritableStream;
  };

  const destinations: LogDestination[] = [];
  let currentTurnStream: LogDestination | null = null;
  let streams: PinoStreamEntry[] = [];

  // Console destination (with pino-pretty if enabled)
  const consoleDest = createConsoleDestination();
  destinations.push(consoleDest);

  // Main log file destination
  const mainLogDest = createMainLogDestination(context);
  destinations.push(mainLogDest);

  // Initialize streams array
  streams = destinations.map((dest) => ({
    level: config.debug ? 'debug' : 'info',
    stream: dest.stream,
  })) as PinoStreamEntry[];

  // Add pino-pretty for console if enabled
  if (config.logging?.prettifyConsole) {
    try {
      const pinoPretty = await import('pino-pretty');
      const pinoPrettyStream = pinoPretty.default({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      });
      streams[0] = {
        level: config.debug ? 'debug' : 'info',
        stream: pinoPrettyStream,
      };
    } catch {
      // Fallback to regular console if pino-pretty not available
      console.warn('pino-pretty not available, using regular console');
    }
  }

  // Create base logger configuration
  const loggerOptions: pino.LoggerOptions = {
    level: config.debug ? 'debug' : 'info',
    base: {
      owner: context.owner,
      repo: context.repo,
      prNumber: context.prNumber,
    },
  };

  // Create logger with initial streams
  let logger = pino(loggerOptions, pino.multistream(streams));

  // Helper function to recreate logger with updated streams
  const recreateLogger = () => {
    logger = pino(loggerOptions, pino.multistream(streams));
  };

  // Create a logger wrapper that always uses the latest logger instance
  const loggerWrapper = {
    get logger() {
      return logger;
    },
    startTurn(turnNumber: number) {
      // Log turn start with formatted message
      const startMessage = formatTurnStart(turnNumber);
      logger.info(startMessage);

      if (config.logging?.perTurnFiles && currentTurnStream === null) {
        currentTurnStream = createTurnFileStream(turnNumber, context);
        // Add turn stream to streams array
        streams.push({
          level: config.debug ? 'debug' : 'info',
          stream: currentTurnStream.stream,
        });
        // Recreate logger with new streams
        recreateLogger();
      }
    },
    endTurn() {
      if (currentTurnStream) {
        const turnStream = currentTurnStream;
        // Remove turn stream from streams array before clearing reference
        streams = streams.filter((s) => s.stream !== turnStream.stream);
        currentTurnStream = null;
        // Recreate logger without turn stream
        recreateLogger();
        turnStream.close?.();
      }
    },
    logTurn(turnData: TurnData) {
      const summary = formatTurnSummary(turnData);
      const endMessage = formatTurnEnd(turnData.turn, summary);
      logger.info(endMessage);
    },
    logToolCall(toolName: string, args: unknown) {
      logger.info(`🔧 Tool Called: ${toolName}`);
      if (config.debug) {
        logger.debug({ tool: toolName, args }, 'Tool arguments');
      }
    },
    logThinking(text: string) {
      if (config.debug) {
        logger.debug({ thinking: text }, '💭 Thinking');
      }
    },
    logSystemInit(model: string, toolCount: number, recceToolCount: number) {
      const message = formatSystemInit(model, toolCount, recceToolCount);
      logger.info(message);
    },
    logCompletion(metrics: {
      totalTurns: number;
      totalTokens: number;
      totalCost: number;
      elapsedSeconds: number;
      toolCallCount: number;
    }) {
      const message = formatCompletionSummary(metrics);
      logger.info(message);
    },
    logResultPreview(result: string) {
      const message = formatResultPreview(result);
      logger.info(message);
    },
    logSection(title: string, emoji?: string) {
      const message = formatSectionHeader(title, emoji);
      logger.info(message);
    },
    close() {
      // Close all destinations
      destinations.forEach((dest) => {
        if (dest.close) {
          dest.close();
        }
      });
      if (currentTurnStream?.close) {
        currentTurnStream.close();
      }
    },
  };

  return loggerWrapper;
}
