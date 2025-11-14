# Claude Code Entry Point

## Main Documentation

Read **[AGENTS.md](./AGENTS.md)** for the complete architecture guide.

This covers:
- Claude Agent SDK multi-agent architecture with delegation patterns
- Directory structure and file organization
- Development workflow and agent execution flow
- Technology stack: Agent SDK, MCP, Octokit, TypeScript ESM
- Troubleshooting guide for MCP server and agent loop issues

---

## Modular Architecture (Clean Architecture)

The agent has been refactored into a **modular architecture** following Clean Architecture principles:

```
src/agent/                    # Agent module (modular, testable)
├── types.ts                 # Domain layer: Type definitions
├── mcp-connector.ts         # Infrastructure: MCP connectivity
├── preset-loader.ts         # Infrastructure: Preset checks loading
├── message-handler.ts       # Application: System message processing
├── agent-executor.ts        # Use Case: Agent execution & streaming
├── pr-analyzer.ts           # Orchestrator: Main PR analysis coordinator
└── index.ts                 # Public API exports

src/agent.ts                 # Thin wrapper for backward compatibility
```

### Design Principles
- **Single Responsibility**: Each module averages ~80 lines with one clear purpose
- **Dependency Inversion**: High-level modules don't depend on low-level details
- **Testability**: Modules can be tested independently
- **Maintainability**: Clear separation of concerns

---

## Technology-Specific Rules

Cursor automatically applies these rules when editing matching files:

| Rule                                                                                        | Auto-applies to         | Content                                                    |
| ------------------------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)                     | src/agent/**/*.ts       | Claude Agent SDK query(), subagents, MCP config            |
| [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc) | src/agent/**/*.ts       | Delegation patterns, permission isolation, context tagging |
| [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)                    | src/agent/**/*.ts       | Recce MCP server setup, stdio communication                |
| [typescript-config.mdc](mdc:.cursor/rules/core/typescript-config.mdc)                       | src/**/*.ts             | ESM modules, .js import extensions, path aliases           |

---

## Quick Principles

### Agent Architecture
- ✅ **Delegation-First**: Main agent orchestrates via subagents, never calls tools directly
- ✅ **Permission Isolation**: Tools restricted to specific subagents (`allowedTools` in config)
- ✅ **Context Tagging**: Subagents prefix responses with `[GITHUB-CONTEXT]` or `[RECCE-VALIDATION]`
- ✅ **Synthesis Role**: Main agent synthesizes subagent findings into markdown output
- ✅ **Modular Design**: Agent logic split into focused modules for better maintainability

### Code Patterns
- ✅ **ESM Imports**: Always use `.js` extensions (`import { x } from "./file.js"`)
- ✅ **Type Safety**: Define interfaces in `src/types/` before implementing features
- ✅ **Config Centralization**: All env vars accessed through `config.ts`
- ✅ **Structured Logging**: Use `logInfo/logError` from `agent_logger.ts`, not `console.log`
- ✅ **Tab Indentation**: Multi-line logs use tabs for consistent alignment across environments
- ✅ **Code Quality**: Run `pnpm run lint` before commits (Biome linter/formatter)

### Common Pitfalls
- ❌ **No Direct Tool Access**: Main agent must delegate to subagents with tool permissions
- ❌ **Missing .js Extensions**: ESM requires explicit extensions in imports
- ❌ **Hardcoded Config**: Never bypass `config.ts` for environment variables
- ❌ **Console.log Usage**: Use `logInfo/logError/logWarn/logDebug` for consistent logging
- ❌ **Ignoring Lint Errors**: Always fix Biome errors before committing
- ❌ **Skipping Type Annotations**: Avoid `any` types and implicit type evolution

---

## Development Tools

### Biome (Linter/Formatter)
- **Check**: `pnpm run lint:check` - View issues without auto-fix
- **Fix**: `pnpm run lint` - Auto-fix safe issues
- **Format**: `pnpm run format` - Format code only
- **Full Check**: `pnpm run check` - Lint + TypeScript validation
- **Config**: `biome.json` - Comprehensive rules for complexity, correctness, security, style

### Build & Test
- **Build**: `pnpm run build` - Bundle with esbuild → `dist/recce-agent`
- **Dev**: `pnpm run dev` - Watch mode for development

---

## When to Read Which Rule

- **Creating new agent logic**: [agent-sdk-patterns.mdc](mdc:.cursor/rules/core/agent-sdk-patterns.mdc)
- **Adding subagents**: [multi-agent-architecture.mdc](mdc:.cursor/rules/architecture/multi-agent-architecture.mdc)
- **Configuring MCP tools**: [mcp-integration.mdc](mdc:.cursor/rules/integration/mcp-integration.mdc)
- **TypeScript issues**: [typescript-config.mdc](mdc:.cursor/rules/core/typescript-config.mdc)
- **Environment setup**: See [AGENTS.md](./AGENTS.md) → Development Workflow

---

## Key Changes in This Session

### 1. Fixed GitHub MCP Tool Registration
- **Issue**: Tool name mismatch (0 tools registered)
- **Fix**: Updated to actual tool names (`mcp__github__pull_request_read`)
- **Result**: GitHub 26 tools + Recce 6 tools successfully registered

### 2. Refactored agent.ts (829 → 239 lines)
- **Before**: Single 829-line file with mixed responsibilities
- **After**: 7 focused modules in `src/agent/` (avg 80 lines each)
- **Benefit**: Better testability, maintainability, and extensibility

### 3. Improved Log Formatting
- **Multi-line alignment**: Changed from spaces to tabs for environment consistency
- **Unified logging**: Replaced `console.log` with `logInfo/logError` for timestamps

### 4. Fixed TypeScript Errors
- Added `ProviderType` re-export in `src/types/index.ts`
- Fixed `gitUrl` undefined handling in `src/index.ts`

---

**Architecture Version**: 2.0 (Modularized)
**Last Updated**: 2025-01-15
