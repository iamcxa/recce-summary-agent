/**
 * Agent API Entry Point
 * Thin layer that orchestrates AgentCore with dependency injection
 */

import { AgentCore } from './core/agent_core.js';
import { createPromptBuilder } from './prompts/index.js';
import type { PromptBuilder } from './prompts/index.js';
import { LifecycleManager } from './core/lifecycle.js';
import { createAgentLogger } from './logging/agent_logger.js';
import { getProvider } from './providers/registry.js';
import { config } from './config.js';
import type { AgentContext, PRAnalysisResult } from './types/index.js';
import type { PromptContext } from './types/prompts.js';
import type { AgentOptions } from './core/agent_core.js';

/**
 * Create and execute a PR analysis agent
 */
export async function createAndAnalyzePR(
  owner: string,
  repo: string,
  prNumber: number,
  recceEnabled: boolean = true,
  githubToken: string = '',
): Promise<PRAnalysisResult> {
  // 1. Build context
  const context: AgentContext = {
    owner,
    repo,
    prNumber,
    githubToken: githubToken || config.github.token,
    recceEnabled,
  };

  // 2. Detect provider (from config or auto-detect)
  const providerType = config.provider || 'github';
  const provider = getProvider(providerType);

  // 3. Build prompt context
  const promptContext: PromptContext = {
    provider: providerType,
    features: {
      githubContext: config.features.githubContext ?? true,
      recceValidation: recceEnabled,
    },
    userIntent: 'analyze-pr',
    owner,
    repo,
    prNumber,
  };

  // 4. Create prompt builder
  const promptBuilder = createPromptBuilder(promptContext);

  // 5. Create lifecycle manager with default hooks
  const lifecycle = new LifecycleManager({
    onStart: async (ctx) => {
      console.log(
        `Starting analysis for PR ${ctx.prNumber} in ${ctx.owner}/${ctx.repo}`,
      );
    },
    onPromptAssembly: async (_system, _user) => {
      console.log('Prompts assembled');
    },
    onTurnStart: async (turn, _msg) => {
      console.log(`Turn ${turn} started`);
    },
    onToolCall: async (toolName, _args) => {
      console.log(`Tool called: ${toolName}`);
    },
    onTurnEnd: async (turn, _result) => {
      console.log(`Turn ${turn} ended`);
    },
    onComplete: async (_result, metrics) => {
      console.log(
        `Analysis completed: ${metrics.totalTurns} turns, ${
          metrics.totalTokens
        } tokens, $${metrics.totalCost.toFixed(4)}`,
      );
    },
  });

  // 6. Create logger
  const logger = await createAgentLogger(context);

  // 7. Create agent core
  const agent = new AgentCore(
    context,
    promptBuilder,
    lifecycle,
    logger,
    provider,
    { maxTurns: 20 },
  );

  // 8. Execute
  return agent.execute();
}

/**
 * Create agent with custom configuration
 */
export async function createAgentWithConfig(
  context: AgentContext,
  promptBuilder: PromptBuilder,
  lifecycle: LifecycleManager,
  logger: Awaited<ReturnType<typeof createAgentLogger>>,
  provider: ReturnType<typeof getProvider>,
  options: AgentOptions = {},
): Promise<PRAnalysisResult> {
  const agent = new AgentCore(
    context,
    promptBuilder,
    lifecycle,
    logger,
    provider,
    options,
  );

  return agent.execute();
}

// Export types for external use
export { AgentCore } from './core/agent_core.js';
export { PromptBuilder } from './prompts/index.js';
export { LifecycleManager } from './core/lifecycle.js';
export type { AgentOptions } from './core/agent_core.js';
export type { AgentContext, PRAnalysisResult } from './types/index.js';
export type { PromptContext } from './types/prompts.js';
export type { LifecycleHooks, AgentMetrics } from './types/hooks.js';
