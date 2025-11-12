/**
 * Base Provider abstract class
 */

import { Provider } from "../types/providers.js";

export abstract class BaseProvider implements Provider {
  abstract name: string;
  abstract type: "github" | "gitlab" | "bitbucket";

  abstract getCliCommand(): string;
  abstract buildCliArgs(prNumber: number): string[];
  abstract getMcpConfig(): Record<string, unknown>;
  abstract getSystemPromptExtension(): string;
  abstract getUserPromptExtension(): string;
}




