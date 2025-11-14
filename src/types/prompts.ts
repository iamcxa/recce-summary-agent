/**
 * Prompt-related type definitions for the agent system
 */

import type { RecceYaml } from '../recce/preset_parser.js';

export interface PromptFragment {
  id: string;
  content: string;
  priority: number;
  condition?: (context: PromptContext) => boolean;
}

export interface PromptContext {
  provider: 'github' | 'gitlab' | 'bitbucket';
  features: {
    githubContext: boolean;
    recceValidation: boolean;
  };
  userIntent: string;
  // Additional context for prompt composition
  owner?: string;
  repo?: string;
  prNumber?: number;

  // Recce preset checks (loaded from recce.yml)
  presetChecks?: RecceYaml | null;

  // Custom user prompt (appended to user prompt, does not override system prompt)
  customPrompt?: string;
}

export interface ComposedPrompt {
  system: string;
  user: string;
  metadata: {
    fragments: string[];
    provider: string;
  };
}
