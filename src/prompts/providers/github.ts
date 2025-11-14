/**
 * GitHub-specific prompt extensions
 */

export const GITHUB_SYSTEM_EXTENSION = `
## GitHub-Specific Context

You are working with GitHub as the source control platform.
- Use \`mcp__github__*\` MCP tools for PR operations
- PR numbers are sequential integers
- Include GitHub-specific metadata (labels, reviewers, checks status)
- Reference GitHub Actions CI/CD status if available`;

export const GITHUB_DELEGATION_INSTRUCTION = `1. **Delegate to github-context subagent**:
   - Task: Fetch PR metadata and file changes
   - Tag response: [GITHUB-CONTEXT]`;

export const GITHUB_OUTPUT_HINT = `Include GitHub PR URL in the summary for easy navigation.`;
