/**
 * Provider-specific prompt fragments - GitLab
 */

import { PromptFragment } from "../../types/prompts.js";

export function gitlabContext(
  project: string,
  mrNumber: number
): PromptFragment {
  return {
    id: "gitlab-context",
    content: `**GitLab Context:**
- Project: ${project}
- MR Number: ${mrNumber}
- Use GitLab CLI (glab) for MR data`,
    priority: 60,
    condition: (ctx) => ctx.provider === "gitlab",
  };
}




