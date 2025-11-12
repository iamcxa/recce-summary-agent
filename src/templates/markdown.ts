/**
 * Markdown template for PR summary output
 */

import { BaseTemplate, TemplateData, OutputFormat } from './base.js';

export class MarkdownTemplate extends BaseTemplate {
  readonly name = 'markdown';
  readonly format: OutputFormat = 'markdown';

  render(data: TemplateData): string {
    this.validate(data);

    const sections: string[] = [];

    // Title
    sections.push(`# PR #${data.pr.number}: ${data.pr.title}\n`);

    // PR Overview
    sections.push(this.renderPROverview(data));

    // dbt Model Changes (if analysis provided)
    if (data.analysis) {
      sections.push(this.renderDbtChanges(data));
    }

    // Preset Check Results (if provided)
    if (data.presetChecks) {
      sections.push(this.renderPresetChecks(data));
    }

    // Impact Analysis
    sections.push(this.renderImpactAnalysis(data));

    return sections.join('\n\n');
  }

  private renderPROverview(data: TemplateData): string {
    const lines: string[] = [];

    lines.push('## PR Overview\n');
    lines.push(`- **Author**: ${data.pr.author}`);
    lines.push(`- **Status**: ${data.pr.state}`);
    lines.push(`- **Created**: ${new Date(data.pr.createdAt).toLocaleDateString()}`);
    lines.push(`- **Updated**: ${new Date(data.pr.updatedAt).toLocaleDateString()}`);
    lines.push(`- **URL**: ${data.pr.url}\n`);

    lines.push('### File Changes\n');
    lines.push(`- **Files Changed**: ${data.diff.changedFilesCount}`);
    lines.push(`- **Additions**: +${data.diff.totalAdditions} lines`);
    lines.push(`- **Deletions**: -${data.diff.totalDeletions} lines`);

    return lines.join('\n');
  }

  private renderDbtChanges(data: TemplateData): string {
    const lines: string[] = [];

    lines.push('## dbt Model Changes\n');

    if (data.analysis?.lineageDiff) {
      lines.push('### Lineage Changes\n');
      lines.push('Models affected by this PR...');
      // TODO: Parse lineageDiff data structure
    }

    if (data.analysis?.schemaDiff) {
      lines.push('\n### Schema Changes\n');
      lines.push('Column-level changes detected...');
      // TODO: Parse schemaDiff data structure
    }

    if (data.analysis?.rowCountDiff) {
      lines.push('\n### Row Count Differences\n');
      lines.push('Data volume changes...');
      // TODO: Parse rowCountDiff data structure
    }

    return lines.join('\n');
  }

  private renderPresetChecks(data: TemplateData): string {
    if (!data.presetChecks) return '';

    const lines: string[] = [];
    const { overallStatus, totalChecks, passed, failed, warnings, results } =
      data.presetChecks;

    // Overall status
    const statusEmoji =
      overallStatus === 'PASS' ? '✅' : overallStatus === 'FAIL' ? '❌' : '⚠️';

    lines.push('## Preset Check Results\n');
    lines.push(
      `**Overall Status: ${statusEmoji} ${overallStatus}** (${totalChecks} checks: ${passed} passed, ${failed} failed, ${warnings} warnings)\n`
    );

    // Passed checks
    const passedChecks = results.filter((r) => r.status === 'PASS');
    if (passedChecks.length > 0) {
      lines.push(`### ✅ Passed Checks (${passedChecks.length})\n`);
      passedChecks.forEach((check, idx) => {
        lines.push(`${idx + 1}. **${check.name}** (${check.type})`);
        lines.push(`   - ${check.summary}`);
      });
      lines.push('');
    }

    // Warnings
    const warnChecks = results.filter((r) => r.status === 'WARN');
    if (warnChecks.length > 0) {
      lines.push(`### ⚠️ Warnings (${warnChecks.length})\n`);
      warnChecks.forEach((check, idx) => {
        lines.push(`${idx + 1}. **${check.name}** (${check.type})`);
        lines.push(`   - ${check.summary}`);
        if (check.details?.evaluation) {
          lines.push(`   - **Reason**: ${check.details.evaluation}`);
        }
      });
      lines.push('');
    }

    // Failed checks
    const failedChecks = results.filter((r) => r.status === 'FAIL');
    if (failedChecks.length > 0) {
      lines.push(`### ❌ Failed Checks (${failedChecks.length})\n`);
      failedChecks.forEach((check, idx) => {
        lines.push(`${idx + 1}. **${check.name}** (${check.type})`);
        lines.push(`   - ${check.summary}`);
        if (check.details?.evaluation) {
          lines.push(`   - **Reason**: ${check.details.evaluation}`);
        }
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  private renderImpactAnalysis(data: TemplateData): string {
    const lines: string[] = [];

    lines.push('## Impact Analysis\n');

    // Data quality implications
    lines.push('### Data Quality Implications\n');
    if (data.presetChecks && data.presetChecks.failed > 0) {
      lines.push(
        `⚠️ ${data.presetChecks.failed} preset check(s) failed - review data quality issues`
      );
    } else {
      lines.push('✅ No data quality issues detected');
    }

    // Breaking changes
    lines.push('\n### Potential Breaking Changes\n');
    if (data.analysis?.schemaDiff) {
      lines.push('Review schema changes for backwards compatibility');
    } else {
      lines.push('No schema changes detected');
    }

    // Recommendations
    lines.push('\n### Recommendations\n');
    lines.push('- Review all file changes carefully');
    lines.push('- Ensure tests pass in CI/CD');
    if (data.presetChecks && data.presetChecks.warnings > 0) {
      lines.push('- Investigate warnings from preset checks');
    }

    return lines.join('\n');
  }
}
