/**
 * Slack template for PR summary output (Slack Block Kit format)
 */

import { BaseTemplate, TemplateData, OutputFormat } from './base.js';

export class SlackTemplate extends BaseTemplate {
  readonly name = 'slack';
  readonly format: OutputFormat = 'slack';

  render(data: TemplateData): string {
    this.validate(data);

    const blocks = [];

    // Header
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: `PR #${data.pr.number}: ${data.pr.title}`,
        emoji: true,
      },
    });

    // PR Overview
    blocks.push({
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Author:*\n${data.pr.author}`,
        },
        {
          type: 'mrkdwn',
          text: `*Status:*\n${data.pr.state}`,
        },
        {
          type: 'mrkdwn',
          text: `*Files Changed:*\n${data.diff.changedFilesCount}`,
        },
        {
          type: 'mrkdwn',
          text: `*Changes:*\n+${data.diff.totalAdditions} / -${data.diff.totalDeletions}`,
        },
      ],
    });

    // Preset Checks (if available)
    if (data.presetChecks) {
      const statusEmoji =
        data.presetChecks.overallStatus === 'PASS'
          ? ':white_check_mark:'
          : data.presetChecks.overallStatus === 'FAIL'
          ? ':x:'
          : ':warning:';

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Preset Checks:* ${statusEmoji} ${data.presetChecks.overallStatus}\n${data.presetChecks.passed} passed, ${data.presetChecks.failed} failed, ${data.presetChecks.warnings} warnings`,
        },
      });

      // Show failed checks
      if (data.presetChecks.failed > 0) {
        const failedChecks = data.presetChecks.results
          .filter((r) => r.status === 'FAIL')
          .map((c) => `• ${c.name}: ${c.summary}`)
          .join('\n');

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Failed Checks:*\n${failedChecks}`,
          },
        });
      }
    }

    // Impact Summary
    const impactText = this.generateImpactSummary(data);
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Impact Analysis:*\n${impactText}`,
      },
    });

    // Link to PR
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${data.pr.url}|View PR on GitHub>`,
      },
    });

    return JSON.stringify({ blocks }, null, 2);
  }

  private generateImpactSummary(data: TemplateData): string {
    const items: string[] = [];

    if (data.presetChecks) {
      if (data.presetChecks.failed === 0) {
        items.push(':white_check_mark: All data quality checks passed');
      } else {
        items.push(`:x: ${data.presetChecks.failed} data quality check(s) failed`);
      }
    }

    if (data.analysis?.schemaDiff) {
      items.push(':warning: Schema changes detected - review carefully');
    }

    if (items.length === 0) {
      items.push(':white_check_mark: No significant issues detected');
    }

    return items.join('\n');
  }
}
