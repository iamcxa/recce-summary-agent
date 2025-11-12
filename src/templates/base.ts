/**
 * Base template interface for output rendering
 */

export interface TemplateData {
  pr: {
    owner: string;
    repo: string;
    number: number;
    title: string;
    description: string;
    author: string;
    state: string;
    createdAt: string;
    updatedAt: string;
    url: string;
  };
  diff: {
    files: Array<{
      filename: string;
      status: string;
      additions: number;
      deletions: number;
      patch?: string;
    }>;
    totalAdditions: number;
    totalDeletions: number;
    changedFilesCount: number;
  };
  analysis?: {
    lineageDiff?: any;
    schemaDiff?: any;
    rowCountDiff?: any;
  };
  presetChecks?: {
    overallStatus: 'PASS' | 'FAIL' | 'WARN';
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    results: Array<{
      name: string;
      type: string;
      status: 'PASS' | 'FAIL' | 'WARN' | 'ERROR';
      summary: string;
      details?: any;
    }>;
  };
}

export type OutputFormat = 'markdown' | 'slack' | 'json' | 'html';

export abstract class BaseTemplate {
  abstract readonly name: string;
  abstract readonly format: OutputFormat;

  /**
   * Render the template with provided data
   */
  abstract render(data: TemplateData): string;

  /**
   * Validate template data before rendering
   */
  protected validate(data: TemplateData): void {
    if (!data.pr || !data.diff) {
      throw new Error('Missing required template data: pr and diff are required');
    }
  }
}
