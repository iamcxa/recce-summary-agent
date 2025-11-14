# MCP Verification Commands - Implementation Plan

## Overview

Add standalone MCP verification commands to help users diagnose connection and authentication issues independently.

## Goal

Enable users to verify individual MCP servers (Recce and Git providers) without running a full analysis, making troubleshooting faster and clearer.

---

## New CLI Commands

### 1. Verify Recce MCP Server

```bash
recce-agent --verify-recce-mcp [url]

# Examples:
recce-agent --verify-recce-mcp
# → Tests http://localhost:8080/sse (default)

recce-agent --verify-recce-mcp http://localhost:9000/sse
# → Tests custom URL
```

**What it does:**
- Checks HTTP connectivity (HEAD request with timeout)
- Tests SSE endpoint availability
- Attempts to initialize MCP connection
- Lists available Recce MCP tools
- Validates server version compatibility
- Reports connection status and diagnostics

**Exit codes:**
- `0` - Recce MCP is accessible and working
- `1` - Connection failed
- `2` - Authentication/configuration error

---

### 2. Verify Git Provider MCP

```bash
recce-agent --verify-git-mcp <provider> [url]

# Examples:
recce-agent --verify-git-mcp github
# → Tests GitHub MCP with current GIT_TOKEN

recce-agent --verify-git-mcp gitlab
# → Tests GitLab MCP with current GIT_TOKEN

recce-agent --verify-git-mcp github https://github.com/owner/repo
# → Tests GitHub MCP with specific repository context
```

**What it does:**
- Validates GIT_TOKEN environment variable
- Tests provider API connectivity
- Initializes provider MCP server
- Lists available provider tools (e.g., github__*, gitlab__*)
- Attempts a basic API call (e.g., fetch user info)
- Reports authentication status and permissions

**Exit codes:**
- `0` - Provider MCP is accessible and authenticated
- `1` - Connection failed
- `2` - Authentication failed (invalid/expired token)
- `3` - API rate limit exceeded

---

## Implementation Steps

### Phase 1: Core Verification Functions

#### 1.1 Create `src/verification/recce_verifier.ts`

```typescript
import { config } from '../config.js';

export interface RecceMcpVerificationResult {
  success: boolean;
  url: string;
  responseTime: number;
  available: boolean;
  tools?: string[];
  error?: string;
  diagnostics: {
    httpReachable: boolean;
    sseEndpoint: boolean;
    mcpInitialized: boolean;
    serverVersion?: string;
  };
}

/**
 * Verify Recce MCP server connectivity and functionality
 */
export async function verifyRecceMcp(
  recceMcpUrl: string = 'http://localhost:8080/sse'
): Promise<RecceMcpVerificationResult> {
  const startTime = Date.now();
  const diagnostics = {
    httpReachable: false,
    sseEndpoint: false,
    mcpInitialized: false,
  };

  try {
    // Step 1: HTTP connectivity check
    console.log('🔍 Step 1/3: Checking HTTP connectivity...');
    const response = await fetch(recceMcpUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    diagnostics.httpReachable = response.ok;

    if (!diagnostics.httpReachable) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    console.log('✅ HTTP connectivity OK');

    // Step 2: SSE endpoint check
    console.log('🔍 Step 2/3: Checking SSE endpoint...');
    const sseResponse = await fetch(recceMcpUrl, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: AbortSignal.timeout(5000),
    });
    diagnostics.sseEndpoint = sseResponse.ok;

    if (!diagnostics.sseEndpoint) {
      throw new Error('SSE endpoint not available');
    }
    console.log('✅ SSE endpoint OK');

    // Step 3: MCP initialization and tool listing
    console.log('🔍 Step 3/3: Initializing MCP connection...');
    const mcpConfig = {
      recce: {
        type: 'sse' as const,
        url: recceMcpUrl,
      },
    };

    // Try to list tools via MCP SDK
    const tools = await listRecceMcpTools(mcpConfig);
    diagnostics.mcpInitialized = tools.length > 0;

    if (!diagnostics.mcpInitialized) {
      throw new Error('MCP initialization failed - no tools available');
    }
    console.log(`✅ MCP initialized with ${tools.length} tools`);

    return {
      success: true,
      url: recceMcpUrl,
      responseTime: Date.now() - startTime,
      available: true,
      tools,
      diagnostics,
    };
  } catch (error) {
    return {
      success: false,
      url: recceMcpUrl,
      responseTime: Date.now() - startTime,
      available: false,
      error: error instanceof Error ? error.message : String(error),
      diagnostics,
    };
  }
}

/**
 * List available Recce MCP tools
 */
async function listRecceMcpTools(mcpConfig: any): Promise<string[]> {
  // Use Claude Agent SDK to initialize MCP and list tools
  // This is a simplified placeholder - actual implementation would use SDK
  // to initialize the MCP server and call tools/list endpoint
  try {
    // TODO: Implement actual MCP tool listing via SDK
    return ['recce__lineage_diff', 'recce__schema_diff', 'recce__row_count_diff'];
  } catch (error) {
    return [];
  }
}
```

#### 1.2 Create `src/verification/git_provider_verifier.ts`

```typescript
import { config } from '../config.js';
import { ProviderType } from '../types/providers.js';
import { ProviderFactory } from '../providers/index.js';

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
 */
export async function verifyGitProviderMcp(
  provider: ProviderType,
  repoUrl?: string
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

    // Step 2: Test API connectivity
    console.log('🔍 Step 2/4: Testing API connectivity...');
    const providerInstance = ProviderFactory.create(provider);
    const userInfo = await providerInstance.testAuthentication(token);
    diagnostics.tokenValid = true;
    diagnostics.apiReachable = true;
    console.log(`✅ Authenticated as: ${userInfo.username}`);

    // Step 3: Initialize MCP
    console.log('🔍 Step 3/4: Initializing provider MCP...');
    const mcpConfig = providerInstance.getMcpConfig(token);
    const tools = await listProviderMcpTools(provider, mcpConfig);
    diagnostics.mcpInitialized = tools.length > 0;
    console.log(`✅ MCP initialized with ${tools.length} tools`);

    // Step 4: Check rate limits (if applicable)
    console.log('🔍 Step 4/4: Checking API rate limits...');
    const rateLimit = await providerInstance.getRateLimit(token);
    console.log(`✅ Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`);

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
    return {
      success: false,
      provider,
      authenticated: false,
      error: error instanceof Error ? error.message : String(error),
      diagnostics,
    };
  }
}

/**
 * List available provider MCP tools
 */
async function listProviderMcpTools(
  provider: ProviderType,
  mcpConfig: any
): Promise<string[]> {
  // Placeholder - actual implementation would use MCP SDK
  const toolPrefixes: Record<ProviderType, string> = {
    github: 'mcp__github__',
    gitlab: 'mcp__gitlab__',
    bitbucket: 'mcp__bitbucket__',
  };

  // TODO: Implement actual MCP tool listing
  return [
    `${toolPrefixes[provider]}pull_request_read`,
    `${toolPrefixes[provider]}get_file_contents`,
    `${toolPrefixes[provider]}list_commits`,
  ];
}
```

---

### Phase 2: CLI Integration

#### 2.1 Update `src/index.ts`

Add new command options:

```typescript
program
  .name("recce-agent")
  .version("0.1.0")
  .description("AI-powered Git analysis tool for dbt projects with Claude AI")

  // Existing commands
  .argument("[git-url]", "Git repository or PR URL (not required for verification commands)")
  .option("--recce-mcp-url <url>", "Recce MCP server URL", "http://localhost:8080/sse")
  .option("--prompt <text>", "Custom analysis instructions")
  .option("-o, --output <path>", "Save analysis summary to file")

  // NEW: Verification commands
  .option("--verify-recce-mcp [url]", "Verify Recce MCP server connectivity")
  .option("--verify-git-mcp <provider>", "Verify Git provider MCP (github|gitlab|bitbucket)")
```

#### 2.2 Add Verification Command Handler

```typescript
.action(async (gitUrl: string | undefined, options: {
  recceMcpUrl: string;
  prompt?: string;
  output?: string;
  verifyRecceMcp?: string | boolean;
  verifyGitMcp?: string;
}) => {
  try {
    validateConfig();

    // Handle verification commands first (they don't need git-url)
    if (options.verifyRecceMcp !== undefined) {
      const url = typeof options.verifyRecceMcp === 'string'
        ? options.verifyRecceMcp
        : options.recceMcpUrl;

      console.log('🔍 Verifying Recce MCP Server');
      console.log('================================\n');

      const result = await verifyRecceMcp(url);
      printRecceMcpVerificationResult(result);

      process.exit(result.success ? 0 : 1);
    }

    if (options.verifyGitMcp) {
      const provider = options.verifyGitMcp as ProviderType;

      if (!['github', 'gitlab', 'bitbucket'].includes(provider)) {
        console.error(`❌ Unsupported provider: ${provider}`);
        console.error('Supported providers: github, gitlab, bitbucket');
        process.exit(1);
      }

      console.log(`🔍 Verifying ${provider.toUpperCase()} MCP`);
      console.log('================================\n');

      const result = await verifyGitProviderMcp(provider, gitUrl);
      printGitProviderVerificationResult(result);

      process.exit(result.success ? 0 : result.diagnostics.tokenValid ? 2 : 1);
    }

    // Regular analysis flow (requires git-url)
    if (!gitUrl) {
      console.error('❌ Error: git-url is required for analysis');
      console.error('Run with --help to see usage');
      process.exit(1);
    }

    // ... existing analysis code ...
  }
});
```

---

### Phase 3: Output Formatters

#### 3.1 Create `src/verification/formatters.ts`

```typescript
export function printRecceMcpVerificationResult(result: RecceMcpVerificationResult) {
  console.log(`URL: ${result.url}`);
  console.log(`Response Time: ${result.responseTime}ms\n`);

  console.log('Diagnostics:');
  console.log(`  HTTP Reachable:    ${result.diagnostics.httpReachable ? '✅' : '❌'}`);
  console.log(`  SSE Endpoint:      ${result.diagnostics.sseEndpoint ? '✅' : '❌'}`);
  console.log(`  MCP Initialized:   ${result.diagnostics.mcpInitialized ? '✅' : '❌'}`);

  if (result.diagnostics.serverVersion) {
    console.log(`  Server Version:    ${result.diagnostics.serverVersion}`);
  }

  if (result.success && result.tools) {
    console.log(`\n📦 Available Tools (${result.tools.length}):`);
    result.tools.forEach(tool => console.log(`  - ${tool}`));
    console.log('\n✅ Recce MCP verification PASSED');
  } else {
    console.log(`\n❌ Recce MCP verification FAILED`);
    if (result.error) {
      console.log(`\nError: ${result.error}`);
    }

    console.log('\n💡 Troubleshooting:');
    if (!result.diagnostics.httpReachable) {
      console.log('  1. Check if Recce server is running');
      console.log('  2. Verify the URL is correct');
      console.log('  3. Check firewall settings');
    }
    if (!result.diagnostics.sseEndpoint) {
      console.log('  1. Ensure SSE endpoint is configured');
      console.log('  2. Check server logs for errors');
    }
  }
}

export function printGitProviderVerificationResult(result: GitProviderVerificationResult) {
  console.log(`Provider: ${result.provider.toUpperCase()}`);
  console.log(`Authenticated: ${result.authenticated ? '✅' : '❌'}\n`);

  console.log('Diagnostics:');
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
  }

  if (result.success && result.tools) {
    console.log(`\n📦 Available Tools (${result.tools.length}):`);
    result.tools.forEach(tool => console.log(`  - ${tool}`));
    console.log(`\n✅ ${result.provider.toUpperCase()} MCP verification PASSED`);
  } else {
    console.log(`\n❌ ${result.provider.toUpperCase()} MCP verification FAILED`);
    if (result.error) {
      console.log(`\nError: ${result.error}`);
    }

    console.log('\n💡 Troubleshooting:');
    if (!result.diagnostics.tokenValid) {
      console.log('  1. Set GIT_TOKEN environment variable');
      console.log('  2. Verify token has correct permissions');
      console.log('  3. Check if token is expired');
    }
    if (!result.diagnostics.apiReachable) {
      console.log('  1. Check internet connectivity');
      console.log('  2. Verify API endpoint is accessible');
      console.log('  3. Check for service outages');
    }
  }
}
```

---

### Phase 4: Provider API Methods

#### 4.1 Update `src/providers/base.ts`

Add new methods to BaseProvider interface:

```typescript
export abstract class BaseProvider {
  // ... existing methods ...

  /**
   * Test authentication and fetch user info
   */
  abstract testAuthentication(token: string): Promise<{
    username: string;
    email?: string;
  }>;

  /**
   * Get API rate limit information
   */
  abstract getRateLimit(token: string): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  }>;
}
```

#### 4.2 Implement in `src/providers/github.ts`

```typescript
async testAuthentication(token: string) {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API authentication failed: ${response.statusText}`);
  }

  const user = await response.json();
  return {
    username: user.login,
    email: user.email || undefined,
  };
}

async getRateLimit(token: string) {
  const response = await fetch('https://api.github.com/rate_limit', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  const data = await response.json();
  return {
    limit: data.rate.limit,
    remaining: data.rate.remaining,
    reset: new Date(data.rate.reset * 1000),
  };
}
```

---

## Testing Plan

### Manual Testing

1. **Recce MCP Verification**
   ```bash
   # Test with running Recce server
   recce-agent --verify-recce-mcp

   # Test with custom URL
   recce-agent --verify-recce-mcp http://localhost:9000/sse

   # Test with unreachable server
   recce-agent --verify-recce-mcp http://localhost:9999/sse
   ```

2. **Git Provider Verification**
   ```bash
   # Test GitHub with valid token
   recce-agent --verify-git-mcp github

   # Test with invalid token (expect failure)
   GIT_TOKEN=invalid recce-agent --verify-git-mcp github

   # Test GitLab
   recce-agent --verify-git-mcp gitlab
   ```

### Unit Tests

Create `src/verification/__tests__/`:
- `recce_verifier.test.ts` - Test Recce MCP verification logic
- `git_provider_verifier.test.ts` - Test provider verification logic
- `formatters.test.ts` - Test output formatting

---

## Documentation Updates

### README.md

Add new section:

```markdown
## Troubleshooting

### Verify MCP Connectivity

If you're experiencing connection issues, use the built-in verification commands:

#### Check Recce MCP Server

\`\`\`bash
recce-agent --verify-recce-mcp
\`\`\`

#### Check Git Provider Authentication

\`\`\`bash
recce-agent --verify-git-mcp github
\`\`\`

These commands will diagnose connection, authentication, and configuration issues.
```

### Help Text Update

Update CLI help text in `src/index.ts`:

```typescript
Verification Commands:
  --verify-recce-mcp [url]     Verify Recce MCP server connectivity
  --verify-git-mcp <provider>  Verify Git provider MCP (github|gitlab|bitbucket)

Examples:
  # Verify Recce MCP server
  $ recce-agent --verify-recce-mcp

  # Verify GitHub MCP authentication
  $ recce-agent --verify-git-mcp github
```

---

## Implementation Timeline

**Total Estimated Time: 8-10 hours**

- **Phase 1**: Core Verification Functions (3-4 hours)
- **Phase 2**: CLI Integration (2 hours)
- **Phase 3**: Output Formatters (1 hour)
- **Phase 4**: Provider API Methods (2 hours)
- **Testing & Documentation**: (2 hours)

---

## Benefits

1. **Faster Troubleshooting**: Users can quickly identify if issues are with Recce, GitHub, or their configuration
2. **Better Error Messages**: Specific diagnostic information instead of generic failures
3. **Pre-flight Validation**: Verify everything works before running expensive analysis
4. **Token Validation**: Confirm authentication before attempting API calls
5. **Rate Limit Awareness**: See remaining API quota before analysis

---

## Future Enhancements

1. **Health Check Dashboard**: Web UI showing MCP status
2. **Automated Diagnostics**: Run all verifications and generate report
3. **Connection Caching**: Store successful verifications to skip checks
4. **Webhook Testing**: Verify webhook endpoints for CI/CD integration
