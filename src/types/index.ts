/**
 * Core data types for PR analysis and summary generation
 */

export interface PRMetadata {
  owner: string;
  repo: string;
  number: number;
  title: string;
  description: string;
  author: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface FileChange {
  path: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  changesCount: number;
  patch?: string;
}

export interface PRDiff {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  changedFilesCount: number;
}

export interface DbtModel {
  name: string;
  path: string;
  type: string;
  description?: string;
  columns?: Record<string, string>;
  config?: Record<string, unknown>;
}

export interface LineageDiff {
  added: DbtModel[];
  removed: DbtModel[];
  modified: DbtModel[];
  dependencies: Record<string, string[]>;
}

export interface DataProfile {
  model: string;
  rowCount?: number;
  columnStats?: Record<
    string,
    {
      min?: unknown;
      max?: unknown;
      avg?: number;
      distinct?: number;
      nullCount?: number;
    }
  >;
  changes?: {
    rowCountDiff?: number;
    rowCountPercentChange?: number;
  };
}

export interface ValidationCheck {
  name: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  details?: unknown;
}

export interface PRAnalysisResult {
  pr: PRMetadata;
  diff: PRDiff;
  dbtChanges?: LineageDiff;
  dataProfiles?: DataProfile[];
  validationChecks?: ValidationCheck[];
  summary?: string;
}

export interface AgentContext {
  prNumber: number;
  owner: string;
  repo: string;
  githubToken: string;
  recceEnabled: boolean;

  // Recce preset checks configuration
  recceYamlPath?: string; // Path to recce.yml (optional)
  executePresetChecks?: boolean; // Whether to execute preset checks (default: true)
}

// Re-export types from providers
export type { ProviderType } from './providers.js';
