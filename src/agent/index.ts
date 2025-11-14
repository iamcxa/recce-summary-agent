/**
 * Agent module public API
 * Clean Architecture: Exposes only what is needed by external consumers
 */

// Main entry points
export { analyzePR } from './pr-analyzer.js';

// Types
export type { AgentPromptOptions } from './types.js';

// Re-export from original types for backward compatibility
export type { PRAnalysisResult } from '../types/index.js';
