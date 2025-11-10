# Recce Summary Agent

An intelligent CLI tool that automatically generates comprehensive PR summaries for dbt projects by analyzing pull requests with data quality insights powered by Claude AI and Recce.

## Requirements

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0 (or npm/yarn)
- **GitHub Token** with PR read access
- **Anthropic API Key** (Claude API access)
- **Recce** integration

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd recce-summary-agent

# Install dependencies
pnpm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Required
GITHUB_TOKEN=ghp_your_github_token_here
ANTHROPIC_API_KEY=sk_your_anthropic_key_here

# Optional
CLAUDE_MODEL=claude-haiku-4-5-20251001        # Model to use (default: claude-haiku-4-5)
RECCE_ENABLED=true                             # Enable Recce analysis (default: true)
RECCE_PROJECT_PATH=/path/to/your/recce         # Path to Recce project
DEBUG=false                                    # Enable debug logging (default: false)
RECCE_CLOUD_API_HOST=https://api.recce.cloud  # Recce Cloud API endpoint (optional)
RECCE_API_TOKEN=your_recce_api_token           # Recce API token (optional)
RECCE_SESSION_ID=your_session_id               # Recce session ID (optional)
```

See `.env.example` for a template.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token for API access |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude access |
| `CLAUDE_MODEL` | No | Model ID (default: `claude-haiku-4-5-20251001`) |
| `DEBUG` | No | Enable detailed debug logging (default: `false`) |
| `RECCE_CLOUD_API_HOST` | No | Recce Cloud API host |
| `RECCE_API_TOKEN` | No | Recce API authentication token |
| `RECCE_SESSION_ID` | No | Recce session identifier |

## Usage

### Basic Command

```bash
pnpm summary <owner> <repo> <pr-number>
```

The summary goes to `summary.md`

### Examples

**Generate summary and print to console:**
```bash
pnpm summary anthropic anthropic-sdk-js 123
```

**Generate summary and save to file:**
```bash
pnpm summary anthropic anthropic-sdk-js 123 ./summary.md
```

**Generate summary for a private repository:**
```bash
pnpm summary my-org my-private-repo 456 ./pr-456-summary.md
```
