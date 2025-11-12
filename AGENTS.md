# Recce Summary Agent - Architecture Guide

> Knowledge base entry point for AI agents working with this Claude Agent SDK-based codebase.

## Overview

**Purpose**: Automated PR summary generator for dbt projects that analyzes pull requests with data quality insights powered by Claude AI and Recce.

**Architecture**: Multi-agent system using Claude Agent SDK with MCP (Model Context Protocol) integration for Recce data validation tools.

**Technology Stack**:
- **Agent Framework**: Claude Agent SDK (@anthropic-ai/claude-agent-sdk v0.1.30)
- **Language**: TypeScript 5.9+ (ES2020 target)
- **Runtime**: Node.js 18+ with ESM modules
- **Package Manager**: pnpm 8+
- **Build Tool**: esbuild (bundling), tsx (development)
- **Integrations**: GitHub (Octokit), Recce (MCP server), dbt (artifact analysis)
- **Validation**: Zod for schema validation

**Navigation**:
- For Claude Agent SDK patterns → [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)
- For multi-agent architecture → [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc)
- For MCP integration → [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)
- For TypeScript configuration → [typescript-config.mdc](mdc:.cursor/rules/core/typescript-config.mdc)

---

## Quick Start Decision Matrix

| If you need to...                    | Then...                                      | Reference                                                                   |
| ------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| Create a new agent                   | Extend PRAnalysisAgent class                 | [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)    |
| Add a subagent                       | Define in buildSubagents() method            | [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc) |
| Integrate new MCP tool               | Configure in buildMCPServerConfig()          | [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)    |
| Add environment variable             | Update config.ts and validateConfig()        | [config.ts](file:src/config.ts)                                            |
| Modify output format                 | Edit buildSystemPrompt() in agent.ts         | [agent.ts](file:src/agent.ts)                                              |
| Change logging behavior              | Update logger.ts or agent message handling   | [logger.ts](file:src/logger.ts)                                            |
| Add new data type                    | Define in src/types/index.ts                 | [types/index.ts](file:src/types/index.ts)                                  |
| Debug agent execution                | Check agent_log.jsonl (JSONL format)         | [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc) |

---

## Directory Structure

```
recce-summary-agent/
├── src/                       # TypeScript source code
│   ├── index.ts               # CLI entry point - argument parsing and main()
│   ├── agent.ts               # PRAnalysisAgent class - core agent logic
│   ├── config.ts              # Environment variable management
│   ├── context.ts             # Inter-agent communication context manager
│   ├── logger.ts              # Logging utility (console + debug mode)
│   └── types/                 # TypeScript type definitions
│       └── index.ts           # PRAnalysisResult, AgentContext, etc.
├── dist/                      # Compiled JavaScript output (esbuild)
├── .cursor/rules/             # Agent specification rules
│   ├── core/                  # Core patterns (Agent SDK, TypeScript)
│   ├── architecture/          # Multi-agent design patterns
│   └── integration/           # External integrations (MCP, GitHub)
├── .mcp.json                  # MCP server config for Cursor IDE (points to jaffle_shop_agentic)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript compiler configuration
├── pnpm-workspace.yaml        # pnpm workspace setup
├── .env                       # Environment variables (not committed)
└── README.md                  # User documentation

Generated artifacts:
├── agent_log.jsonl            # Detailed execution trace (JSONL format)
└── summary.md                 # PR analysis output (Markdown)
```

**Purpose of each directory**:
- `src/index.ts`: CLI entry point with argument parsing (`pnpm summary <owner> <repo> <pr-number>`)
- `src/agent.ts`: `PRAnalysisAgent` class implementing Claude Agent SDK query loop
- `src/config.ts`: Centralized environment variable access with validation
- `src/context.ts`: `ContextManager` for inter-agent message passing
- `src/types/`: TypeScript interfaces for PR metadata, dbt changes, validation results

**Key files to understand**:
1. `src/agent.ts` (lines 1-454): Main agent orchestration
   - `buildSystemPrompt()`: Agent instructions and delegation rules
   - `buildSubagents()`: Subagent definitions (github-context, recce-validation)
   - `buildMCPServerConfig()`: Recce MCP server setup
   - Agent loop processing with JSONL logging
2. `src/config.ts` (lines 1-52): Configuration management
3. `src/types/index.ts` (lines 1-93): Core data structures

---

## Development Workflow

### Agent Execution Flow

**High-Level Sequence**:
```
1. CLI Argument Parsing (index.ts)
   ↓
2. Configuration Validation (config.ts)
   ↓
3. Agent Initialization (agent.ts → PRAnalysisAgent)
   ↓
4. Claude Agent SDK Query Loop
   ├─ System Prompt: Delegation rules
   ├─ User Prompt: Analysis task
   ├─ MCP Server Config: Recce tools
   └─ Subagents: github-context, recce-validation
   ↓
5. Agent Loop (for await message of result)
   ├─ System: Initialization
   ├─ User: Tool results
   ├─ Assistant: Claude thinking + tool calls
   ├─ Tool Progress: Execution status
   └─ Result: Final summary
   ↓
6. Output Generation
   ├─ summary.md: Markdown output
   └─ agent_log.jsonl: Execution trace
```

**Agent Delegation Pattern**:
```
Main Agent (no direct tool access)
  ↓ delegates to
@agent-github-context (GitHub API access)
  - Fetch PR metadata
  - Identify dbt model changes
  - Return [GITHUB-CONTEXT] tagged response
  
@agent-recce-validation (Recce MCP tools access)
  - mcp__recce__get_lineage_diff
  - mcp__recce__row_count_diff
  - mcp__recce__profile_diff
  - Return [RECCE-VALIDATION] tagged response
  
Main Agent (synthesis)
  ↓ generates
Comprehensive Markdown Summary
```

**For detailed agent patterns**, see [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)

### Development Commands

```bash
# Install dependencies
pnpm install

# Run in development mode (with tsx)
pnpm dev <owner> <repo> <pr-number>

# Build for production (esbuild)
pnpm build

# Run built version
node dist/index.js <owner> <repo> <pr-number>

# Type checking only (no build)
pnpm type-check

# Generate summary (shortcut)
pnpm summary <owner> <repo> <pr-number> [output-path]
```

**Environment setup**:
1. Copy `.env.example` to `.env`
2. Set required variables:
   - `GITHUB_TOKEN`: GitHub PAT with PR read access
   - `ANTHROPIC_API_KEY`: Claude API key
3. Optional variables:
   - `CLAUDE_MODEL`: Model ID (default: `claude-haiku-4-5`)
   - `DEBUG`: Enable verbose logging (default: `false`)
   - `RECCE_ENABLED`: Enable Recce analysis (default: `true`)

**For MCP server setup**, see [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)

**MCP Configuration**:
- **IDE (Cursor)**: `.mcp.json` enables Recce tools in Cursor Chat for testing
  - Points to `jaffle_shop_agentic` test project
  - Useful for developing agent logic with real MCP tool access
- **Runtime (Agent)**: `src/agent.ts` configures MCP when agent executes
  - Dynamic configuration based on target dbt project
  - Used during actual PR analysis

---

## Technology Stack Index

### Core Framework
- **Claude Agent SDK**: [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)
  - `query()` function for agent loops
  - Subagent delegation with isolated permissions
  - MCP server configuration
  - Message streaming and processing

### Architecture
- **Multi-Agent System**: [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc)
  - Main agent orchestration
  - Subagent definitions (github-context, recce-validation)
  - Permission-based tool access
  - Context isolation and message tagging

### Integration
- **MCP Integration**: [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)
  - Recce MCP server setup (`recce mcp-server`)
  - Tool permissions and subagent access
  - Stdio-based communication
- **GitHub API**: Octokit for PR data fetching (future enhancement)
- **dbt Integration**: Artifact analysis in target/ and target-base/

### Development Tools
- **TypeScript**: [typescript-config.mdc](mdc:.cursor/rules/core/typescript-config.mdc)
  - ES2020 target with strict mode
  - Path aliases (`@/*` → `src/*`)
  - ESM modules with `.js` import extensions
- **Build**: esbuild for bundling, tsx for development
- **Validation**: Zod for schema validation (future use)

---

## Quick Commands & Troubleshooting

### Common Commands

```bash
# Basic usage
pnpm summary anthropic anthropic-sdk-js 123

# Save to specific file
pnpm summary anthropic anthropic-sdk-js 123 ./pr-123-analysis.md

# Development mode with debug logging
DEBUG=true pnpm dev my-org my-repo 456

# Build and verify
pnpm build
node dist/index.js my-org my-repo 456

# Type check
pnpm type-check

# Test Recce MCP tools in Cursor (requires .mcp.json)
# Open Cursor Chat and try:
# "Use mcp__recce__get_lineage_diff to show model changes"
```

### Common Issues

#### Issue: "GITHUB_TOKEN environment variable is not set"
**Symptoms**: Configuration validation fails at startup  
**Cause**: Missing `.env` file or empty `GITHUB_TOKEN`  
**Solution**:
1. Create `.env` file in project root
2. Add: `GITHUB_TOKEN=ghp_your_token_here`
3. Verify with: `cat .env | grep GITHUB_TOKEN`

#### Issue: "ANTHROPIC_API_KEY environment variable is not set"
**Symptoms**: Configuration validation fails at startup  
**Cause**: Missing or empty `ANTHROPIC_API_KEY`  
**Solution**:
1. Add to `.env`: `ANTHROPIC_API_KEY=sk_your_key_here`
2. Get API key from: https://console.anthropic.com/

#### Issue: MCP server tools not available
**Symptoms**: Agent logs show "No Recce tools available"  
**Cause**: Recce MCP server not running or misconfigured  
**Solution**:
1. Ensure Recce is installed: `pip install recce`
2. Verify MCP server works: `recce mcp-server` (should start stdio server)
3. Check `buildMCPServerConfig()` in `src/agent.ts`:
   ```typescript
   recce: {
     type: "stdio",
     command: "recce",
     args: ["mcp-server"],
   }
   ```
4. Check agent_log.jsonl for MCP server connection errors

#### Issue: Agent exceeds max turns (20)
**Symptoms**: Analysis stops with "max_turns_reached" message  
**Cause**: Agent loop not converging (too many tool calls)  
**Solution**:
1. Check agent_log.jsonl for repeated tool calls
2. Simplify prompts in `buildSystemPrompt()` or `buildUserPrompt()`
3. Increase `maxTurns` in `AgentOptions` (default: 20)
4. Review subagent prompts for ambiguity

#### Issue: Import errors with .js extensions
**Symptoms**: TypeScript compilation works but runtime fails  
**Cause**: ESM requires explicit `.js` extensions in imports  
**Solution**:
```typescript
// ✅ Correct (ESM with .js extension)
import { config } from "./config.js";

// ❌ Wrong (will fail at runtime)
import { config } from "./config";
```

**Debug checklist**:
- [ ] Check `.env` file exists with required variables
- [ ] Verify Recce is installed: `recce --version`
- [ ] Test MCP server: `recce mcp-server` (Ctrl+C to stop)
- [ ] Check agent_log.jsonl for detailed errors
- [ ] Enable debug mode: `DEBUG=true pnpm dev ...`
- [ ] Verify Node version: `node --version` (should be ≥18.0.0)

---

## Key Principles

### Agent Design Principles
1. **Delegation Over Direct Access**: Main agent orchestrates via subagents, doesn't call tools directly
2. **Permission Isolation**: Tools restricted to specific subagents (`allowedTools` in subagent config)
3. **Context Tagging**: Subagents prefix responses with `[GITHUB-CONTEXT]` or `[RECCE-VALIDATION]` for observability
4. **Prompt Clarity**: System prompts explicitly state WHICH agent can access WHICH tools
5. **Synthesis Role**: Main agent synthesizes subagent findings into comprehensive output

### Code Organization Principles
1. **ESM Modules**: Use `.js` extensions in imports (TypeScript transpiles to ESM)
2. **Type Safety**: Define interfaces in `src/types/` before implementing features
3. **Configuration Centralization**: All env vars accessed through `config.ts`
4. **Logging Discipline**: Use `logger` for console output, write structured logs to `agent_log.jsonl`
5. **Single Responsibility**: Each file has one clear purpose (agent logic, config, types, etc.)

### Observability Principles
1. **JSONL Logging**: Every agent message appended to `agent_log.jsonl` for debugging
2. **Turn Counting**: Track agent loop iterations in logs
3. **Token Tracking**: Log usage and cost from Claude API responses
4. **Subagent Tagging**: Identify which subagent executed in logs

---

## Testing Strategy

**Current State**: No automated tests yet (integration testing recommended)

**Recommended Test Structure**:
```bash
tests/
├── unit/
│   ├── config.test.ts          # Environment validation
│   ├── logger.test.ts          # Logging utility
│   └── context.test.ts         # Context manager
├── integration/
│   ├── agent.test.ts           # Full agent execution with mocked MCP
│   └── github-api.test.ts      # Octokit integration
└── fixtures/
    ├── mock-pr-response.json
    └── mock-recce-output.json
```

**Testing Tools**:
- Test framework: Vitest (recommended for ESM + TypeScript)
- Mocking: Mock MCP server responses for deterministic tests
- Fixtures: Store sample PR data and Recce outputs

**For testing patterns**, see future [testing-strategy.mdc](mdc:.cursor/rules/core/testing-strategy.mdc)

---

## Output Formats

### agent_log.jsonl (Observability)
JSONL format with one JSON object per line:
```jsonl
{"timestamp":"2025-11-11T12:00:00.000Z","event":"agent_start","context":{"owner":"anthropic","repo":"anthropic-sdk-js","prNumber":123}}
{"timestamp":"2025-11-11T12:00:01.000Z","event":"message_received","type":"system","data":{...}}
{"timestamp":"2025-11-11T12:00:02.000Z","event":"message_received","type":"assistant","data":{...}}
{"timestamp":"2025-11-11T12:00:10.000Z","event":"agent_complete","elapsedSeconds":10.5}
```

**Query examples**:
```bash
# Show all agent thinking
cat agent_log.jsonl | jq 'select(.type == "assistant") | .data.message.content[] | select(.type == "text") | .text'

# Show all tool calls
cat agent_log.jsonl | jq 'select(.type == "assistant") | .data.message.content[] | select(.type == "tool_use")'

# Show final result
cat agent_log.jsonl | jq 'select(.event == "message_received" and .type == "result")'
```

### summary.md (Final Output)
Structured Markdown with sections:
1. **Overview**: Analysis scope and key findings
2. **dbt Model Changes**: Added/removed/modified models with counts
3. **Data Insights**: Row count changes (current vs baseline), percentages, direction (📈/📉)
4. **Risk Assessment**: Risk level (LOW/MEDIUM/HIGH) with factors
5. **Data Quality**: Anomalies and warnings detected
6. **Actionable Recommendations**: Next steps for reviewers

---

## Related Rules

- [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc) - Claude Agent SDK usage
- [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc) - Subagent patterns
- [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc) - MCP server setup
- [typescript-config.mdc](mdc:.cursor/rules/core/typescript-config.mdc) - TypeScript configuration

---

**Total Lines**: ~450 (within 550-line limit)

