/**
 * User prompt fragments - Task description
 */

import { PromptFragment, PromptContext } from "../../types/prompts.js";

export function taskDescription(context: PromptContext): PromptFragment {
  return {
    id: "task-description",
    content: `Analyze dbt model changes and generate a comprehensive data quality summary.`,
    priority: 100,
  };
}




