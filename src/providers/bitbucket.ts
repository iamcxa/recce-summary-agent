/**
 * Bitbucket Provider implementation (stub for future support)
 */

import { BITBUCKET_SYSTEM_EXTENSION } from '../prompts/providers/bitbucket.js';
import type { ProviderType } from '../types/providers.js';
import { BaseProvider, type MCPServerConfig } from './base.js';

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

  async testAuthentication(token: string): Promise<{ username: string; email?: string }> {
    const baseUrl = process.env.BITBUCKET_BASE_URL || 'https://api.bitbucket.org/2.0';
    const response = await fetch(`${baseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'User-Agent': 'Recce-Agent',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Bitbucket API authentication failed: ${response.status} ${response.statusText}\n${error}`,
      );
    }

    const user = await response.json();
    return {
      username: user.username || user.display_name,
      email: undefined, // Bitbucket API doesn't always return email in /user endpoint
    };
  }

  async getRateLimit(_token: string): Promise<{ limit: number; remaining: number; reset: Date }> {
    // Bitbucket doesn't expose rate limit information in the same way as GitHub/GitLab
    // We'll return default values
    throw new Error('Rate limit checking is not supported for Bitbucket');
  }
}
