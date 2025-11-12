/**
 * Log formatters for agent logging
 */

export interface TurnData {
  turn: number;
  message: any;
  toolCalls: Array<{ name: string; args: any }>;
  thinking: string[];
  timestamp: string;
}

export interface ToolCallData {
  name: string;
  args: any;
  timestamp: string;
}

// Visual separators
const SEPARATOR_HEAVY = '═'.repeat(70);
const SEPARATOR_LIGHT = '─'.repeat(70);
const SEPARATOR_SECTION = '━'.repeat(70);

/**
 * Format section header
 */
export function formatSectionHeader(title: string, emoji: string = ''): string {
  const header = emoji ? `${emoji} ${title}` : title;
  return `\n${SEPARATOR_HEAVY}\n${header}\n${SEPARATOR_HEAVY}`;
}

/**
 * Format subsection header
 */
export function formatSubsectionHeader(title: string): string {
  return `\n${SEPARATOR_LIGHT}\n${title}\n${SEPARATOR_LIGHT}`;
}

/**
 * Format turn start
 */
export function formatTurnStart(turn: number): string {
  const timestamp = new Date().toISOString();
  return formatSectionHeader(`Turn ${turn} Started`, '🔄') + `\nTimestamp: ${timestamp}`;
}

/**
 * Format turn end
 */
export function formatTurnEnd(turn: number, summary: string): string {
  return `${formatSubsectionHeader(`Turn ${turn} Completed`)}\n${summary}`;
}

/**
 * Format thinking section
 */
export function formatThinkingSection(thoughts: string[], turn: number): string {
  if (thoughts.length === 0) return '';

  const lines: string[] = [];
  lines.push(formatSubsectionHeader(`💭 Claude's Thinking (Turn ${turn})`));

  thoughts.forEach((thought, idx) => {
    // Detect subagent tags
    let prefix = '';
    if (thought.includes('[GITHUB-CONTEXT]')) {
      prefix = '🌐 [GITHUB] ';
    } else if (thought.includes('[RECCE-VALIDATION]')) {
      prefix = '📊 [RECCE] ';
    } else if (thought.includes('[GITLAB-CONTEXT]')) {
      prefix = '🦊 [GITLAB] ';
    }

    // Format multi-line thoughts with indentation
    const formattedThought = thought
      .split('\n')
      .map((line, lineIdx) => (lineIdx === 0 ? line : `  ${line}`))
      .join('\n');

    lines.push(`\n${prefix}Thought ${idx + 1}:`);
    lines.push(formattedThought);
  });

  return lines.join('\n');
}

/**
 * Format tool calls section
 */
export function formatToolCallsSection(toolCalls: Array<{ name: string; args: any }>, turn: number): string {
  if (toolCalls.length === 0) return '';

  const lines: string[] = [];
  lines.push(formatSubsectionHeader(`🔧 Tool Calls (Turn ${turn}) - ${toolCalls.length} tool(s)`));

  toolCalls.forEach((tool, idx) => {
    lines.push(`\n[${idx + 1}] ${tool.name}`);

    // Format args with proper indentation
    const argsStr = JSON.stringify(tool.args, null, 2);
    const argsLines = argsStr.split('\n');

    if (argsLines.length > 10) {
      // Truncate long args
      lines.push('  Arguments:');
      lines.push(argsLines.slice(0, 8).map((l) => `    ${l}`).join('\n'));
      lines.push(`    ... (${argsLines.length - 8} more lines)`);
    } else {
      lines.push('  Arguments:');
      lines.push(argsLines.map((l) => `    ${l}`).join('\n'));
    }
  });

  return lines.join('\n');
}

/**
 * Format turn summary for logging
 */
export function formatTurnSummary(turnData: TurnData): string {
  const sections: string[] = [];

  // Thinking section
  if (turnData.thinking.length > 0) {
    sections.push(formatThinkingSection(turnData.thinking, turnData.turn));
  }

  // Tool calls section
  if (turnData.toolCalls.length > 0) {
    sections.push(formatToolCallsSection(turnData.toolCalls, turnData.turn));
  }

  return sections.join('\n');
}

/**
 * Format tool call for logging
 */
export function formatToolCall(toolName: string, args: any): string {
  const argsStr = JSON.stringify(args, null, 2);
  return `🔧 Tool: ${toolName}\nArguments:\n${argsStr}`;
}

/**
 * Format Claude thinking text for logging
 */
export function formatThinking(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength)}\n... [truncated - ${text.length - maxLength} more characters]`;
}

/**
 * Format system initialization
 */
export function formatSystemInit(model: string, toolCount: number, recceToolCount: number): string {
  const lines: string[] = [];
  lines.push(formatSectionHeader('System Initialized', '🤖'));
  lines.push(`\n📦 Model: ${model}`);
  lines.push(`🔧 Total Tools: ${toolCount}`);
  lines.push(`📊 Recce Tools: ${recceToolCount}`);
  return lines.join('\n');
}

/**
 * Format completion summary
 */
export function formatCompletionSummary(metrics: {
  totalTurns: number;
  totalTokens: number;
  totalCachedTokens: number;
  totalCost: number;
  elapsedSeconds: number;
  toolCallCount: number;
}): string {
  const lines: string[] = [];
  lines.push(formatSectionHeader('Analysis Completed', '✅'));
  lines.push(`\n📊 Statistics:`);
  lines.push(`   • Turns: ${metrics.totalTurns}`);
  lines.push(`   • Tokens: ${metrics.totalTokens.toLocaleString()}`);
  lines.push(`   • Cached Tokens: ${metrics.totalCachedTokens.toLocaleString()}`);
  lines.push(`   • Total (with cache): ${(metrics.totalTokens + metrics.totalCachedTokens).toLocaleString()}`);
  lines.push(`   • Cost: $${metrics.totalCost.toFixed(4)}`);
  lines.push(`   • Duration: ${metrics.elapsedSeconds.toFixed(2)}s`);
  lines.push(`   • Tool Calls: ${metrics.toolCallCount}`);
  return lines.join('\n');
}

/**
 * Format final result preview
 */
export function formatResultPreview(result: string, maxLength: number = 300): string {
  const lines: string[] = [];
  lines.push(formatSubsectionHeader('📄 Generated Summary Preview'));

  if (result.length <= maxLength) {
    lines.push(result);
  } else {
    lines.push(result.substring(0, maxLength));
    lines.push(`\n... [${result.length - maxLength} more characters]`);
    lines.push('\n💾 Full summary saved to summary.md');
  }

  return lines.join('\n');
}

