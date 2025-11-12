/**
 * User prompt fragments - Analysis steps
 */

import { PromptFragment } from "../../types/prompts.js";

export function analysisSteps(): PromptFragment {
  return {
    id: "analysis-steps",
    content: `**REQUIRED ANALYSIS STEPS:**
Delegate to @agent-recce-validation:
1. Use mcp__recce__get_lineage_diff to identify model changes
2. Use mcp__recce__row_count_diff to analyze row count differences
3. Use mcp__recce__profile_diff for key modified models
4. Synthesize findings into comprehensive markdown`,
    priority: 80,
  };
}




