/**
 * Agent event types for lifecycle tracking
 */

export enum AgentEventType {
  START = "agent:start",
  PROMPT_ASSEMBLY = "agent:prompt_assembly",
  TURN_START = "agent:turn_start",
  TOOL_CALL = "agent:tool_call",
  SUBAGENT_DELEGATE = "agent:subagent_delegate",
  TURN_END = "agent:turn_end",
  TOKEN_THRESHOLD = "agent:token_threshold",
  ERROR = "agent:error",
  COMPLETE = "agent:complete",
}

export interface AgentEvent {
  type: AgentEventType;
  timestamp: string;
  data: any;
}




