# Output Format and MCP Tool Calling Fix

**Date**: 2025-11-13
**Purpose**: Fix two critical issues in PR summary output

## Problems Identified

### Problem 1: Incorrect Output Format

**User Observation**: 輸出的結果有問題
```
內容不應該出現如 subagent 等相關字句，
內容應該完全以 pr-summary 的 template 為主，
輸出一份由 recce formatted 過的 output
```

**Issue**: Agent was outputting internal implementation details like "subagents", "delegation", and not following the pr-summary template structure.

**Example of Incorrect Output**:
```markdown
# PR #3 Analysis Summary: Multi-Agent Architecture Migration

## PR Overview
...

## Preset Check Results

### Overall Status: ⏳ **PENDING EVALUATION**

The Recce preset checks were invoked but require database environment initialization...
```

**Expected Output** (pr-summary template):
```markdown
# PR Validation Summary

---

### ⚠ Anomalies Detected

🔴 **Critical issues**: ...
⚠️ **Warnings**: ...
✅ **Stable metrics**: ...

---

### Changes Overview

- Models: **X modified**, **Y new**, **Z removed**
- Direct Changes (columns): ...

---

### ✅ Test Status

✅ Schema validation: ...
⚠️ Row count validation: ...

---

### 📊 Validation Results

(Only show when issues detected)

---

### 🔍 Suggested Checks

- Action item 1
- Action item 2
```

### Problem 2: MCP Tools Not Being Called

**User Observation**:
```
agent 似乎仍然沒有呼叫 mcp tools，
只有看到 list tools 的呼叫
```

**Issue**: preset-check-executor subagent was not actually calling MCP tools like `mcp__recce__row_count_diff`, `mcp__recce__query_diff`. It was only listing available tools.

---

## Root Causes

### Root Cause 1: Weak Output Format Instructions

**File**: `src/prompts/fragments/base.ts`

**Problem**:
```typescript
// ❌ Too vague
export const BASE_WORKFLOW_INSTRUCTIONS = `
- Use subagents for data gathering, YOU for synthesis  // Mentions "subagents"!
`;

export const BASE_OUTPUT_FORMAT = `
Return ONLY the final markdown summary.  // Doesn't specify template
Do NOT include subagent raw responses.  // Mentions "subagent"!
`;
```

**Impact**:
- Agent included "subagent" in output text
- Agent didn't know to follow pr-summary template
- Agent created its own structure instead

### Root Cause 2: Missing Tool Call Examples

**File**: `src/prompts/fragments/preset_checks.ts`

**Problem**:
```typescript
// ❌ No concrete examples
**Available Recce MCP Tools:**
- mcp__recce__row_count_diff: Row count comparison

**Execution Process:**
2. For each check, call the corresponding MCP tool with the specified parameters
```

**Impact**:
- Agent didn't know the exact XML format for tool calls
- Agent described what should be done instead of actually calling tools
- No examples showing `<tool_use>` syntax

---

## Fixes Implemented

### Fix 1: Strengthened Output Format Instructions

#### File: `src/prompts/fragments/base.ts`

**Changes**:
```typescript
// ✅ Clear and specific
export const BASE_WORKFLOW_INSTRUCTIONS = `
- Delegate data gathering tasks, then synthesize findings  // No "subagent"
- Be concise but comprehensive
- Focus on actionable insights
- Highlight data quality and breaking changes
`;

export const BASE_OUTPUT_FORMAT = `
Return ONLY the final formatted summary following the specified template.
Do NOT include internal implementation details or delegation process.  // Clear instruction
`;
```

#### File: `src/prompts/fragments/pr_summary_format.ts`

**Added at the beginning**:
```typescript
export const PR_SUMMARY_OUTPUT_FORMAT = `
## 🚨 CRITICAL: Output Format Requirements

**YOU MUST FOLLOW THIS EXACT FORMAT - NO DEVIATIONS ALLOWED**

This is the ONLY acceptable output format. Do NOT create your own structure.
Do NOT include implementation details, delegation notes, or internal process descriptions.
Output ONLY the user-facing PR validation summary following this template.

---

## Output Format: PR Validation Summary
...
```

#### File: `src/prompts/index.ts`

**Enhanced delegation instructions**:
```typescript
// Line 98-105
const stepNumber = context.presetChecks ? '4' : '3';
const outputFormat = context.outputFormat || 'markdown';
parts.push(`\n${stepNumber}. **Synthesize final summary**:`);
parts.push(`   Output format: **${outputFormat.toUpperCase()}**`);
if (outputFormat === 'pr-summary') {
  parts.push('   🚨 CRITICAL: Follow the PR Validation Summary template EXACTLY');
  parts.push('   Do NOT include delegation details, only the formatted validation report');
}
```

### Fix 2: Added Concrete Tool Call Examples

#### File: `src/prompts/fragments/preset_checks.ts`

**Added explicit tool call examples** (+40 lines):

```typescript
export const PRESET_CHECK_EXECUTOR_PROMPT = `
🚨 **CRITICAL: YOU HAVE ACCESS TO MCP TOOLS AND MUST USE THEM**

You have the following Recce MCP tools available for use. YOU MUST CALL THESE TOOLS:

**Available Recce MCP Tools:**
- mcp__recce__get_lineage_diff: Get lineage changes (for schema_diff checks)
- mcp__recce__row_count_diff: Row count comparison (for row_count_diff checks)
- mcp__recce__query_diff: Custom SQL query comparison (for query_diff and value_diff checks)
- mcp__recce__profile_diff: Statistical profile comparison (for profile_diff checks)

**Example Tool Calls:**

For row_count_diff check:
<tool_use>
<tool_name>mcp__recce__row_count_diff</tool_name>
<parameters>
{
  "node_names": ["customers", "orders"]
}
</parameters>
</tool_use>

For query_diff check:
<tool_use>
<tool_name>mcp__recce__query_diff</tool_name>
<parameters>
{
  "sql_template": "SELECT DATE_TRUNC('week', first_order) AS week, AVG(customer_lifetime_value) FROM {{ ref('customers') }} GROUP BY week"
}
</parameters>
</tool_use>

For value_diff check (construct SQL first):
<tool_use>
<tool_name>mcp__recce__query_diff</tool_name>
<parameters>
{
  "sql_template": "SELECT customer_id, customer_lifetime_value FROM {{ ref('customers') }} ORDER BY customer_id",
  "primary_keys": ["customer_id"]
}
</parameters>
</tool_use>
`;
```

**Key improvements**:
1. ✅ Shows exact `<tool_use>` XML syntax
2. ✅ Demonstrates JSON parameter format
3. ✅ Provides 3 concrete examples for different check types
4. ✅ Shows how to construct SQL for value_diff

---

## Changes Summary

### Files Modified

1. **src/prompts/fragments/base.ts** (+4 lines)
   - Removed "subagent" mentions
   - Changed "Use subagents for data gathering" → "Delegate data gathering tasks"
   - Changed vague instruction → "Do NOT include internal implementation details"

2. **src/prompts/fragments/pr_summary_format.ts** (+8 lines)
   - Added 🚨 CRITICAL section at the beginning
   - Emphasized "NO DEVIATIONS ALLOWED"
   - Explicit "Do NOT include implementation details"

3. **src/prompts/index.ts** (+5 lines)
   - Added output format emphasis in synthesis step
   - Added conditional warning for pr-summary format
   - Explicit "Do NOT include delegation details"

4. **src/prompts/fragments/preset_checks.ts** (+40 lines)
   - Added 🚨 CRITICAL section about tool access
   - Added 3 concrete tool call examples with XML syntax
   - Showed exact parameter format for each check type

---

## Build Result

```bash
✅ dist/index.js  839.9kb (+1.7kb from 838.2kb)
⏱️  52ms
```

**Size increase**: Additional tool call examples and format instructions

---

## Expected Behavioral Changes

### Before:

**Output**:
```markdown
# PR #3 Analysis Summary

Based on the comprehensive data I've gathered from the subagents...  ❌

## Preset Check Results

The Recce preset checks were invoked but require database...  ❌
```

**Tool calls**: Only `list_tools` observed ❌

### After:

**Output**:
```markdown
# PR Validation Summary  ✅

---

### ⚠ Anomalies Detected

🔴 **Critical issues**: ...  ✅
⚠️ **Warnings**: ...  ✅

---

### Changes Overview

- Models: **X modified**, **Y new**, **Z removed**  ✅

---

### ✅ Test Status

✅ Schema validation: ...  ✅

---

### 📊 Validation Results

(table format)  ✅

---

### 🔍 Suggested Checks

- Action item 1  ✅
```

**Tool calls**:
```xml
<tool_use>
<tool_name>mcp__recce__row_count_diff</tool_name>
<parameters>{"node_names": ["customers", "orders"]}</parameters>
</tool_use>
```
✅ Actual MCP tool invocations observed

---

## Testing Checklist

When testing with jaffle_shop_agentic PR:

- [ ] **Output structure**: Matches pr-summary template exactly
- [ ] **No internal details**: No mentions of "subagent", "delegation", "invoked"
- [ ] **Section order**: Follows template order (Anomalies → Changes → Test Status → Validation Results → Suggested Checks)
- [ ] **Emoji indicators**: Uses 🔴, ⚠️, ✅ correctly
- [ ] **Concrete values**: No placeholders, all metrics from actual tool results
- [ ] **MCP tool calls**: Log shows actual tool invocations:
  - [ ] `mcp__recce__get_lineage_diff` called
  - [ ] `mcp__recce__row_count_diff` called for customers and orders
  - [ ] `mcp__recce__query_diff` called for value checks
  - [ ] `mcp__recce__query_diff` called for query checks
- [ ] **Tool responses**: Each tool call has corresponding response in logs
- [ ] **Evaluation**: Tool results are evaluated against thresholds

---

## Logging Verification

**What to check in logs**:

1. **Tool list call** (expected once at start):
```json
{"type": "tool_use", "tool": "list_tools", "server": "recce"}
```

2. **Actual tool calls** (should see multiple):
```json
{"type": "tool_use", "tool": "mcp__recce__row_count_diff", "parameters": {...}}
{"type": "tool_result", "tool": "mcp__recce__row_count_diff", "result": {...}}

{"type": "tool_use", "tool": "mcp__recce__query_diff", "parameters": {...}}
{"type": "tool_result", "tool": "mcp__recce__query_diff", "result": {...}}
```

3. **Check count**: Should see N tool calls where N = number of preset checks

---

## Related Documentation

- [MCP_TOOL_EXECUTION_UPDATE.md](./MCP_TOOL_EXECUTION_UPDATE.md) - Initial MCP tool calling fix
- [SEMANTIC_INTERPRETATION_UPDATE.md](./SEMANTIC_INTERPRETATION_UPDATE.md) - Semantic evaluation logic
- [PR_SUMMARY_FORMAT.md](./PR_SUMMARY_FORMAT.md) - Template specification
- [AGENTS.md](./AGENTS.md) - Multi-agent architecture

---

## Next Steps

1. **Test with real PR**: Run with `OUTPUT_FORMAT=pr-summary` on jaffle_shop_agentic PR #3
2. **Verify output structure**: Check output matches template exactly
3. **Verify tool calls**: Check logs for actual MCP tool invocations
4. **Iterate if needed**: If issues persist, add even more explicit examples

---

**Status**: ✅ Complete and ready for testing
**Build**: 839.9kb (success)
**Key Changes**: Output format enforcement + concrete tool call examples
**Expected Impact**:
- ✅ Clean pr-summary formatted output
- ✅ Actual MCP tool execution with observable tool calls
