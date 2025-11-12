/**
 * PromptBuilder - Composes prompts from fragments based on context
 */

import { PromptContext } from '../types/prompts.js';
import { ReccePresetService } from '../recce/preset_service.js';

// Base fragments
import {
  BASE_ORCHESTRATOR_PROMPT,
  BASE_WORKFLOW_INSTRUCTIONS,
  BASE_OUTPUT_FORMAT,
} from './fragments/base.js';

import {
  GITHUB_CONTEXT_DESCRIPTION,
  GITHUB_CONTEXT_PROMPT,
} from './fragments/github_context.js';

import {
  RECCE_ANALYSIS_DESCRIPTION,
  RECCE_ANALYSIS_PROMPT,
} from './fragments/recce_analysis.js';

import {
  PRESET_CHECK_EXECUTOR_DESCRIPTION,
  PRESET_CHECK_EXECUTOR_PROMPT,
} from './fragments/preset_checks.js';

import { getOutputFormatInstruction } from './fragments/output_formats.js';

// Provider extensions
import {
  GITHUB_SYSTEM_EXTENSION,
  GITHUB_DELEGATION_INSTRUCTION,
  GITHUB_OUTPUT_HINT,
} from './providers/github.js';

import {
  GITLAB_SYSTEM_EXTENSION,
  GITLAB_DELEGATION_INSTRUCTION,
  GITLAB_OUTPUT_HINT,
} from './providers/gitlab.js';

import {
  BITBUCKET_SYSTEM_EXTENSION,
  BITBUCKET_DELEGATION_INSTRUCTION,
  BITBUCKET_OUTPUT_HINT,
} from './providers/bitbucket.js';

export interface SubagentConfig {
  description: string;
  model: 'haiku' | 'sonnet' | 'opus' | 'inherit';
  tools: string[];
  prompt: string;
}

export class PromptBuilder {
  /**
   * Build main system prompt for orchestrator agent
   */
  buildSystemPrompt(context: PromptContext): string {
    const parts: string[] = [];

    // 1. Base orchestrator prompt
    parts.push(BASE_ORCHESTRATOR_PROMPT);

    // 2. Provider-specific context
    parts.push(this.getProviderExtension(context.provider));

    // 3. Workflow instructions
    parts.push('\n## Workflow\n');
    parts.push(this.getProviderDelegationInstruction(context.provider, context));

    // 4. Recce analysis delegation (if enabled)
    if (context.features.recceValidation) {
      parts.push('\n2. **Delegate to recce-analysis subagent**:');
      parts.push('   - Task: Analyze dbt model changes using Recce tools');
      parts.push('   - Tag response: [RECCE-ANALYSIS]');
    } else {
      parts.push('\n2. **Skip Recce analysis** (disabled by user)');
    }

    // 5. Preset checks delegation (if available)
    if (context.presetChecks && context.presetChecks.checks.length > 0) {
      parts.push('\n3. **Delegate to preset-check-executor subagent**:');
      parts.push('   - Task: Execute preset checks from recce.yml by CALLING MCP TOOLS');
      parts.push('   - CRITICAL: The subagent MUST actually call mcp__recce__* tools for each check');
      parts.push('   - Expected: Structured JSON with tool results and evaluation for each check');
      parts.push('   - Tag response: [PRESET-CHECKS]');
      parts.push('');
      parts.push(ReccePresetService.formatForPrompt(context.presetChecks));
    }

    // 6. Synthesis instructions
    const stepNumber = context.presetChecks ? '4' : '3';
    const outputFormat = context.outputFormat || 'markdown';
    parts.push(`\n${stepNumber}. **Synthesize final summary**:`);
    parts.push(`   Output format: **${outputFormat.toUpperCase()}**`);
    if (outputFormat === 'pr-summary') {
      parts.push('   🚨 CRITICAL: Follow the PR Validation Summary template EXACTLY');
      parts.push('   Do NOT include delegation details, only the formatted validation report');
    } else {
      parts.push('   Combine insights into markdown with appropriate sections');
    }
    parts.push('');

    // 7. Output format instructions (dynamic based on outputFormat config)
    const hasPresetChecks = !!(context.presetChecks && context.presetChecks.checks.length > 0);
    parts.push(getOutputFormatInstruction(outputFormat, hasPresetChecks));

    // 8. Output format and rules
    parts.push('\n' + BASE_OUTPUT_FORMAT);
    parts.push('\n' + BASE_WORKFLOW_INSTRUCTIONS);

    // 9. Provider-specific output hints
    parts.push('\n' + this.getProviderOutputHint(context.provider));

    // 10. Additional rules for preset checks
    if (context.presetChecks) {
      parts.push('\n- Clearly show preset check validation results');
    }

    return parts.join('\n');
  }

  /**
   * Build user prompt
   */
  buildUserPrompt(context: PromptContext): string {
    const { owner, repo, prNumber } = context;
    return `Analyze PR #${prNumber} in ${owner}/${repo} and generate a comprehensive summary with data quality insights.`;
  }

  /**
   * Get subagent configuration for provider-context (github or gitlab)
   * Dynamically returns the appropriate context subagent based on provider
   */
  getProviderContextSubagent(provider: string = 'github'): SubagentConfig {
    if (provider === 'gitlab') {
      return {
        description: 'Fetches MR metadata and file changes using GitLab MCP tools',
        model: 'haiku',
        tools: ['mcp__gitlab'],
        prompt: `You are a GitLab data specialist. Your task is to fetch MR (Merge Request) information.

Use GitLab MCP tools to gather:
1. MR metadata (title, description, author, state, created/updated dates)
2. File changes (additions, deletions, modifications)
3. Commit history
4. Pipeline status and approvals

Return results in this JSON format:
\`\`\`json
{
  "mrMetadata": {
    "owner": "string",
    "repo": "string",
    "number": number,
    "title": "string",
    "description": "string",
    "author": "string",
    "state": "open" | "closed" | "merged",
    "createdAt": "ISO date",
    "updatedAt": "ISO date",
    "url": "string",
    "pipelineStatus": "string",
    "approvals": []
  },
  "fileChanges": {
    "files": [
      {
        "filename": "string",
        "status": "added" | "modified" | "removed",
        "additions": number,
        "deletions": number,
        "patch": "string"
      }
    ],
    "totalAdditions": number,
    "totalDeletions": number,
    "changedFilesCount": number
  }
}
\`\`\`

Focus on DATA, not analysis. Be concise and structured.`,
      };
    }

    // Default to GitHub
    return this.getGithubContextSubagent();
  }

  /**
   * Get subagent configuration for github-context
   */
  getGithubContextSubagent(): SubagentConfig {
    return {
      description: GITHUB_CONTEXT_DESCRIPTION,
      model: 'haiku',
      tools: [
        'mcp__github__pull_request_read',
        'mcp__github__get_pull_request',
        'mcp__github__get_pull_request_files',
        'mcp__github__get_pull_request_status',
        'mcp__github__get_pull_request_comments',
        'mcp__github__get_pull_request_reviews',
      ],
      prompt: GITHUB_CONTEXT_PROMPT,
    };
  }

  /**
   * Get subagent configuration for recce-analysis
   */
  getRecceAnalysisSubagent(): SubagentConfig {
    return {
      description: RECCE_ANALYSIS_DESCRIPTION,
      model: 'haiku',
      tools: [
        'mcp__recce__get_lineage_diff',
        'mcp__recce__lineage_diff',
        'mcp__recce__schema_diff',
        'mcp__recce__row_count_diff',
        'mcp__recce__profile_diff',
      ],
      prompt: RECCE_ANALYSIS_PROMPT,
    };
  }

  /**
   * Get subagent configuration for preset-check-executor
   */
  getPresetCheckExecutorSubagent(): SubagentConfig {
    return {
      description: PRESET_CHECK_EXECUTOR_DESCRIPTION,
      model: 'haiku',
      tools: [
        'mcp__recce__get_lineage_diff',
        'mcp__recce__lineage_diff',
        'mcp__recce__schema_diff',
        'mcp__recce__row_count_diff',
        'mcp__recce__query',
        'mcp__recce__query_diff',
        'mcp__recce__profile_diff',
      ],
      prompt: PRESET_CHECK_EXECUTOR_PROMPT,
    };
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  private getProviderExtension(provider: string): string {
    switch (provider) {
      case 'github':
        return GITHUB_SYSTEM_EXTENSION;
      case 'gitlab':
        return GITLAB_SYSTEM_EXTENSION;
      case 'bitbucket':
        return BITBUCKET_SYSTEM_EXTENSION;
      default:
        return GITHUB_SYSTEM_EXTENSION;
    }
  }

  private getProviderDelegationInstruction(
    provider: string,
    context: PromptContext
  ): string {
    const { owner, repo, prNumber } = context;
    const prRef = `${owner}/${repo} #${prNumber}`;

    switch (provider) {
      case 'github':
        return GITHUB_DELEGATION_INSTRUCTION.replace(
          'Fetch PR metadata and file changes',
          `Fetch PR metadata and file changes for ${prRef}`
        );
      case 'gitlab':
        return GITLAB_DELEGATION_INSTRUCTION.replace(
          'Fetch MR metadata and file changes',
          `Fetch MR metadata and file changes for ${prRef}`
        );
      case 'bitbucket':
        return BITBUCKET_DELEGATION_INSTRUCTION.replace(
          'Fetch PR metadata and file changes',
          `Fetch PR metadata and file changes for ${prRef}`
        );
      default:
        return GITHUB_DELEGATION_INSTRUCTION;
    }
  }

  private getProviderOutputHint(provider: string): string {
    switch (provider) {
      case 'github':
        return GITHUB_OUTPUT_HINT;
      case 'gitlab':
        return GITLAB_OUTPUT_HINT;
      case 'bitbucket':
        return BITBUCKET_OUTPUT_HINT;
      default:
        return GITHUB_OUTPUT_HINT;
    }
  }
}

// Export singleton instance
export const promptBuilder = new PromptBuilder();
