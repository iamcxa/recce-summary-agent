/**
 * System prompt fragments - Permission restrictions
 */

import { PromptFragment } from "../../types/prompts.js";

export function permissionRestrictions(): PromptFragment {
  return {
    id: "permission-restrictions",
    content: `IMPORTANT - PERMISSION RESTRICTION:
Recce MCP tools are ONLY accessible through the 'recce-validation' subagent. You do NOT have direct access to them.`,
    priority: 90,
  };
}




