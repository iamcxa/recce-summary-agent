/**
 * Context management for inter-agent communication
 *
 * Manages shared context and data flow between sub-agents
 */

import { logger } from "./logger.js";

export interface AgentMessage {
  agentId: string;
  timestamp: string;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface PipelineContext {
  prNumber: number;
  owner: string;
  repo: string;
  startTime: Date;
  messages: AgentMessage[];
  state: "initializing" | "fetching_pr" | "analyzing_dbt" | "profiling_data" | "generating_summary" | "complete";
}

class ContextManager {
  private contexts: Map<string, PipelineContext> = new Map();

  /**
   * Create a new pipeline context for a PR
   */
  createContext(owner: string, repo: string, prNumber: number): PipelineContext {
    const contextId = this.getContextId(owner, repo, prNumber);

    const context: PipelineContext = {
      prNumber,
      owner,
      repo,
      startTime: new Date(),
      messages: [],
      state: "initializing",
    };

    this.contexts.set(contextId, context);
    logger.debug(`Created context: ${contextId}`);

    return context;
  }

  /**
   * Get existing context
   */
  getContext(owner: string, repo: string, prNumber: number): PipelineContext | undefined {
    return this.contexts.get(this.getContextId(owner, repo, prNumber));
  }

  /**
   * Add a message to the context from a sub-agent
   */
  addMessage(
    context: PipelineContext,
    agentId: string,
    data: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const message: AgentMessage = {
      agentId,
      timestamp: new Date().toISOString(),
      data,
      metadata,
    };

    context.messages.push(message);
    logger.debug(`Message from ${agentId} added to context`, { messageCount: context.messages.length });
  }

  /**
   * Update context state
   */
  updateState(
    context: PipelineContext,
    state: PipelineContext["state"]
  ): void {
    context.state = state;
    logger.debug(`Context state updated: ${state}`);
  }

  /**
   * Get all messages from a specific agent
   */
  getMessagesByAgent(
    context: PipelineContext,
    agentId: string
  ): AgentMessage[] {
    return context.messages.filter((m) => m.agentId === agentId);
  }

  /**
   * Compact context by removing old messages (for token efficiency)
   */
  compactContext(context: PipelineContext, keepLatestN: number = 5): void {
    if (context.messages.length > keepLatestN) {
      const removedCount = context.messages.length - keepLatestN;
      context.messages = context.messages.slice(-keepLatestN);
      logger.debug(`Context compacted: removed ${removedCount} old messages`);
    }
  }

  /**
   * Clear context
   */
  clearContext(owner: string, repo: string, prNumber: number): void {
    const contextId = this.getContextId(owner, repo, prNumber);
    this.contexts.delete(contextId);
    logger.debug(`Context cleared: ${contextId}`);
  }

  /**
   * Get context ID from PR info
   */
  private getContextId(owner: string, repo: string, prNumber: number): string {
    return `${owner}/${repo}#${prNumber}`;
  }

  /**
   * Get context summary for logging
   */
  getSummary(context: PipelineContext): {
    messageCount: number;
    agents: string[];
    state: string;
    elapsed: number;
  } {
    const agents = [...new Set(context.messages.map((m) => m.agentId))];
    const elapsed = Date.now() - context.startTime.getTime();

    return {
      messageCount: context.messages.length,
      agents,
      state: context.state,
      elapsed,
    };
  }
}

export const contextManager = new ContextManager();
