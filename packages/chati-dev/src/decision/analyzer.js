/**
 * Impact Analyzer - Dependency analysis for chati.dev
 * Analyzes impact of changes via dependency graph traversal
 *
 * @module decision/analyzer
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

/**
 * Analyze impact of changing an entity.
 * Builds dependency graph from entity-registry and calculates affected entities.
 *
 * @param {string} projectDir
 * @param {string} entityPath - Path of entity being changed
 * @returns {{ impactLevel: 'low'|'medium'|'high'|'critical', affectedEntities: object[], dependencyChain: string[] }}
 */
export function analyzeImpact(projectDir, entityPath) {
  const graph = buildDependencyGraph(projectDir);
  const affectedPaths = getTransitiveDependents(graph, entityPath);

  // Determine impact level based on affected entity count
  let impactLevel;
  const affectedCount = affectedPaths.length;

  if (affectedCount === 0) {
    impactLevel = 'low';
  } else if (affectedCount <= 2) {
    impactLevel = 'low';
  } else if (affectedCount <= 5) {
    impactLevel = 'medium';
  } else if (affectedCount <= 10) {
    impactLevel = 'high';
  } else {
    impactLevel = 'critical';
  }

  // Load entity details
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  const registry = existsSync(registryPath)
    ? yaml.load(readFileSync(registryPath, 'utf8'))
    : { entities: {} };

  const allEntities = flattenEntities(registry);
  const entityMap = new Map(allEntities.map(e => [e.path, e]));

  const affectedEntities = affectedPaths.map(path => {
    const entity = entityMap.get(path);
    return {
      path,
      type: entity?.type || 'unknown',
      name: entity?.name || path.split('/').pop()
    };
  });

  return {
    impactLevel,
    affectedEntities,
    dependencyChain: affectedPaths
  };
}

/**
 * Build dependency graph from entity registry.
 * @param {string} projectDir
 * @returns {Map<string, string[]>} Map of entityPath -> [dependentPaths]
 */
export function buildDependencyGraph(projectDir) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  const graph = new Map();

  if (!existsSync(registryPath)) {
    return graph;
  }

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  const entities = flattenEntities(registry);

  // Initialize graph with all entities
  entities.forEach(entity => {
    if (entity.path) {
      graph.set(entity.path, []);
    }
  });

  // Build reverse dependency map (who depends on whom)
  entities.forEach(entity => {
    if (entity.dependencies && Array.isArray(entity.dependencies)) {
      entity.dependencies.forEach(depPath => {
        if (!graph.has(depPath)) {
          graph.set(depPath, []);
        }
        // Add entity.path as dependent of depPath
        const dependents = graph.get(depPath);
        if (!dependents.includes(entity.path)) {
          dependents.push(entity.path);
        }
      });
    }
  });

  return graph;
}

/**
 * Get all entities that depend on a given entity (transitive).
 * Uses BFS traversal.
 * @param {Map<string, string[]>} graph
 * @param {string} entityPath
 * @returns {string[]} All affected paths
 */
export function getTransitiveDependents(graph, entityPath) {
  const visited = new Set();
  const queue = [entityPath];
  const result = [];

  while (queue.length > 0) {
    const current = queue.shift();

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    // Get direct dependents
    const dependents = graph.get(current) || [];

    dependents.forEach(dependent => {
      if (!visited.has(dependent)) {
        queue.push(dependent);
        result.push(dependent);
      }
    });
  }

  return result;
}

/**
 * Flatten entity registry into array of entities.
 * @private
 * @param {object} registry
 * @returns {object[]}
 */
function flattenEntities(registry) {
  const entities = [];

  if (!registry.entities) {
    return entities;
  }

  Object.entries(registry.entities).forEach(([type, typeEntities]) => {
    if (Array.isArray(typeEntities)) {
      typeEntities.forEach(entity => {
        entities.push({
          ...entity,
          type
        });
      });
    }
  });

  return entities;
}
