/**
 * MCP Registry and Configuration
 * Defines available MCPs and their agent dependencies
 */

export const DEFAULT_MCPS = ['context7', 'browser'];

export const MCP_CONFIGS = {
  browser: {
    name: 'Browser (Playwright)',
    description: 'Web automation and testing',
    requiresEnv: [],
    claudeConfig: {
      command: 'npx',
      args: ['-y', '@playwright/mcp'],
    },
  },
  context7: {
    name: 'Context7',
    description: 'Library documentation search',
    requiresEnv: [],
    claudeConfig: {
      command: 'npx',
      args: ['-y', '@context7/mcp'],
    },
  },
};

/**
 * Agent-MCP dependency matrix
 */
export const AGENT_MCP_DEPS = {
  orchestrator:        { required: [],            optional: [] },
  'greenfield-wu':     { required: [],            optional: [] },
  'brownfield-wu':     { required: [],            optional: ['browser'] },
  brief:               { required: [],            optional: [] },
  detail:              { required: [],            optional: [] },
  architect:           { required: ['context7'],  optional: [] },
  ux:                  { required: [],            optional: ['browser'] },
  phases:              { required: [],            optional: [] },
  tasks:               { required: [],            optional: [] },
  'qa-planning':       { required: [],            optional: [] },
  dev:                 { required: ['context7'],  optional: ['browser'] },
  'qa-implementation': { required: [],            optional: ['browser'] },
  devops:              { required: [],            optional: [] },
};

/**
 * Generate MCP config for Claude Code (.claude/mcp.json)
 */
export function generateClaudeMCPConfig(selectedMCPs) {
  const mcpServers = {};
  for (const mcpKey of selectedMCPs) {
    const config = MCP_CONFIGS[mcpKey];
    if (config?.claudeConfig) {
      const entry = {
        command: config.claudeConfig.command,
        args: config.claudeConfig.args,
      };
      if (config.claudeConfig.env) {
        entry.env = config.claudeConfig.env;
      }
      mcpServers[mcpKey] = entry;
    }
  }
  return { mcpServers };
}
