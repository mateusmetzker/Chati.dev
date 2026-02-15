/**
 * L1 Global Layer — ALWAYS active.
 *
 * Loads global rules: coding standards, bracket-specific behavioral rules,
 * mode governance constraints (planning/build/deploy).
 */

import { loadGlobalDomain, extractRules } from '../domain-loader.js';

/**
 * Process L1: load global rules + mode governance.
 * @param {object} ctx - Pipeline context
 * @param {string} ctx.domainsDir - Path to chati.dev/domains/
 * @param {string} ctx.mode - Current mode (planning, build, deploy)
 * @param {string} ctx.bracket - Current bracket (FRESH, MODERATE, etc.)
 * @returns {{ layer: string, rules: Array, mode: string, modeRules: object }}
 */
export function processL1(ctx) {
  const domain = loadGlobalDomain(ctx.domainsDir);
  const rules = extractRules(domain);
  const mode = ctx.mode || 'planning';

  const modeRules = domain?.modes?.[mode] || {};
  const bracketRules = domain?.brackets?.[ctx.bracket] || {};

  return {
    layer: 'L1',
    rules,
    mode,
    modeRules: {
      writeScope: modeRules.writeScope || 'chati.dev/',
      allowedActions: modeRules.allowedActions || [],
      blockedActions: modeRules.blockedActions || [],
    },
    bracketBehavior: bracketRules.behavior || 'normal',
  };
}
