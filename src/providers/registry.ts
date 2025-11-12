/**
 * Provider Registry - Manages available providers
 */

import { Provider } from "../types/providers.js";
import { GitHubProvider } from "./github.js";
import { GitLabProvider } from "./gitlab.js";
import { BitbucketProvider } from "./bitbucket.js";

const providers = new Map<string, Provider>();

// Register default providers
providers.set("github", new GitHubProvider());
providers.set("gitlab", new GitLabProvider());
providers.set("bitbucket", new BitbucketProvider());

/**
 * Get a provider by type
 */
export function getProvider(type: string): Provider {
  const provider = providers.get(type);
  if (!provider) {
    throw new Error(`Unknown provider: ${type}. Available providers: ${Array.from(providers.keys()).join(", ")}`);
  }
  return provider;
}

/**
 * Register a custom provider
 */
export function registerProvider(type: string, provider: Provider): void {
  providers.set(type, provider);
}

/**
 * List all available providers
 */
export function listProviders(): string[] {
  return Array.from(providers.keys());
}




