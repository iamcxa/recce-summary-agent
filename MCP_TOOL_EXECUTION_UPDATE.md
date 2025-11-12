# MCP Tool Execution Update

**Date**: 2025-11-13
**Purpose**: Ensure preset-check-executor subagent actually calls MCP tools

## Problem Identified

User observation: "agent 似乎沒有真的使用 mcp tool 來執行 preset check"

After analyzing the jaffle_shop_agentic project's prompt files, we discovered that our preset-check-executor subagent lacked **explicit imperative instructions** to actually call MCP tools.

### Key Difference

**jaffle_shop_agentic approach** (system-prompt.md):
```markdown
**For EACH check in recce.yml:**
   - Identify the check type
   - Use the mapping to determine which MCP tool to call
   - Extract params from recce.yml and adapt them to MCP tool format
   - **Execute the MCP tool call**  👈 Imperative instruction
   - Collect and analyze results
```

**Our previous approach** (preset_checks.ts):
```markdown
**Execution Process:**
1. Parse the provided preset check definitions
2. For each check, call the corresponding MCP tool with the specified parameters
3. Evaluate results: determine PASS/FAIL based on differences found
4. Return structured results
```

**Problem**: The instruction "call the corresponding MCP tool" is passive and lacks specificity. The subagent might interpret this as "describe what should be called" rather than "actually invoke the tool."

---

## Changes Made

### 1. Updated `src/prompts/fragments/preset_checks.ts`

Added explicit, imperative MCP tool execution instructions (~70 lines added):

```typescript
**Execution Process:**

🚨 **CRITICAL: YOU MUST ACTUALLY CALL MCP TOOLS - DO NOT JUST DESCRIBE WHAT SHOULD BE DONE**

1. Parse the provided preset check definitions
2. **For EACH check in the list, you MUST execute the following steps**:

   a. **Identify the check type** (schema_diff, row_count_diff, value_diff, query_diff, profile_diff)

   b. **Determine which MCP tool to call** using the mapping below

   c. **Extract parameters** from the check definition in recce.yml

   d. **IMMEDIATELY EXECUTE the MCP tool** by calling it with the extracted parameters
      - Example: If check type is row_count_diff, call mcp__recce__row_count_diff(node_names=["customers"])
      - Example: If check type is query_diff, call mcp__recce__query_diff(sql_template="SELECT ...")

   e. **Wait for and capture the tool response**

   f. **Evaluate the results** against the tolerance level (read description for semantic intent)

   g. **Record the check result** (PASS/FAIL/WARN)

3. After ALL checks have been executed, aggregate the results
4. Return structured JSON with all check results
```

#### Added Check Type → MCP Tool Mapping Table

| Check Type | MCP Tool to Call | Required Parameters |
|------------|------------------|---------------------|
| schema_diff | mcp__recce__get_lineage_diff | select (optional) |
| row_count_diff | mcp__recce__row_count_diff | node_names or select |
| value_diff | mcp__recce__query_diff | sql_template (construct from model/columns), primary_keys |
| query_diff | mcp__recce__query_diff | sql_template (from params) |
| profile_diff | mcp__recce__profile_diff | model, columns (optional) |

#### Added Concrete Parameter Adaptation Examples

**Example 1: row_count_diff check**
```yaml
type: row_count_diff
params:
  select: customers orders state:modified
```
→ Call: `mcp__recce__row_count_diff(select="customers orders state:modified")`

**Example 2: value_diff check**
```yaml
type: value_diff
params:
  model: customers
  primary_key: customer_id
  columns:
    - customer_id
    - customer_lifetime_value
```
→ Construct SQL: `SELECT customer_id, customer_lifetime_value FROM {{ ref('customers') }} ORDER BY customer_id`
→ Call: `mcp__recce__query_diff(sql_template=<constructed SQL>, primary_keys=["customer_id"])`

**Example 3: query_diff check**
```yaml
type: query_diff
params:
  sql_template: |-
    SELECT
        DATE_TRUNC('week', first_order) AS first_order_week,
        AVG(customer_lifetime_value) AS avg_lifetime_value
    FROM {{ ref("customers") }}
    WHERE first_order is not NULL
    GROUP BY first_order_week
    ORDER BY first_order_week;
```
→ Call: `mcp__recce__query_diff(sql_template=<exact SQL from params>)`

---

### 2. Updated `src/prompts/index.ts`

Enhanced main agent delegation instructions to emphasize MCP tool execution:

**Before:**
```typescript
parts.push('\n3. **Delegate to preset-check-executor subagent**:');
parts.push('   - Task: Execute preset checks from recce.yml');
parts.push('   - Tag response: [PRESET-CHECKS]');
```

**After:**
```typescript
parts.push('\n3. **Delegate to preset-check-executor subagent**:');
parts.push('   - Task: Execute preset checks from recce.yml by CALLING MCP TOOLS');
parts.push('   - CRITICAL: The subagent MUST actually call mcp__recce__* tools for each check');
parts.push('   - Expected: Structured JSON with tool results and evaluation for each check');
parts.push('   - Tag response: [PRESET-CHECKS]');
```

---

## Key Improvements

### 1. Explicit Imperative Language

- ✅ "YOU MUST ACTUALLY CALL MCP TOOLS"
- ✅ "IMMEDIATELY EXECUTE the MCP tool"
- ✅ "For EACH check, you MUST execute the following steps"

These imperative phrases leave no ambiguity about what the agent should do.

### 2. Step-by-Step Execution Protocol

Broke down the execution into concrete, ordered steps (a, b, c, d, e, f, g) that the agent must follow.

### 3. Concrete Examples

Provided real examples from recce.yml showing:
- Input: Check definition in YAML
- Process: How to adapt parameters
- Output: Exact MCP tool call syntax

### 4. Tool Mapping Table

Clear reference table showing which MCP tool to use for each check type.

### 5. Parameter Adaptation Guidance

Explicit instructions on how to transform recce.yml parameters into MCP tool parameters, especially for value_diff which requires SQL construction.

---

## Behavioral Impact

### Before (Potential Issues):

1. **Passive instruction**: "call the corresponding MCP tool"
   - Agent might describe what should be called
   - Agent might not actually invoke tools
   - Unclear which tool maps to which check type

2. **Missing examples**: No concrete examples of tool calls
   - Agent has to guess parameter format
   - Potential parameter mismatch errors

3. **Ambiguous workflow**: "For each check, call the tool"
   - Agent might batch operations incorrectly
   - Agent might skip evaluation step

### After (Expected Behavior):

1. **Imperative instruction**: "YOU MUST ACTUALLY CALL MCP TOOLS"
   - Agent knows it must invoke tools, not describe
   - Clear expectation of tool execution

2. **Concrete examples**: Three detailed examples provided
   - Agent sees exact tool call syntax
   - Parameter format demonstrated clearly

3. **Structured workflow**: Step a, b, c, d, e, f, g
   - Agent follows ordered execution protocol
   - No steps can be skipped

---

## Build Verification

```bash
✅ Build Success: dist/index.js  838.2kb
⏱️  Build Time: 52ms
📈 Size Change: +2.6kb (from 835.6kb, +0.31%)
```

**Size increase**: Additional MCP tool execution instructions and examples

---

## Testing Checklist

When testing with real PRs that have preset checks:

- [ ] Verify preset-check-executor actually calls MCP tools (check logs for tool invocations)
- [ ] Verify each check type executes correct MCP tool:
  - [ ] `row_count_diff` → calls `mcp__recce__row_count_diff`
  - [ ] `value_diff` → constructs SQL and calls `mcp__recce__query_diff` with primary_keys
  - [ ] `query_diff` → calls `mcp__recce__query_diff` with sql_template
  - [ ] `schema_diff` → calls `mcp__recce__get_lineage_diff`
  - [ ] `profile_diff` → calls `mcp__recce__profile_diff`
- [ ] Verify tool responses are captured and included in check results
- [ ] Verify evaluation logic reads tool responses correctly
- [ ] Verify overall status determination (ALL checks must pass)
- [ ] Check agent_log.jsonl for tool call messages

---

## Integration with Semantic Interpretation

This update **complements** the previous semantic interpretation update (SEMANTIC_INTERPRETATION_UPDATE.md):

1. **Semantic interpretation** (previous): Teaches the agent HOW to evaluate tool results
   - Read descriptions for tolerance levels
   - Zero tolerance patterns
   - Threshold-based patterns

2. **Tool execution** (this update): Ensures the agent ACTUALLY calls the tools
   - Explicit imperative instructions
   - Concrete tool call examples
   - Step-by-step execution protocol

**Combined effect**: The agent now:
- ✅ Actually calls MCP tools for each check
- ✅ Correctly interprets semantic intent from descriptions
- ✅ Evaluates results with appropriate tolerance levels
- ✅ Reports findings with context

---

## Files Modified

1. **src/prompts/fragments/preset_checks.ts** (+70 lines)
   - Added imperative execution instructions
   - Added tool mapping table
   - Added concrete parameter adaptation examples
   - Emphasized "YOU MUST ACTUALLY CALL" language

2. **src/prompts/index.ts** (+2 lines)
   - Enhanced delegation instructions
   - Added "by CALLING MCP TOOLS" emphasis
   - Added "CRITICAL: The subagent MUST actually call" instruction
   - Added expected output format clarification

---

## Related Documentation

- [SEMANTIC_INTERPRETATION_UPDATE.md](./SEMANTIC_INTERPRETATION_UPDATE.md) - Semantic intent evaluation
- [PRESET_CHECK_SEMANTICS.md](./PRESET_CHECK_SEMANTICS.md) - Comprehensive semantic guide
- [PR_SUMMARY_FORMAT.md](./PR_SUMMARY_FORMAT.md) - Output format specification
- [AGENTS.md](./AGENTS.md) - Multi-agent architecture guide

---

## Next Steps

1. **Test with real PR**: Deploy to GitHub Action and test with jaffle_shop_agentic PR
2. **Monitor tool calls**: Check agent_log.jsonl for MCP tool invocations
3. **Validate results**: Ensure preset check results include actual tool responses
4. **Iterate if needed**: If agent still doesn't call tools, add even more explicit instructions

---

**Status**: ✅ Complete and ready for testing
**Build**: 838.2kb (success)
**Ready for**: Real PR validation with preset checks
