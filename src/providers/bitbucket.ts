/**
 * Bitbucket Provider implementation
 */

import { BaseProvider } from "./base.js";

export class BitbucketProvider extends BaseProvider {
  name = "Bitbucket";
  type = "bitbucket" as const;

  getCliCommand(): string {
    return "bb";
  }

  buildCliArgs(prNumber: number): string[] {
    return ["pr", "view", prNumber.toString()];
  }

  getMcpConfig(): Record<string, unknown> {
    // Bitbucket MCP server configuration (if available)
    return {
      // bitbucket: {
      //   type: "stdio",
      //   command: "bb-mcp-server",
      //   args: [],
      // },
    };
  }

  getSystemPromptExtension(): string {
    return `Bitbucket-specific instructions: Use 'bb pr view' for PR data.`;
  }

  getUserPromptExtension(): string {
    return `Context: Working with Bitbucket PR.`;
  }
}




