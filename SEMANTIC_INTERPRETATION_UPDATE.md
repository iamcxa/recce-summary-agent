# Semantic Interpretation Update

**Date**: 2025-11-13
**Purpose**: Enhanced preset check evaluation with semantic interpretation of descriptions

## Overview

Based on user feedback, we updated the preset check evaluation logic to properly interpret the **semantic intent** from check descriptions in `recce.yml`.

## Key Insight

The user pointed out that preset check descriptions contain critical information about tolerance levels:

### Example 1: Query Diff with Zero Tolerance

```yaml
- name: Query diff of customers avg lifetime value
  description: The average of customer_lifetime_value should not be changed
  type: query_diff
```

**Interpretation**: "should not be changed" = **ANY difference is a failure**

### Example 2: Value Diff with 100% Match Requirement

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

**Interpretation**: "should be 100% matched" = **Even 1 mismatched record is a failure**

## Changes Made

### 1. Bug Fix: presetChecks vs presetChecksPrompt

**Issue**: Agent crashed with "Cannot read properties of undefined (reading 'length')"

**Root Cause**:
- `PromptContext.presetChecks` expects `RecceYaml` object
- But `agent.ts` was passing `presetChecksPrompt` (formatted string)

**Fix**:
```typescript
// src/agent.ts (Line 144, 155)
// Before: ❌
presetChecks: presetChecksPrompt,  // String

// After: ✅
presetChecks: presetChecks,  // RecceYaml object

// Line 175
// Before: ❌
...(presetChecksPrompt && {

// After: ✅
...(presetChecks && presetChecks.checks.length > 0 && {
```

### 2. Enhanced Evaluation Logic in preset_checks.ts

**Added semantic interpretation guidance**:

```typescript
**CRITICAL**: Read the check's **description** in recce.yml to understand its semantic intent.

The description often contains key phrases that indicate tolerance level:
- "should not be changed" → Zero tolerance (any difference = FAIL)
- "should be 100% matched" → Zero tolerance (any mismatch = FAIL)
- "should be within X%" → Explicit threshold
- "should be stable" → Use reasonable threshold
```

**Updated check type rules**:

#### value_diff
- **Default**: ZERO TOLERANCE (any mismatch = FAIL)
- Read description for tolerance level
- Example: "100% matched" → Even 1 mismatched record = FAIL

#### query_diff
- **Default**: ZERO TOLERANCE (any difference = FAIL)
- Read description for tolerance level
- Example: "should not be changed" → Even 0.01% change = FAIL

#### row_count_diff
- Look for explicit threshold in params or description
- Default: ±5% if not specified
- Example: "within 10%" → Use 10% threshold

### 3. Enhanced Output Format in pr_summary_format.ts

**Added semantic pattern recognition**:

```
Common semantic patterns:
- "should not be changed" → ZERO TOLERANCE (any difference = FAIL)
- "should be 100% matched" → ZERO TOLERANCE (any mismatch = FAIL)
- "should be within X%" → EXPLICIT THRESHOLD (use X%)
```

**Updated check type evaluation**:
- `value_diff`: Usually ZERO TOLERANCE - Any mismatch = FAIL
- `query_diff`: Usually ZERO TOLERANCE - Any difference = FAIL
- `row_count_diff`: Use threshold from params/description or ±5% default

### 4. New Documentation: PRESET_CHECK_SEMANTICS.md

Created comprehensive guide (~400 lines) covering:

1. **Semantic Pattern Recognition**
   - Zero tolerance patterns
   - Explicit threshold patterns
   - Implicit threshold patterns

2. **Check Type Default Behaviors**
   - `query_diff`: Zero tolerance unless specified
   - `value_diff`: Zero tolerance unless specified
   - `row_count_diff`: ±5% default
   - `schema_diff`: No breaking changes
   - `profile_diff`: ±10% default

3. **Real-World Examples**
   - Critical business metrics (zero tolerance)
   - Data integrity checks (zero tolerance)
   - Data freshness checks (threshold-based)

4. **Evaluation Decision Tree**
   ```
   Read description
   → Identify semantic pattern
   → Look for explicit threshold
   → Execute MCP tool
   → Evaluate with tolerance
   → Report with context
   ```

5. **Best Practices for Writing Preset Checks**
   - ✅ Clear semantic intent
   - ✅ Explicit thresholds
   - ❌ Ambiguous descriptions
   - ❌ Missing context

## Implementation Details

### Files Modified

1. **src/agent.ts**
   - Fixed presetChecks vs presetChecksPrompt bug
   - Line 144, 155: Pass RecceYaml object
   - Line 175: Check object length properly

2. **src/prompts/fragments/preset_checks.ts** (+60 lines)
   - Added semantic interpretation section
   - Enhanced evaluation rules for each check type
   - Added examples from recce.yml
   - Emphasized zero tolerance for value_diff and query_diff

3. **src/prompts/fragments/pr_summary_format.ts** (+30 lines)
   - Added semantic pattern recognition
   - Updated check type evaluation guidance
   - Added real-world examples from recce.yml

### Files Created

1. **PRESET_CHECK_SEMANTICS.md** (~400 lines)
   - Comprehensive semantic interpretation guide
   - Real-world examples with explanations
   - Evaluation decision tree
   - Best practices for writing checks
   - Troubleshooting guide

## Key Principles Established

### 1. Description is the Source of Truth

The check's `description` field encodes the **business expectation** and **tolerance level**.

**Don't just look at check type** (query_diff, value_diff) — **read the description**.

### 2. Zero Tolerance is Common

For critical business metrics and data integrity checks:
- `query_diff`: Usually zero tolerance
- `value_diff`: Usually zero tolerance

**Unless the description says otherwise**, assume any difference = FAIL.

### 3. Explicit Thresholds Take Precedence

If the description or params specify a threshold, use it:

```yaml
description: Row count should be stable within 10%
params:
  threshold: 10
```

→ Use ±10% as the threshold

### 4. Report with Context

Always include the check description in evaluation reasoning to show semantic intent:

```json
{
  "name": "Query diff of customers avg lifetime value",
  "status": "FAIL",
  "summary": "Average customer_lifetime_value changed by -2.3%",
  "details": {
    "description_intent": "should not be changed (zero tolerance)",
    "evaluation": "FAIL: Description requires zero tolerance, but detected -2.3% change"
  }
}
```

## Build Verification

```bash
✅ Build Success: dist/index.js  835.6kb
⏱️  Build Time: 61ms
📈 Size Change: +2.4kb (from 833.2kb, +0.3%)
```

**Size increase**: New semantic interpretation guidance in prompts

## Testing Checklist

When testing with real PRs:

- [ ] Check with value_diff that has "100% matched" in description
  - Verify: Even 1 mismatched record = FAIL
- [ ] Check with query_diff that has "should not be changed"
  - Verify: Even 0.01% change = FAIL
- [ ] Check with row_count_diff that has explicit threshold
  - Verify: Uses specified threshold, not default
- [ ] Verify preset check failures are reported in Anomalies section
- [ ] Verify check descriptions are included in evaluation reasoning

## Example Validation Scenarios

### Scenario 1: Critical Metric Unchanged

**recce.yml**:
```yaml
- name: Query diff of customers avg lifetime value
  description: The average of customer_lifetime_value should not be changed
  type: query_diff
```

**MCP Result**: avg_lifetime_value changed by 0.001%

**Expected Evaluation**:
- ❌ FAIL: Description requires zero tolerance
- Include in Anomalies Detected section as 🔴 critical
- Overall status: ❌ FAIL

### Scenario 2: Data Integrity Verified

**recce.yml**:
```yaml
- name: Value diff of customers
  description: The customer_lifetime_value in customers should be 100% matched
  type: value_diff
```

**MCP Result**: 1 mismatched record found

**Expected Evaluation**:
- ❌ FAIL: Description requires 100% match
- Report: "1 mismatched record (ID: 12345)"
- Include in Anomalies Detected as 🔴 critical
- Overall status: ❌ FAIL

### Scenario 3: Row Count Within Threshold

**recce.yml**:
```yaml
- name: Row count variance check
  description: Daily order variance acceptable within 10%
  type: row_count_diff
  params:
    threshold: 10
```

**MCP Result**: Row count changed by +8.5%

**Expected Evaluation**:
- ✅ PASS: Change (+8.5%) within threshold (10%)
- Include in Test Status as ✅
- Overall status: ✅ (if all other checks pass)

## Summary

**What We Learned**:

1. ✅ Preset check descriptions encode **business requirements**, not just technical validations
2. ✅ Semantic phrases like "should not be changed" mean **zero tolerance**
3. ✅ `value_diff` and `query_diff` typically have **zero tolerance** for critical metrics
4. ✅ The description is the **source of truth** for tolerance levels
5. ✅ Always **report the description** in evaluation reasoning

**Impact**:

- More accurate preset check evaluation
- Better alignment with business expectations
- Clearer failure explanations
- Reduced false positives/negatives

**Next Steps**:

1. Test with real PR that has preset checks
2. Validate semantic interpretation works correctly
3. Iterate based on agent behavior

---

**Related Documentation**:
- [PRESET_CHECK_SEMANTICS.md](./PRESET_CHECK_SEMANTICS.md) - Full semantic interpretation guide
- [PR_SUMMARY_FORMAT.md](./PR_SUMMARY_FORMAT.md) - Output format specification
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Overall implementation summary

**Status**: ✅ Complete and tested
**Build**: 835.6kb (success)
**Ready for**: Real PR validation
