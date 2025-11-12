/**
 * Provider Factory - Creates provider instances based on type
 */

import { ProviderType } from '../types/providers.js';
import { BaseProvider } from './base.js';
import { GitHubProvider } from './github.js';
import { GitLabProvider } from './gitlab.js';
import { BitbucketProvider } from './bitbucket.js';

export class ProviderFactory {
  /**
   * Create a provider instance based on type
   */
  static create(type: ProviderType): BaseProvider {
    switch (type) {
      case 'github':
        return new GitHubProvider();
      case 'gitlab':
        return new GitLabProvider();
      case 'bitbucket':
        return new BitbucketProvider();
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }

  /**
   * Get list of supported providers
   */
  static getSupportedProviders(): ProviderType[] {
    return ['github', 'gitlab', 'bitbucket'];
  }

  /**
   * Check if a provider type is supported
   */
  static isSupported(type: string): type is ProviderType {
    return ['github', 'gitlab', 'bitbucket'].includes(type);
  }
}

// Export provider classes
export { BaseProvider } from './base.js';
export { GitHubProvider } from './github.js';
export { GitLabProvider } from './gitlab.js';
export { BitbucketProvider } from './bitbucket.js';
