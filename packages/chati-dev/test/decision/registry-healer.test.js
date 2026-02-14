/**
 * Tests for decision/registry-healer.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import {
  healRegistry,
  detectMissingEntities,
  detectOrphanedEntries,
  detectStaleMetadata,
  detectDuplicates,
  detectInvalidPaths,
  detectCountMismatch,
  applyFixes
} from '../../src/decision/registry-healer.js';

const TEST_DIR = join(import.meta.dirname, '../../tmp/test-healer');

function setupTestProject() {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(join(TEST_DIR, 'chati.dev'), { recursive: true });
  mkdirSync(join(TEST_DIR, 'chati.dev', 'agents'), { recursive: true });
}

function cleanupTestProject() {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

test('detectMissingEntities', () => {
  setupTestProject();

  // Create file but no registry
  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'agents', 'dev.md'),
    '# Dev Agent',
    'utf8'
  );

  const issues = detectMissingEntities(TEST_DIR);

  assert.ok(issues.length > 0, 'Should detect missing entity');
  assert.equal(issues[0].rule, 'missing_entity');
  assert.equal(issues[0].severity, 'warning');

  cleanupTestProject();
});

test('detectOrphanedEntries', () => {
  setupTestProject();

  // Create registry with file that doesn't exist
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 1,
      last_updated: new Date().toISOString()
    },
    entities: {
      agent: [
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

  const issues = detectOrphanedEntries(TEST_DIR);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, 'orphaned_entry');
  assert.equal(issues[0].severity, 'error');
  assert.equal(issues[0].path, 'chati.dev/agents/removed.md');

  cleanupTestProject();
});

test('detectStaleMetadata', () => {
  setupTestProject();

  // Create file
  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'agents', 'dev.md'),
    '# Dev Agent',
    'utf8'
  );

  // Create registry with old timestamp
  const oldDate = new Date(Date.now() - 10000);
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
          keywords: ['old'],
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

  const issues = detectStaleMetadata(TEST_DIR);

  assert.ok(issues.length > 0, 'Should detect stale metadata');
  assert.equal(issues[0].rule, 'stale_metadata');
  assert.equal(issues[0].severity, 'info');

  cleanupTestProject();
});

test('detectDuplicates', () => {
  setupTestProject();

  // Create registry with duplicate entries
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
          name: 'dev-duplicate',
          path: 'chati.dev/agents/dev.md', // Same path
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

  const issues = detectDuplicates(TEST_DIR);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, 'duplicate_entry');
  assert.equal(issues[0].severity, 'error');
  assert.equal(issues[0].count, 2);

  cleanupTestProject();
});

test('detectInvalidPaths - absolute path', () => {
  setupTestProject();

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
          path: '/absolute/path/dev.md',
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

  const issues = detectInvalidPaths(TEST_DIR);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, 'invalid_path');
  assert.equal(issues[0].severity, 'error');
  assert.equal(issues[0].reason, 'Absolute path');

  cleanupTestProject();
});

test('detectInvalidPaths - parent directory reference', () => {
  setupTestProject();

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
          path: '../outside/dev.md',
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

  const issues = detectInvalidPaths(TEST_DIR);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].reason, 'Contains parent directory reference');

  cleanupTestProject();
});

test('detectInvalidPaths - missing path', () => {
  setupTestProject();

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
          keywords: ['development']
          // Missing path field
        }
      ]
    }
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const issues = detectInvalidPaths(TEST_DIR);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].reason, 'Missing path field');

  cleanupTestProject();
});

test('detectCountMismatch', () => {
  setupTestProject();

  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 5, // Wrong count
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

  const issues = detectCountMismatch(TEST_DIR);

  assert.equal(issues.length, 1);
  assert.equal(issues[0].rule, 'count_mismatch');
  assert.equal(issues[0].severity, 'warning');
  assert.equal(issues[0].recorded, 5);
  assert.equal(issues[0].actual, 1);

  cleanupTestProject();
});

test('applyFixes - creates backup', () => {
  setupTestProject();

  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 0,
      last_updated: new Date().toISOString()
    },
    entities: {}
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const fixes = [
    {
      action: 'fix_count',
      expected: 0
    }
  ];

  const result = applyFixes(TEST_DIR, fixes);

  assert.equal(result.applied, 1);
  assert.ok(result.backup);
  assert.ok(existsSync(result.backup), 'Backup should exist');

  cleanupTestProject();
});

test('healRegistry - no issues', () => {
  setupTestProject();

  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 0,
      last_updated: new Date().toISOString()
    },
    entities: {}
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const result = healRegistry(TEST_DIR);

  assert.equal(result.healthy, true);
  assert.equal(result.issues.length, 0);

  cleanupTestProject();
});

test('healRegistry - with autoFix', () => {
  setupTestProject();

  // Create file
  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'agents', 'dev.md'),
    '# Dev Agent',
    'utf8'
  );

  // Create registry with issues
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 5, // Wrong count
      last_updated: new Date().toISOString()
    },
    entities: {}
  };

  writeFileSync(
    join(TEST_DIR, 'chati.dev', 'entity-registry.yaml'),
    yaml.dump(registry),
    'utf8'
  );

  const result = healRegistry(TEST_DIR, { autoFix: true });

  assert.equal(result.healthy, false);
  assert.ok(result.issues.length > 0);
  assert.ok(result.fixes.length > 0);
  assert.ok(result.applied > 0);
  assert.ok(result.backup);

  cleanupTestProject();
});

test('healRegistry - multiple issues', () => {
  setupTestProject();

  // Create registry with multiple problems
  const registry = {
    metadata: {
      version: '1.0',
      entity_count: 10, // Wrong
      last_updated: new Date().toISOString()
    },
    entities: {
      agent: [
        {
          name: 'removed',
          path: 'chati.dev/agents/removed.md', // Doesn't exist
          keywords: ['test']
        },
        {
          name: 'invalid',
          path: '/absolute/path.md', // Invalid
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

  const result = healRegistry(TEST_DIR);

  assert.equal(result.healthy, false);
  assert.ok(result.issues.length >= 3, 'Should detect multiple issues');

  cleanupTestProject();
});
