/**
 * Recce Preset Check Parser
 * Reads and parses recce.yml preset checks
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { load } from 'js-yaml';
import { join } from 'path';

/**
 * Preset check types supported by Recce
 */
export type PresetCheckType = 'schema_diff' | 'row_count_diff' | 'value_diff' | 'query_diff';

/**
 * Individual preset check definition
 */
export interface ReccePresetCheck {
  name: string;
  description?: string;
  type: PresetCheckType;
  params: Record<string, unknown>;
}

/**
 * GitHub settings in recce.yml
 */
export interface RecceGitHubSettings {
  repo: string;
}

/**
 * Complete recce.yml structure
 */
export interface RecceYaml {
  github?: RecceGitHubSettings;
  checks: ReccePresetCheck[];
}

/**
 * Parser for recce.yml preset checks
 */
export class PresetCheckParser {
  /**
   * Parse recce.yml from a given path
   * @param yamlPath - Path to recce.yml file
   * @returns Parsed RecceYaml object
   */
  static async parse(yamlPath: string): Promise<RecceYaml> {
    if (!existsSync(yamlPath)) {
      throw new Error(`recce.yml not found at path: ${yamlPath}`);
    }

    const content = await readFile(yamlPath, 'utf-8');
    const parsed = load(content) as RecceYaml;

    // Validate structure
    if (!parsed.checks || !Array.isArray(parsed.checks)) {
      throw new Error('recce.yml must contain a "checks" array');
    }

    // Validate each check
    for (const check of parsed.checks) {
      if (!check.name || !check.type || !check.params) {
        throw new Error(
          `Invalid check definition: ${JSON.stringify(check)}. Must have name, type, and params.`
        );
      }

      const validTypes: PresetCheckType[] = ['schema_diff', 'row_count_diff', 'value_diff', 'query_diff'];
      if (!validTypes.includes(check.type)) {
        throw new Error(
          `Invalid check type: ${check.type}. Must be one of: ${validTypes.join(', ')}`
        );
      }
    }

    return parsed;
  }

  /**
   * Parse recce.yml from project directory
   * @param projectDir - Project directory containing recce.yml
   * @returns Parsed RecceYaml object
   */
  static async parseFromProjectDir(projectDir: string): Promise<RecceYaml> {
    const yamlPath = join(projectDir, 'recce.yml');
    return this.parse(yamlPath);
  }

  /**
   * Get Recce MCP tool name for a given check type
   * @param checkType - Preset check type
   * @returns MCP tool name
   */
  static getMcpToolForCheckType(checkType: PresetCheckType): string {
    const toolMap: Record<PresetCheckType, string> = {
      schema_diff: 'mcp__recce__get_lineage_diff',
      row_count_diff: 'mcp__recce__row_count_diff',
      value_diff: 'mcp__recce__value_diff',
      query_diff: 'mcp__recce__query_diff',
    };

    return toolMap[checkType];
  }

  /**
   * Format check parameters for MCP tool invocation
   * @param check - Preset check
   * @returns Formatted parameters for MCP tool
   */
  static formatParamsForMcpTool(check: ReccePresetCheck): Record<string, unknown> {
    // Most parameters can be passed directly
    // Special handling for specific check types if needed
    switch (check.type) {
      case 'schema_diff':
        // schema_diff uses 'select' param for model selection
        return {
          select: check.params.select || '',
        };

      case 'row_count_diff':
        // row_count_diff uses 'select' param for model selection
        return {
          select: check.params.select || '',
        };

      case 'value_diff':
        // value_diff requires model, primary_key, and columns
        return {
          model: check.params.model,
          primary_key: check.params.primary_key,
          columns: check.params.columns,
        };

      case 'query_diff':
        // query_diff requires sql_template
        return {
          sql_template: check.params.sql_template,
        };

      default:
        return check.params;
    }
  }
}
