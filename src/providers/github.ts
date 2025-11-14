/**
 * GitHub Provider implementation
 */

import { GITHUB_SYSTEM_EXTENSION } from '../prompts/providers/github.js';
import type { ProviderType } from '../types/providers.js';
import { BaseProvider, type MCPServerConfig } from './base.js';

export class GitHubProvider extends BaseProvider {
  readonly name = 'GitHub';
  readonly type: ProviderType = 'github';

  getCliCommand(): string {
    return 'gh';
  }

  buildCliArgs(prNumber: number): string[] {
    return [
      'pr',
      'view',
      prNumber.toString(),
      '--json',
      'title,body,author,state,createdAt,updatedAt,number,url,files',
    ];
  }

  getMcpConfig(token: string): Record<string, MCPServerConfig> {
    return {
      github: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: token,
        },
      },
    };
  }

  getPRUrl(owner: string, repo: string, prNumber: number): string {
    return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
  }

  getSystemPromptExtension(): string {
    return GITHUB_SYSTEM_EXTENSION;
  }

  async testAuthentication(token: string): Promise<{ username: string; email?: string }> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Recce-Agent',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `GitHub API authentication failed: ${response.status} ${response.statusText}\n${error}`,
      );
    }

    const user = await response.json();
    return {
      username: user.login,
      email: user.email || undefined,
    };
  }

  async getRateLimit(token: string): Promise<{ limit: number; remaining: number; reset: Date }> {
    const response = await fetch('https://api.github.com/rate_limit', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Recce-Agent',
      },
    });

    if (!response.ok) {
      throw new Error(
        `GitHub API rate limit check failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000),
    };
  }
}
