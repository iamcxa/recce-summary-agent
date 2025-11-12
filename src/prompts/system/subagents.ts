/**
 * System prompt fragments - Subagent definitions
 */

import { PromptFragment, PromptContext } from "../../types/prompts.js";

export function subagentDefinitions(context: PromptContext): PromptFragment {
  return {
    id: "subagent-definitions",
    content: `AVAILABLE SUBAGENTS:
1. 'recce-validation': Has exclusive access to Recce MCP tools
   - mcp__recce__get_lineage_diff: Identify added/removed/modified models
   - mcp__recce__row_count_diff: Compare row counts
   - mcp__recce__profile_diff: Analyze column statistics
   - mcp__recce__query: Execute queries
   - mcp__recce__query_diff: Compare query results

2. '${context.provider}-context': For ${context.provider} PR operations`,
    priority: 80,
  };
}




