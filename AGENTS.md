# Agent Architecture Guide

**Recce Summary Agent** - Multi-agent PR analysis system built with Claude Agent SDK

## Overview

This project implements a multi-agent architecture using the [Claude Agent SDK](https://github.com/anthropics/agent-sdk) to analyze Pull Requests (PRs) in dbt projects. It combines GitHub/GitLab context with Recce validation tools to generate comprehensive PR summaries with data quality insights.

### Key Concepts

- **Main Agent**: Orchestrator that delegates to specialized subagents
- **Subagents**: Specialized workers with scoped tool permissions
- **MCP (Model Context Protocol)**: Standard protocol for connecting AI agents to external tools
- **Provider Abstraction**: Support for multiple git platforms (GitHub, GitLab, Bitbucket)
- **Modular Prompts**: Composable prompt fragments for different contexts
- **Template System**: Multiple output formats (Markdown, JSON, Slack)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Main Agent                            │
│                    (Orchestrator)                           │
│  - Model: claude-sonnet-4-5                                 │
│  - Tools: NONE (delegates only)                             │
│  - Role: Synthesis & coordination                           │
└───────────────┬─────────────────┬───────────────────────────┘
                │                 │
                │                 │
    ┌───────────▼──────┐    ┌────▼────────────────┐
    │ github-context   │    │ recce-analysis      │
    │ (or gitlab)      │    │                     │
    │ Model: haiku     │    │ Model: haiku        │
    │ Tools:           │    │ Tools:              │
    │ - mcp__github    │    │ - mcp__recce        │
    └──────────────────┘    └─────────────────────┘
                │                 │
                │                 │
    ┌───────────▼─────────────────▼────────────────┐
    │         MCP Servers                          │
    │  - GitHub MCP (stdio)                        │
    │  - Recce MCP (sse)                           │
    │  - GitLab MCP (stdio, optional)              │
    └──────────────────────────────────────────────┘
```

## Directory Structure

```
recce-summary-agent/
├── src/
│   ├── agent.ts              # Main agent orchestrator
│   ├── config.ts             # Configuration management
│   ├── index.ts              # CLI entry point
│   │
│   ├── prompts/              # Modular prompt system
│   │   ├── index.ts          # PromptBuilder class
│   │   ├── fragments/        # Reusable prompt components
│   │   │   ├── base.ts       # Core orchestrator prompts
│   │   │   ├── github_context.ts
│   │   │   ├── recce_analysis.ts
│   │   │   ├── preset_checks.ts
│   │   │   └── output_formats.ts
│   │   └── providers/        # Provider-specific extensions
│   │       ├── github.ts
│   │       ├── gitlab.ts
│   │       └── bitbucket.ts
│   │
│   ├── providers/            # Git provider abstraction
│   │   ├── base.ts           # BaseProvider abstract class
│   │   ├── github.ts         # GitHub implementation
│   │   ├── gitlab.ts         # GitLab implementation
│   │   ├── bitbucket.ts      # Bitbucket stub
│   │   └── index.ts          # ProviderFactory
│   │
│   ├── templates/            # Output formatting
│   │   ├── base.ts           # BaseTemplate abstract class
│   │   ├── markdown.ts       # Markdown formatter
│   │   ├── json.ts           # JSON formatter
│   │   ├── slack.ts          # Slack Block Kit formatter
│   │   └── index.ts          # TemplateFactory
│   │
│   ├── recce/                # Recce integration
│   │   ├── preset_service.ts # Load and execute preset checks
│   │   └── types.ts          # Recce-specific types
│   │
│   ├── logging/              # Logging infrastructure
│   │   ├── agent_logger.ts   # Structured logging
│   │   ├── destinations.ts   # Log destinations
│   │   └── formatters.ts     # Log formatting
│   │
│   └── types/                # TypeScript types
│       ├── index.ts          # Core types (PR, Diff, Analysis)
│       ├── prompts.ts        # Prompt context types
│       └── recce.ts          # Recce types
│
├── .cursor/rules/            # Development rules (auto-applied)
│   ├── core/
│   │   ├── agent-sdk-patterns.mdc
│   │   └── typescript-config.mdc
│   ├── architecture/
│   │   └── multi-agent-architecture.mdc
│   └── integration/
│       └── mcp-integration.mdc
│
├── logs/                     # Agent execution logs
├── dist/                     # Compiled output
│
├── CLAUDE.md                 # Claude Code entry point
├── AGENTS.md                 # This file
├── README.md                 # Project README
├── .env.example              # Environment variable template
├── package.json              # NPM dependencies
└── tsconfig.json             # TypeScript configuration
```

## Agent Execution Flow

### 1. Initialization Phase

```typescript
// src/agent.ts
export async function createAndAnalyzePR(
  owner: string,
  repo: string,
  prNumber: number,
  recceEnabled: boolean = true
): Promise<PRAnalysisResult>
```

**Steps**:
1. Build context object (owner, repo, prNumber, features)
2. Load Recce preset checks from `recce.yml` (if enabled)
3. Initialize structured logger with metadata
4. Configure MCP servers based on provider

### 2. Prompt Construction Phase

```typescript
const promptBuilder = new PromptBuilder();

const systemPrompt = promptBuilder.buildSystemPrompt({
  provider: config.provider,
  features: config.features,
  userIntent: 'pr_analysis',
  owner, repo, prNumber,
  presetChecks: presetChecksPrompt,
  outputFormat: config.outputFormat,
});

const userPrompt = promptBuilder.buildUserPrompt({
  provider: config.provider,
  // ... same context
});
```

**Prompt Components**:
- Base orchestrator instructions
- Provider-specific extensions (GitHub vs GitLab)
- Workflow and delegation rules
- Output format instructions
- Preset checks (if available)

### 3. Subagent Configuration Phase

```typescript
const contextSubagentName = config.provider === 'gitlab'
  ? 'gitlab-context'
  : 'github-context';

const agents = {
  [contextSubagentName]: promptBuilder.getProviderContextSubagent(config.provider),
  ...(context.includeRecce && {
    'recce-analysis': promptBuilder.getRecceAnalysisSubagent(),
  }),
  ...(presetChecksPrompt && {
    'preset-check-executor': promptBuilder.getPresetCheckExecutorSubagent(),
  }),
};
```

**Dynamic Subagent Selection**:
- **Provider Context**: `github-context` or `gitlab-context` based on config
- **Recce Analysis**: Only if `recceEnabled=true`
- **Preset Executor**: Only if `recce.yml` has checks

### 4. Agent Execution Phase

```typescript
const result = query({
  prompt: userPrompt,
  options: {
    model: config.claude.model,
    systemPrompt,
    cwd: process.cwd(),
    maxTurns: 20,
    mcpServers: mcpServers as any,
    allowedTools: [], // Main agent doesn't call tools
    agents, // Subagents with tool permissions
  },
});
```

**Message Stream Processing**:
```typescript
for await (const message of result) {
  if (message.type === 'system') {
    // Handle MCP server connections, tool availability
    handleSystemMessage(message, logger);
  }
  if (message.type === 'assistant') {
    // Log thinking and tool calls (subagent delegations)
    logAssistantMessage(message, logger);
  }
  if (message.type === 'result') {
    // Extract final markdown summary
    finalResult = message.result;
  }
}
```

### 5. Result Processing Phase

```typescript
return {
  pr: { owner, repo, number, title, author, state, url, ... },
  diff: { files, totalAdditions, totalDeletions, changedFilesCount },
  summary: formattedSummary, // Markdown output from agent
};
```

**Optional Template Formatting**:
- If `outputFormat` is not `markdown`, apply template
- Parse agent output to extract structured data
- Format using TemplateFactory

## Subagent Details

### github-context (or gitlab-context)

**Purpose**: Fetch PR/MR metadata and file changes

**Tools**: `mcp__github` or `mcp__gitlab`

**Model**: `haiku` (cost-efficient)

**Workflow**:
1. Fetch PR details (title, author, description)
2. Get list of changed files with additions/deletions
3. Identify dbt models (`.sql` files in `models/`)
4. Return structured JSON with context tag

**Output Format**:
```
[GITHUB-CONTEXT]
{
  "pr": {
    "title": "Add customer segmentation model",
    "author": "alice",
    "state": "open",
    "createdAt": "2024-01-15T10:00:00Z"
  },
  "diff": {
    "files": [
      { "path": "models/staging/stg_customers.sql", "additions": 25, "deletions": 3 }
    ],
    "totalAdditions": 25,
    "totalDeletions": 3,
    "changedFilesCount": 1
  }
}
```

### recce-analysis

**Purpose**: Analyze dbt model changes using Recce tools

**Tools**: `mcp__recce`

**Model**: `haiku`

**Workflow**:
1. **Lineage Diff**: Identify upstream/downstream model impacts
2. **Schema Diff**: Detect schema changes (breaking changes)
3. **Row Count Diff**: Compare row counts between base and current
4. Focus on modified dbt models from github-context

**Output Format**:
```
[RECCE-ANALYSIS]
## Lineage Impact
- `stg_customers` affects 3 downstream models:
  - `fct_orders` (direct)
  - `dim_customers` (direct)
  - `rpt_daily_sales` (indirect)

## Schema Changes
- `stg_customers`:
  - ⚠️ New column: `customer_segment` (string)
  - ✅ No breaking changes

## Row Count Analysis
- `stg_customers`: Base: 1000 → Current: 1025 (+2.5%)
```

### preset-check-executor

**Purpose**: Execute and evaluate recce.yml preset checks

**Tools**: `mcp__recce`

**Model**: `haiku`

**Workflow**:
1. Parse preset checks from prompt context
2. Execute each check using appropriate Recce tool
3. Evaluate results based on check type:
   - `schema_diff`: PASS if no breaking changes
   - `row_count_diff`: PASS if within threshold
   - `value_diff`: PASS if all values match
   - `query_diff`: PASS if queries identical
4. Return JSON with overall status

**Output Format**:
```
[PRESET-CHECKS]
{
  "overallStatus": "PASS",
  "totalChecks": 3,
  "passed": 2,
  "failed": 0,
  "warnings": 1,
  "results": [
    {
      "name": "stg_customers schema validation",
      "type": "schema_diff",
      "status": "WARN",
      "message": "New column added: customer_segment"
    },
    {
      "name": "stg_orders row count validation",
      "type": "row_count_diff",
      "status": "PASS",
      "message": "Row count within expected range (+1.2%)"
    }
  ]
}
```

## MCP Server Configuration

### GitHub MCP Server (stdio)

```typescript
{
  github: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN,
    },
  }
}
```

**Prerequisites**:
- `GITHUB_TOKEN` environment variable set
- Network access to GitHub API

### GitLab MCP Server (stdio)

```typescript
{
  gitlab: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@zereight/mcp-gitlab'],
    env: {
      GITLAB_PERSONAL_ACCESS_TOKEN: process.env.GITLAB_TOKEN,
      GITLAB_API_URL: process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4',
      // ... other config
    },
  }
}
```

**Prerequisites**:
- `GITLAB_TOKEN` environment variable set
- GitLab API access configured

### Recce MCP Server (sse)

```typescript
{
  recce: {
    type: 'sse',
    url: 'http://0.0.0.0:8080/sse',
  }
}
```

**Prerequisites**:
- Recce server running: `recce server --cloud`
- Valid Recce project state
- Port 8080 accessible

## Development Workflow

### 1. Setup Environment

```bash
# Clone repository
git clone <repo-url>
cd recce-summary-agent

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Configure environment variables
# Edit .env with your tokens and settings
```

### 2. Start Recce Server

```bash
# In a separate terminal
cd /path/to/your/recce/project
recce server --cloud
# Server starts on http://0.0.0.0:8080
```

### 3. Build and Run

```bash
# Build TypeScript
pnpm run build

# Run agent
node dist/index.js \
  --owner=dbt-labs \
  --repo=jaffle_shop \
  --pr=123

# Or use development mode (no build needed)
pnpm run dev -- --owner=dbt-labs --repo=jaffle_shop --pr=123
```

### 4. Check Logs

```bash
# View structured logs
cat logs/*-main-agent-*.log | tail -50

# View raw JSONL (for debugging)
cat logs/*-raw.jsonl | jq '.data.type' | uniq -c

# Check MCP connection status
cat logs/*-raw.jsonl | jq 'select(.data.type=="system") | .data.mcp_servers'
```

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxx
GITHUB_TOKEN=ghp_xxx          # or GITLAB_TOKEN

# Optional - Provider
PROVIDER=github               # github | gitlab | bitbucket

# Optional - Features
RECCE_ENABLED=true
RECCE_PROJECT_PATH=/path/to/recce/project
RECCE_YAML_PATH=/path/to/recce.yml
RECCE_EXECUTE_PRESET_CHECKS=true

# Optional - Output
OUTPUT_FORMAT=markdown        # markdown | slack | json | html
INCLUDE_PATCHES=false
MAX_PATCH_LINES=50

# Optional - Model
CLAUDE_MODEL=claude-sonnet-4-5

# Optional - Debug
DEBUG=false
```

### recce.yml Example

```yaml
checks:
  - name: stg_customers schema validation
    description: Ensure no breaking changes in stg_customers
    type: schema_diff
    params:
      model: stg_customers

  - name: stg_orders row count validation
    description: Validate row count is within acceptable range
    type: row_count_diff
    params:
      model: stg_orders

  - name: fct_orders value validation
    description: Ensure order totals match
    type: value_diff
    params:
      model: fct_orders
      columns: [order_total]
```

## Technology Stack

- **Language**: TypeScript (ESM modules)
- **Runtime**: Node.js 18+
- **AI Framework**: Claude Agent SDK
- **Protocol**: Model Context Protocol (MCP)
- **Git Providers**: GitHub (Octokit), GitLab (@zereight/mcp-gitlab)
- **dbt Integration**: Recce (SSE MCP server)
- **Build Tool**: esbuild
- **Package Manager**: pnpm

## Troubleshooting

### Issue: MCP Server Connection Failed

**Symptoms**:
```
❌ MCP Server 'recce' failed to connect:
   Status: error
   Error: ECONNREFUSED 127.0.0.1:8080
```

**Solutions**:
1. Ensure Recce server is running: `recce server --cloud`
2. Check port 8080 is not in use: `lsof -i :8080`
3. Verify Recce project has valid state

### Issue: GitHub/GitLab Authentication Failed

**Symptoms**:
```
❌ MCP Server 'github' failed to connect:
   Error: 401 Unauthorized
```

**Solutions**:
1. Check token is set: `echo $GITHUB_TOKEN`
2. Verify token has correct scopes (repo access)
3. Test token manually: `gh auth status` or `curl -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user`

### Issue: Agent Loop Timeout

**Symptoms**:
Agent runs for max turns (20) without completing

**Solutions**:
1. Check agent logs for repeated tool calls
2. Verify subagent prompts include context tags
3. Ensure MCP tools are returning valid data
4. Check for prompt ambiguity causing confusion

### Issue: TypeScript Import Errors

**Symptoms**:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
```

**Solutions**:
1. Ensure all imports use `.js` extensions
2. Rebuild: `pnpm run build`
3. Check tsconfig.json has `"module": "ESNext"`

## Performance Considerations

- **Model Selection**:
  - Main agent: `claude-sonnet-4-5` (synthesis requires intelligence)
  - Subagents: `haiku` (data fetching is straightforward)

- **Cost Optimization**:
  - Use haiku for 80% of work (subagents)
  - Only use sonnet for final synthesis
  - Typical cost per analysis: $0.10-0.30

- **Speed**:
  - Average execution time: 30-60 seconds
  - Depends on PR size and number of models changed
  - MCP tool latency is main bottleneck

## Future Enhancements

- [ ] Support for Bitbucket provider
- [ ] HTML template output format
- [ ] Incremental analysis (cache previous results)
- [ ] GitHub Actions integration
- [ ] GitLab CI integration
- [ ] Web UI for viewing analysis history
- [ ] Support for custom preset check evaluators
- [ ] Multi-project analysis (monorepo support)

## References

- [Claude Agent SDK Documentation](https://github.com/anthropics/agent-sdk)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Recce Documentation](https://datarecce.io/docs)
- [GitHub MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/github)
- [GitLab MCP Server](https://github.com/zereight/mcp-gitlab)

---

**Version**: 2.0.0 (Multi-agent architecture)
**Last Updated**: 2025-11-13
