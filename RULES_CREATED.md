# Cursor Rules Created

**Date**: 2025-11-13
**Purpose**: Establish development guidelines for Claude Code and Cursor IDE

## Overview

Created comprehensive development rules in `.cursor/rules/` to provide context-aware guidance when editing specific files. These rules are automatically applied by Cursor when matching files are opened.

## Created Rules

### 1. Core Rules

#### agent-sdk-patterns.mdc
- **Location**: `.cursor/rules/core/agent-sdk-patterns.mdc`
- **Auto-applies to**: `src/agent.ts`, `src/core/*.ts`
- **Coverage**:
  - Claude Agent SDK `query()` function usage
  - Subagent architecture patterns
  - MCP server configuration
  - Message stream processing
  - Permission isolation
  - Error handling patterns
- **Size**: ~200 lines with comprehensive examples

#### typescript-config.mdc
- **Location**: `.cursor/rules/core/typescript-config.mdc`
- **Auto-applies to**: `src/**/*.ts`, `*.config.ts`
- **Coverage**:
  - ES Modules (ESM) configuration
  - Import syntax with `.js` extensions
  - Type definitions (interface vs type)
  - tsconfig.json and package.json setup
  - Common issues and solutions
  - Code style and naming conventions
  - Type safety best practices
- **Size**: ~350 lines with detailed explanations

### 2. Architecture Rules

#### multi-agent-architecture.mdc
- **Location**: `.cursor/rules/architecture/multi-agent-architecture.mdc`
- **Auto-applies to**: `src/agent.ts`, `src/prompts/*.ts`
- **Coverage**:
  - Delegation-first design principles
  - Subagent types (github-context, recce-analysis, preset-check-executor)
  - Context tagging protocol
  - Main agent synthesis role
  - Permission isolation patterns
  - Dynamic subagent selection
  - Communication flow diagram
- **Size**: ~300 lines with detailed workflow descriptions

### 3. Integration Rules

#### mcp-integration.mdc
- **Location**: `.cursor/rules/integration/mcp-integration.mdc`
- **Auto-applies to**: `src/agent.ts`, `src/config.ts`, `src/providers/*.ts`
- **Coverage**:
  - MCP server types (stdio, sse, http)
  - Provider-specific configurations (GitHub, GitLab)
  - Recce MCP server setup
  - Connection validation and error handling
  - Common connection issues and solutions
  - MCP server lifecycle
  - Debugging techniques
- **Size**: ~350 lines with troubleshooting guides

## Directory Structure

```
.cursor/
└── rules/
    ├── core/
    │   ├── agent-sdk-patterns.mdc      # Claude Agent SDK patterns
    │   └── typescript-config.mdc       # TypeScript/ESM configuration
    ├── architecture/
    │   └── multi-agent-architecture.mdc # Multi-agent design patterns
    └── integration/
        └── mcp-integration.mdc          # MCP server integration
```

## Integration with CLAUDE.md

The rules are referenced in `CLAUDE.md` (Claude Code entry point):

| Rule | Auto-applies to | Content |
|------|----------------|---------|
| agent-sdk-patterns.mdc | src/agent.ts | Claude Agent SDK query(), subagents, MCP config |
| multi-agent-architecture.mdc | src/agent.ts | Delegation patterns, permission isolation, context tagging |
| mcp-integration.mdc | src/agent.ts | Recce MCP server setup, stdio communication |
| typescript-config.mdc | src/**/*.ts | ESM modules, .js import extensions, path aliases |

## Documentation Updates

### Created Files

1. **AGENTS.md** (New)
   - Complete architecture guide with 400+ lines
   - Detailed agent execution flow
   - Subagent specifications
   - MCP server configuration examples
   - Development workflow
   - Troubleshooting guide
   - Technology stack overview

2. **RULES_CREATED.md** (This file)
   - Summary of rule creation
   - Rule coverage and purpose
   - Integration documentation

### Updated Files

- **CLAUDE.md**: Already correctly referenced the rules (no changes needed)
- **.gitignore**: Added `.cursor/` and `.mcp.json` entries

## Rule Features

### Auto-Application
Rules automatically apply when editing matching file patterns:
- Edit `src/agent.ts` → All 3 agent-related rules apply
- Edit `src/providers/gitlab.ts` → TypeScript + MCP integration rules apply
- Edit `src/types/index.ts` → TypeScript rules apply

### Content Organization
Each rule includes:
- **Principles**: High-level concepts and patterns
- **Code Examples**: TypeScript code snippets showing correct usage
- **Anti-Patterns**: Common mistakes to avoid (with ❌ markers)
- **Best Practices**: Recommended approaches (with ✅ markers)
- **Troubleshooting**: Common issues and solutions
- **References**: Links to external documentation

### Visual Markers
- ✅ Correct patterns
- ❌ Anti-patterns to avoid
- ⚠️ Warnings and cautions
- 📋 Important notes

## Benefits

1. **Context-Aware Guidance**: Rules apply only to relevant files
2. **Consistency**: Enforces project patterns across codebase
3. **Knowledge Transfer**: Documents architectural decisions
4. **Onboarding**: New developers understand patterns quickly
5. **Error Prevention**: Highlights common pitfalls before they occur

## Maintenance

### When to Update Rules

- **New Patterns**: When introducing new architectural patterns
- **Common Mistakes**: When team repeatedly makes same errors
- **Technology Changes**: When upgrading Claude SDK or dependencies
- **Lessons Learned**: After resolving complex bugs

### How to Update Rules

1. Edit `.mdc` files directly in `.cursor/rules/`
2. Rules are automatically reloaded by Cursor
3. Test by opening matching files and observing applied rules
4. Document changes in git commit messages

## Build Verification

After creating rules:
- ✅ Build successful: `npm run build` → 821.9kb
- ✅ TypeScript compilation: No errors
- ✅ All files properly formatted
- ✅ Git status: 39 changed files ready for commit

## Next Steps

1. **Commit Changes**: Stage and commit all rule files
2. **Team Review**: Have team members review rules for accuracy
3. **Iterate**: Gather feedback and refine rules as needed
4. **Expand**: Add more rules as new patterns emerge

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Claude Code entry point
- [AGENTS.md](./AGENTS.md) - Complete architecture guide
- [README.md](./README.md) - Project overview
- [.env.example](./.env.example) - Configuration template

---

**Total Rules Created**: 4
**Total Lines Written**: ~1200 lines
**Coverage**: Agent SDK, TypeScript, Architecture, MCP Integration
**Status**: ✅ Complete and verified
