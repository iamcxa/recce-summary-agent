/**
 * Log destinations for agent logging
 * Supports console output, main log file, and per-turn log files
 */

import { createWriteStream } from "fs";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { AgentContext } from "../types/index.js";
import { config } from "../config.js";

export interface LogDestination {
  stream: NodeJS.WritableStream;
  close?: () => void;
}

/**
 * Create console destination with pino-pretty formatting
 */
export function createConsoleDestination(): LogDestination {
  // Console will be handled by pino-pretty in the logger setup
  return {
    stream: process.stdout,
  };
}

/**
 * Create main log file destination (all turns in one file)
 */
export function createMainLogDestination(context: AgentContext): LogDestination {
  const logDir = config.logging?.logDir || "logs";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${timestamp}-${context.owner}-${context.repo}-pr-${context.prNumber}.log`;
  const filepath = join(process.cwd(), logDir, filename);

  // Ensure directory exists
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const stream = createWriteStream(filepath, { flags: "a" });

  return {
    stream,
    close: () => {
      stream.end();
    },
  };
}

/**
 * Create per-turn log file destination
 */
export function createTurnFileStream(
  turnNumber: number,
  context: AgentContext
): LogDestination {
  const logDir = config.logging?.logDir || "logs";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const promptSummary = "analyze-pr"; // Could be derived from context
  const filename = `${timestamp}-${promptSummary}-turn-${turnNumber}.log`;
  const filepath = join(process.cwd(), logDir, filename);

  // Ensure directory exists
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const stream = createWriteStream(filepath, { flags: "w" });

  return {
    stream,
    close: () => {
      stream.end();
    },
  };
}

