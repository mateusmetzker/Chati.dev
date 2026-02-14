/**
 * @fileoverview Write scope isolation for multi-terminal execution.
 *
 * Each agent is confined to a set of paths it may write to.
 * Read access is unrestricted -- every agent can read the entire project.
 * This module defines scope mappings, validates that parallel configs
 * do not conflict, and builds the environment variables that enforce
 * isolation at runtime.
 */

/**
 * Default write scope mapping per agent.
 * Each key is an agent name; each value is an array of path prefixes
 * (relative to the project root) the agent is allowed to write.
 *
 * @type {Record<string, string[]>}
 */
export const WRITE_SCOPES = {
  'greenfield-wu': ['chati.dev/artifacts/0-WU/'],
  'brownfield-wu': ['chati.dev/artifacts/0-WU/'],
  'brief':         ['chati.dev/artifacts/1-Brief/'],
  'detail':        ['chati.dev/artifacts/2-PRD/'],
  'architect':     ['chati.dev/artifacts/3-Architecture/'],
  'ux':            ['chati.dev/artifacts/4-UX/'],
  'phases':        ['chati.dev/artifacts/5-Phases/'],
  'tasks':         ['chati.dev/artifacts/6-Tasks/'],
  'qa-planning':   ['chati.dev/artifacts/7-QA-Planning/'],
  'dev':           ['src/', 'test/', 'package.json'],
  'qa-implementation': ['test/', 'chati.dev/artifacts/8-QA-Impl/'],
  'devops':        ['.github/', 'Dockerfile', 'docker-compose.yml', 'chati.dev/artifacts/9-Deploy/'],
};

/**
 * Return the write scope for a given agent.
 *
 * @param {string} agent - Agent name (e.g. "architect")
 * @returns {string[]} Array of path prefixes the agent may write to.
 *   Returns an empty array for unknown agents.
 */
export function getWriteScope(agent) {
  if (!agent || typeof agent !== 'string') {
    return [];
  }
  return WRITE_SCOPES[agent] || [];
}

/**
 * Validate that a set of parallel spawn configs have no overlapping
 * write scopes.  Two configs conflict when any prefix from one
 * starts-with a prefix from the other (or they are identical).
 *
 * @param {Array<{agent: string}>} configs
 * @returns {{ valid: boolean, conflicts: Array<{agents: [string, string], path: string}> }}
 */
export function validateWriteScopes(configs) {
  if (!Array.isArray(configs)) {
    return { valid: false, conflicts: [{ agents: ['unknown', 'unknown'], path: 'invalid configs' }] };
  }

  const conflicts = [];

  for (let i = 0; i < configs.length; i++) {
    const scopeA = getWriteScope(configs[i].agent);
    for (let j = i + 1; j < configs.length; j++) {
      const scopeB = getWriteScope(configs[j].agent);
      for (const pathA of scopeA) {
        for (const pathB of scopeB) {
          if (pathA === pathB || pathA.startsWith(pathB) || pathB.startsWith(pathA)) {
            conflicts.push({
              agents: [configs[i].agent, configs[j].agent],
              path: pathA === pathB ? pathA : `${pathA} <-> ${pathB}`,
            });
          }
        }
      }
    }
  }

  return { valid: conflicts.length === 0, conflicts };
}

/**
 * Check whether a file path falls within an agent's write scope.
 *
 * @param {string} agent - Agent name
 * @param {string} filePath - Relative file path to check
 * @returns {boolean} True when the path is within the scope.
 */
export function isPathAllowed(agent, filePath) {
  if (!agent || !filePath) {
    return false;
  }

  const scope = getWriteScope(agent);
  if (scope.length === 0) {
    return false;
  }

  const normalised = filePath.replace(/\\/g, '/');
  return scope.some(prefix => normalised === prefix || normalised.startsWith(prefix));
}

/**
 * Return the read scope for an agent.
 * Read access is always unrestricted -- every agent can read everything.
 *
 * @param {string} _agent - Agent name (unused -- read is universal)
 * @returns {string[]} Single-element array containing '*' (everything).
 */
export function getReadScope(_agent) {
  return ['*'];
}

/**
 * Build the environment variables that communicate write/read scopes
 * to a spawned terminal process.
 *
 * @param {string} agent - Agent name
 * @returns {{ CHATI_WRITE_SCOPE: string, CHATI_READ_SCOPE: string }}
 */
export function buildIsolationEnv(agent) {
  const writeScope = getWriteScope(agent);
  const readScope = getReadScope(agent);

  return {
    CHATI_WRITE_SCOPE: writeScope.join(','),
    CHATI_READ_SCOPE: readScope.join(','),
  };
}
