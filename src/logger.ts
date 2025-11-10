/**
 * Simple logging utility for the agent
 */

import { config } from "./config.js";

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

class Logger {
  private level: LogLevel = config.debug ? LogLevel.DEBUG : LogLevel.INFO;

  log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const levelStr = `[${level}]`;
    const prefix = `${timestamp} ${levelStr}`;

    if (level === LogLevel.ERROR) {
      console.error(`${prefix} ${message}`, data || "");
    } else if (level === LogLevel.WARN) {
      console.warn(`${prefix} ${message}`, data || "");
    } else if (level === LogLevel.DEBUG && config.debug) {
      console.log(`${prefix} ${message}`, data || "");
    } else if (level === LogLevel.INFO) {
      console.log(`${prefix} ${message}`, data || "");
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }
}

export const logger = new Logger();
