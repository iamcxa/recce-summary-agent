/**
 * PR Summary Output Format
 *
 * Structured format for comprehensive PR validation summaries
 * Based on Recce PR Analysis format with detailed sections
 */

export const PR_SUMMARY_OUTPUT_FORMAT = `
## 🚨 CRITICAL: Output Format Requirements

**YOU MUST FOLLOW THIS EXACT FORMAT - NO DEVIATIONS ALLOWED**

This is the ONLY acceptable output format. Do NOT create your own structure.
Do NOT include implementation details, delegation notes, or internal process descriptions.
Output ONLY the user-facing PR validation summary following this template.

---

## Output Format: PR Validation Summary

You MUST structure your response with the following sections in this exact order.

**Title**: Use "# PR Validation Summary [YYYY-MM-DD]" as the main heading with current date.

---

## [REQUIRED] ⚠ Anomalies Detected

**Purpose**: Highlight critical issues and warnings detected during validation.

**Severity Indicators**:
- 🔴 **Critical issues**: Large value shifts, new NULL values, breaking changes
  - Example: "Large value shift: \`customers.customer_lifetime_value\` avg **-32.1%** (exceeds 30% threshold)"
  - Example: "New NULL values: **5 records** changed from non-NULL → NULL (IDs: \`101, 102, 103, 104, 105\`) — **2.3%**"
- ⚠️ **Warnings**: High-magnitude changes, threshold exceeded
  - Example: "High-magnitude changes: \`orders.total_amount\` **-15% ~ -25%**"
- ✅ **Stable metrics**: No issues detected
  - Example: "Row counts stable: All models maintained record counts within threshold"

**If no critical issues**, state: "✅ No critical anomalies detected"

**Anomaly Detection Criteria**:
- Row count changes exceeding threshold defined in recce.yml (or default 5%)
- Schema changes (added/removed/modified columns) that are breaking
- Profile metrics (avg/min/max/sum) exceeding specified thresholds
- Unexpected NULL values or data quality issues
- Query diff results showing significant variance
- **Preset checks**: ANY preset check failure is a critical anomaly
- **Tool execution errors**: ANY MCP tool call failure is a critical blocker

---

## [REQUIRED] Changes Overview

**Purpose**: Summarize model and column changes with downstream impact.

**Format**:
- Models: **X modified**, **Y new**, **Z removed**
- Direct Changes (columns): **N total** — **X modified**, **Y added**, **Z removed**
- Indirect Impact: **N downstream columns** across **M models**

**If less than 10 affected items**, use detailed format:

### Modified Columns
- \`model.column_name\` → description of change
- \`model.column_name\` → description of change

### Downstream Impact
- \`model.column_name\` → dependency explanation
- \`model.column_name\` → dependency explanation

### Affected Models
- Modified: \`model1\`, \`model2\`, \`model3\`
- New: \`new_model\`
- Removed: \`removed_model\` (if any)
- Downstream: \`downstream_model1\`, \`downstream_model2\`

**If more than 10 affected items**, use top-K format:

### Top Column Changes (by downstream impact)
- \`model.column_name\` → description of change
- \`model.column_name\` → description of change
- \`model.column_name\` → description of change
- [X more columns]

---

## [REQUIRED] ✅ Test Status

**Purpose**: Show validation status for each check type.

**Read recce.yml to determine what to test**. Status indicators:
- ✅ **Passed**: Schema validation, row count validation, profile checks within threshold
  - Example: "✅ Schema validation: **3 columns added**, no breaking changes"
  - Example: "✅ Row count validation: **all stable** (changes within ±5%)"
- ⚠️ **Warning**: Threshold exceeded but not critical
  - Example: "⚠️ Profile threshold exceeded: **>15% change in customer_lifetime_value avg**"
  - Example: "⚠️ NULL value increase: **5 records** in \`orders.customer_id\`"
- ❌ **Failed**: Critical failures, preset checks failed
  - Example: "❌ Preset check failed: 'stg_customers schema validation'"
  - Example: "❌ Breaking change: Column \`orders.order_date\` removed"
- 🔴 **Error**: Tool execution failed (blocker)
  - Example: "🔴 Tool execution error: 'mcp__recce__schema_diff' - Connection timeout"
  - Example: "🔴 Missing artifacts: manifest.json not found in target/ directory"

**🚨 CRITICAL**:
- If ANY preset check defined in recce.yml fails → mark as ❌
- If ANY tool call fails (ERROR status) → mark as 🔴 and set overall status to ❌
- Tool execution errors are BLOCKERS - PR cannot merge

---

## [OPTIONAL] 📊 Validation Results

**Show this section ONLY when Test Status contains ⚠️ or ❌**. Skip if all tests are ✅.

### Schema Diff

List schema changes for modified models:
- \`model.column_name\`: Type change, added, or removed

### Row Count Diff

**Use table format** when available:

| Model | Base Count | Current Count | Change | Percentage | Status |
|-------|-----------|---------------|--------|------------|--------|
| \`customers\` | 1000 | 1025 | +25 | +2.5% | ✅ Within |
| \`orders\` | 5000 | 4850 | -150 | -3.0% | ✅ Within |

**Or list format** if table not suitable:
- \`customers\`: 1025 (change: +25 rows, +2.5%, ✅ within threshold)
- \`orders\`: 4850 (change: -150 rows, -3.0%, ✅ within threshold)

### Profile Diff

**REQUIRED table format** for profile metrics:

| Metric | Current | Change | Threshold | Status |
|--------|---------|--------|-----------|--------|
| \`customers.customer_lifetime_value\` (avg) | 124.8 | -32.1% | 30% | ⚠️ Exceeded |
| \`customers.net_customer_lifetime_value\` (avg) | 98.4 | +2.3% | 30% | ✅ Within |
| \`orders.total_amount\` (sum) | 1245320 | -4.8% | 10% | ✅ Within |

**Or list format** if table incomplete:
- \`customers.customer_lifetime_value\` (avg): 124.8 (change: -32.1%, threshold: 30%, ⚠️ exceeded)
- \`customers.net_customer_lifetime_value\` (avg): 98.4 (change: +2.3%, threshold: 30%, ✅ within)

### Top-K Affected Records

**Include ONLY when significant record-level anomalies detected**:

| Record ID | Previous Value | Current Value | Change | Note |
|-----------|----------------|---------------|--------|------|
| 101 | 150.5 | 98.2 | -34.8% | Significant drop |
| 102 | 200.0 | NULL | -100% | Became NULL |
| 103 | 175.3 | 120.1 | -31.5% | Significant drop |

---

## [REQUIRED] 🔍 Suggested Checks

**Purpose**: Provide actionable recommendations for further validation with links to Recce checks.

**Format**: Action-oriented suggestions with specific references.

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
- Investigate drivers of \`customers.customer_lifetime_value\` avg **-32.1%**; confirm the discount logic change is intentional. Link to profile diff in \`customers.customer_lifetime_value\`
- Verify if the **5 newly NULL** records in \`orders.customer_id\` are expected (data quality or model logic issue?). Link to value diff in \`orders.customer_id\`
- Validate whether downstream model \`rpt_daily_sales\` shows unreasonable changes. Link to query diff in \`rpt_daily_sales\`
- Confirm business logic changes in \`stg_orders\` align with requirements. Link to schema diff in \`stg_orders\`

---

## Formatting Guidelines

**Key Principles**:
- Use emoji for visual hierarchy: 🔴 (critical), ⚠️ (warning), ✅ (ok), 📊 (data), 🔍 (suggestion)
- **Bold** important values: **-32.1%**, **5 records**, **confirmed and expected**
- Use backticks for code references: \`model.column_name\`, \`id1, id2, id3\`
- Separate major sections with \`---\` horizontal rules
- Use tables for structured data (row counts, profile metrics, top-K records)
- Include hints in blockquotes when helpful: > **Note**: ...
- **Always provide concrete values**, never use placeholders like "X%", "N records"
- Keep language concise and action-oriented
- Use proper markdown table formatting with aligned columns

---

## Output Validation Checklist

Before submitting your response, verify:
- [ ] Main title is "# PR Validation Summary [YYYY-MM-DD]" with current date
- [ ] All [REQUIRED] sections are included in order
- [ ] Section titles match exactly (including emoji indicators)
- [ ] Major sections separated with \`---\` horizontal rules
- [ ] Profile Diff uses table format (or list with explanation)
- [ ] **Concrete values** used instead of placeholders
- [ ] Based on actual MCP tool results from subagents, not assumptions
- [ ] Preset check failures (if any) are marked as ❌ in Test Status
- [ ] Anomalies section includes preset check failures as 🔴 critical issues

---

## Special Notes for Preset Checks

**CRITICAL**: Preset checks defined in recce.yml are MANDATORY validations.

**Evaluation Logic**:
- **ALL preset checks must PASS** for overall validation to pass
- If ANY preset check fails → Mark as ❌ in Test Status
- Include preset check failures in Anomalies Detected section as 🔴 critical
- Thresholds for preset checks come from recce.yml definitions

**Preset Check Status Determination**:

**CRITICAL**: Read each check's **description** in recce.yml to understand tolerance level.

Common semantic patterns:
- "should not be changed" → **ZERO TOLERANCE** (any difference = FAIL)
- "should be 100% matched" → **ZERO TOLERANCE** (any mismatch = FAIL)
- "should be within X%" → **EXPLICIT THRESHOLD** (use X%)

**By Check Type**:
- schema_diff: PASS if no breaking changes, WARN if new columns, FAIL if breaking
- row_count_diff: Use threshold from params/description or ±5% default
- value_diff: **Usually ZERO TOLERANCE** - Any mismatch = FAIL (unless description allows variance)
- query_diff: **Usually ZERO TOLERANCE** - Any difference = FAIL (unless description allows variance)
- profile_diff: Use threshold from params/description or ±10% default

**Examples**:
(yaml examples)
# Example 1: Zero tolerance for query diff
description: The average of customer_lifetime_value should not be changed
→ Even 0.01% change = FAIL

# Example 2: Zero tolerance for value diff
description: The customer_lifetime_value in customers should be 100% matched
→ Even 1 mismatched record = FAIL

# Example 3: Explicit threshold
description: Row count should be stable within 10%
params:
  threshold: 10
→ ±10% allowed, exceeding = FAIL
(end yaml examples)

**Integration with MCP Analysis**:
1. Preset check executor subagent returns structured JSON with check results
2. You synthesize preset check results with MCP tool results (lineage_diff, row_count_diff, etc.)
3. If preset checks pass BUT MCP tools detect anomalies → Overall status is ⚠️ (warning)
4. If preset checks fail OR critical MCP anomalies → Overall status is ❌ (failed)
5. If preset checks pass AND no MCP anomalies → Overall status is ✅ (passed)

`;

export function getPRSummaryOutputInstruction(hasPresetChecks: boolean = false): string {
  let instruction = PR_SUMMARY_OUTPUT_FORMAT;

  if (!hasPresetChecks) {
    instruction += `\n\n**Note**: No preset checks defined in recce.yml. Focus validation on MCP tool analysis (lineage, row counts, profiles, queries).`;
  } else {
    instruction += `\n\n**Note**: Preset checks are defined in recce.yml. Ensure ALL preset checks are evaluated and their status reported accurately.`;
  }

  return instruction;
}
