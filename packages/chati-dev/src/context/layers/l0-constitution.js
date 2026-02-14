/**
 * L0 Constitution Layer — ALWAYS active, non-negotiable.
 *
 * Loads constitution rules from domain file. These are the fundamental
 * governance rules that every agent must follow at all times.
 */

import { loadConstitutionDomain, extractRules } from '../domain-loader.js';

/**
 * Process L0: load constitution governance rules.
 * @param {object} ctx - Pipeline context
 * @param {string} ctx.domainsDir - Path to chati.dev/domains/
 * @returns {{ layer: string, rules: Array, summary: string }}
 */
export function processL0(ctx) {
  const domain = loadConstitutionDomain(ctx.domainsDir);
  const rules = extractRules(domain);

  const summary = domain?.summary || 'Constitution governance: self-validation, quality >= 95%, guided options, persistent state, two-layer handoff, language protocol, deviation protocol, mode governance.';

  return {
    layer: 'L0',
    rules,
    summary,
    articleCount: domain?.articleCount || rules.length,
  };
}
