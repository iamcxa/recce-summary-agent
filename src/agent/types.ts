/**
 * Agent module type definitions
 */

import type { RecceYaml } from '../recce/preset_parser.js';
import type { ProviderType } from '../types/providers.js';

/**
 * Options for customizing agent prompts
 */
export interface AgentPromptOptions {
  recceConfig?: string;
  userPrompt?: string;
  systemPrompt?: string;
  promptCommandsPath?: string;
  showSystemPrompt?: boolean;
}

/**
 * Agent execution context
 */
export interface AgentContext {
  owner: string;
  repo: string;
  prNumber: number;
  includeRecce: boolean;
}

/**
 * Agent configuration for execution
 */
export interface AgentExecutionConfig {
  context: AgentContext;
  provider: ProviderType;
  gitToken: string;
  repoUrl: string;
  recceMcpUrl: string;
  presetChecks: RecceYaml | null;
  promptOptions?: AgentPromptOptions;
}
