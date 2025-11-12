/**
 * Bitbucket-specific prompt extensions
 */

export const BITBUCKET_SYSTEM_EXTENSION = `
## Bitbucket-Specific Context

You are working with Bitbucket as the source control platform.
- Use Bitbucket MCP tools for PR operations
- PR IDs are unique within the repository
- Include Bitbucket-specific metadata (build status, tasks, comments)
- Reference Bitbucket Pipelines status if available`;

export const BITBUCKET_DELEGATION_INSTRUCTION = `1. **Delegate to bitbucket-context subagent**:
   - Task: Fetch PR metadata and file changes
   - Tag response: [BITBUCKET-CONTEXT]`;

export const BITBUCKET_OUTPUT_HINT = `Include Bitbucket PR URL in the summary for easy navigation.`;
