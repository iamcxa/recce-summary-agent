/**
 * System prompt fragments - Agent checklist
 */

import { PromptFragment } from "../../types/prompts.js";

export function agentChecklist(): PromptFragment {
  return {
    id: "agent-checklist",
    content: `EXECUTION CHECKLIST (for your reference):
- [ ] Verify subagent permissions before delegating
- [ ] Wait for [TAGGED] responses from subagents
- [ ] Synthesize all findings before generating final output
- [ ] Include risk assessment and actionable recommendations
- [ ] Format output as professional markdown`,
    priority: 50,
  };
}




