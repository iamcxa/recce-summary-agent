/**
 * Agent message handler module
 * Processes system messages from Claude Agent SDK
 */

import type { AgentLogger } from '../logging/agent_logger.js';
import { logDebug, logError } from '../logging/agent_logger.js';
import { config } from '../config.js';

/**
 * Handle system messages from Agent SDK
 * Logs MCP server connection status and available tools
 */
export function handleSystemMessage(message: any, logger: AgentLogger): void {
  const tools = message.tools || [];

  // Debug: Log first few tool names to understand structure
  if (config.debug && tools.length > 0) {
    logger.logger.debug({
      event: 'tools_debug',
      sample_tools: tools.slice(0, 5),
      total_tools: tools.length,
    });
  }

  // Group tools by server
  // Note: tools are strings, not objects
  const byServer: Record<string, number> = {};
  tools.forEach((toolName: string) => {
    const match = toolName.match(/^mcp__([^_]+)__/);
    if (match) {
      const server = match[1];
      byServer[server] = (byServer[server] || 0) + 1;
    }
  });

  logger.logToolsAvailable(tools.length, byServer);

  // Log MCP server connection status
  if (message.mcp_servers) {
    message.mcp_servers.forEach((srv: any) => {
      if (srv.status === 'connected') {
        const toolCount = byServer[srv.name] || 0;
        logger.logMCPConnectSuccess(srv.name, toolCount, 0);
      } else {
        // Enhanced error logging
        logger.logMCPConnectFailed(
          srv.name,
          srv.error || srv.status || 'Connection failed',
          JSON.stringify(srv, null, 2),
        );

        logError(`❌ MCP Server '${srv.name}' failed to connect:`);
        logError(`   Status: ${srv.status}`);
        if (srv.error) {
          logError(`   Error: ${srv.error}`);
        }
        if (srv.message) {
          logError(`   Message: ${srv.message}`);
        }
        if (srv.stderr) {
          logError(`   Stderr: ${srv.stderr}`);
        }
        if (srv.stdout) {
          logError(`   Stdout: ${srv.stdout}`);
        }

        logDebug(`   Full server object: ${JSON.stringify(srv, null, 2)}`);
      }
    });

    // Console status summary
    const serverStatus = message.mcp_servers
      .map((srv: any) => {
        if (srv.status === 'connected') {
          return `   • ${srv.name}: ✅ ${srv.status}`;
        }
        return `   • ${srv.name}: ❌ ${srv.status}`;
      })
      .join('\n');
    logger.logger.info(`🔌 MCP Servers:\n${serverStatus}`);
  }
}
