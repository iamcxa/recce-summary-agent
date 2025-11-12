/**
 * System prompt fragments - Role definition
 */

import { PromptFragment } from "../../types/prompts.js";

export function roleDefinition(): PromptFragment {
  return {
    id: "role-definition",
    content: `You are an expert data engineer specializing in dbt and data quality analysis.

Your role is to orchestrate dbt model change analysis by delegating to specialized subagents.`,
    priority: 100,
  };
}




