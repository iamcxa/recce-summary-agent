/**
 * Template Factory - Creates template instances based on format
 */

import { OutputFormat } from './base.js';
import { BaseTemplate } from './base.js';
import { MarkdownTemplate } from './markdown.js';
import { JsonTemplate } from './json.js';
import { SlackTemplate } from './slack.js';

export class TemplateFactory {
  /**
   * Create a template instance based on format
   */
  static create(format: OutputFormat): BaseTemplate {
    switch (format) {
      case 'markdown':
        return new MarkdownTemplate();
      case 'json':
        return new JsonTemplate();
      case 'slack':
        return new SlackTemplate();
      case 'html':
        // TODO: Implement HTML template
        throw new Error('HTML template not yet implemented');
      default:
        throw new Error(`Unsupported template format: ${format}`);
    }
  }

  /**
   * Get list of supported formats
   */
  static getSupportedFormats(): OutputFormat[] {
    return ['markdown', 'json', 'slack'];
  }

  /**
   * Check if a format is supported
   */
  static isSupported(format: string): format is OutputFormat {
    return ['markdown', 'json', 'slack', 'html'].includes(format);
  }
}

// Export template classes and types
export { BaseTemplate, TemplateData, OutputFormat } from './base.js';
export { MarkdownTemplate } from './markdown.js';
export { JsonTemplate } from './json.js';
export { SlackTemplate } from './slack.js';
