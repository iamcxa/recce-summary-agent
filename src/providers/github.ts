/**
 * GitHub Provider implementation
 */

import { BaseProvider } from "./base.js";

export class GitHubProvider extends BaseProvider {
  name = "GitHub";
  type = "github" as const;

  getCliCommand(): string {
    return "gh";
  }

  buildCliArgs(prNumber: number): string[] {
    return ["pr", "view", prNumber.toString(), "--json", "title,body,author"];
  }

  getMcpConfig(): Record<string, unknown> {
    // GitHub MCP server configuration (if available)
    // For now, return empty config as GitHub MCP server may not be available
    return {
      // github: {
      //   type: "stdio",
      //   command: "gh-mcp-server",
      //   args: [],
      // },
    };
  }

  getSystemPromptExtension(): string {
    return `GitHub-specific instructions: Use 'gh pr view' for PR data.`;
  }

  getUserPromptExtension(): string {
    return `Context: Working with GitHub PR.`;
  }
}




