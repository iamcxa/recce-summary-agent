# Preset Check Semantic Interpretation Guide

**Date**: 2025-11-13
**Purpose**: Document how to interpret preset check descriptions for accurate evaluation

## Overview

Preset checks in `recce.yml` are not just technical validations—they encode **business expectations** and **data quality requirements**. The `description` field is critical for understanding the intended tolerance level.

## Key Principle

**The description field defines the semantic intent and tolerance level of a check.**

Don't just look at the check type (`query_diff`, `value_diff`, etc.)—read the description to understand what the team expects.

## Common Semantic Patterns

### 1. Zero Tolerance (No Changes Allowed)

#### Pattern: "should not be changed"

**Example**:
```yaml
- name: Query diff of customers avg lifetime value
  description: The average of customer_lifetime_value should not be changed
  type: query_diff
  params:
    sql_template: |-
      SELECT AVG(customer_lifetime_value) AS avg_lifetime_value
      FROM {{ ref("customers") }}
```

**Interpretation**:
- ✅ PASS: Query results are **identical** between base and current
- ❌ FAIL: **Any difference**, even 0.01%, is a validation failure

**Why**: The team has determined that this metric is critical and must remain stable. Any change indicates a data quality issue or unintended model change.

#### Pattern: "should be 100% matched"

**Example**:
```yaml
- name: Value diff of customers
  description: The customer_lifetime_value in customers should be 100% matched
  type: value_diff
  params:
    model: customers
    primary_key: customer_id
    columns:
      - customer_id
      - customer_lifetime_value
```

**Interpretation**:
- ✅ PASS: **All records** match perfectly (primary key + column values)
- ❌ FAIL: **Even 1 mismatched record** is a validation failure

**Why**: This column is critical for downstream reporting. Any mismatch means data integrity is compromised.

### 2. Explicit Threshold (Variance Allowed)

#### Pattern: "should be within X%"

**Example**:
```yaml
- name: Row count stability check
  description: Row count should be stable within 10%
  type: row_count_diff
  params:
    model: stg_orders
    threshold: 10
```

**Interpretation**:
- ✅ PASS: Row count change is within ±10%
- ❌ FAIL: Row count change exceeds ±10%

**Why**: Some variance is expected due to business seasonality, but large changes indicate data pipeline issues.

### 3. Implicit Threshold (Reasonable Defaults)

#### Pattern: "should be stable"

**Example**:
```yaml
- name: Schema stability
  description: Schema should be stable with no breaking changes
  type: schema_diff
  params:
    model: dim_customers
```

**Interpretation**:
- ✅ PASS: No breaking changes (removed columns, type changes)
- ⚠️ WARN: New columns added (non-breaking)
- ❌ FAIL: Breaking changes detected

**Why**: Schema changes can break downstream queries and reports.

## Check Type Default Behaviors

### query_diff

**Default**: **ZERO TOLERANCE** unless description specifies otherwise

**Reasoning**: Query results typically represent aggregated business metrics. Any change should be intentional and verified.

**Common descriptions**:
- ❌ "should not change" → Zero tolerance
- ❌ "must remain constant" → Zero tolerance
- ✅ "variance up to 5% acceptable" → Use 5% threshold

### value_diff

**Default**: **ZERO TOLERANCE** unless description specifies otherwise

**Reasoning**: Value diffs check data integrity at the record level. Mismatches often indicate serious data quality issues.

**Common descriptions**:
- ❌ "should be 100% matched" → Zero tolerance
- ❌ "critical columns must match" → Zero tolerance
- ✅ "minor variance acceptable" → Use reasonable threshold

### row_count_diff

**Default**: **±5%** if no threshold specified

**Reasoning**: Some row count variance is normal (new data, filters), but large changes need investigation.

**Common descriptions**:
- "should be stable" → Use ±5% default
- "within 10%" → Use explicit 10%
- "no missing rows" → Zero tolerance (use 0%)

### schema_diff

**Default**: **No breaking changes** (new columns allowed)

**Reasoning**: Schema evolution is normal, but breaking changes need coordination.

**Common descriptions**:
- "no breaking changes" → New columns OK, removals FAIL
- "stable schema" → Any change is WARN
- "no changes" → Even new columns are FAIL

### profile_diff

**Default**: **±10%** if no threshold specified

**Reasoning**: Profile metrics (min/max/avg/sum) can vary with data distribution changes.

**Common descriptions**:
- "metrics should be stable" → Use ±10% default
- "variance within 5%" → Use explicit 5%
- "no change in averages" → Zero tolerance

## Real-World Examples from recce.yml

### Example 1: Critical Business Metric (Zero Tolerance)

```yaml
- name: Query diff of customers avg lifetime value
  description: The average of customer_lifetime_value should not be changed
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

**Semantic Interpretation**:
1. **Check type**: `query_diff` (comparing aggregated metrics)
2. **Description**: "should not be changed" (zero tolerance phrase)
3. **Business context**: Customer lifetime value is a core business metric
4. **Evaluation**:
   - ✅ PASS: Results identical (0% change)
   - ❌ FAIL: Any difference (even 0.01% change)

**Why this matters**:
- This metric drives revenue forecasting
- Changes indicate model logic errors
- Downstream reports depend on stability

### Example 2: Data Integrity Check (Zero Tolerance)

```yaml
- name: Value diff of customers
  description: The customer_lifetime_value in customers should be 100% matched
  type: value_diff
  params:
    model: customers
    primary_key: customer_id
    columns:
      - customer_id
      - customer_lifetime_value
```

**Semantic Interpretation**:
1. **Check type**: `value_diff` (record-level comparison)
2. **Description**: "100% matched" (explicit zero tolerance)
3. **Business context**: Customer data is critical master data
4. **Evaluation**:
   - ✅ PASS: All records match (0 mismatches)
   - ❌ FAIL: Any mismatched records (even 1)

**Why this matters**:
- Customer lifetime value affects segmentation
- Mismatches could indicate calculation errors
- Data feeds multiple downstream systems

### Example 3: Data Freshness Check (Threshold-Based)

```yaml
- name: Row count diff of stg_orders
  description: Row count should be stable within 5% (daily variance acceptable)
  type: row_count_diff
  params:
    model: stg_orders
    threshold: 5
```

**Semantic Interpretation**:
1. **Check type**: `row_count_diff` (row count comparison)
2. **Description**: "within 5%" (explicit threshold)
3. **Business context**: Order volume varies day-to-day
4. **Evaluation**:
   - ✅ PASS: Change within ±5% (e.g., +3.2%)
   - ❌ FAIL: Change exceeds ±5% (e.g., -8.1%)

**Why this matters**:
- Normal business variance expected
- Large drops might indicate data pipeline issues
- Helps distinguish noise from real problems

## Evaluation Decision Tree

```
For each preset check:

1. Read the description field
   ↓
2. Identify semantic pattern:
   - "should not change" → Zero tolerance
   - "100% matched" → Zero tolerance
   - "within X%" → Use X% threshold
   - "stable" → Use default threshold
   ↓
3. Look for explicit threshold in params:
   - threshold: 10 → Use 10%
   - No threshold → Use semantic interpretation
   ↓
4. Execute MCP tool and evaluate:
   - Compare results to threshold
   - PASS or FAIL based on tolerance
   ↓
5. Report with context:
   - Include check description
   - Show actual vs expected
   - Explain why PASS/FAIL
```

## Best Practices for Writing Preset Checks

### ✅ Good: Clear Semantic Intent

```yaml
- name: Critical metric stability
  description: Revenue metrics should not change (zero tolerance)
  type: query_diff
```

→ Agent knows this is zero tolerance

### ✅ Good: Explicit Threshold

```yaml
- name: Row count variance check
  description: Daily order variance acceptable within 10%
  type: row_count_diff
  params:
    threshold: 10
```

→ Agent knows exactly what's allowed

### ❌ Bad: Ambiguous Description

```yaml
- name: Some check
  description: Check if data is OK
  type: value_diff
```

→ Agent must guess tolerance level

### ❌ Bad: Missing Context

```yaml
- name: Value comparison
  type: value_diff
  # No description!
```

→ No semantic guidance at all

## Integration with Agent Evaluation

The preset-check-executor subagent receives:

1. **Full recce.yml content** including descriptions
2. **MCP tool results** (actual data differences)
3. **Evaluation instructions** from `preset_checks.ts`

The subagent must:

1. **Parse each check's description** for semantic intent
2. **Extract tolerance level** (zero tolerance vs threshold)
3. **Evaluate MCP results** against tolerance
4. **Return structured JSON** with PASS/FAIL/WARN status
5. **Include description** in evaluation reasoning

**Example evaluation reasoning**:
```json
{
  "name": "Query diff of customers avg lifetime value",
  "type": "query_diff",
  "status": "FAIL",
  "summary": "Average customer_lifetime_value changed by -2.3%",
  "details": {
    "description_intent": "should not be changed (zero tolerance)",
    "evaluation": "FAIL: Description requires zero tolerance, but detected -2.3% change in avg_lifetime_value"
  }
}
```

## Troubleshooting

### Issue: Check marked PASS but should be FAIL

**Cause**: Agent didn't read description, used default threshold

**Fix**: Ensure description uses clear semantic phrases like "should not be changed"

### Issue: Check marked FAIL but should be PASS

**Cause**: Agent applied zero tolerance when threshold was intended

**Fix**: Add explicit threshold in description or params

### Issue: Inconsistent evaluation

**Cause**: Description is ambiguous or missing

**Fix**: Write clear descriptions with explicit tolerance levels

## Summary

**Key Takeaways**:

1. ✅ **Always read the description** to understand intent
2. ✅ **Zero tolerance is common** for query_diff and value_diff
3. ✅ **Thresholds should be explicit** when variance is acceptable
4. ✅ **Report the description** in evaluation reasoning
5. ✅ **A single FAIL** causes overall validation to FAIL

**Remember**: Preset checks encode business requirements, not just technical validations. The description is your guide to evaluating them correctly.

---

**Related Documentation**:
- [PR_SUMMARY_FORMAT.md](./PR_SUMMARY_FORMAT.md) - Output format specification
- [AGENTS.md](./AGENTS.md) - Architecture guide
- Prompt fragments:
  - `src/prompts/fragments/preset_checks.ts` - Evaluation logic
  - `src/prompts/fragments/pr_summary_format.ts` - Output format

**Version**: 1.0
**Last Updated**: 2025-11-13
