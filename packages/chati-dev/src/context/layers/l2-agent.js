/**
 * L2 Agent Layer — Active when an agent is assigned.
 *
 * Loads agent-specific domain rules: authority boundaries,
 * behavioral rules, and task registry.
 */

import { loadAgentDomains, extractRules } from '../domain-loader.js';

/**
 * Process L2: load agent domain rules.
 * @param {object} ctx - Pipeline context
 * @param {string} ctx.domainsDir - Path to chati.dev/domains/
 * @param {string} ctx.agent - Active agent name (e.g. 'brief', 'dev', 'orchestrator')
 * @returns {{ layer: string, agent: string, rules: Array, authority: object }}
 */
export function processL2(ctx) {
  if (!ctx.agent) {
    return { layer: 'L2', agent: null, rules: [], authority: {} };
  }

  const allDomains = loadAgentDomains(ctx.domainsDir);
  const domain = allDomains.get(ctx.agent) || null;
  const rules = extractRules(domain);

  return {
    layer: 'L2',
    agent: ctx.agent,
    rules,
    authority: {
      exclusive: domain?.authority?.exclusive || [],
      allowed: domain?.authority?.allowed || [],
      blocked: domain?.authority?.blocked || [],
      redirectMessage: domain?.authority?.redirectMessage || null,
    },
    mission: domain?.mission || '',
    outputs: domain?.outputs || [],
  };
}
