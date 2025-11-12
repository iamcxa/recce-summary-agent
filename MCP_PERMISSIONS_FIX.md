# MCP Tool Permissions Fix

**Date**: 2025-11-13
**Purpose**: Pre-grant MCP tool permissions to avoid permission prompts during execution

## Problem Identified

**User Observation**:
```
Claude requested permissions to use mcp__recce__schema_diff, but you haven't granted it yet
```

**Issue**: When preset-check-executor subagent tried to call MCP tools, Claude Agent SDK prompted for permissions, blocking execution.

---

## Root Cause

### Claude Agent SDK Permission Model

The Claude Agent SDK has a permission system that requires tools to be pre-authorized in the main agent's `allowedTools` list, even when those tools are only used by subagents.

**Before (Incorrect)**:
```typescript
// src/agent.ts
const result = query({
  prompt: userPrompt,
  options: {
    model: config.claude.model,
    systemPrompt,
    mcpServers: mcpServers as any,
    allowedTools: [], // ❌ Empty - no tools pre-authorized
    agents, // Subagents configured with tools: ['mcp__recce']
  },
});
```

**Problem**:
1. Main agent has `allowedTools: []` (empty)
2. Subagents have `tools: ['mcp__recce']` in their config
3. When subagent calls `mcp__recce__schema_diff`, SDK checks main agent's `allowedTools`
4. Tool not found in `allowedTools` → Permission prompt appears
5. Execution blocks waiting for permission grant

**Why this happens**:
- The SDK's permission model operates at the **main agent level**
- Even though subagents have tool permissions in their config, those are just filters
- The main agent's `allowedTools` acts as the **master permission list**
- If a tool is not in `allowedTools`, the SDK won't allow any subagent to call it

---

## Solution

Pre-grant permissions for all MCP tools in the main agent's `allowedTools` list.

### Implementation

**File**: `src/agent.ts` (Line 182-215)

**Added**:
```typescript
// Build allowed tools list - include all MCP tools that subagents need
const allowedTools: string[] = [
  // Recce MCP tools (for recce-analysis and preset-check-executor subagents)
  'mcp__recce__get_lineage_diff',
  'mcp__recce__lineage_diff',
  'mcp__recce__schema_diff',
  'mcp__recce__row_count_diff',
  'mcp__recce__query',
  'mcp__recce__query_diff',
  'mcp__recce__profile_diff',
  // GitHub MCP tools (for github-context subagent)
  'mcp__github__get_pull_request',
  'mcp__github__get_pull_request_files',
  'mcp__github__get_pull_request_status',
  'mcp__github__get_pull_request_comments',
  'mcp__github__get_pull_request_reviews',
  'mcp__github__list_pull_requests',
  'mcp__github__search_issues',
  'mcp__github__search_code',
];

// Execute agent with Claude SDK
const result = query({
  prompt: userPrompt,
  options: {
    model: config.claude.model,
    systemPrompt,
    cwd: process.cwd(),
    maxTurns: 20,
    mcpServers: mcpServers as any,
    allowedTools, // ✅ Pre-grant permissions for all MCP tools
    agents, // Subagents with tool permissions
  },
});
```

---

## How Permissions Work in Claude Agent SDK

### Permission Hierarchy

```
Main Agent (query options)
├── allowedTools: [...] ← Master permission list (controls what ANY agent can use)
└── agents:
    ├── github-context:
    │   └── tools: ['mcp__github'] ← Filter: Only GitHub tools
    ├── recce-analysis:
    │   └── tools: ['mcp__recce'] ← Filter: Only Recce tools
    └── preset-check-executor:
        └── tools: ['mcp__recce'] ← Filter: Only Recce tools
```

### Permission Check Flow

```
1. Subagent wants to call mcp__recce__schema_diff
   ↓
2. SDK checks: Is 'mcp__recce__schema_diff' in main agent's allowedTools?
   ↓
   YES → Continue to step 3
   NO → Prompt for permission (blocks execution)
   ↓
3. SDK checks: Does this subagent's tools list allow 'mcp__recce__schema_diff'?
   ↓
   YES (mcp__recce matches mcp__recce__*) → Allow call
   NO → Deny call
```

### Key Principles

1. **Master Permission List**: `allowedTools` in main agent is the ultimate authority
2. **Subagent Filters**: `tools` in subagent config are just filters, not grants
3. **Prefix Matching**: `'mcp__recce'` in subagent matches `'mcp__recce__*'` tools
4. **No Runtime Prompts**: Pre-granting avoids blocking prompts during execution

---

## Before vs After

### Before (Blocking Behavior)

```
Turn 7: preset-check-executor calls mcp__recce__schema_diff
↓
SDK: "Claude requested permissions to use mcp__recce__schema_diff"
↓
Execution BLOCKS waiting for user input
↓
User must manually grant permission
↓
Tool call proceeds (if granted)
```

**Problems**:
- ❌ Execution blocks
- ❌ Requires manual intervention
- ❌ Not suitable for automated workflows (CI/CD)
- ❌ Degrades user experience

### After (Non-Blocking Behavior)

```
Turn 7: preset-check-executor calls mcp__recce__schema_diff
↓
SDK checks allowedTools: 'mcp__recce__schema_diff' → FOUND ✅
↓
SDK checks subagent tools: 'mcp__recce' matches 'mcp__recce__*' → ALLOWED ✅
↓
Tool call proceeds immediately
↓
Tool result returned
```

**Benefits**:
- ✅ No blocking prompts
- ✅ Fully automated execution
- ✅ Works in CI/CD environments
- ✅ Better user experience

---

## Tool List Rationale

### Recce MCP Tools

All tools available from Recce MCP server:

| Tool | Used By | Purpose |
|------|---------|---------|
| `mcp__recce__get_lineage_diff` | recce-analysis | Get model lineage changes |
| `mcp__recce__lineage_diff` | recce-analysis | Alternative lineage API |
| `mcp__recce__schema_diff` | preset-check-executor | Schema change validation |
| `mcp__recce__row_count_diff` | preset-check-executor | Row count comparison |
| `mcp__recce__query` | recce-analysis | Execute SQL queries |
| `mcp__recce__query_diff` | preset-check-executor | Compare query results |
| `mcp__recce__profile_diff` | preset-check-executor | Statistical profile comparison |

### GitHub MCP Tools

Commonly used tools from GitHub MCP server:

| Tool | Used By | Purpose |
|------|---------|---------|
| `mcp__github__get_pull_request` | github-context | Get PR metadata |
| `mcp__github__get_pull_request_files` | github-context | Get changed files |
| `mcp__github__get_pull_request_status` | github-context | Get CI/CD status |
| `mcp__github__get_pull_request_comments` | github-context | Get PR comments |
| `mcp__github__get_pull_request_reviews` | github-context | Get PR reviews |
| `mcp__github__list_pull_requests` | github-context | List PRs |
| `mcp__github__search_issues` | github-context | Search issues |
| `mcp__github__search_code` | github-context | Search code |

**Note**: We only include tools that are actually used by subagents. This follows the principle of least privilege.

---

## Build Result

```bash
✅ dist/index.js  840.6kb (+0.7kb from 839.9kb)
⏱️  79ms
```

**Size increase**: Minimal overhead for permission list

---

## Testing Checklist

When testing with the updated build:

- [ ] **No permission prompts**: Should see direct tool execution
- [ ] **Preset checks execute**: All 4 checks call MCP tools without blocking
- [ ] **Logs show tool calls**: Check for `mcp__recce__*` tool invocations
- [ ] **No errors**: No "requested permissions" messages in logs
- [ ] **Automated execution**: Works without manual intervention

---

## Related Files

### Modified
- `src/agent.ts` (+19 lines)
  - Added `allowedTools` list with all MCP tools
  - Changed from empty array to explicit permission list

---

## Migration Notes

### For Other Projects Using Claude Agent SDK

If you're using the multi-agent pattern with MCP tools:

1. **Always pre-grant permissions** in main agent's `allowedTools`
2. **List all tools explicitly** that any subagent might use
3. **Don't rely on subagent `tools` for permissions** - they're just filters
4. **Test in automated environments** to catch permission prompts early

### Example Pattern

```typescript
// Good ✅
const allowedTools = [
  'mcp__service1__method1',
  'mcp__service1__method2',
  'mcp__service2__method1',
];

query({
  options: {
    allowedTools, // Pre-grant all tools
    agents: {
      'agent1': {
        tools: ['mcp__service1'], // Filter to service1 only
      },
      'agent2': {
        tools: ['mcp__service2'], // Filter to service2 only
      },
    },
  },
});

// Bad ❌
query({
  options: {
    allowedTools: [], // Empty - will prompt for permissions!
    agents: {
      'agent1': { tools: ['mcp__service1'] },
    },
  },
});
```

---

## Summary

**Problem**: Permission prompts blocked MCP tool execution
**Root Cause**: Empty `allowedTools` list in main agent
**Solution**: Pre-grant permissions for all MCP tools
**Impact**:
- ✅ No more blocking prompts
- ✅ Fully automated execution
- ✅ CI/CD compatible
- ✅ Better user experience

**Status**: ✅ Fixed and ready for testing
**Build**: 840.6kb (success)
**Next Step**: Test with real PR to verify no permission prompts appear
