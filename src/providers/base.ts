/**
 * Base Provider interface and abstract class
 */

import { ProviderType } from '../types/providers.js';

export interface MCPServerConfig {
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  cwd?: string;
}

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly type: ProviderType;

  /**
   * Get CLI command for provider (e.g., 'gh' for GitHub)
   */
  abstract getCliCommand(): string;

  /**
   * Build CLI arguments for fetching PR info
   */
  abstract buildCliArgs(prNumber: number): string[];

  /**
   * Get MCP server configuration
   */
  abstract getMcpConfig(token: string): Record<string, MCPServerConfig>;

  /**
   * Generate PR/MR URL for this provider
   */
  abstract getPRUrl(owner: string, repo: string, prNumber: number): string;

  /**
   * Get system prompt extension for this provider
   */
  abstract getSystemPromptExtension(): string;

  /**
   * Get user prompt extension for this provider
   */
  getUserPromptExtension(): string {
    return ''; // Most providers don't need user prompt extension
  }

  /**
   * Get subagent name for context fetching
   */
  getContextSubagentName(): string {
    return `${this.type}-context`;
  }
}
