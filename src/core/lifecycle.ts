/**
 * Lifecycle Manager - Handles agent execution lifecycle hooks
 */

import { LifecycleHooks, AgentMetrics } from "../types/hooks.js";
import { AgentContext } from "../types/index.js";

export class LifecycleManager {
  private hooks: LifecycleHooks;

  constructor(hooks: LifecycleHooks = {}) {
    this.hooks = hooks;
  }

  async emitStart(context: AgentContext): Promise<void> {
    await this.hooks.onStart?.(context);
  }

  async emitPromptAssembly(system: string, user: string): Promise<void> {
    await this.hooks.onPromptAssembly?.(system, user);
  }

  async emitTurnStart(turn: number, message: any): Promise<void> {
    await this.hooks.onTurnStart?.(turn, message);
  }

  async emitToolCall(toolName: string, args: any): Promise<void> {
    await this.hooks.onToolCall?.(toolName, args);
  }

  async emitSubagentDelegate(name: string, prompt: string): Promise<void> {
    await this.hooks.onSubagentDelegate?.(name, prompt);
  }

  async emitTurnEnd(turn: number, result: any): Promise<void> {
    await this.hooks.onTurnEnd?.(turn, result);
  }

  async emitTokenThreshold(usage: any, threshold: number): Promise<void> {
    await this.hooks.onTokenThreshold?.(usage, threshold);
  }

  async emitError(error: Error, context: any): Promise<void> {
    await this.hooks.onError?.(error, context);
  }

  async emitComplete(result: any, metrics: AgentMetrics): Promise<void> {
    await this.hooks.onComplete?.(result, metrics);
  }
}




