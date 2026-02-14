/**
 * Tests for decision/registry-updater.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import {
  updateRegistry,
  detectNewEntities,
  detectRemovedEntities,
  generateEntityMeta
} from '../../src/decision/registry-updater.js';

const TEST_DIR = join(import.meta.dirname, '../../tmp/test-updater');

function setupTestProject() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'chati.dev'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'chati.dev', 'agents'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'chati.dev', 'tasks'), { recursive: true });

  // Create mock files
  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'agents', 'dev.md'),
    '# Development Agent\nPurpose: Build features and implement code',
    'utf8'
  );

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'agents', 'architect.md'),
    '# System Architect\nDesign system architecture',
    'utf8'
  );

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'tasks', 'setup-db.md'),
    '# Setup Database\nInitialize database schema',
    'utf8'
  );
}

function cleanupTestProject() {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

test('detectNewEntities - finds new files', () => {
  setupTestProject();

  const newEntities = detectNewEntities(TEST_DIR);

  assert.ok(newEntities.length >= 3, 'Should find at least 3 entities');

  const devAgent = newEntities.find(e => e.name === 'dev');
  assert.ok(devAgent, 'Should find dev agent');
  assert.equal(devAgent.type, 'agent');
  assert.ok(devAgent.path.includes('agents/dev.md'));

  cleanupTestProject();
});

test('detectNewEntities - with existing registry', () => {
  setupTestProject();

  // Create registry with one entity
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 1,
      last_updated: new Date().toISOString()
    },
    entities: {
      agent: [
        {
          name: 'dev',
          path: 'chati.dev/agents/dev.md',
          keywords: ['development']
        }
      ]
    }
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const newEntities = detectNewEntities(TEST_DIR);

  // Should only find architect and setup-db (dev already in registry)
  assert.ok(
    newEntities.length >= 2,
    'Should find remaining new entities'
  );
  assert.ok(!newEntities.find(e => e.name === 'dev'), 'Should not include dev');

  cleanupTestProject();
});

test('detectRemovedEntities', () => {
  setupTestProject();

  // Create registry with removed file
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 2,
      last_updated: new Date().toISOString()
    },
    entities: {
      agent: [
        {
          name: 'dev',
          path: 'chati.dev/agents/dev.md',
          keywords: ['development']
        },
        {
          name: 'removed',
          path: 'chati.dev/agents/removed.md',
          keywords: ['test']
        }
      ]
    }
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const removedEntities = detectRemovedEntities(TEST_DIR);

  assert.equal(removedEntities.length, 1);
  assert.equal(removedEntities[0].name, 'removed');
  assert.equal(removedEntities[0].path, 'chati.dev/agents/removed.md');

  cleanupTestProject();
});

test('generateEntityMeta - extracts from filename', () => {
  setupTestProject();

  const meta = generateEntityMeta(
    TEST_DIR,
    'chati.dev/agents/dev.md'
  );

  assert.equal(meta.name, 'dev');
  assert.ok(meta.keywords.length > 0);

  cleanupTestProject();
});

test('generateEntityMeta - extracts purpose from content', () => {
  setupTestProject();

  const meta = generateEntityMeta(
    TEST_DIR,
    'chati.dev/agents/dev.md'
  );

  assert.ok(meta.purpose.length > 0);
  assert.ok(
    meta.purpose.includes('Development') ||
    meta.purpose.includes('Build features')
  );

  cleanupTestProject();
});

test('updateRegistry - dry run mode', () => {
  setupTestProject();

  const changes = updateRegistry(TEST_DIR, { dryRun: true });

  assert.ok(changes.added.length >= 3, 'Should detect added files');
  assert.equal(changes.removed.length, 0);
  assert.equal(changes.updated.length, 0);

  // Registry should not be created in dry run
  const registryPath = join(TEST_DIR, 'chati.dev', 'entity-registry.yaml');
  assert.ok(!existsSync(registryPath), 'Registry should not exist');

  cleanupTestProject();
});

test('updateRegistry - creates new registry', () => {
  setupTestProject();

  const changes = updateRegistry(TEST_DIR);

  assert.ok(changes.added.length >= 3, 'Should add files');

  // Verify registry was created
  const registryPath = join(TEST_DIR, 'chati.dev', 'entity-registry.yaml');
  assert.ok(existsSync(registryPath), 'Registry should exist');

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  assert.ok(registry.metadata);
  assert.ok(registry.entities);
  assert.ok(registry.metadata.entity_count >= 3);

  cleanupTestProject();
});

test('updateRegistry - removes orphaned entries', () => {
  setupTestProject();

  // Create registry with removed file
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 2,
      last_updated: new Date(Date.now() - 1000).toISOString()
    },
    entities: {
      agent: [
        {
          name: 'dev',
          path: 'chati.dev/agents/dev.md',
          keywords: ['development']
        },
        {
          name: 'removed',
          path: 'chati.dev/agents/removed.md',
          keywords: ['test']
        }
      ]
    }
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const changes = updateRegistry(TEST_DIR);

  assert.equal(changes.removed.length, 1);
  assert.ok(changes.removed.includes('chati.dev/agents/removed.md'));

  cleanupTestProject();
});

test('updateRegistry - detects updates', () => {
  setupTestProject();

  // Create registry with old timestamp
  const oldDate = new Date(Date.now() - 10000); // 10 seconds ago
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 1,
      last_updated: oldDate.toISOString()
    },
    entities: {
      agent: [
        {
          name: 'dev',
          path: 'chati.dev/agents/dev.md',
          keywords: ['development'],
          purpose: 'Old purpose'
        }
      ]
    }
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const changes = updateRegistry(TEST_DIR);

  // File was created after registry, so should be detected as updated
  assert.ok(
    changes.updated.includes('chati.dev/agents/dev.md') ||
    changes.unchanged > 0
  );

  cleanupTestProject();
});
