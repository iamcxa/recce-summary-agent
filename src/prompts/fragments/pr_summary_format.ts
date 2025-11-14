/**
 * PR Summary Output Format Base Template
 *
 * Provides the foundational structure for PR validation summaries.
 * Preset check integration rules are managed in preset_checks.ts.
 */

export const SUMMARY_FORMAT_BASE = `
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
- Row count changes exceeding threshold (default 5%)
- Schema changes (added/removed/modified columns) that are breaking
- Profile metrics (avg/min/max/sum) exceeding specified thresholds
- Unexpected NULL values or data quality issues
- Query diff results showing significant variance

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

**Status indicators**:
- ✅ **Passed**: Schema validation, row count validation, profile checks within threshold
  - Example: "✅ Schema validation: **3 columns added**, no breaking changes"
  - Example: "✅ Row count validation: **all stable** (changes within ±5%)"
- ⚠️ **Warning**: Threshold exceeded but not critical
  - Example: "⚠️ Profile threshold exceeded: **>15% change in customer_lifetime_value avg**"
  - Example: "⚠️ NULL value increase: **5 records** in \`orders.customer_id\`"
- ❌ **Failed**: Critical failures
  - Example: "❌ Breaking change: Column \`orders.order_date\` removed"
- 🔴 **Error**: Tool execution failed (blocker)
  - Example: "🔴 Tool execution error: 'mcp__recce__schema_diff' - Connection timeout"
  - Example: "🔴 Missing artifacts: manifest.json not found in target/ directory"

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

**Purpose**: Provide actionable recommendations for further validation.

**Format**: Action-oriented suggestions with specific references.

Examples:
- Investigate drivers of \`customers.customer_lifetime_value\` avg **-32.1%**; confirm the discount logic change is intentional
- Verify if the **5 newly NULL** records in \`orders.customer_id\` are expected (data quality or model logic issue?)
- Validate whether downstream model \`rpt_daily_sales\` shows unreasonable changes
- Confirm business logic changes in \`stg_orders\` align with requirements

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
`;
