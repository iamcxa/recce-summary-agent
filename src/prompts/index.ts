/**
 * Prompt Builder - Composes system and user prompts from fragments
 */

import { PromptFragment, PromptContext, ComposedPrompt } from "../types/prompts.js";
import { roleDefinition } from "./system/base.js";
import { permissionRestrictions } from "./system/permissions.js";
import { workflowSteps } from "./system/workflow.js";
import { subagentDefinitions } from "./system/subagents.js";
import { agentChecklist } from "./system/checklist.js";
import { taskDescription } from "./user/base.js";
import { analysisSteps } from "./user/analysis.js";
import { outputFormat } from "./user/output.js";
import { githubContext } from "./providers/github.js";

export class PromptBuilder {
  private systemFragments: PromptFragment[] = [];
  private userFragments: PromptFragment[] = [];
  private context: PromptContext;

  constructor(context: PromptContext) {
    this.context = context;
  }

  addSystemFragment(fragment: PromptFragment): this {
    this.systemFragments.push(fragment);
    return this;
  }

  addUserFragment(fragment: PromptFragment): this {
    this.userFragments.push(fragment);
    return this;
  }

  build(): ComposedPrompt {
    // Filter by conditions
    const activeSystemFragments = this.systemFragments.filter(
      (f) => !f.condition || f.condition(this.context)
    );
    const activeUserFragments = this.userFragments.filter(
      (f) => !f.condition || f.condition(this.context)
    );

    // Sort by priority (higher first)
    activeSystemFragments.sort((a, b) => b.priority - a.priority);
    activeUserFragments.sort((a, b) => b.priority - a.priority);

    // Compose
    const systemPrompt = activeSystemFragments.map((f) => f.content).join("\n\n");
    const userPrompt = activeUserFragments.map((f) => f.content).join("\n\n");

    return {
      system: systemPrompt,
      user: userPrompt,
      metadata: {
        fragments: [...activeSystemFragments, ...activeUserFragments].map((f) => f.id),
        provider: this.context.provider,
      },
    };
  }
}

/**
 * Factory function to create a prompt builder with default fragments
 */
export function createPromptBuilder(context: PromptContext): PromptBuilder {
  const builder = new PromptBuilder(context);

  // Auto-add fragments based on context
  // System prompts
  builder.addSystemFragment(roleDefinition());
  builder.addSystemFragment(permissionRestrictions());
  builder.addSystemFragment(workflowSteps());
  builder.addSystemFragment(subagentDefinitions(context));
  builder.addSystemFragment(agentChecklist());

  // User prompts
  builder.addUserFragment(taskDescription(context));
  builder.addUserFragment(analysisSteps());
  builder.addUserFragment(outputFormat());

  // Provider-specific
  if (context.provider === "github" && context.owner && context.repo && context.prNumber) {
    builder.addSystemFragment(githubContext(context.owner, context.repo, context.prNumber));
  }

  return builder;
}




