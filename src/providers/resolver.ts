/**
 * Git Provider Resolver - Parse Git repository URLs and resolve provider configuration
 *
 * Supports:
 * - GitHub: https://github.com/owner/repo
 * - GitLab: https://gitlab.com/owner/repo
 * - Bitbucket: https://bitbucket.org/owner/repo
 * - Self-hosted instances with custom domains
 */

import type { ProviderType } from '../types/providers.js';
import type { BaseProvider, MCPServerConfig } from './base.js';
import { BitbucketProvider } from './bitbucket.js';
import { GitHubProvider } from './github.js';
import { GitLabProvider } from './gitlab.js';

export interface ParsedRepoInfo {
  provider: ProviderType;
  owner: string;
  repo: string;
  domain: string;
  providerInstance: BaseProvider;
}

export interface ParsedPRInfo extends ParsedRepoInfo {
  prNumber?: number;
  urlType: 'repo' | 'pr';
}

export class GitProviderResolver {
  /**
   * Parse a Git URL (supports both repository and PR URLs)
   *
   * @param gitUrl - Git URL (e.g., https://github.com/owner/repo or https://github.com/owner/repo/pull/123)
   * @returns Parsed Git information including URL type and optional PR number
   * @throws Error if URL format is invalid or provider is unsupported
   *
   * @example
   * parseGitUrl('https://github.com/owner/repo')
   * // → { urlType: 'repo', prNumber: undefined, ... }
   *
   * parseGitUrl('https://github.com/owner/repo/pull/123')
   * // → { urlType: 'pr', prNumber: 123, ... }
   */
  static parseGitUrl(gitUrl: string): ParsedPRInfo {
    // Clean up URL
    const cleanUrl = gitUrl.trim().replace(/\.git$/, '');

    let url: URL;
    try {
      url = new URL(cleanUrl);
    } catch (_error) {
      throw new Error(`Invalid Git URL: ${gitUrl}`);
    }

    // Validate URL scheme (security: only allow HTTP/HTTPS)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(
        `Unsupported URL protocol: ${url.protocol}. Only HTTP and HTTPS are allowed.`,
      );
    }

    const domain = url.hostname;
    const pathParts = url.pathname.split('/').filter((p) => p.length > 0);

    // Extract owner and repo from path
    if (pathParts.length < 2) {
      throw new Error(
        `Invalid Git URL format. Expected format: https://domain.com/owner/repo\nGot: ${gitUrl}`,
      );
    }

    const owner = pathParts[0];
    const repo = pathParts[1];

    // Detect if URL is a PR/MR URL
    let prNumber: number | undefined;
    let urlType: 'repo' | 'pr' = 'repo';

    if (pathParts.length >= 4) {
      // GitHub: /owner/repo/pull/123 or /owner/repo/pulls/123
      if (pathParts[2] === 'pull' || pathParts[2] === 'pulls') {
        const parsed = Number.parseInt(pathParts[3], 10);
        if (!Number.isNaN(parsed)) {
          prNumber = parsed;
          urlType = 'pr';
        }
      }
      // GitLab: /owner/repo/-/merge_requests/456
      else if (pathParts[2] === '-' && pathParts[3] === 'merge_requests' && pathParts.length >= 5) {
        const parsed = Number.parseInt(pathParts[4], 10);
        if (!Number.isNaN(parsed)) {
          prNumber = parsed;
          urlType = 'pr';
        }
      }
      // Bitbucket: /owner/repo/pull-requests/789
      else if (pathParts[2] === 'pull-requests') {
        const parsed = Number.parseInt(pathParts[3], 10);
        if (!Number.isNaN(parsed)) {
          prNumber = parsed;
          urlType = 'pr';
        }
      }
    }

    // Detect provider from domain
    const provider = GitProviderResolver.detectProvider(domain);
    const providerInstance = GitProviderResolver.createProviderInstance(provider);

    return {
      provider,
      owner,
      repo,
      domain,
      providerInstance,
      prNumber,
      urlType,
    };
  }

  /**
   * Parse a Git repository URL and extract provider information
   * (Legacy method for backward compatibility - use parseGitUrl instead)
   *
   * @param repoUrl - Git repository URL (e.g., https://github.com/owner/repo)
   * @returns Parsed repository information
   * @throws Error if URL format is invalid or provider is unsupported
   */
  static parseRepoUrl(repoUrl: string): ParsedRepoInfo {
    // Clean up URL
    const cleanUrl = repoUrl.trim().replace(/\.git$/, '');

    let url: URL;
    try {
      url = new URL(cleanUrl);
    } catch (_error) {
      throw new Error(`Invalid repository URL: ${repoUrl}`);
    }

    // Validate URL scheme (security: only allow HTTP/HTTPS)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(
        `Unsupported URL protocol: ${url.protocol}. Only HTTP and HTTPS are allowed.`,
      );
    }

    const domain = url.hostname;
    const pathParts = url.pathname.split('/').filter((p) => p.length > 0);

    // Extract owner and repo from path
    if (pathParts.length < 2) {
      throw new Error(
        `Invalid repository URL format. Expected format: https://domain.com/owner/repo\nGot: ${repoUrl}`,
      );
    }

    const owner = pathParts[0];
    const repo = pathParts[1];

    // Detect provider from domain
    const provider = GitProviderResolver.detectProvider(domain);
    const providerInstance = GitProviderResolver.createProviderInstance(provider);

    return {
      provider,
      owner,
      repo,
      domain,
      providerInstance,
    };
  }

  /**
   * Detect provider type from domain name
   */
  private static detectProvider(domain: string): ProviderType {
    const lowerDomain = domain.toLowerCase();

    if (lowerDomain.includes('github')) {
      return 'github';
    }
    if (lowerDomain.includes('gitlab')) {
      return 'gitlab';
    }
    if (lowerDomain.includes('bitbucket')) {
      return 'bitbucket';
    }

    // Default to GitHub for unknown domains (can be overridden by user)
    throw new Error(
      `Unable to detect provider from domain: ${domain}. ` +
        `Supported providers: github.com, gitlab.com, bitbucket.org`,
    );
  }

  /**
   * Create provider instance based on type
   */
  private static createProviderInstance(type: ProviderType): BaseProvider {
    switch (type) {
      case 'github':
        return new GitHubProvider();
      case 'gitlab':
        return new GitLabProvider();
      case 'bitbucket':
        return new BitbucketProvider();
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }

  /**
   * Build MCP server configuration for a given repo URL and token
   *
   * @param repoUrl - Git repository URL
   * @param gitToken - Authentication token for the provider
   * @param recceMcpUrl - URL of the Recce MCP server (e.g., http://localhost:8080/sse)
   * @returns MCP server configuration object
   */
  static buildMCPConfig(
    repoUrl: string,
    gitToken: string,
    recceMcpUrl: string,
  ): Record<string, MCPServerConfig> {
    const { provider, providerInstance } = GitProviderResolver.parseRepoUrl(repoUrl);

    // Get provider-specific MCP configuration
    const providerMcpConfig = providerInstance.getMcpConfig(gitToken);

    // Add Recce MCP Server
    return {
      ...providerMcpConfig,
      recce: {
        type: 'sse' as const,
        url: recceMcpUrl,
      },
    };
  }

  /**
   * Validate repository URL format
   */
  static isValidRepoUrl(repoUrl: string): boolean {
    try {
      GitProviderResolver.parseRepoUrl(repoUrl);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract repository identifier (owner/repo) from URL
   */
  static getRepoIdentifier(repoUrl: string): string {
    const { owner, repo } = GitProviderResolver.parseRepoUrl(repoUrl);
    return `${owner}/${repo}`;
  }
}
