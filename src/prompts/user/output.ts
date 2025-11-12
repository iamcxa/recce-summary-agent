/**
 * User prompt fragments - Output format
 */

import { PromptFragment } from "../../types/prompts.js";

export function outputFormat(): PromptFragment {
  return {
    id: "output-format",
    content: `**Output Format:**
Generate professional markdown with:
1. Overview - Analysis scope and key findings
2. dbt Model Changes - Added/removed/modified models with counts
3. Data Insights - Row count changes (📈/📉)
4. Risk Assessment - Risk level (LOW/MEDIUM/HIGH)
5. Data Quality - Anomalies and warnings
6. Actionable Recommendations - Next steps`,
    priority: 70,
  };
}




