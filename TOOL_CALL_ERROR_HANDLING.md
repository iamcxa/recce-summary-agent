# Tool Call Error Handling Implementation

**Date**: 2025-11-13
**Purpose**: Handle MCP tool call failures as merge blockers with explicit validation failure reporting

## Problem Statement

**User Requirement**:
```
我注意到一個問題，請調整流程，如果 tool call 失敗，則視為失敗不可以 merge，且需要指出哪一段檢驗有錯
```

Translation:
- If tool call fails → treat as FAIL (cannot merge)
- Must explicitly indicate which validation failed
- Tool execution failures are blockers

---

## Architecture Overview

### Error Flow

```
Tool Call Failure
    ↓
Check Status = ERROR
    ↓
Overall Status = FAIL
    ↓
Merge Recommendation = ❌ DO NOT MERGE
    ↓
Output shows 🔴 indicator + specific error details
```

### Error Detection Points

1. **Connection Timeout**: Recce MCP server unreachable
2. **Error Response**: Tool returns error status
3. **Invalid Parameters**: Tool rejects input
4. **Missing Artifacts**: dbt manifest.json not found

---

## Implementation Details

### 1. Preset Check Executor (src/prompts/fragments/preset_checks.ts)

#### Added Error Handling Rules

**Lines 208-219**: Tool Call Failure Handling Section

```typescript
**🚨 CRITICAL: Tool Call Failure Handling**

If ANY MCP tool call fails (error response, timeout, connection issue):
1. Mark that specific check as status: "ERROR"
2. Set overall status to "FAIL" (not "ERROR")
3. In summary field, clearly state: "Tool execution failed: [error message]"
4. In details.evaluation, explain:
   - Which tool was called
   - What parameters were used
   - What error occurred
   - Why this is a blocker for merge
```

**Key Design Decision**: Overall status is "FAIL" (not "ERROR") to maintain compatibility with existing status checks. The ERROR status is check-level only.

#### Enhanced Return Format

**Lines 236-260**: Added error tracking fields

```json
{
  "presetCheckResults": [
    {
      "name": "check-name",
      "type": "schema_diff|row_count_diff|value_diff|query_diff",
      "status": "PASS|FAIL|WARN|ERROR",  // ← ERROR status added
      "summary": "Brief one-line summary",
      "details": {
        "tool_called": "mcp__recce__schema_diff",
        "tool_params": { /* parameters sent to tool */ },
        "tool_response": { /* raw MCP tool response */ } | null,
        "tool_error": "error message if tool failed" | null,  // ← NEW
        "evaluation": "Detailed explanation of why PASS/FAIL/ERROR"
      }
    }
  ],
  "overallStatus": "PASS|FAIL",
  "totalChecks": number,
  "passed": number,
  "failed": number,
  "warnings": number,
  "errors": number,  // ← NEW: Count of ERROR status checks
  "mergeRecommendation": "✅ SAFE TO MERGE" | "❌ DO NOT MERGE - Validation failures detected" | "❌ DO NOT MERGE - Tool execution errors"  // ← NEW
}
```

#### Merge Recommendation Logic

**Lines 262-266**: Explicit merge decision rules

```typescript
**Merge Recommendation Logic**:
- overallStatus = "PASS" AND errors = 0 → "✅ SAFE TO MERGE"
- overallStatus = "FAIL" AND errors = 0 → "❌ DO NOT MERGE - Validation failures detected"
- errors > 0 → "❌ DO NOT MERGE - Tool execution errors"
```

**Truth Table**:

| Overall Status | Errors | Merge Recommendation | Reason |
|---------------|--------|----------------------|--------|
| PASS | 0 | ✅ SAFE TO MERGE | All checks passed |
| PASS | >0 | ❌ DO NOT MERGE - Tool execution errors | Impossible state (errors should cause FAIL) |
| FAIL | 0 | ❌ DO NOT MERGE - Validation failures detected | Checks failed validation |
| FAIL | >0 | ❌ DO NOT MERGE - Tool execution errors | Tool failures prevent validation |

### 2. PR Summary Output Format (src/prompts/fragments/pr_summary_format.ts)

#### Added Error Status Indicators

**Lines 101-108**: Test Status section

```markdown
- 🔴 **Error**: Tool execution failed (blocker)
  - Example: "🔴 Tool execution error: 'mcp__recce__schema_diff' - Connection timeout"
  - Example: "🔴 Missing artifacts: manifest.json not found in target/ directory"

**🚨 CRITICAL**:
- If ANY preset check defined in recce.yml fails → mark as ❌
- If ANY tool call fails (ERROR status) → mark as 🔴 and set overall status to ❌
- Tool execution errors are BLOCKERS - PR cannot merge
```

#### Updated Anomaly Detection Criteria

**Lines 42-49**: Anomalies Detected section

```markdown
**Anomaly Detection Criteria**:
- Row count changes exceeding threshold defined in recce.yml (or default 5%)
- Schema changes (added/removed/modified columns) that are breaking
- Profile metrics (avg/min/max/sum) exceeding specified thresholds
- Unexpected NULL values or data quality issues
- Query diff results showing significant variance
- **Preset checks**: ANY preset check failure is a critical anomaly
- **Tool execution errors**: ANY MCP tool call failure is a critical blocker  // ← NEW
```

#### Enhanced Suggested Checks

**Lines 167-184**: Suggested Checks section

```markdown
**If tool execution errors occurred, MUST include**:
- Fix tool execution error before merge: [specific tool and error]
- Verify Recce MCP server connection and dbt artifacts
- Check that manifest.json exists in target/ and target-base/ directories
- Ensure Recce project is properly configured

**If validation failures occurred, MUST include**:
- Investigate specific check failures with concrete metrics
- Verify if threshold exceedances are expected
- Confirm business logic changes align with requirements

Examples:
- 🔴 **BLOCKER**: Fix tool execution error: 'mcp__recce__schema_diff' failed with connection timeout. Verify Recce server is running.
- ❌ **BLOCKER**: Preset check 'customers value_diff' failed: **23 mismatched records** detected (IDs: 101-123). Description requires 100% match.
- Investigate drivers of \`customers.customer_lifetime_value\` avg **-32.1%**; confirm the discount logic change is intentional.
```

---

## Error Scenarios and Handling

### Scenario 1: Connection Timeout

**Trigger**: Recce MCP server not running or unreachable

**Agent Behavior**:
1. Tool call: `mcp__recce__schema_diff` returns timeout error
2. Preset check executor marks check as ERROR
3. Overall status set to FAIL
4. Error count incremented

**Output Example**:
```markdown
### ✅ Test Status

- 🔴 **Error**: Tool execution failed: 'mcp__recce__schema_diff' - Connection timeout after 30s

### 🔍 Suggested Checks

- 🔴 **BLOCKER**: Fix tool execution error: 'mcp__recce__schema_diff' failed with connection timeout. Verify Recce server is running.
- Check Recce MCP server is started: `recce server --cloud`
- Verify MCP server URL in configuration: http://0.0.0.0:8080/sse
```

### Scenario 2: Missing dbt Artifacts

**Trigger**: manifest.json not found in target/ or target-base/

**Agent Behavior**:
1. Tool call: `mcp__recce__lineage_diff` returns artifact error
2. Preset check executor marks check as ERROR
3. Overall status set to FAIL
4. Error details logged

**Output Example**:
```markdown
### ✅ Test Status

- 🔴 **Error**: Missing artifacts - manifest.json not found in target/ directory

### 🔍 Suggested Checks

- 🔴 **BLOCKER**: Fix tool execution error: Missing dbt artifacts. Run `dbt compile` first.
- Verify target/ directory exists and contains manifest.json
- Verify target-base/ directory exists with base environment artifacts
- Ensure RECCE_PROJECT_PATH environment variable points to correct directory
```

### Scenario 3: Invalid Tool Parameters

**Trigger**: Tool receives malformed parameters (e.g., invalid column name)

**Agent Behavior**:
1. Tool call: `mcp__recce__profile_diff` rejects parameters
2. Preset check executor marks check as ERROR
3. Overall status set to FAIL
4. Parameter details logged

**Output Example**:
```markdown
### ✅ Test Status

- 🔴 **Error**: Invalid parameters for 'mcp__recce__profile_diff' - Column 'invalid_column' does not exist in model 'customers'

### 🔍 Suggested Checks

- 🔴 **BLOCKER**: Fix tool execution error: Invalid column reference. Check recce.yml preset check configuration.
- Verify column names in preset checks match actual model schema
- Run `dbt docs generate` to see available columns
- Update recce.yml with correct column references
```

### Scenario 4: Tool Returns Error Status

**Trigger**: Tool executes but returns error response (e.g., SQL syntax error)

**Agent Behavior**:
1. Tool call: `mcp__recce__query_diff` returns error status
2. Preset check executor marks check as ERROR
3. Overall status set to FAIL
4. SQL error details logged

**Output Example**:
```markdown
### ✅ Test Status

- 🔴 **Error**: SQL execution failed in 'mcp__recce__query_diff' - syntax error at line 3: unexpected token 'FORM'

### 🔍 Suggested Checks

- 🔴 **BLOCKER**: Fix tool execution error: SQL syntax error in query_diff check. Review SQL template.
- Check SQL template in recce.yml for syntax errors
- Verify SQL is compatible with your warehouse (BigQuery/Snowflake/Postgres)
- Test SQL directly in your warehouse to debug
```

---

## Status Priority Matrix

When multiple issues occur, the output prioritizes by severity:

| Priority | Status | Indicator | Example |
|----------|--------|-----------|---------|
| 1 (Highest) | ERROR | 🔴 | Tool execution failed |
| 2 | FAIL | ❌ | Preset check failed validation |
| 3 | WARN | ⚠️ | Threshold exceeded (non-critical) |
| 4 (Lowest) | PASS | ✅ | All checks passed |

**Aggregation Rules**:
- If ANY check is ERROR → Overall status = FAIL, show 🔴 in Anomalies
- If ANY check is FAIL (but no ERROR) → Overall status = FAIL, show ❌ in Anomalies
- If ANY check is WARN (but no FAIL/ERROR) → Overall status = PASS, show ⚠️ in Anomalies
- If ALL checks are PASS → Overall status = PASS, show ✅ in Anomalies

---

## Testing Checklist

### Manual Testing Scenarios

#### Test 1: Tool Connection Failure
- [ ] Stop Recce MCP server
- [ ] Run agent analysis
- [ ] Verify ERROR status appears in output
- [ ] Verify "❌ DO NOT MERGE - Tool execution errors" recommendation
- [ ] Verify specific tool and error message shown

#### Test 2: Missing dbt Artifacts
- [ ] Remove target/manifest.json
- [ ] Run agent analysis
- [ ] Verify ERROR status for lineage checks
- [ ] Verify Suggested Checks mentions artifact paths
- [ ] Verify merge recommendation blocks merge

#### Test 3: Invalid Parameters
- [ ] Add preset check with non-existent column
- [ ] Run agent analysis
- [ ] Verify ERROR status with parameter details
- [ ] Verify Suggested Checks mentions configuration fix

#### Test 4: Mixed Status (ERROR + FAIL)
- [ ] Cause tool failure AND validation failure
- [ ] Verify both appear in output
- [ ] Verify ERROR takes precedence in merge recommendation
- [ ] Verify both issues listed in Suggested Checks

#### Test 5: Normal Success Path
- [ ] Ensure all tools working
- [ ] Ensure all checks pass
- [ ] Verify "✅ SAFE TO MERGE" recommendation
- [ ] Verify no 🔴 or ❌ indicators

---

## Integration Points

### 1. Subagent Communication

**preset-check-executor subagent** must return structured JSON:

```json
{
  "presetCheckResults": [...],
  "overallStatus": "PASS|FAIL",
  "errors": 2,  // ← Must track ERROR count
  "mergeRecommendation": "❌ DO NOT MERGE - Tool execution errors"  // ← Must include
}
```

### 2. Main Agent Synthesis

**Main agent** (src/agent.ts) receives subagent results and:
1. Parses `presetCheckResults` array
2. Identifies checks with `status: "ERROR"`
3. Extracts `tool_error` field for each ERROR check
4. Formats output according to pr-summary template
5. Includes `mergeRecommendation` at end

### 3. Output Format Validation

Before submitting, verify:
- [ ] Main title is "# PR Validation Summary"
- [ ] All [REQUIRED] sections included
- [ ] 🔴 indicators for ERROR checks
- [ ] ❌ indicators for FAIL checks
- [ ] Suggested Checks lists ALL blockers first
- [ ] Merge recommendation present at end

---

## Environment Variables

No new environment variables added. Uses existing:

```bash
# Recce MCP Server
RECCE_PROJECT_PATH=/path/to/jaffle_shop
RECCE_REVIEW_MODE=base_and_current

# dbt Artifacts (implicit)
# Must exist: ${RECCE_PROJECT_PATH}/target/manifest.json
# Must exist: ${RECCE_PROJECT_PATH}/target-base/manifest.json
```

---

## Error Recovery Guide

### If You See: "🔴 Tool execution error: Connection timeout"

**Solution**:
```bash
# 1. Start Recce server
cd /path/to/jaffle_shop
recce server --cloud

# 2. Verify server is running
curl http://0.0.0.0:8080/sse

# 3. Re-run agent
npm start
```

### If You See: "🔴 Missing artifacts: manifest.json"

**Solution**:
```bash
# 1. Compile dbt project (base environment)
cd /path/to/jaffle_shop
dbt compile

# 2. Copy artifacts to target-base/
mkdir -p target-base
cp target/manifest.json target-base/

# 3. Switch to PR branch
git checkout feature/my-pr-branch

# 4. Compile again (current environment)
dbt compile

# 5. Verify artifacts exist
ls -la target/manifest.json target-base/manifest.json

# 6. Re-run agent
cd /path/to/recce-summary-agent
npm start
```

### If You See: "🔴 Invalid parameters: Column 'x' does not exist"

**Solution**:
```bash
# 1. Check recce.yml preset check configuration
cat recce.yml

# 2. Verify model schema
dbt docs generate
# Open docs and check column names

# 3. Update recce.yml with correct column names
vim recce.yml

# 4. Re-run agent
npm start
```

---

## Future Enhancements

### 1. Retry Logic

Add automatic retry for transient failures:

```typescript
async function callToolWithRetry(tool: string, params: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callTool(tool, params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
}
```

### 2. Error Categorization

Add error categories for better diagnostics:

```typescript
enum ErrorCategory {
  CONNECTION = 'connection',      // Server unreachable
  AUTHENTICATION = 'auth',        // Token invalid
  ARTIFACTS = 'artifacts',        // Missing manifest.json
  PARAMETERS = 'parameters',      // Invalid input
  EXECUTION = 'execution',        // SQL error, etc.
}
```

### 3. Error Recovery Suggestions

AI-generated recovery suggestions based on error type:

```markdown
### 🔍 AI-Suggested Recovery Steps

Based on the connection timeout error, try:
1. Check if Recce server is running: `ps aux | grep recce`
2. Restart server: `recce server --cloud --port 8080`
3. Verify network connectivity: `curl http://0.0.0.0:8080/health`
```

---

## Summary

**Problem**: Tool call failures were not treated as merge blockers, and specific failures were not clearly identified.

**Solution**:
1. Added ERROR status for tool call failures
2. ERROR status causes overall FAIL status
3. Enhanced output with 🔴 indicators
4. Added explicit merge recommendation
5. Suggested Checks lists specific errors and recovery steps

**Impact**:
- ✅ Tool failures now block merge
- ✅ Specific check failures clearly identified
- ✅ Actionable recovery steps provided
- ✅ Explicit merge recommendation shown
- ✅ No false positives (PASS when tools errored)

**Files Modified**:
- `src/prompts/fragments/preset_checks.ts` (+60 lines)
- `src/prompts/fragments/pr_summary_format.ts` (+20 lines)

**Build**: 843.7kb (+2.5kb from 841.2kb)

**Status**: ✅ Ready for testing

**Next Step**: Manual testing with simulated tool failures to verify ERROR handling
