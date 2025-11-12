/**
 * Output format instructions for different output types
 * These provide detailed guidance to the agent on how to structure output
 */

export const MARKDOWN_OUTPUT_SECTIONS = `## Output Format Instructions

Generate a comprehensive markdown report with the following sections:

### PR Overview
- PR title, number, author, and status
- Summary of files changed (additions/deletions/modifications)
- Direct link to PR for easy access

### dbt Model Changes
- **Added Models**: List newly created dbt models
- **Modified Models**: List changed models with description of changes
- **Removed Models**: List deprecated/deleted models
- **Schema Changes**: Detail column additions, removals, and type changes
- **Row Count Differences**: Show significant row count changes
- **Lineage Changes**: Describe upstream/downstream dependency changes

### Impact Analysis
- **Data Quality**: Assess impact on data quality and reliability
- **Breaking Changes**: Identify any breaking changes for downstream consumers
- **Performance**: Note potential performance implications
- **Recommendations**: Provide actionable recommendations for reviewers

**Formatting Guidelines:**
- Use clear markdown headers (##, ###)
- Use bullet points for lists
- Use code blocks for SQL/model names
- Use tables for structured data
- Keep language concise and technical`;

export const MARKDOWN_OUTPUT_WITH_PRESET_CHECKS = `## Output Format Instructions

Generate a comprehensive markdown report with the following sections:

### PR Overview
- PR title, number, author, and status
- Summary of files changed (additions/deletions/modifications)
- Direct link to PR for easy access

### dbt Model Changes
- **Added Models**: List newly created dbt models
- **Modified Models**: List changed models with description of changes
- **Removed Models**: List deprecated/deleted models
- **Schema Changes**: Detail column additions, removals, and type changes
- **Row Count Differences**: Show significant row count changes
- **Lineage Changes**: Describe upstream/downstream dependency changes

### Preset Check Results
- **Overall Status**: Display with emoji (✅ PASS / ⚠️ WARN / ❌ FAIL)
- **Summary Table**: Create a table with check name, type, and status
- **Failed Checks**: Provide detailed findings for each failed check
- **Warnings**: List warnings that require attention
- **Pass Count**: Summarize passed checks briefly

### Impact Analysis
- **Data Quality**: Assess based on preset check results
- **Breaking Changes**: Identify schema changes that break compatibility
- **Performance**: Note potential performance implications
- **Recommendations**: Prioritize based on check failures

**Formatting Guidelines:**
- Use emoji indicators: ✅ (pass), ⚠️ (warn), ❌ (fail)
- Use markdown tables for check summaries
- Use code blocks for SQL/model names
- Highlight critical issues in bold
- Keep language concise and actionable`;

export const SLACK_OUTPUT_FORMAT = `## Output Format Instructions (Slack)

Generate output optimized for Slack messaging with these guidelines:

**Structure:**
- Keep total message under 3000 characters
- Use emoji for visual indicators
- Use *bold* and _italic_ for emphasis
- Break into clear sections with line breaks

**Content Sections:**
1. **Header** (1 line): PR title and number with status emoji
2. **Changes** (3-5 bullets): Key changes only, most important first
3. **Checks** (if applicable): Overall status with counts (e.g., "✅ 8 passed, ❌ 2 failed")
4. **Action Items** (2-3 bullets): Critical issues requiring attention
5. **Link**: Include PR URL

**Emoji Guide:**
- ✅ Success/Pass
- ⚠️ Warning/Caution
- ❌ Failure/Error
- 📊 Statistics
- 🔍 Review needed
- 💡 Recommendation

**Example:**
\`\`\`
🔍 *PR #123: Add customer segmentation model*
Author: @john • Status: Open

*Key Changes:*
• Added 3 new customer models
• Modified base_customers schema (added 2 columns)
• Row counts decreased 5% (expected)

*Checks:* ✅ 8 passed • ❌ 2 failed
• schema_diff: ❌ Breaking change detected
• row_count_diff: ✅ Within threshold

*Action Required:*
• Review breaking schema change in base_customers
• Verify downstream impact

<PR URL>
\`\`\``;

export const JSON_OUTPUT_FORMAT = `## Output Format Instructions (JSON)

Generate a structured JSON object with complete type safety and validation:

\`\`\`typescript
{
  "pr": {
    "number": number,
    "title": string,
    "author": string,
    "state": "open" | "closed" | "merged",
    "url": string,
    "createdAt": string,  // ISO 8601
    "updatedAt": string   // ISO 8601
  },
  "changes": {
    "filesChanged": number,
    "additions": number,
    "deletions": number,
    "files": Array<{
      "filename": string,
      "status": "added" | "modified" | "removed",
      "additions": number,
      "deletions": number
    }>
  },
  "dbtAnalysis": {
    "modelsAdded": string[],
    "modelsModified": string[],
    "modelsRemoved": string[],
    "schemaChanges": Array<{
      "model": string,
      "column": string,
      "changeType": "added" | "removed" | "type_changed",
      "details": string
    }>,
    "rowCountDiff": Array<{
      "model": string,
      "baseCount": number,
      "currentCount": number,
      "diffPercent": number
    }>
  },
  "presetChecks": {
    "overallStatus": "PASS" | "FAIL" | "WARN",
    "totalChecks": number,
    "passed": number,
    "failed": number,
    "warnings": number,
    "results": Array<{
      "name": string,
      "type": "schema_diff" | "row_count_diff" | "value_diff" | "query_diff",
      "status": "PASS" | "FAIL" | "WARN",
      "summary": string,
      "details": object
    }>
  },
  "impact": {
    "severity": "low" | "medium" | "high" | "critical",
    "dataQualityIssues": number,
    "breakingChanges": boolean,
    "performanceImpact": "none" | "minor" | "moderate" | "significant",
    "recommendations": string[]
  }
}
\`\`\`

**Requirements:**
- All fields must be properly typed
- Use null for missing optional values
- ISO 8601 format for all dates
- Ensure JSON is valid and parseable
- Include all available data, omit only truly unavailable fields`;

/**
 * Get output format instruction based on template type and context
 */
export function getOutputFormatInstruction(
  format: 'markdown' | 'slack' | 'json' | 'html' | 'pr-summary',
  hasPresetChecks: boolean = false
): string {
  switch (format) {
    case 'pr-summary':
      // Import dynamically to avoid circular dependencies
      const { getPRSummaryOutputInstruction } = require('./pr_summary_format.js');
      return getPRSummaryOutputInstruction(hasPresetChecks);
    case 'slack':
      return SLACK_OUTPUT_FORMAT;
    case 'json':
      return JSON_OUTPUT_FORMAT;
    case 'html':
      // HTML uses markdown as base, templates convert it
      return hasPresetChecks
        ? MARKDOWN_OUTPUT_WITH_PRESET_CHECKS
        : MARKDOWN_OUTPUT_SECTIONS;
    case 'markdown':
    default:
      return hasPresetChecks
        ? MARKDOWN_OUTPUT_WITH_PRESET_CHECKS
        : MARKDOWN_OUTPUT_SECTIONS;
  }
}
