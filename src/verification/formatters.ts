/**
 * Verification Result Formatters
 *
 * Pretty-print verification results with diagnostics and troubleshooting guidance.
 */

import type { GitProviderVerificationResult } from './git_provider_verifier.js';
import type { RecceMcpVerificationResult } from './recce_verifier.js';

/**
 * Print Recce MCP verification result with diagnostics
 */
export function printRecceMcpVerificationResult(result: RecceMcpVerificationResult): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log('Recce MCP Server Verification Result');
  console.log('='.repeat(50));
  console.log(`URL: ${result.url}`);
  console.log(`Response Time: ${result.responseTime}ms`);
  console.log();

  console.log('📋 Diagnostics:');
  console.log(`  HTTP Reachable:    ${result.diagnostics.httpReachable ? '✅' : '❌'}`);
  console.log(`  SSE Endpoint:      ${result.diagnostics.sseEndpoint ? '✅' : '❌'}`);
  console.log(`  MCP Initialized:   ${result.diagnostics.mcpInitialized ? '✅' : '❌'}`);

  if (result.diagnostics.serverVersion) {
    console.log(`  Server Version:    ${result.diagnostics.serverVersion}`);
  }

  if (result.success && result.tools) {
    console.log(`\n📦 Available Tools (${result.tools.length}):`);
    result.tools.forEach((tool) => console.log(`  - ${tool}`));
    console.log(`\n✅ Recce MCP verification PASSED`);
    console.log('🎉 Server is ready for use!\n');
  } else {
    console.log(`\n❌ Recce MCP verification FAILED`);
    if (result.error) {
      console.log(`\n🔴 Error: ${result.error}`);
    }

    console.log('\n💡 Troubleshooting:');

    if (!result.diagnostics.httpReachable) {
      console.log('\n  HTTP Connectivity Failed:');
      console.log('  1. Check if Recce server is running');
      console.log('     → Start Recce: recce server');
      console.log('  2. Verify the URL is correct');
      console.log('     → Default: http://localhost:8080/sse');
      console.log('  3. Check firewall settings');
      console.log('  4. Ensure no port conflicts (8080)');
    }

    if (result.diagnostics.httpReachable && !result.diagnostics.sseEndpoint) {
      console.log('\n  SSE Endpoint Not Available:');
      console.log('  1. Ensure SSE endpoint is configured');
      console.log('  2. Check Recce server logs for errors');
      console.log('  3. Verify MCP server mode is enabled');
      console.log('     → recce server --mcp');
    }

    if (result.diagnostics.sseEndpoint && !result.diagnostics.mcpInitialized) {
      console.log('\n  MCP Initialization Failed:');
      console.log('  1. Check Claude API key is set (ANTHROPIC_API_KEY)');
      console.log('  2. Verify dbt project is configured');
      console.log('  3. Check Recce server logs for initialization errors');
      console.log('  4. Try restarting the Recce server');
    }

    console.log();
  }
}

/**
 * Print Git provider MCP verification result with diagnostics
 */
export function printGitProviderVerificationResult(result: GitProviderVerificationResult): void {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${result.provider.toUpperCase()} MCP Verification Result`);
  console.log('='.repeat(50));
  console.log(`Provider: ${result.provider}`);
  console.log(`Authenticated: ${result.authenticated ? '✅' : '❌'}`);
  console.log();

  console.log('📋 Diagnostics:');
  console.log(`  Token Valid:       ${result.diagnostics.tokenValid ? '✅' : '❌'}`);
  console.log(`  API Reachable:     ${result.diagnostics.apiReachable ? '✅' : '❌'}`);
  console.log(`  MCP Initialized:   ${result.diagnostics.mcpInitialized ? '✅' : '❌'}`);

  if (result.user) {
    console.log(`\n👤 Authenticated User:`);
    console.log(`  Username: ${result.user.username}`);
    if (result.user.email) {
      console.log(`  Email: ${result.user.email}`);
    }
  }

  if (result.rateLimit) {
    console.log(`\n⏱️  Rate Limit:`);
    console.log(`  Remaining: ${result.rateLimit.remaining}/${result.rateLimit.limit}`);
    console.log(`  Resets: ${result.rateLimit.reset.toLocaleString()}`);

    if (result.rateLimit.remaining < result.rateLimit.limit * 0.1) {
      console.log(`  ⚠️  WARNING: Low rate limit remaining!`);
    }
  }

  if (result.success && result.tools) {
    console.log(`\n📦 Available Tools (${result.tools.length}):`);
    result.tools.slice(0, 10).forEach((tool) => console.log(`  - ${tool}`));
    if (result.tools.length > 10) {
      console.log(`  ... and ${result.tools.length - 10} more`);
    }
    console.log(`\n✅ ${result.provider.toUpperCase()} MCP verification PASSED`);
    console.log('🎉 Provider is ready for use!\n');
  } else {
    console.log(`\n❌ ${result.provider.toUpperCase()} MCP verification FAILED`);
    if (result.error) {
      console.log(`\n🔴 Error: ${result.error}`);
    }

    console.log('\n💡 Troubleshooting:');

    if (!result.diagnostics.tokenValid) {
      console.log('\n  Authentication Token Invalid:');
      console.log('  1. Set GIT_TOKEN environment variable');
      console.log('     → export GIT_TOKEN=your_token_here');
      console.log(`  2. Verify token has correct permissions for ${result.provider}`);

      if (result.provider === 'github') {
        console.log('     → GitHub: repo, read:user permissions');
        console.log('     → Generate at: https://github.com/settings/tokens');
      } else if (result.provider === 'gitlab') {
        console.log('     → GitLab: api, read_user, read_repository permissions');
        console.log('     → Generate at: https://gitlab.com/-/profile/personal_access_tokens');
      } else if (result.provider === 'bitbucket') {
        console.log('     → Bitbucket: Pull requests:read, Account:read permissions');
        console.log('     → Generate at: https://bitbucket.org/account/settings/app-passwords/');
      }

      console.log('  3. Check if token is expired');
      console.log('  4. Ensure token is for the correct account');
    }

    if (result.diagnostics.tokenValid && !result.diagnostics.apiReachable) {
      console.log('\n  API Not Reachable:');
      console.log('  1. Check internet connectivity');
      console.log(`  2. Verify ${result.provider} API endpoint is accessible`);
      console.log('  3. Check for service outages');

      if (result.provider === 'github') {
        console.log('     → Status: https://www.githubstatus.com/');
      } else if (result.provider === 'gitlab') {
        console.log('     → Status: https://status.gitlab.com/');
      }

      console.log('  4. Check proxy settings if behind corporate firewall');
    }

    if (result.diagnostics.apiReachable && !result.diagnostics.mcpInitialized) {
      console.log('\n  MCP Initialization Failed:');
      console.log(`  1. Check ${result.provider} MCP server package is available`);

      if (result.provider === 'github') {
        console.log('     → Ensure @modelcontextprotocol/server-github is installed');
        console.log('     → Install: npm install -g @modelcontextprotocol/server-github');
      } else if (result.provider === 'gitlab') {
        console.log('     → Ensure @zereight/mcp-gitlab is installed');
        console.log('     → Install: npm install -g @zereight/mcp-gitlab');
      }

      console.log('  2. Check Claude API key is set (ANTHROPIC_API_KEY)');
      console.log('  3. Verify MCP server logs for errors');
    }

    console.log();
  }
}
