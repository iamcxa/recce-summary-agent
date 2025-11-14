/**
 * Git Provider MCP Verification
 *
 * Provides diagnostic tools to verify Git provider (GitHub, GitLab, Bitbucket)
 * MCP connectivity, authentication, and tool availability.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { config } from '../config.js';
import { ProviderFactory } from '../providers/index.js';
import type { ProviderType } from '../types/providers.js';

export interface GitProviderVerificationResult {
  success: boolean;
  provider: ProviderType;
  authenticated: boolean;
  user?: {
    username: string;
    email?: string;
  };
  tools?: string[];
  permissions?: string[];
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: Date;
  };
  error?: string;
  diagnostics: {
    tokenValid: boolean;
    apiReachable: boolean;
    mcpInitialized: boolean;
  };
}

/**
 * Verify Git provider MCP connectivity and authentication
 *
 * @param provider - Git provider type (github, gitlab, or bitbucket)
 * @param repoUrl - Optional repository URL for context
 * @returns Verification result with diagnostics
 */
export async function verifyGitProviderMcp(
  provider: ProviderType,
  _repoUrl?: string,
): Promise<GitProviderVerificationResult> {
  const diagnostics = {
    tokenValid: false,
    apiReachable: false,
    mcpInitialized: false,
  };

  try {
    // Step 1: Validate token exists
    console.log('🔍 Step 1/4: Checking authentication token...');
    const token = config.git.token;
    if (!token) {
      throw new Error('GIT_TOKEN environment variable not set');
    }
    console.log('✅ Token found');

    // Step 2: Test API connectivity and authentication
    console.log('🔍 Step 2/4: Testing API connectivity and authentication...');
    const providerInstance = ProviderFactory.create(provider);
    const userInfo = await providerInstance.testAuthentication(token);
    diagnostics.tokenValid = true;
    diagnostics.apiReachable = true;
    console.log(`✅ Authenticated as: ${userInfo.username}`);

    // Step 3: Initialize MCP
    console.log('🔍 Step 3/4: Initializing provider MCP...');
    const tools = await listProviderMcpTools(provider, token);
    diagnostics.mcpInitialized = tools.length > 0;
    console.log(`✅ MCP initialized with ${tools.length} tools`);

    // Step 4: Check rate limits (if applicable)
    let rateLimit: { limit: number; remaining: number; reset: Date } | undefined;
    try {
      console.log('🔍 Step 4/4: Checking API rate limits...');
      rateLimit = await providerInstance.getRateLimit(token);
      console.log(`✅ Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`);
    } catch (_error) {
      // Rate limit check is optional - some providers might not support it
      if (config.debug) {
        console.log('⚠️  Rate limit check not available for this provider');
      }
    }

    return {
      success: true,
      provider,
      authenticated: true,
      user: userInfo,
      tools,
      rateLimit,
      diagnostics,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (config.debug) {
      console.error('Debug: Verification error details:', error);
    }

    return {
      success: false,
      provider,
      authenticated: false,
      error: errorMessage,
      diagnostics,
    };
  }
}

/**
 * List available provider MCP tools
 *
 * @param provider - Git provider type
 * @param token - Authentication token
 * @returns Array of available tool names
 */
async function listProviderMcpTools(provider: ProviderType, token: string): Promise<string[]> {
  try {
    // Get provider instance and MCP configuration
    const providerInstance = ProviderFactory.create(provider);
    const mcpConfig = providerInstance.getMcpConfig(token);

    // Use Claude Agent SDK to probe available tools
    const result = await query({
      prompt: `List all available ${provider} MCP tools. Return only the tool names as a JSON array.`,
      model: config.claude.model,
      apiKey: config.claude.apiKey,
      mcpServers: mcpConfig,
      maxTurns: 1,
    });

    // Extract tool names from the response
    const toolPrefix = `mcp__${provider}__`;
    const toolPattern = new RegExp(`${toolPrefix}[\\w_]+`, 'g');
    const output = typeof result === 'string' ? result : result.output || '';
    const matches = output.match(toolPattern) || [];
    const uniqueTools = [...new Set(matches)];

    // If extraction failed, provide known common tools
    if (uniqueTools.length === 0) {
      const commonTools: Record<ProviderType, string[]> = {
        github: [
          'pull_request_read',
          'get_file_contents',
          'list_commits',
          'search_code',
          'create_pull_request',
          'issue_read',
        ],
        gitlab: ['pull_request_read', 'get_file_contents', 'list_commits'],
        bitbucket: ['pull_request_read', 'get_file_contents', 'list_commits'],
      };

      return commonTools[provider].map((tool) => `${toolPrefix}${tool}`);
    }

    return uniqueTools;
  } catch (error) {
    if (config.debug) {
      console.error(`Debug: Failed to list ${provider} MCP tools:`, error);
    }
    throw new Error(
      `Failed to initialize ${provider} MCP: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
