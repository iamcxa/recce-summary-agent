/**
 * Output format instructions for PR/Repo analysis summary
 * Unified format highlighting Recce tool capabilities
 */

/**
 * Unified Summary Format - Comprehensive PR validation with Recce analysis
 * Combines best practices from markdown reporting and structured validation
 */
export const UNIFIED_SUMMARY_FORMAT = `## Output Format: Comprehensive Summary with Recce Analysis

You MUST structure your response with the following sections in this exact order.

**Title**: Use "# PR Analysis Summary [YYYY-MM-DD]" as the main heading with current date.

---

## [REQUIRED] ⚠ Anomalies Detected

**Purpose**: Highlight critical issues and warnings detected during validation.

**Severity Indicators**:
- 🔴 **Critical issues**: Large value shifts, new NULL values, breaking changes
  - Example: "Large value shift: \`customers.customer_lifetime_value\` avg **-32.1%** (exceeds 30% threshold)"
  - Example: "New NULL values: **5 records** changed from non-NULL → NULL (IDs: \`101, 102, 103, 104, 105\`) — **2.3%**"
  - Example: "Breaking change: Column \`orders.order_date\` removed"
- ⚠️ **Warnings**: High-magnitude changes, threshold exceeded
  - Example: "High-magnitude changes: \`orders.total_amount\` **-15% ~ -25%**"
  - Example: "New columns added: \`customers.loyalty_tier\` (non-breaking)"
- ✅ **Stable metrics**: No issues detected
  - Example: "Row counts stable: All models maintained record counts within threshold"

**If no critical issues**, state: "✅ No critical anomalies detected"

**Anomaly Detection Criteria** (powered by Recce):
- Schema changes (added/removed/modified columns) via \`schema_diff\`
- Row count changes via \`row_count_diff\`
- Profile metrics (avg/min/max/sum) via \`profile_diff\`
- Value mismatches via \`query_diff\` and \`value_diff\`
- Lineage changes via \`lineage_diff\`

---

## [REQUIRED] dbt Model Changes

**Purpose**: Summarize model and column changes with Recce lineage analysis.

**Format**:
- **Models**: X modified, Y new, Z removed
- **Direct Changes** (columns): N total — X modified, Y added, Z removed
- **Indirect Impact**: N downstream columns across M models

### Modified Models
List modified dbt models with description of changes:
- \`model_name\` → description of change
- Use Recce \`lineage_diff\` results to identify affected models

### New Models
List newly created dbt models (if any):
- \`new_model\` → purpose and dependencies

### Removed Models
List deprecated/deleted models (if any):
- \`removed_model\` → impact on downstream dependencies

### Schema Changes
Detail column additions, removals, and type changes (from Recce \`schema_diff\`):
- \`model.column_name\` → Type change / Added / Removed
- Highlight breaking vs non-breaking changes

### Downstream Impact
Show affected downstream models (from Recce \`lineage_diff\`):
- \`downstream_model\` → How it's impacted by changes

---

## [REQUIRED] 📊 Recce Validation Results

**Purpose**: Show detailed validation results from Recce MCP tools.

### Row Count Analysis
**Use table format** when available (from \`row_count_diff\`):

| Model | Base Count | Current Count | Change | Percentage | Status |
|-------|-----------|---------------|--------|------------|--------|
| \`customers\` | 1000 | 1025 | +25 | +2.5% | ✅ Within |
| \`orders\` | 5000 | 4850 | -150 | -3.0% | ✅ Within |

**Or list format** if table not suitable:
- \`customers\`: 1025 (change: +25 rows, +2.5%, ✅ within threshold)

### Schema Diff Summary
List schema changes detected by Recce \`schema_diff\`:
- \`model.column_name\`: Type change, added, or removed
- Indicate breaking vs non-breaking changes

### Profile Metrics
**REQUIRED table format** for profile metrics (from \`profile_diff\`):

| Metric | Current | Change | Threshold | Status |
|--------|---------|--------|-----------|--------|
| \`customers.customer_lifetime_value\` (avg) | 124.8 | -32.1% | 30% | ⚠️ Exceeded |
| \`customers.net_customer_lifetime_value\` (avg) | 98.4 | +2.3% | 30% | ✅ Within |

### Query Diff Results
Show results from \`query_diff\` checks (if executed):
- Aggregated metrics comparison
- Specific differences found in query results

---

## [REQUIRED] Impact Analysis

**Purpose**: Assess overall impact and provide recommendations.

### Data Quality
Assess based on Recce validation results:
- Impact on data quality and reliability
- Potential data consistency issues

### Breaking Changes
Identify schema changes that break compatibility:
- List specific breaking changes from \`schema_diff\`
- Impact on downstream consumers

### Performance
Note potential performance implications:
- Large row count changes
- Complex query modifications
- New model dependencies

### Recommendations
Provide actionable recommendations for reviewers:
- Priority items to address before merge
- Testing suggestions
- Documentation updates needed

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
- **Bold** important values: **-32.1%**, **5 records**, **PASS**
- Use backticks for code references: \`model.column_name\`, \`tool_name\`
- Separate major sections with \`---\` horizontal rules
- Use tables for structured data (row counts, profile metrics)
- Include hints in blockquotes when helpful: > **Note**: ...
- **Always provide concrete values**, never use placeholders like "X%", "N records"
- Keep language concise and action-oriented
- Use proper markdown table formatting with aligned columns

---

## Output Validation Checklist

Before submitting your response, verify:
- [ ] Main title is "# PR Analysis Summary [YYYY-MM-DD]" with current date
- [ ] All [REQUIRED] sections are included in order
- [ ] Section titles match exactly (including emoji indicators)
- [ ] Major sections separated with \`---\` horizontal rules
- [ ] Recce tool results prominently featured
- [ ] **Concrete values** used instead of placeholders
- [ ] Based on actual MCP tool results from subagents, not assumptions
`;

/**
 * Additional instructions for when preset checks are available
 */
export const PRESET_CHECKS_OUTPUT_ADDITION = `
---

## [REQUIRED] ✅ Preset Check Results

**Purpose**: Show validation status for each preset check defined in recce.yml.

**Status indicators**:
- ✅ **Passed**: Check criteria met, no issues
- ⚠️ **Warning**: Threshold exceeded but not critical
- ❌ **Failed**: Critical validation failure
- 🔴 **Error**: Tool execution failed (blocker)

**Format**:

### Overall Status
[✅ PASS / ⚠️ WARN / ❌ FAIL] - X/Y checks passed

### Check Summary Table

| Check Name | Type | Status | Summary |
|------------|------|--------|---------|
| Check 1 | schema_diff | ✅ PASS | No breaking changes |
| Check 2 | row_count_diff | ⚠️ WARN | +12% exceeds 10% threshold |
| Check 3 | value_diff | ❌ FAIL | 23 mismatched records |

### Failed Checks (if any)
For each failed check, provide:
- **Check name** and description
- **What was checked**: Specific models/columns
- **Expected**: What should have passed
- **Actual**: What was found
- **Impact**: Why this matters

### Warnings (if any)
List warnings that require attention but are not blockers.

**🚨 CRITICAL**:
- If ANY preset check defined in recce.yml fails → overall status is ❌
- If ANY tool call fails (ERROR status) → overall status is ❌ and PR is blocked
- Include preset check failures in "Anomalies Detected" section as 🔴 critical

**Integration**:
- Preset check results should be incorporated into the main "Anomalies Detected" section
- Failed preset checks are CRITICAL anomalies
- Include specific check names and details in "Suggested Checks" section
`;

/**
 * Get output format instruction based on whether preset checks are available
 */
export function getOutputFormatInstruction(hasPresetChecks = false): string {
  if (hasPresetChecks) {
    return `${UNIFIED_SUMMARY_FORMAT}\n${PRESET_CHECKS_OUTPUT_ADDITION}`;
  }
  return UNIFIED_SUMMARY_FORMAT;
}
