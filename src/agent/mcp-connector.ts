/**
 * MCP (Model Context Protocol) connection and configuration module
 * Handles MCP server connectivity checks and configuration building
 */

import { GitProviderResolver } from '../providers/index.js';
import { logDebug } from '../logging/agent_logger.js';

/**
 * Check if Recce MCP server is reachable (pre-flight check)
 *
 * @param recceMcpUrl - URL of the Recce MCP server
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise<boolean> - true if server is reachable, false otherwise
 */
export async function checkRecceMcpConnection(
  recceMcpUrl: string,
  timeoutMs = 5000,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(recceMcpUrl, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    // Connection failed (timeout, network error, etc.)
    logDebug(`⚠️  Recce MCP connection check failed: ${error}`);
    return false;
  }
}

/**
 * Build MCP server configuration dynamically from repo URL
 *
 * @param repoUrl - Git repository URL (e.g., https://github.com/owner/repo)
 * @param gitToken - Authentication token for the git provider
 * @param recceMcpUrl - URL of the Recce MCP server (e.g., http://localhost:8080/sse)
 * @returns MCP server configuration object
 */
export function buildMCPConfig(
  repoUrl: string,
  gitToken: string,
  recceMcpUrl: string,
): Record<string, any> {
  return GitProviderResolver.buildMCPConfig(repoUrl, gitToken, recceMcpUrl);
}
