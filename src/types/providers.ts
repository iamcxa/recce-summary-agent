/**
 * Provider type definitions for different Git hosting platforms
 */

export type ProviderType = 'github' | 'gitlab' | 'bitbucket';

export interface Provider {
  name: string;
  type: ProviderType;

  // CLI 策略
  getCliCommand(): string;
  buildCliArgs(prNumber: number): string[];

  // MCP 策略
  getMcpConfig(): Record<string, unknown>;

  // Prompt 擴展
  getSystemPromptExtension(): string;
  getUserPromptExtension(): string;
}
