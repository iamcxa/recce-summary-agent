/**
 * System prompt fragments - Workflow steps
 */

import { PromptFragment } from "../../types/prompts.js";

export function workflowSteps(): PromptFragment {
  return {
    id: "workflow-steps",
    content: `WORKFLOW - YOU MUST DELEGATE:
1. Delegate to 'recce-validation' subagent to analyze dbt model changes
2. Receive its findings with [RECCE-VALIDATION] tag
3. Synthesize insights into professional markdown summary
4. Include: Overview, dbt Changes, Data Insights, Risk Assessment, Quality, Recommendations`,
    priority: 70,
  };
}




