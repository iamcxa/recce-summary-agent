/**
 * GitHub Provider implementation
 */

import { ProviderType } from '../types/providers.js';
import { BaseProvider, MCPServerConfig } from './base.js';
import { GITHUB_SYSTEM_EXTENSION } from '../prompts/providers/github.js';

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
}
