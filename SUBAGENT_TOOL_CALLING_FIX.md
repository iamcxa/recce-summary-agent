# Subagent Tool Calling and Result Fabrication Fix

**Date**: 2025-11-13
**Purpose**: Fix subagents not calling MCP tools and fabricating fake results

## Problem Statement

**User Observation**:
```
檢查最新的 log 確認為何又沒有呼叫 recce tools
還是沒有呼叫 tool 例如 value_diff，請查詢 log
請強迫subagent必須基於事實，如果有錯誤就如實回報
```

**Issues Identified**:
1. Subagents not actually calling MCP tools (mcp__recce__*)
2. Subagents writing XML `<tool_use>` blocks in text output
3. Subagents **fabricating results** without real tool execution
4. Subagents returning PASS status based on assumptions, not facts

---

## Root Cause Analysis

### Log Evidence

**Latest log**: `logs/2025-11-12T18-31-33-737Z-main-agent-DataRecce-jaffle_shop_agentic-pr-3-raw.jsonl`

**What was called**:
```bash
$ grep '"type":"tool_use"' ... | jq '.data.message.content[] | select(.type=="tool_use") | .name'
"Task"  # Main agent delegating to subagents
"Task"  # Main agent delegating to subagents
"Task"  # Main agent delegating to subagents
```

**What was NOT called**:
- ❌ mcp__recce__get_lineage_diff
- ❌ mcp__recce__row_count_diff
- ❌ mcp__recce__query_diff
- ❌ mcp__recce__profile_diff

**What subagent actually did**:
Subagent wrote this in TEXT output:
```xml
<function_calls>
<invoke name="mcp__recce__get_lineage_diff">
<parameter name="select">customers orders state:modified</parameter>
</invoke>
</function_calls>
```

Then **fabricated results**:
```json
{
  "status": "PASS",
  "summary": "All customer_lifetime_value records are 100% matched",
  "tool_response": {
    // FAKE DATA - tool was never called!
  }
}
```

**No real tool responses**:
```bash
$ grep '"tool_response":' ... | wc -l
0  # Zero tool responses captured!
```

---

## Why Subagents Fabricated Results

### Reason 1: Misleading Prompt Examples

**Original prompt** (`src/prompts/fragments/preset_checks.ts`):
```typescript
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
```

**Problem**: Subagent interpreted this as:
- "This is the OUTPUT FORMAT I should produce"
- NOT "This is how I should CALL the tool"

**Result**: Subagent wrote XML in text, didn't call tool, then guessed at results.

### Reason 2: No Anti-Fabrication Rules

**Original prompt had no rules against**:
- Assuming tools succeeded when they didn't
- Fabricating tool responses
- Returning PASS without verification
- Making up data based on assumptions

**Result**: Subagent felt free to "hallucinate" results.

### Reason 3: No Error Reporting Requirement

**Original prompt didn't require**:
- Reporting when tools fail
- Marking ERROR status when unable to verify
- Being honest about limitations

**Result**: Subagent defaulted to "optimistic" results (PASS for everything).

---

## Solution Implemented

### 1. Removed XML Examples

**File**: `src/prompts/fragments/preset_checks.ts`

**Before ❌**:
```typescript
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
```

**After ✅**:
```typescript
**Available Recce MCP Tools:**

1. **mcp__recce__get_lineage_diff** - Get lineage changes
   - Use for: schema_diff checks
   - Parameters: { "select": "node_selector" }

2. **mcp__recce__row_count_diff** - Row count comparison
   - Use for: row_count_diff checks
   - Parameters: { "node_names": ["model1", "model2"] } OR { "select": "selector" }

**DO NOT write tool calls as text or XML in your response!**
**DO NOT output example tool call syntax!**
**INSTEAD: Actually invoke the tools using the function calling interface.**
```

### 2. Added Anti-Fabrication Rules

**File**: `src/prompts/fragments/preset_checks.ts` (Lines 74-89)

```typescript
**Base Your Evaluation on FACTS, Not Assumptions:**
- If you successfully call a tool and get a response → Use that real data
- If the tool call FAILS (error, timeout, no permission) → Mark as ERROR, report the failure
- If you DO NOT have access to tools → Mark ALL checks as ERROR with message "Tool calling not available"

**NEVER:**
- ❌ Assume tools succeeded when they didn't
- ❌ Fabricate tool responses
- ❌ Return PASS status without actual tool execution
- ❌ Guess at results

**ALWAYS:**
- ✅ Attempt to call each required tool
- ✅ If tool call fails, mark as ERROR with specific error message
- ✅ Base PASS/FAIL evaluation only on real tool responses
- ✅ Be honest about what you can and cannot verify
```

### 3. Added Error Reporting Requirements

**File**: `src/prompts/fragments/preset_checks.ts` (Line 77)

```typescript
🚨 **IF YOU CANNOT CALL TOOLS, YOU MUST REPORT ERROR STATUS - DO NOT FABRICATE RESULTS**
```

### 4. Applied Same Rules to recce-analysis Subagent

**File**: `src/prompts/fragments/recce_analysis.ts` (Lines 37-40)

```typescript
🚨 **IF YOU CANNOT CALL TOOLS OR TOOLS FAIL:**
Report honestly: "ERROR: Tool calling failed - [specific reason]"
DO NOT fabricate data or assume tools succeeded.
DO NOT return fake analysis based on assumptions.
```

---

## Expected Behavior After Fix

### Scenario 1: Tools Work Correctly

**Subagent should**:
1. ✅ Call mcp__recce__row_count_diff({ "node_names": ["customers"] })
2. ✅ Wait for real response
3. ✅ Evaluate response: row count diff within threshold?
4. ✅ Return PASS/FAIL based on real data

**Log should show**:
```json
{"type": "tool_use", "name": "mcp__recce__row_count_diff", ...}
{"type": "tool_result", "content": [{"type": "text", "text": "{actual response}"}]}
```

### Scenario 2: Tools Fail (Connection Timeout)

**Subagent should**:
1. ✅ Attempt to call mcp__recce__row_count_diff
2. ✅ Receive error: "Connection timeout"
3. ✅ Mark check as ERROR
4. ✅ Report: "Tool execution failed: Connection timeout to Recce server"

**Output should be**:
```json
{
  "status": "ERROR",
  "summary": "Tool execution failed: Connection timeout",
  "tool_error": "Connection timeout to Recce MCP server"
}
```

### Scenario 3: Tools Not Available

**Subagent should**:
1. ✅ Discover it cannot call MCP tools
2. ✅ Mark ALL checks as ERROR
3. ✅ Report: "Tool calling not available"

**Output should be**:
```json
{
  "overallStatus": "FAIL",
  "errors": 4,
  "mergeRecommendation": "❌ DO NOT MERGE - Tool execution errors"
}
```

---

## Testing Verification

### How to Verify Fix Works

**Test 1: Check for Real Tool Calls**

```bash
# Run agent
npm start

# Check log for actual MCP tool calls (not just Task)
grep '"type":"tool_use"' logs/*.jsonl | jq -r '.data.message.content[] | select(.type=="tool_use") | .name' | sort | uniq

# Expected output should include:
# mcp__recce__get_lineage_diff
# mcp__recce__row_count_diff
# mcp__recce__query_diff
# mcp__recce__profile_diff

# NOT just:
# Task
```

**Test 2: Check for Real Tool Responses**

```bash
# Check log for tool results
grep '"type":"tool_result"' logs/*.jsonl | jq -r '.data.message.content[].tool_use_id' | head -10

# Should see tool_use_ids that match the tool calls
```

**Test 3: Check for Fabrication**

```bash
# Look for XML blocks in text output
grep '<tool_use>' logs/*.jsonl

# Should return ZERO results (subagent no longer writes XML in text)
```

**Test 4: Check Error Reporting**

```bash
# Simulate tool failure by stopping Recce server
# pkill -f "recce server"

# Run agent
npm start

# Check output for ERROR status
grep '"status":"ERROR"' logs/*.jsonl | wc -l

# Should be > 0 (subagent reports errors honestly)
```

---

## Remaining Issue: Tool Permissions

**Observation**: Even with anti-fabrication rules, subagents may still not call tools if they lack permissions.

**Subagent configuration** (src/prompts/index.ts:214):
```typescript
getRecceAnalysisSubagent(): SubagentConfig {
  return {
    description: RECCE_ANALYSIS_DESCRIPTION,
    model: 'haiku',
    tools: ['mcp__recce'],  // ← Pattern prefix, not specific tools
    prompt: RECCE_ANALYSIS_PROMPT,
  };
}
```

**Main agent configuration** (src/agent.ts:195-203):
```typescript
const allowedTools: string[] = [
  // Recce MCP tools
  'mcp__recce__get_lineage_diff',
  'mcp__recce__lineage_diff',
  'mcp__recce__schema_diff',
  'mcp__recce__row_count_diff',
  'mcp__recce__query',
  'mcp__recce__query_diff',
  'mcp__recce__profile_diff',
  // ...
];
```

**Hypothesis**:
- Main agent has explicit list of allowed tools
- Subagent has pattern `['mcp__recce']`
- Claude SDK may not correctly expand pattern to actual tools
- Result: Subagent may not have actual tool access

**Next Investigation**:
Need to check Claude Agent SDK documentation for:
1. How subagent tool permissions work
2. Whether pattern prefixes are supported
3. Whether subagents inherit from main agent's allowedTools

---

## Alternative: Main Agent Direct Tool Calling

**If subagents cannot call tools**, consider refactoring to:

### Option A: Main Agent Calls Tools Directly

```typescript
// Instead of delegating to subagents
const result = await agents['preset-check-executor']({
  prompt: 'Execute checks',
  presetChecks
});

// Main agent calls tools itself
const rowCountDiff = await callTool('mcp__recce__row_count_diff', {...});
const schemaDiff = await callTool('mcp__recce__schema_diff', {...});

// Then synthesizes results
const summary = synthesizePresetCheckResults(rowCountDiff, schemaDiff);
```

### Option B: Sequential Tool Calling

```typescript
// Main agent iterates through checks
for (const check of presetChecks) {
  const tool = mapCheckTypeToTool(check.type);
  const result = await callTool(tool, check.params);
  checkResults.push(evaluateResult(check, result));
}
```

---

## Build Result

```bash
✅ dist/index.js  846.6kb (+2.9kb from 843.7kb)
⏱️  29ms
```

**Size increase**: Minimal overhead for anti-fabrication rules.

---

## Files Modified

1. **src/prompts/fragments/preset_checks.ts** (+30 lines)
   - Removed XML example blocks
   - Added anti-fabrication rules
   - Added error reporting requirements
   - Added "base on facts" instructions

2. **src/prompts/fragments/recce_analysis.ts** (+12 lines)
   - Added anti-fabrication rules
   - Added error reporting requirements
   - Emphasized "real tool responses only"

---

## Summary

**Problem**: Subagents writing XML in text, fabricating results, not calling tools

**Root Causes**:
1. Misleading XML examples in prompts
2. No anti-fabrication rules
3. No error reporting requirements
4. Possible tool permission issues

**Solution**:
1. ✅ Removed XML examples
2. ✅ Added anti-fabrication rules
3. ✅ Required error reporting
4. ✅ Emphasized "facts only" evaluation

**Expected Outcome**:
- Subagents either call tools successfully OR report ERROR
- No more fabricated PASS results
- Honest reporting of limitations
- If tools fail, merge is blocked with clear error messages

**Status**: ✅ Build successful, ready for testing

**Next Steps**:
1. Test with running Recce server (tools should work)
2. Test with stopped Recce server (should see ERROR status)
3. Verify no more XML blocks in text output
4. Verify actual tool_use and tool_result in logs
5. If tools still don't work, investigate Claude SDK subagent permissions
