/**
 * Recce Preset Service
 * Centralized service for managing Recce preset checks
 *
 * This service abstracts all preset check logic for future extensibility:
 * - Current: Load from recce.yml file
 * - Future: Load from Recce Cloud API, validate, transform, etc.
 */

import { join } from 'node:path';
import { config } from '../config.js';
import { logError, logInfo } from '../logging/agent_logger.js';
import { PresetCheckParser, type RecceYaml } from './preset_parser.js';

/**
 * Service for managing Recce preset checks
 */
export class ReccePresetService {
  /**
   * Load preset checks based on configuration
   *
   * Resolution order:
   * 1. Explicit recceYamlPath from context
   * 2. RECCE_YAML_PATH environment variable
   * 3. Default: {recceProjectPath}/recce.yml
   *
   * @param recceYamlPath - Optional explicit path to recce.yml
   * @param recceProjectPath - Project directory (fallback)
   * @returns Parsed RecceYaml or null if not found/disabled
   */
  static async loadPresetChecks(
    recceYamlPath?: string,
    recceProjectPath?: string,
  ): Promise<RecceYaml | null> {
    try {
      // Determine the path to recce.yml
      const yamlPath = ReccePresetService.resolveYamlPath(recceYamlPath, recceProjectPath);

      if (!yamlPath) {
        logInfo('ℹ️  No recce.yml path configured, skipping preset checks');
        return null;
      }

      logInfo(`📋 Loading preset checks from: ${yamlPath}`);
      const presetChecks = await PresetCheckParser.parse(yamlPath);

      logInfo(`✅ Loaded ${presetChecks.checks.length} preset checks from recce.yml`);

      return presetChecks;
    } catch (error) {
      logError(`❌ Failed to load preset checks: ${error}`);
      // Don't fail the entire analysis if preset checks can't be loaded
      // Just log and return null
      return null;
    }
  }

  /**
   * Resolve the path to recce.yml based on configuration
   *
   * @param explicitPath - Explicit path from context
   * @param projectPath - Project directory
   * @returns Resolved path or null
   */
  private static resolveYamlPath(explicitPath?: string, projectPath?: string): string | null {
    // 1. Use explicit path if provided
    if (explicitPath) {
      return explicitPath;
    }

    // 2. Use environment variable
    if (config.recce.yamlPath) {
      return config.recce.yamlPath;
    }

    // 3. Use default: {projectPath}/recce.yml
    const fallbackProjectPath = projectPath || config.recce.projectPath || '.';
    return join(fallbackProjectPath, 'recce.yml');
  }

  /**
   * Format preset checks for inclusion in prompt
   *
   * This method provides a clean, structured format that Claude can easily parse
   * and pass to the preset-check-executor subagent.
   *
   * @param presetChecks - Parsed preset checks
   * @returns Formatted string for prompt injection
   */
  static formatForPrompt(presetChecks: RecceYaml): string {
    if (!presetChecks.checks || presetChecks.checks.length === 0) {
      return 'No preset checks defined in recce.yml';
    }

    const lines: string[] = [];
    lines.push(`**Recce Preset Checks (${presetChecks.checks.length} checks):**`);
    lines.push('');

    for (let i = 0; i < presetChecks.checks.length; i++) {
      const check = presetChecks.checks[i];
      lines.push(`${i + 1}. **${check.name}**`);
      if (check.description) {
        lines.push(`   Description: ${check.description}`);
      }
      lines.push(`   Type: \`${check.type}\``);
      lines.push(`   Params: \`${JSON.stringify(check.params)}\``);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push(
      '**IMPORTANT**: Delegate to @agent-preset-check-executor with the above check definitions.',
    );
    lines.push(
      'The executor will use Recce MCP tools to validate each check and return PASS/FAIL results.',
    );

    return lines.join('\n');
  }

  /**
   * Get a summary of preset checks for logging
   *
   * @param presetChecks - Parsed preset checks
   * @returns Summary string
   */
  static getSummary(presetChecks: RecceYaml): string {
    const typeCounts: Record<string, number> = {};

    for (const check of presetChecks.checks) {
      typeCounts[check.type] = (typeCounts[check.type] || 0) + 1;
    }

    const summary = Object.entries(typeCounts)
      .map(([type, count]) => `${type}(${count})`)
      .join(', ');

    return `${presetChecks.checks.length} checks: ${summary}`;
  }

  /**
   * Future: Load preset checks from Recce Cloud API
   *
   * @param sessionId - Recce Cloud session ID
   * @returns Parsed preset checks
   */
  static async loadFromRecceCloud(_sessionId: string): Promise<RecceYaml | null> {
    // TODO: Implement Recce Cloud API integration
    console.warn('⚠️  Recce Cloud API not implemented yet');
    return null;
  }

  /**
   * Future: Validate preset checks before execution
   *
   * @param presetChecks - Preset checks to validate
   * @returns Validation result
   */
  static validate(_presetChecks: RecceYaml): {
    valid: boolean;
    errors: string[];
  } {
    // TODO: Implement validation logic
    // - Check for invalid check types
    // - Check for missing required params
    // - Check for conflicting checks
    return { valid: true, errors: [] };
  }
}
