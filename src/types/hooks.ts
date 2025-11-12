/**
 * Lifecycle hooks type definitions for agent execution
 */

import { AgentContext } from "./index.js";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface AgentMetrics {
  totalTurns: number;
  totalTokens: number;
  totalCost: number;
  elapsedSeconds: number;
  toolCallCount: number;
}

export interface LifecycleHooks {
  onStart?: (context: AgentContext) => void | Promise<void>;
  onPromptAssembly?: (system: string, user: string) => void | Promise<void>;
  onTurnStart?: (turn: number, message: any) => void | Promise<void>;
  onToolCall?: (toolName: string, args: any) => void | Promise<void>;
  onSubagentDelegate?: (name: string, prompt: string) => void | Promise<void>;
  onTurnEnd?: (turn: number, result: any) => void | Promise<void>;
  onTokenThreshold?: (usage: TokenUsage, threshold: number) => void | Promise<void>;
  onError?: (error: Error, context: any) => void | Promise<void>;
  onComplete?: (result: any, metrics: AgentMetrics) => void | Promise<void>;
}




