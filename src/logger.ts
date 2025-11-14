/**
 * Dual-format logging utility for the agent
 *
 * Outputs to:
 * 1. logs/recce-agent-raw.jsonl - Raw JSONL format for machine processing
 * 2. logs/recce-agent.log - Human-readable format for debugging
 * 3. Console output for real-time monitoring
 */

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

type WriteStream = fs.WriteStream;

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  role?: string;
  action?: string;
  command?: string;
  context?: string;
  message: string;
  data?: unknown;
}

class Logger {
  private level: LogLevel = config.debug ? LogLevel.DEBUG : LogLevel.INFO;
  private logsDir = 'logs';
  private rawLogFile = path.join(this.logsDir, 'recce-agent-raw.jsonl');
  private readableLogFile = path.join(this.logsDir, 'recce-agent.log');
  private rawLogStream: WriteStream;
  private readableLogStream: WriteStream;

  constructor() {
    // Ensure logs directory exists
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }

    // Create write streams for async I/O
    this.rawLogStream = fs.createWriteStream(this.rawLogFile, { flags: 'a' });
    this.readableLogStream = fs.createWriteStream(this.readableLogFile, { flags: 'a' });

    // Handle stream errors gracefully
    this.rawLogStream.on('error', (err) => {
      console.error('Error writing to raw log file:', err.message);
    });
    this.readableLogStream.on('error', (err) => {
      console.error('Error writing to readable log file:', err.message);
    });
  }

  /**
   * Format log entry for human-readable output
   * Format: [HH:mm:ss] symbol message (with optional metadata)
   */
  private formatReadable(entry: LogEntry): string {
    // Format time as [HH:mm:ss]
    const date = new Date(entry.timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const time = `[${hours}:${minutes}:${seconds}]`;

    // Add level symbol (consistent with console output)
    const levelSymbols: Record<LogLevel, string> = {
      [LogLevel.INFO]: '•',
      [LogLevel.DEBUG]: '→',
      [LogLevel.WARN]: '⚠',
      [LogLevel.ERROR]: '✗',
    };
    const symbol = levelSymbols[entry.level] || '•';

    // Build message parts
    const parts: string[] = [];
    if (entry.role) {
      parts.push(entry.role);
    }
    if (entry.action) {
      parts.push(entry.action);
    }
    if (entry.command || entry.context) {
      parts.push(entry.command || entry.context || '');
    }

    // Format line
    let line = `${time} ${symbol} ${entry.message}`;
    if (parts.length > 0) {
      line = `${time} ${symbol} [${parts.join(' - ')}] ${entry.message}`;
    }

    if (entry.data) {
      const dataStr =
        typeof entry.data === 'string' ? entry.data : JSON.stringify(entry.data, null, 2);
      line += `\n  ${dataStr}`;
    }

    return line;
  }

  /**
   * Write to both log files and console (async I/O for better performance)
   */
  private writeLog(entry: LogEntry): void {
    try {
      // Write to raw JSONL file (async)
      this.rawLogStream.write(`${JSON.stringify(entry)}\n`);

      // Write to readable log file (async)
      const readableLine = this.formatReadable(entry);
      this.readableLogStream.write(`${readableLine}\n`);
    } catch (error) {
      // Fallback to console-only logging if file writes fail
      console.error('Log file write failed:', error);
    }

    // Console output removed - now handled by unified pino logger in agent_logger.ts
  }

  /**
   * Close log streams gracefully
   */
  close(): void {
    this.rawLogStream.end();
    this.readableLogStream.end();
  }

  log(
    level: LogLevel,
    message: string,
    options?: {
      data?: unknown;
      role?: string;
      action?: string;
      command?: string;
      context?: string;
    },
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...options,
    };

    this.writeLog(entry);
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, { data });
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, { data });
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, { data });
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, { data });
  }

  /**
   * Log with detailed context (role, action, command)
   */
  logWithContext(
    level: LogLevel,
    message: string,
    context: {
      role?: string;
      action?: string;
      command?: string;
      context?: string;
      data?: unknown;
    },
  ): void {
    this.log(level, message, context);
  }
}

export const logger = new Logger();
