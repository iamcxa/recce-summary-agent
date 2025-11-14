# Slash Commands Examples

This directory contains example slash commands that demonstrate how to extend Recce Agent with custom analysis capabilities.

## What are Slash Commands?

Slash commands are custom instructions that can be loaded into the agent's system prompt to provide specialized analysis behaviors. They allow you to customize how the agent analyzes PRs without modifying code.

## Usage

Pass the `--prompt-commands-path` option to load slash commands:

```bash
./dist/recce-agent https://github.com/org/repo/pull/123 \
  --prompt-commands-path ./examples/slash-commands
```

## Supported Formats

### JSON Format

Simple JSON structure for command definitions:

```json
{
  "name": "command-name",
  "description": "Short description",
  "instructions": "Detailed instructions for the AI...",
  "examples": [
    "/command-name",
    "Use /command-name with custom prompt"
  ]
}
```

### Markdown Format

Markdown files with YAML frontmatter:

```markdown
---
name: command-name
description: Short description
parameters: [{"name": "param1", "description": "...", "required": false, "type": "string"}]
examples: ["/command-name", "/command-name param1=value"]
---

Detailed instructions in markdown format...
```

## Example Commands

### focus-breaking-changes.json
Focuses analysis on breaking changes and migration impact. Useful for PRs that modify public APIs.

### security-audit.md
Performs security-focused code review with comprehensive checklist. Includes parameter support for severity filtering.

### tldr.md
Generates a concise 2-3 sentence summary of the PR changes.

## Testing Your Commands

View the generated system prompt with your commands:

```bash
./dist/recce-agent https://github.com/org/repo/pull/123 \
  --prompt-commands-path ./path/to/commands \
  --show-system-prompt
```

## Best Practices

1. **Clear Instructions**: Write specific, actionable instructions for the AI
2. **Examples**: Provide usage examples to clarify command syntax
3. **Focused Scope**: Each command should have a single, clear purpose
4. **Descriptive Names**: Use kebab-case names that describe the command's function
5. **Documentation**: Include detailed context and expected behavior

## Command Naming

- Use lowercase with hyphens (kebab-case): `focus-security`, `check-performance`
- Avoid special characters except hyphens and underscores
- Keep names concise but descriptive
