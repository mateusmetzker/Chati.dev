/**
 * Tests for decision/analyzer.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import {
  analyzeImpact,
  buildDependencyGraph,
  getTransitiveDependents
} from '../../src/decision/analyzer.js';

const TEST_DIR = join(import.meta.dirname, '../../tmp/test-analyzer');

function setupTestProject() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'chati.dev'), { recursive: true });

  // Create mock entity registry with dependencies
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 5,
      last_updated: new Date().toISOString()
    },
    entities: {
      schema: [
        {
          name: 'base-schema',
          path: 'chati.dev/schemas/base-schema.md',
          keywords: ['schema', 'base'],
          dependencies: []
        }
      ],
      domain: [
        {
          name: 'user-domain',
          path: 'chati.dev/domains/user-domain.md',
          keywords: ['user', 'domain'],
          dependencies: ['chati.dev/schemas/base-schema.md']
        },
        {
          name: 'project-domain',
          path: 'chati.dev/domains/project-domain.md',
          keywords: ['project', 'domain'],
          dependencies: ['chati.dev/schemas/base-schema.md']
        }
      ],
      agent: [
        {
          name: 'dev',
          path: 'chati.dev/agents/dev.md',
          keywords: ['development'],
          dependencies: [
            'chati.dev/domains/user-domain.md',
            'chati.dev/domains/project-domain.md'
          ]
        },
        {
          name: 'qa',
          path: 'chati.dev/agents/qa.md',
          keywords: ['quality'],
          dependencies: ['chati.dev/agents/dev.md']
        }
      ]
    }
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );
}

function cleanupTestProject() {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

test('buildDependencyGraph', () => {
  setupTestProject();

  const graph = buildDependencyGraph(TEST_DIR);

  // Base schema is depended on by user-domain and project-domain
  assert.ok(graph.has('chati.dev/schemas/base-schema.md'));
  const baseDeps = graph.get('chati.dev/schemas/base-schema.md');
  assert.equal(baseDeps.length, 2);
  assert.ok(baseDeps.includes('chati.dev/domains/user-domain.md'));
  assert.ok(baseDeps.includes('chati.dev/domains/project-domain.md'));

  // User domain is depended on by dev agent
  const userDomainDeps = graph.get('chati.dev/domains/user-domain.md');
  assert.ok(userDomainDeps.includes('chati.dev/agents/dev.md'));

  cleanupTestProject();
});

test('getTransitiveDependents - single level', () => {
  const graph = new Map([
    ['A', ['B', 'C']],
    ['B', []],
    ['C', []]
  ]);

  const dependents = getTransitiveDependents(graph, 'A');

  assert.equal(dependents.length, 2);
  assert.ok(dependents.includes('B'));
  assert.ok(dependents.includes('C'));
});

test('getTransitiveDependents - multiple levels', () => {
  const graph = new Map([
    ['A', ['B']],
    ['B', ['C']],
    ['C', ['D']],
    ['D', []]
  ]);

  const dependents = getTransitiveDependents(graph, 'A');

  assert.equal(dependents.length, 3);
  assert.ok(dependents.includes('B'));
  assert.ok(dependents.includes('C'));
  assert.ok(dependents.includes('D'));
});

test('getTransitiveDependents - no dependents', () => {
  const graph = new Map([
    ['A', []],
    ['B', []]
  ]);

  const dependents = getTransitiveDependents(graph, 'A');

  assert.equal(dependents.length, 0);
});

test('analyzeImpact - low impact (0-2 affected)', () => {
  setupTestProject();

  const result = analyzeImpact(
    TEST_DIR,
    'chati.dev/domains/user-domain.md'
  );

  assert.equal(result.impactLevel, 'low');
  assert.ok(result.affectedEntities.length <= 2);
  assert.ok(result.dependencyChain.includes('chati.dev/agents/dev.md'));

  cleanupTestProject();
});

test('analyzeImpact - medium impact (3-5 affected)', () => {
  setupTestProject();

  const result = analyzeImpact(
    TEST_DIR,
    'chati.dev/schemas/base-schema.md'
  );

  // Base schema affects: user-domain, project-domain, dev, qa
  assert.ok(['medium', 'high'].includes(result.impactLevel));
  assert.ok(result.affectedEntities.length >= 3);

  cleanupTestProject();
});

test('analyzeImpact - no dependencies', () => {
  setupTestProject();

  const result = analyzeImpact(
    TEST_DIR,
    'chati.dev/agents/qa.md'
  );

  assert.equal(result.impactLevel, 'low');
  assert.equal(result.affectedEntities.length, 0);

  cleanupTestProject();
});

test('analyzeImpact - no registry', () => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });

  const result = analyzeImpact(TEST_DIR, 'some/path.md');

  assert.equal(result.impactLevel, 'low');
  assert.equal(result.affectedEntities.length, 0);

  cleanupTestProject();
});

test('analyzeImpact - returns entity details', () => {
  setupTestProject();

  const result = analyzeImpact(
    TEST_DIR,
    'chati.dev/domains/user-domain.md'
  );

  assert.ok(result.affectedEntities.length > 0);
  result.affectedEntities.forEach(entity => {
    assert.ok(entity.path);
    assert.ok(entity.type);
    assert.ok(entity.name);
  });

  cleanupTestProject();
});
