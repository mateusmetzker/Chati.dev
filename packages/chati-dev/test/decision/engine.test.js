/**
 * Tests for decision/engine.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import {
  analyzeRequest,
  calculateSimilarity,
  getDecisionHistory,
  recordDecision,
  getEngineStats
} from '../../src/decision/engine.js';

const TEST_DIR = join(import.meta.dirname, '../../tmp/test-engine');

function setupTestProject() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'chati.dev'), { recursive: true });

  // Create mock entity registry
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 3,
      last_updated: new Date().toISOString()
    },
    entities: {
      agent: [
        {
          name: 'dev',
          path: 'chati.dev/agents/dev.md',
          keywords: ['development', 'coding', 'implementation'],
          purpose: 'Development agent for building features'
        },
        {
          name: 'architect',
          path: 'chati.dev/agents/architect.md',
          keywords: ['architecture', 'design', 'structure'],
          purpose: 'System architecture and design'
        }
      ],
      task: [
        {
          name: 'setup-database',
          path: 'chati.dev/tasks/setup-database.md',
          keywords: ['database', 'setup', 'migration'],
          purpose: 'Initialize database schema'
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

test('calculateSimilarity - exact keyword match', () => {
  const request = {
    keywords: ['development', 'coding'],
    type: 'agent'
  };

  const entity = {
    keywords: ['development', 'coding', 'implementation'],
    type: 'agent'
  };

  const score = calculateSimilarity(request, entity);
  assert.ok(score > 60, `Expected score > 60, got ${score}`);
});

test('calculateSimilarity - type boost', () => {
  const request = {
    keywords: ['testing', 'quality'],
    type: 'agent'
  };

  const entityWithType = {
    keywords: ['testing'],
    type: 'agent',
    name: 'qa'
  };

  const entityWithoutType = {
    keywords: ['testing'],
    type: 'task',
    name: 'qa'
  };

  const scoreWithType = calculateSimilarity(request, entityWithType);
  const scoreWithoutType = calculateSimilarity(request, entityWithoutType);

  assert.ok(
    scoreWithType > scoreWithoutType,
    `Same type should boost score: ${scoreWithType} vs ${scoreWithoutType}`
  );
});

test('calculateSimilarity - no overlap', () => {
  const request = {
    keywords: ['frontend', 'react'],
    type: 'agent'
  };

  const entity = {
    keywords: ['backend', 'database'],
    type: 'task'
  };

  const score = calculateSimilarity(request, entity);
  assert.equal(score, 0, 'No overlap should give 0 score');
});

test('analyzeRequest - REUSE recommendation (>=90%)', () => {
  setupTestProject();

  const request = {
    description: 'I need a development agent',
    type: 'agent',
    keywords: ['development', 'coding', 'implementation'],
    agent: 'orchestrator'
  };

  const result = analyzeRequest(TEST_DIR, request);

  assert.equal(result.recommendation, 'REUSE');
  assert.ok(result.score >= 90, `Score should be >= 90, got ${result.score}`);
  assert.ok(result.matches.length > 0, 'Should have matches');
  assert.ok(result.reasoning.includes('High similarity'));

  cleanupTestProject();
});

test('analyzeRequest - ADAPT recommendation (60-89%)', () => {
  setupTestProject();

  const request = {
    description: 'I need an agent for architecture and design work',
    type: 'agent',
    keywords: ['architecture', 'design', 'planning'],
    agent: 'orchestrator'
  };

  const result = analyzeRequest(TEST_DIR, request);

  assert.equal(result.recommendation, 'ADAPT');
  assert.ok(
    result.score >= 60 && result.score < 90,
    `Score should be 60-89, got ${result.score}`
  );
  assert.ok(result.reasoning.includes('Moderate similarity'));

  cleanupTestProject();
});

test('analyzeRequest - CREATE recommendation (<60%)', () => {
  setupTestProject();

  const request = {
    description: 'I need something completely different',
    type: 'agent',
    keywords: ['frontend', 'react', 'component'],
    agent: 'orchestrator'
  };

  const result = analyzeRequest(TEST_DIR, request);

  assert.equal(result.recommendation, 'CREATE');
  assert.ok(result.score < 60, `Score should be < 60, got ${result.score}`);

  cleanupTestProject();
});

test('analyzeRequest - no registry', () => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });

  const request = {
    description: 'First request',
    type: 'agent',
    keywords: ['test'],
    agent: 'orchestrator'
  };

  const result = analyzeRequest(TEST_DIR, request);

  assert.equal(result.recommendation, 'CREATE');
  assert.equal(result.score, 0);
  assert.ok(result.reasoning.includes('No entity registry'));

  cleanupTestProject();
});

test('recordDecision and getDecisionHistory', () => {
  setupTestProject();

  const decision = {
    timestamp: new Date().toISOString(),
    request: {
      description: 'Test request',
      type: 'agent',
      keywords: ['test'],
      agent: 'orchestrator'
    },
    recommendation: 'CREATE',
    score: 45,
    reasoning: 'Test reasoning'
  };

  recordDecision(TEST_DIR, decision);

  const history = getDecisionHistory(TEST_DIR);
  assert.equal(history.length, 1);
  assert.equal(history[0].recommendation, 'CREATE');
  assert.equal(history[0].score, 45);

  cleanupTestProject();
});

test('getEngineStats', () => {
  setupTestProject();

  // Record multiple decisions
  recordDecision(TEST_DIR, {
    timestamp: new Date().toISOString(),
    recommendation: 'REUSE',
    score: 95
  });

  recordDecision(TEST_DIR, {
    timestamp: new Date().toISOString(),
    recommendation: 'ADAPT',
    score: 75
  });

  recordDecision(TEST_DIR, {
    timestamp: new Date().toISOString(),
    recommendation: 'CREATE',
    score: 40
  });

  const stats = getEngineStats(TEST_DIR);

  assert.equal(stats.totalDecisions, 3);
  assert.equal(stats.byRecommendation.REUSE, 1);
  assert.equal(stats.byRecommendation.ADAPT, 1);
  assert.equal(stats.byRecommendation.CREATE, 1);
  assert.equal(stats.avgScore, 70); // (95 + 75 + 40) / 3 = 70

  cleanupTestProject();
});

test('getEngineStats - empty history', () => {
  setupTestProject();

  const stats = getEngineStats(TEST_DIR);

  assert.equal(stats.totalDecisions, 0);
  assert.equal(stats.byRecommendation.REUSE, 0);
  assert.equal(stats.byRecommendation.ADAPT, 0);
  assert.equal(stats.byRecommendation.CREATE, 0);
  assert.equal(stats.avgScore, 0);

  cleanupTestProject();
});
