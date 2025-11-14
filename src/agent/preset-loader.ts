/**
 * Preset checks loader module
 * Handles loading and formatting of Recce preset checks from recce.yml
 */

import type { RecceYaml } from '../recce/preset_parser.js';
import { ReccePresetService } from '../recce/preset_service.js';
import { logInfo, logWarn } from '../logging/agent_logger.js';

/**
 * Load preset checks from recce.yml
 *
 * @param recceConfig - Path to recce.yml (optional, auto-detects if not provided)
 * @param projectPath - Project root path for auto-detection
 * @returns Loaded preset checks or null if loading fails
 */
export async function loadPresetChecks(
  recceConfig: string | undefined,
  projectPath: string | undefined,
): Promise<RecceYaml | null> {
  try {
    // Priority: CLI param > env var > auto-detect
    const yamlPath = recceConfig || undefined; // undefined triggers auto-detect

    const presetChecks = await ReccePresetService.loadPresetChecks(yamlPath, projectPath);

    if (presetChecks && presetChecks.checks.length > 0) {
      logInfo(`📋 Loaded ${presetChecks.checks.length} preset checks from recce.yml`);
      logInfo(`   ${ReccePresetService.getSummary(presetChecks)}`);
      return presetChecks;
    }

    return null;
  } catch (error) {
    logWarn(`⚠️  Failed to load preset checks: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Format preset checks for inclusion in prompts
 */
export function formatPresetChecksForPrompt(presetChecks: RecceYaml): string {
  return ReccePresetService.formatForPrompt(presetChecks);
}
