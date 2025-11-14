# Recce Summary Agent

An intelligent CLI tool that automatically generates comprehensive PR summaries for dbt projects by analyzing pull requests with data quality insights powered by Claude AI and Recce.

## Requirements

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (or npm/yarn)
- **Git Provider Token** (GitHub, GitLab, or Bitbucket)
- **Anthropic API Key** (Claude API access)
- **Recce Server** running with MCP interface (for dbt validation)

## Installation

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd recce-summary-agent

# Install dependencies
pnpm install

# Build the project
pnpm run build
```

### Global Installation (Recommended)

After building, you can install `recce-agent` as a global CLI command:

```bash
# Link as global command
pnpm link --global

# Now you can use 'recce-agent' from anywhere
recce-agent --help

# To uninstall
pnpm unlink --global
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Required
ANTHROPIC_API_KEY=sk_your_anthropic_key_here
GIT_TOKEN=your_git_provider_token_here  # Works for GitHub, GitLab, or Bitbucket

# Optional
CLAUDE_MODEL=claude-haiku-4-5-20251001  # Model to use (default)
RECCE_ENABLED=true                       # Enable Recce analysis (default: true)
RECCE_PROJECT_PATH=/path/to/your/recce  # Path to Recce project
DEBUG=false                              # Enable debug logging (default: false)
```

See `.env.example` for a complete template.

### Environment Variables

| Variable             | Required | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `ANTHROPIC_API_KEY`  | Yes      | Anthropic API key for Claude access              |
| `GIT_TOKEN`          | Yes      | Git provider token (GitHub/GitLab/Bitbucket)     |
| `CLAUDE_MODEL`       | No       | Model ID (default: `claude-haiku-4-5-20251001`)  |
| `RECCE_ENABLED`      | No       | Enable Recce validation (default: `true`)        |
| `RECCE_PROJECT_PATH` | No       | Path to Recce project (default: `.`)             |
| `DEBUG`              | No       | Enable detailed debug logging (default: `false`) |

## Usage

### Basic Command

```bash
recce-agent [git-url] [options]
```

The CLI automatically detects whether the URL is a **Pull Request** or **Repository** URL:
- **PR URL** → Full diff analysis with Recce validation
- **Repo URL** → Repository overview analysis (main branch)

### Key Features

- **Unified Summary Format**: Single comprehensive format highlighting Recce tool capabilities
- **Automatic Preset Checks**: Loads and executes checks from `recce.yml` automatically
- **Customizable Prompts**: Override system or user prompts for specific analysis needs
- **Slash Commands**: Define reusable prompt templates
- **Debug Mode**: Detailed execution logging for troubleshooting

### Examples

**Analyze a Pull Request (GitHub):**
```bash
recce-agent https://github.com/dbt-labs/jaffle_shop/pull/123
```

**Analyze a GitLab Merge Request:**
```bash
recce-agent https://gitlab.com/my-org/my-project/-/merge_requests/456
```

**Analyze a Repository (main branch overview):**
```bash
recce-agent https://github.com/dbt-labs/jaffle_shop
```

**With custom Recce MCP URL:**
```bash
recce-agent https://github.com/org/repo/pull/123 --recce-mcp-url http://localhost:9000/sse
```

**With custom Recce config:**
```bash
recce-agent https://github.com/org/repo/pull/123 --recce-config ./custom-recce.yml
```

**Add custom analysis instructions:**
```bash
recce-agent https://github.com/org/repo/pull/789 --user-prompt "Focus on schema changes and data quality"
```

**Save output to file:**
```bash
recce-agent https://github.com/org/repo/pull/123 --output ./summary.md
```

**Override system prompt:**
```bash
recce-agent https://github.com/org/repo/pull/123 --system-prompt "You are a senior data engineer..."
```

**View prompts without executing:**
```bash
recce-agent https://github.com/org/repo/pull/123 --show-system-prompt
```

**Combine multiple options:**
```bash
recce-agent https://github.com/org/repo/pull/123 \
  --recce-config ./custom-recce.yml \
  --user-prompt "Highlight breaking changes" \
  --output ./pr-summary.md \
  --debug
```

### CLI Options

View all available options:

```bash
recce-agent --help
```

Key options:

| Option | Description | Default |
|--------|-------------|---------|
| `--recce-mcp-url <url>` | Recce MCP server URL | `http://localhost:8080/sse` |
| `--recce-config <path>` | Path to recce.yml configuration file | Auto-detect in current directory |
| `--user-prompt <text>` | Custom user prompt (appends to default) | - |
| `--system-prompt <text>` | Custom system prompt (overrides default) | - |
| `--prompt-commands-path <path>` | Directory with slash command definitions | - |
| `--show-system-prompt` | Display prompts without executing | - |
| `-o, --output <path>` | Save analysis to file | - |
| `--debug` | Enable detailed debug logging | `false` |
| `--verify-recce-mcp [url]` | Verify Recce MCP server connectivity | - |
| `--verify-git-mcp <provider>` | Verify Git provider MCP (github/gitlab/bitbucket) | - |

### Supported URL Formats

| Provider      | PR/MR URL                                            | Repo URL                           |
| ------------- | ---------------------------------------------------- | ---------------------------------- |
| **GitHub**    | `https://github.com/owner/repo/pull/123`             | `https://github.com/owner/repo`    |
| **GitLab**    | `https://gitlab.com/owner/repo/-/merge_requests/456` | `https://gitlab.com/owner/repo`    |
| **Bitbucket** | `https://bitbucket.org/owner/repo/pull-requests/789` | `https://bitbucket.org/owner/repo` |


## Logging

The tool automatically generates logs in two formats for different use cases:

### 1. Raw JSONL Format
**Location:** `logs/recce-agent-raw.jsonl`

Machine-readable format with complete structured data. Each line is a JSON object:

```json
{"timestamp":"2025-11-14T14:01:27.183Z","level":"INFO","message":"Recce Agent - Git Analysis Tool"}
{"timestamp":"2025-11-14T14:01:27.196Z","level":"INFO","role":"main","action":"analyze","context":"pr-123","message":"Starting PR analysis"}
```

**Use cases:**
- Machine processing and analysis
- Log aggregation systems
- Automated monitoring

```bash
# View all messages
cat logs/recce-agent-raw.jsonl | jq '.message'

# Filter by level
cat logs/recce-agent-raw.jsonl | jq 'select(.level == "ERROR")'

# Extract specific fields
cat logs/recce-agent-raw.jsonl | jq '{time: .timestamp, role: .role, msg: .message}'
```

### 2. Human-Readable Format
**Location:** `logs/recce-agent.log`

Human-friendly format optimized for debugging and monitoring:

```
下午10:01:27: Recce Agent - Git Analysis Tool
下午10:01:27 - main - analyze - pr-123: Starting PR analysis
下午10:01:28 - github-context - fetch - get_file_contents: Fetching file README.md
```

**Format:** `(time) - role - action - command/context: message`

**Use cases:**
- Quick debugging during development
- Manual inspection of execution flow
- Troubleshooting issues

```bash
# View recent logs
tail -f logs/recce-agent.log

# Search for specific patterns
grep "ERROR" logs/recce-agent.log
grep "github-context" logs/recce-agent.log
```

### Agent Execution Logs (JSONL)

In addition to the main logs above, the multi-agent system generates detailed execution traces in `logs/*.jsonl` files. These contain low-level agent events (agent start, messages, tool calls, results):

```bash
# View all agent execution logs
ls logs/*.jsonl

# Inspect a specific agent's trace
cat logs/*-main-agent-*.jsonl | jq '.data.message'
```

### Console Output Behavior

The agent provides real-time console output with clean, readable formatting using symbols instead of verbose log level names:

**Log Level Symbols:**
- `•` (INFO) - General information messages
- `→` (DEBUG) - Detailed execution information (only with `--debug`)
- `⚠` (WARN) - Warning messages
- `✗` (ERROR) - Error messages

**Format:** `[HH:mm:ss] symbol message`

**Example output:**
```
[23:07:21] • Recce Agent - Git Analysis Tool
[23:07:21] • Recce MCP Server: http://localhost:8080/sse
[23:07:21] • ⚙️  Using custom user prompt
[23:07:22] • ✅ Recce MCP server connected
[23:07:22] • 📋 Loaded 4 preset checks from recce.yml
[23:07:22] → Preset checks structure: {checks: [...], total_size: 2.3kb}
[23:07:23] ⚠ Recce MCP server unreachable - disabling Recce features
[23:07:24] ✗ Connection failure: timeout after 30s
```

### Output Behavior Matrix

The following table describes how console output behaves with different CLI flags:

| Flags | Info Logs | Debug Logs | Final Result |
|-------|-----------|------------|--------------|
| (none) | ✅ Console | ❌ | ✅ Console |
| `--debug` | ✅ Console | ✅ Console | ✅ Console |
| `-o file` | ✅ Console | ❌ | ❌ (file only) |
| `--debug -o file` | ✅ Console | ✅ Console | ❌ (file only) |
| `--show-system-prompt` | ✅ Console (flow) | ❌ | N/A (exits) |
| `--show-system-prompt --debug` | ✅ Console (flow) | ✅ Console | N/A (exits) |

**Key Points:**
- `--debug` flag enables debug-level logs (symbol: `→`) showing detailed execution information
- `-o` flag suppresses final result output to console (writes to file only)
- Info logs always show on console regardless of flags (except when using `-o` for final result)
- `--show-system-prompt` displays prompts and exits before execution

### Log Levels

**INFO (`•`)** - Always visible (default level)
- Startup banner and configuration
- MCP connection status
- Preset checks and slash commands loaded
- Prompt override indicators
- Analysis start/completion

**DEBUG (`→`)** - Only with `--debug` flag
- MCP server URLs and connection details
- Prompt composition details
- Agent SDK subagent delegation
- File I/O operations
- Token usage statistics

**WARN (`⚠`)** - Always visible
- Failed to load slash commands
- Recce MCP unavailable
- Non-critical errors

**ERROR (`✗`)** - Always visible
- Connection failures
- Parse errors
- Validation failures
- Critical errors requiring attention

**Examples:**

```bash
# Default: Info logs only
./dist/recce-agent https://github.com/org/repo/pull/123

# Enable debug logging
./dist/recce-agent https://github.com/org/repo/pull/123 --debug

# Save result to file (no console output for final result)
./dist/recce-agent https://github.com/org/repo/pull/123 -o summary.md

# Show final prompt configuration without executing
./dist/recce-agent https://github.com/org/repo/pull/123 --show-system-prompt
```