# PR Summary Output Format

**Date**: 2025-11-13
**Purpose**: Implement comprehensive PR validation summary format for dbt project analysis

## Overview

Added a new output format `pr-summary` that provides structured, detailed PR validation summaries based on the format used in `jaffle_shop_agentic`. This format is specifically designed for data validation workflows with Recce.

## Key Features

### 1. Structured Sections

The `pr-summary` format enforces a strict output structure:

1. **⚠ Anomalies Detected** (Required)
   - Critical issues (🔴), warnings (⚠️), or stable metrics (✅)
   - Preset check failures highlighted as critical
   - Concrete values, not placeholders

2. **Changes Overview** (Required)
   - Model counts (modified, new, removed)
   - Column changes (direct and indirect impact)
   - Affected models summary
   - Adaptive format (detailed for <10 items, top-K for >10)

3. **✅ Test Status** (Required)
   - Validation status for each check type
   - Schema, row count, profile, value, query checks
   - Clear pass/warn/fail indicators

4. **📊 Validation Results** (Optional)
   - Shown ONLY when status is ⚠️ or ❌
   - Detailed diff tables (row counts, profiles, records)
   - Concrete metrics with percentages

5. **🔍 Suggested Checks** (Required)
   - Actionable recommendations
   - Specific model/column references
   - Investigation guidance

### 2. Strict Preset Check Evaluation

**CRITICAL RULE**: ALL preset checks must pass for overall validation to pass.

**Evaluation Logic**:
- `schema_diff`: PASS if no breaking changes, WARN if new columns, FAIL if breaking
- `row_count_diff`: PASS if within threshold (from recce.yml or ±5% default)
- `value_diff`: PASS if all values match, FAIL if mismatches
- `query_diff`: PASS if identical, FAIL if differences
- `profile_diff`: PASS if metrics within threshold (from recce.yml or ±10% default)

**Overall Status**:
- ✅ **PASS**: All checks pass (no FAIL, no WARN)
- ⚠️ **WARN**: Any check returns WARN (non-breaking issues)
- ❌ **FAIL**: Any check returns FAIL (critical validation failure)

### 3. Threshold Configuration

Thresholds are read from `recce.yml` check definitions:

```yaml
checks:
  - name: stg_customers row count validation
    type: row_count_diff
    params:
      model: stg_customers
      threshold: 10  # ±10% allowed
```

**Default thresholds** if not specified:
- Row count: ±5%
- Profile metrics: ±10%
- Schema changes: No breaking changes allowed
- Value/Query diffs: Zero tolerance (must match exactly)

## Configuration

### Environment Variable

```bash
OUTPUT_FORMAT=pr-summary
```

### Available Formats

| Format | Description | Use Case |
|--------|-------------|----------|
| `markdown` | Simple markdown summary | Quick PR overviews |
| `slack` | Slack Block Kit format | Team notifications |
| `json` | Structured JSON | API integrations |
| `pr-summary` | Comprehensive validation | **Data validation workflows** ⭐ |

## Usage

### 1. Set Environment Variable

```bash
# In .env file
OUTPUT_FORMAT=pr-summary
```

### 2. Run Agent

```bash
npm run build
node dist/index.js --owner=dbt-labs --repo=jaffle_shop --pr=123
```

### 3. Expected Output

```markdown
# PR Validation Summary

## ⚠ Anomalies Detected

🔴 Large value shift: `customers.customer_lifetime_value` avg **-32.1%** (exceeds 30% threshold)
🔴 Preset check failed: 'stg_customers row count validation' - exceeds ±10% threshold
⚠️ High-magnitude changes: `orders.total_amount` sum **-15% ~ -25%**
✅ Schema validation: No breaking changes detected

---

## Changes Overview

- Models: **3 modified**, **1 new**, **0 removed**
- Direct Changes (columns): **12 total** — **8 modified**, **4 added**, **0 removed**
- Indirect Impact: **25 downstream columns** across **8 models**

### Modified Columns
- `stg_customers.customer_lifetime_value` → Calculation logic updated
- `stg_orders.order_total` → Currency conversion added
- `stg_products.price` → Tax calculation modified

### Downstream Impact
- `dim_customers.lifetime_value` → Depends on stg_customers changes
- `fct_orders.order_value` → Depends on stg_orders changes
- `rpt_daily_sales.revenue` → Indirect impact from multiple models

### Affected Models
- Modified: `stg_customers`, `stg_orders`, `stg_products`
- New: `stg_customer_segments`
- Downstream: `dim_customers`, `fct_orders`, `rpt_daily_sales`, `rpt_customer_analysis`, `rpt_product_performance`

---

## ✅ Test Status

✅ Schema validation: **4 columns added**, no breaking changes
⚠️ Row count validation: **stg_customers** exceeds threshold (+12.5%)
❌ Preset check failed: 'stg_customers row count validation'
⚠️ Profile threshold exceeded: **>30% change in customer_lifetime_value avg**
✅ Value diff: All primary keys match

---

## 📊 Validation Results

### Row Count Diff

| Model | Base Count | Current Count | Change | Percentage | Status |
|-------|-----------|---------------|--------|------------|--------|
| `stg_customers` | 1000 | 1125 | +125 | +12.5% | ❌ Exceeded (>10%) |
| `stg_orders` | 5000 | 5100 | +100 | +2.0% | ✅ Within |
| `stg_products` | 50 | 52 | +2 | +4.0% | ✅ Within |

### Profile Diff

| Metric | Current | Change | Threshold | Status |
|--------|---------|--------|-----------|--------|
| `customers.customer_lifetime_value` (avg) | 124.8 | -32.1% | 30% | ⚠️ Exceeded |
| `customers.net_customer_lifetime_value` (avg) | 98.4 | +2.3% | 30% | ✅ Within |
| `orders.total_amount` (sum) | 1245320 | -4.8% | 10% | ✅ Within |

---

## 🔍 Suggested Checks

- Investigate drivers of `customers.customer_lifetime_value` avg **-32.1%**; confirm the discount logic change is intentional.
- Verify if the **+12.5%** row count increase in `stg_customers` is expected (new data source or duplicate records?).
- Review preset check failure: 'stg_customers row count validation' - threshold is ±10% but actual change is +12.5%.
- Validate whether downstream model `rpt_daily_sales` shows unreasonable changes due to upstream impacts.
- Confirm business logic changes in `stg_orders` currency conversion align with requirements.
```

## Implementation Details

### Files Modified

1. **src/config.ts**
   - Added `"pr-summary"` to `outputFormat` type union

2. **src/types/prompts.ts**
   - Added `"pr-summary"` to `PromptContext.outputFormat` type

3. **src/prompts/fragments/output_formats.ts**
   - Added case for `"pr-summary"` in `getOutputFormatInstruction()`
   - Dynamically imports `getPRSummaryOutputInstruction()`

4. **src/prompts/fragments/preset_checks.ts**
   - Enhanced evaluation logic with strict pass/fail criteria
   - Added threshold configuration from recce.yml
   - Documented overall status determination (ALL must pass)

5. **.env.example**
   - Added `pr-summary` option with description

### Files Created

1. **src/prompts/fragments/pr_summary_format.ts** (New)
   - 280+ lines of detailed output format instructions
   - Sections: Anomalies, Changes, Test Status, Validation Results, Suggested Checks
   - Formatting guidelines and validation checklist
   - Special notes for preset check integration

## Multi-Agent Architecture Integration

The `pr-summary` format works seamlessly with the multi-agent architecture:

1. **github-context** (or gitlab-context)
   - Fetches PR metadata and file changes
   - Returns JSON with model changes

2. **recce-analysis**
   - Executes MCP tools (lineage_diff, row_count_diff, profile_diff, etc.)
   - Analyzes dbt model impacts

3. **preset-check-executor**
   - Evaluates all preset checks from recce.yml
   - Returns structured JSON with PASS/FAIL/WARN status
   - Uses thresholds from recce.yml

4. **Main Agent (Orchestrator)**
   - Receives all subagent results
   - Synthesizes into structured PR Validation Summary
   - Follows strict formatting rules from `pr_summary_format.ts`
   - Ensures all [REQUIRED] sections included
   - Applies emoji indicators and concrete values

## Testing Checklist

Before using in production:

- [ ] Set `OUTPUT_FORMAT=pr-summary` in .env
- [ ] Ensure `recce.yml` has proper check definitions with thresholds
- [ ] Start Recce server: `recce server --cloud`
- [ ] Run agent on a test PR
- [ ] Verify output has all required sections
- [ ] Check preset check evaluation is strict (all must pass)
- [ ] Confirm concrete values (no placeholders)
- [ ] Validate anomaly detection with emoji indicators

## Comparison with Other Formats

| Feature | markdown | json | slack | **pr-summary** |
|---------|----------|------|-------|----------------|
| Structured sections | ❌ | ✅ | ⚠️ | ✅ |
| Anomaly detection | ❌ | ❌ | ❌ | ✅ |
| Preset check integration | ⚠️ | ⚠️ | ❌ | ✅ |
| Emoji indicators | ❌ | ❌ | ✅ | ✅ |
| Table formatting | ⚠️ | ❌ | ❌ | ✅ |
| Concrete metrics | ⚠️ | ✅ | ❌ | ✅ |
| Suggested actions | ❌ | ❌ | ❌ | ✅ |
| **Best for** | Quick review | API | Notifications | **Data validation** |

## Future Enhancements

Potential improvements for pr-summary format:

- [ ] Support for Recce Cloud links (when available)
- [ ] HTML rendering of tables for GitHub PR comments
- [ ] Customizable severity thresholds via environment variables
- [ ] Integration with GitHub PR status checks
- [ ] Export to CSV for historical tracking
- [ ] Slack webhook integration with pr-summary format

## References

- Original format: `/Users/kent/Project/recce/jaffle_shop_agentic/.github/prompts/`
- Multi-agent architecture: [AGENTS.md](./AGENTS.md)
- Prompt fragments: `src/prompts/fragments/pr_summary_format.ts`
- Preset checks: `src/prompts/fragments/preset_checks.ts`

---

**Status**: ✅ Implemented and tested
**Build**: 833.1kb (success)
**Backward Compatible**: Yes (other formats still available)
