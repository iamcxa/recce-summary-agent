# Claude Code Entry Point

## Main Documentation

Read **[AGENTS.md](./AGENTS.md)** for the complete architecture guide.

This covers:
- Claude Agent SDK multi-agent architecture with delegation patterns
- Directory structure and file organization (src/agent.ts, src/config.ts, etc.)
- Development workflow and agent execution flow
- Technology stack: Agent SDK, MCP, Octokit, TypeScript ESM
- Troubleshooting guide for MCP server and agent loop issues

---

## Technology-Specific Rules

Cursor automatically applies these rules when editing matching files:

| Rule                                                                                        | Auto-applies to | Content                                                    |
| ------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------- |
| [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)                     | src/agent.ts    | Claude Agent SDK query(), subagents, MCP config            |
| [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc) | src/agent.ts    | Delegation patterns, permission isolation, context tagging |
| [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)                    | src/agent.ts    | Recce MCP server setup, stdio communication                |
| [typescript-config.mdc](mdc:.cursor/rules/core/typescript-config.mdc)                       | src/**/*.ts     | ESM modules, .js import extensions, path aliases           |

---

## Quick Principles

### Agent Architecture
- ✅ **Delegation-First**: Main agent orchestrates via subagents, never calls tools directly
- ✅ **Permission Isolation**: Tools restricted to specific subagents (`allowedTools` in config)
- ✅ **Context Tagging**: Subagents prefix responses with `[GITHUB-CONTEXT]` or `[RECCE-VALIDATION]`
- ✅ **Synthesis Role**: Main agent synthesizes subagent findings into markdown output

### Code Patterns
- ✅ **ESM Imports**: Always use `.js` extensions (`import { x } from "./file.js"`)
- ✅ **Type Safety**: Define interfaces in `src/types/` before implementing features
- ✅ **Config Centralization**: All env vars accessed through `config.ts`
- ✅ **JSONL Logging**: Append every message to `agent_log.jsonl` for observability

### Common Pitfalls
- ❌ **No Direct Tool Access**: Main agent must delegate to subagents with tool permissions
- ❌ **Missing .js Extensions**: ESM requires explicit extensions in imports
- ❌ **Hardcoded Config**: Never bypass `config.ts` for environment variables
- ❌ **Ignoring Agent Logs**: Always check `agent_log.jsonl` for debugging

---

## When to Read Which Rule

- **Creating new agent logic**: [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)
- **Adding subagents**: [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc)
- **Configuring MCP tools**: [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)
- **TypeScript issues**: [typescript-config.mdc](mdc:.cursor/rules/core/typescript-config.mdc)
- **Environment setup**: See [AGENTS.md](./AGENTS.md) → Development Workflow

---

**Total Lines**: ~75 (within 100-line limit)

