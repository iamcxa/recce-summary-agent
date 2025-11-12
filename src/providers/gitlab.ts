/**
 * GitLab Provider implementation using @zereight/mcp-gitlab
 */

import { ProviderType } from '../types/providers.js';
import { BaseProvider, MCPServerConfig } from './base.js';
import { GITLAB_SYSTEM_EXTENSION } from '../prompts/providers/gitlab.js';

export class GitLabProvider extends BaseProvider {
  readonly name = 'GitLab';
  readonly type: ProviderType = 'gitlab';

  getCliCommand(): string {
    return 'glab';
  }

  buildCliArgs(prNumber: number): string[] {
    return ['mr', 'view', prNumber.toString(), '--json'];
  }

  getMcpConfig(token: string): Record<string, MCPServerConfig> {
    // GitLab MCP configuration using @zereight/mcp-gitlab
    // Reference: https://github.com/zereight/mcp-gitlab

    // Get GitLab configuration from environment variables directly
    // to avoid circular dependency with config.ts
    const gitlabConfig = {
      apiUrl: process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4',
      projectId: process.env.GITLAB_PROJECT_ID || '',
      allowedProjectIds: process.env.GITLAB_ALLOWED_PROJECT_IDS || '',
      useOAuth: process.env.GITLAB_USE_OAUTH === 'true',
      oauthClientId: process.env.GITLAB_OAUTH_CLIENT_ID || '',
      oauthRedirectUri: process.env.GITLAB_OAUTH_REDIRECT_URI || 'http://127.0.0.1:8888/callback',
      readOnlyMode: process.env.GITLAB_READ_ONLY_MODE !== 'false',
      useWiki: process.env.USE_GITLAB_WIKI === 'true',
      useMilestone: process.env.USE_MILESTONE === 'true',
      usePipeline: process.env.USE_PIPELINE === 'true',
    };

    const env: Record<string, string> = {
      GITLAB_API_URL: gitlabConfig.apiUrl,
      GITLAB_READ_ONLY_MODE: gitlabConfig.readOnlyMode.toString(),
      USE_GITLAB_WIKI: gitlabConfig.useWiki.toString(),
      USE_MILESTONE: gitlabConfig.useMilestone.toString(),
      USE_PIPELINE: gitlabConfig.usePipeline.toString(),
    };

    // Add OAuth settings if enabled
    if (gitlabConfig.useOAuth) {
      env.GITLAB_USE_OAUTH = 'true';
      env.GITLAB_OAUTH_CLIENT_ID = gitlabConfig.oauthClientId;
      env.GITLAB_OAUTH_REDIRECT_URI = gitlabConfig.oauthRedirectUri;
    } else {
      // Use personal access token
      env.GITLAB_PERSONAL_ACCESS_TOKEN = token;
    }

    // Add project IDs if specified
    if (gitlabConfig.projectId) {
      env.GITLAB_PROJECT_ID = gitlabConfig.projectId;
    }
    if (gitlabConfig.allowedProjectIds) {
      env.GITLAB_ALLOWED_PROJECT_IDS = gitlabConfig.allowedProjectIds;
    }

    return {
      gitlab: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@zereight/mcp-gitlab'],
        env,
      },
    };
  }

  getPRUrl(owner: string, repo: string, prNumber: number): string {
    // GitLab uses "merge requests" instead of "pull requests"
    // URL format: https://gitlab.com/owner/repo/-/merge_requests/123
    const apiUrl = process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4';
    const baseUrl = apiUrl.replace('/api/v4', ''); // Remove /api/v4 to get base URL
    return `${baseUrl}/${owner}/${repo}/-/merge_requests/${prNumber}`;
  }

  getSystemPromptExtension(): string {
    return GITLAB_SYSTEM_EXTENSION;
  }
}
