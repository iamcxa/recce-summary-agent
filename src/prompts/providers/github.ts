/**
 * Provider-specific prompt fragments - GitHub
 */

import { PromptFragment } from "../../types/prompts.js";

export function githubContext(
  owner: string,
  repo: string,
  prNumber: number
): PromptFragment {
  return {
    id: "github-context",
    content: `**GitHub Context:**
- Repository: ${owner}/${repo}
- PR Number: ${prNumber}
- Use GitHub CLI or MCP tools for PR data`,
    priority: 60,
    condition: (ctx) => ctx.provider === "github" && ctx.features.githubContext,
  };
}




