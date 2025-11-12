/**
 * GitLab Provider implementation
 */

import { BaseProvider } from "./base.js";

export class GitLabProvider extends BaseProvider {
  name = "GitLab";
  type = "gitlab" as const;

  getCliCommand(): string {
    return "glab";
  }

  buildCliArgs(prNumber: number): string[] {
    return ["mr", "view", prNumber.toString(), "--json"];
  }

  getMcpConfig(): Record<string, unknown> {
    // GitLab MCP server configuration (if available)
    return {
      // gitlab: {
      //   type: "stdio",
      //   command: "glab-mcp-server",
      //   args: [],
      // },
    };
  }

  getSystemPromptExtension(): string {
    return `GitLab-specific instructions: Use 'glab mr view' for MR data.`;
  }

  getUserPromptExtension(): string {
    return `Context: Working with GitLab MR.`;
  }
}




