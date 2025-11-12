/**
 * JSON template for structured PR summary output
 */

import { BaseTemplate, TemplateData, OutputFormat } from './base.js';

export class JsonTemplate extends BaseTemplate {
  readonly name = 'json';
  readonly format: OutputFormat = 'json';

  render(data: TemplateData): string {
    this.validate(data);

    const output = {
      pr: {
        number: data.pr.number,
        title: data.pr.title,
        author: data.pr.author,
        state: data.pr.state,
        url: data.pr.url,
        createdAt: data.pr.createdAt,
        updatedAt: data.pr.updatedAt,
      },
      changes: {
        filesChanged: data.diff.changedFilesCount,
        additions: data.diff.totalAdditions,
        deletions: data.diff.totalDeletions,
        files: data.diff.files.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
        })),
      },
      dbtAnalysis: data.analysis
        ? {
            lineageDiff: data.analysis.lineageDiff || null,
            schemaDiff: data.analysis.schemaDiff || null,
            rowCountDiff: data.analysis.rowCountDiff || null,
          }
        : null,
      presetChecks: data.presetChecks || null,
      impact: {
        dataQualityIssues: data.presetChecks?.failed || 0,
        breakingChanges: data.analysis?.schemaDiff ? true : false,
        recommendations: this.generateRecommendations(data),
      },
    };

    return JSON.stringify(output, null, 2);
  }

  private generateRecommendations(data: TemplateData): string[] {
    const recommendations: string[] = [];

    recommendations.push('Review all file changes carefully');
    recommendations.push('Ensure tests pass in CI/CD');

    if (data.presetChecks) {
      if (data.presetChecks.failed > 0) {
        recommendations.push('Address failed preset checks before merging');
      }
      if (data.presetChecks.warnings > 0) {
        recommendations.push('Investigate warnings from preset checks');
      }
    }

    if (data.analysis?.schemaDiff) {
      recommendations.push('Review schema changes for backwards compatibility');
    }

    return recommendations;
  }
}
