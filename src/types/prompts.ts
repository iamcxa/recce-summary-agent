/**
 * Prompt-related type definitions for the agent system
 */

import { AgentContext } from "./index.js";

export interface PromptFragment {
  id: string;
  content: string;
  priority: number;
  condition?: (context: PromptContext) => boolean;
}

export interface PromptContext {
  provider: "github" | "gitlab" | "bitbucket";
  features: {
    githubContext: boolean;
    recceValidation: boolean;
  };
  userIntent: string;
  // Additional context for prompt composition
  owner?: string;
  repo?: string;
  prNumber?: number;
}

export interface ComposedPrompt {
  system: string;
  user: string;
  metadata: {
    fragments: string[];
    provider: string;
  };
}




