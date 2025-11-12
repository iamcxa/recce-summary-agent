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
 * Create agent execution log file (all agent interactions in one file)
 */
export function createAgentLogDestination(
  context: AgentContext,
  agentName: string,
  timestamp?: string
): LogDestination {
  const logDir = config.logging?.logDir || "logs";
  const ts = timestamp || new Date().toISOString().replace(/[:.]/g, "-");
  const prInfo = context.prNumber
    ? `-${context.owner}-${context.repo}-pr-${context.prNumber}`
    : "-" + (context.owner || "") + "-" + (context.repo || "") + "-pr-0";
  const filename = `${ts}-${agentName}${prInfo}.log`;
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
 * Create system diagnostic log file (MCP, errors, performance)
 */
export function createSystemLogDestination(
  agentName: string,
  timestamp?: string
): LogDestination {
  const logDir = config.logging?.logDir || "logs";
  const ts = timestamp || new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${ts}-${agentName}-system.log`;
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

