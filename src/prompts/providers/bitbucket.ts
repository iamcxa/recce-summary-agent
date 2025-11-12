/**
 * Provider-specific prompt fragments - Bitbucket
 */

import { PromptFragment } from "../../types/prompts.js";

export function bitbucketContext(
  workspace: string,
  repo: string,
  prNumber: number
): PromptFragment {
  return {
    id: "bitbucket-context",
    content: `**Bitbucket Context:**
- Workspace: ${workspace}
- Repository: ${repo}
- PR Number: ${prNumber}
- Use Bitbucket CLI or API for PR data`,
    priority: 60,
    condition: (ctx) => ctx.provider === "bitbucket",
  };
}




