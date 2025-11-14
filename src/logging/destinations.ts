/**
 * Log destinations for agent logging
 * Now uses unified logger - only console output is provided here
 * File logging is handled by the main logger (logs/recce-agent.log & logs/recce-agent-raw.jsonl)
 */

export interface LogDestination {
  stream: NodeJS.WritableStream;
  close?: () => void;
}

/**
 * Create console destination for pino logger
 */
export function createConsoleDestination(): LogDestination {
  return {
    stream: process.stdout,
  };
}
