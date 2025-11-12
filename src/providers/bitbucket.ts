/**
 * Bitbucket Provider implementation (stub for future support)
 */

import { ProviderType } from '../types/providers.js';
import { BaseProvider, MCPServerConfig } from './base.js';
import { BITBUCKET_SYSTEM_EXTENSION } from '../prompts/providers/bitbucket.js';

export class BitbucketProvider extends BaseProvider {
  readonly name = 'Bitbucket';
  readonly type: ProviderType = 'bitbucket';

  getCliCommand(): string {
    return 'bb'; // Hypothetical Bitbucket CLI
  }

  buildCliArgs(prNumber: number): string[] {
    return ['pr', 'view', prNumber.toString(), '--json'];
  }

  getMcpConfig(token: string): Record<string, MCPServerConfig> {
    // TODO: Implement Bitbucket MCP server when available
    return {
      bitbucket: {
        type: 'stdio',
        command: 'bitbucket-mcp-server', // Hypothetical
        env: {
          BITBUCKET_TOKEN: token,
        },
      },
    };
  }

  getPRUrl(owner: string, repo: string, prNumber: number): string {
    // Bitbucket uses "pull-requests" in URL
    // URL format: https://bitbucket.org/owner/repo/pull-requests/123
    const baseUrl = process.env.BITBUCKET_BASE_URL || 'https://bitbucket.org';
    return `${baseUrl}/${owner}/${repo}/pull-requests/${prNumber}`;
  }

  getSystemPromptExtension(): string {
    return BITBUCKET_SYSTEM_EXTENSION;
  }
}
