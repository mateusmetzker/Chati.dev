/**
 * Domain Loader — Parses YAML domain files for context injection.
 *
 * Domain files live in chati.dev/domains/ and contain rules/context
 * that PRISM injects into agent prompts based on the active layer.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import yaml from 'js-yaml';

/**
 * Load a single domain YAML file.
 * @param {string} filePath - Absolute path to YAML file
 * @returns {{ loaded: boolean, data: object|null, error: string|null }}
 */
export function loadDomainFile(filePath) {
  if (!existsSync(filePath)) {
    return { loaded: false, data: null, error: `File not found: ${filePath}` };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = yaml.load(raw) || {};
    return { loaded: true, data, error: null };
  } catch (err) {
    return { loaded: false, data: null, error: `Parse error in ${filePath}: ${err.message}` };
  }
}

/**
 * Load all agent domain files from chati.dev/domains/agents/.
 * @param {string} domainsDir - Path to chati.dev/domains/
 * @returns {Map<string, object>} Map of agentName → domain data
 */
export function loadAgentDomains(domainsDir) {
  const agentsDir = join(domainsDir, 'agents');
  const domains = new Map();

  if (!existsSync(agentsDir)) return domains;

  const files = readdirSync(agentsDir).filter(f => f.endsWith('.yaml'));
  for (const file of files) {
    const name = basename(file, '.yaml');
    const result = loadDomainFile(join(agentsDir, file));
    if (result.loaded) {
      domains.set(name, result.data);
    }
  }
  return domains;
}

/**
 * Load all workflow domain files from chati.dev/domains/workflows/.
 * @param {string} domainsDir - Path to chati.dev/domains/
 * @returns {Map<string, object>} Map of workflowName → domain data
 */
export function loadWorkflowDomains(domainsDir) {
  const workflowsDir = join(domainsDir, 'workflows');
  const domains = new Map();

  if (!existsSync(workflowsDir)) return domains;

  const files = readdirSync(workflowsDir).filter(f => f.endsWith('.yaml'));
  for (const file of files) {
    const name = basename(file, '.yaml');
    const result = loadDomainFile(join(workflowsDir, file));
    if (result.loaded) {
      domains.set(name, result.data);
    }
  }
  return domains;
}

/**
 * Load the constitution domain (extracted rules from constitution.md).
 * @param {string} domainsDir - Path to chati.dev/domains/
 * @returns {object|null}
 */
export function loadConstitutionDomain(domainsDir) {
  const result = loadDomainFile(join(domainsDir, 'constitution.yaml'));
  return result.loaded ? result.data : null;
}

/**
 * Load the global domain (coding standards, bracket rules).
 * @param {string} domainsDir - Path to chati.dev/domains/
 * @returns {object|null}
 */
export function loadGlobalDomain(domainsDir) {
  const result = loadDomainFile(join(domainsDir, 'global.yaml'));
  return result.loaded ? result.data : null;
}

/**
 * Extract rules array from a domain object.
 * Domain files have a `rules` key with an array of rule objects.
 * @param {object} domain - Parsed domain object
 * @returns {Array<{ id: string, text: string, priority: string }>}
 */
export function extractRules(domain) {
  if (!domain || !Array.isArray(domain.rules)) return [];
  return domain.rules.map(r => ({
    id: r.id || 'unknown',
    text: r.text || r.rule || '',
    priority: r.priority || 'normal',
  }));
}
