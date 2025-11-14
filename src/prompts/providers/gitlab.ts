/**
 * GitLab-specific prompt extensions
 */

export const GITLAB_SYSTEM_EXTENSION = `
## GitLab-Specific Context

You are working with GitLab as the source control platform.
- Use GitLab MCP tools for MR (Merge Request) operations
- MR numbers are called "merge request IIDs"
- Include GitLab-specific metadata (approvals, discussions, pipeline status)
- Reference GitLab CI/CD pipeline status`;

export const GITLAB_DELEGATION_INSTRUCTION = `1. **Delegate to gitlab-context subagent**:
   - Task: Fetch MR metadata and file changes
   - Tag response: [GITLAB-CONTEXT]`;

export const GITLAB_OUTPUT_HINT = `Include GitLab MR URL in the summary for easy navigation.`;
