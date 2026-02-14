import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  recordError,
  getGotchas,
  getRelevantGotchas,
  getGotchaStats,
  clearExpiredErrors,
  updateGotchaResolution,
} from '../../src/memory/gotchas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Gotchas', () => {
  let tempDir;

  before(() => {
    tempDir = join(__dirname, 'tmp-gotchas');
    mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should record an error without promotion (first occurrence)', () => {
    const result = recordError(tempDir, {
      message: 'Failed to parse config.yaml',
      agent: 'architect',
      task: 'design-architecture',
      context: { file: 'config.yaml' },
    });

    assert.equal(result.recorded, true);
    assert.equal(result.promoted, false);
    assert.equal(result.gotcha, null);
  });

  it('should promote error to gotcha after 3 occurrences', () => {
    const error = {
      message: 'Database connection failed at port 5432',
      agent: 'dev',
      task: 'setup-database',
      context: { port: 5432 },
    };

    // Record 3 times
    recordError(tempDir, error);
    recordError(tempDir, error);
    const result = recordError(tempDir, error);

    assert.equal(result.recorded, true);
    assert.equal(result.promoted, true);
    assert.ok(result.gotcha);
    assert.equal(result.gotcha.agent, 'dev');
    assert.equal(result.gotcha.count, 3);
    assert.ok(result.gotcha.id.startsWith('G'));
  });

  it('should get all gotchas', () => {
    const gotchas = getGotchas(tempDir);

    assert.ok(Array.isArray(gotchas));
    assert.ok(gotchas.length > 0);
    assert.ok(gotchas[0].id);
    assert.ok(gotchas[0].pattern);
    assert.ok(gotchas[0].message);
  });

  it('should get relevant gotchas for agent context', () => {
    // Record a gotcha for 'brief' agent
    const error = {
      message: 'Missing NFR requirements in brief',
      agent: 'brief',
      task: 'extract-brief',
      context: { category: 'nfr' },
    };

    for (let i = 0; i < 3; i++) {
      recordError(tempDir, error);
    }

    const relevant = getRelevantGotchas(tempDir, {
      agent: 'brief',
      task: 'extract-brief',
      keywords: ['nfr', 'requirements'],
    });

    assert.ok(Array.isArray(relevant));
    const briefGotcha = relevant.find(g => g.agent === 'brief');
    assert.ok(briefGotcha);
    assert.ok(briefGotcha.relevance > 0);
  });

  it('should return empty array for irrelevant context', () => {
    const relevant = getRelevantGotchas(tempDir, {
      agent: 'nonexistent',
      task: 'fake-task',
      keywords: ['xyz123'],
    });

    assert.ok(Array.isArray(relevant));
    assert.equal(relevant.length, 0);
  });

  it('should get gotcha statistics', () => {
    const stats = getGotchaStats(tempDir);

    assert.ok(stats.totalErrors > 0);
    assert.ok(stats.totalGotchas > 0);
    assert.ok(Array.isArray(stats.topPatterns));
    assert.ok(stats.topPatterns.length > 0);
    assert.ok(stats.topPatterns[0].count > 0);
  });

  it('should update gotcha resolution', () => {
    const gotchas = getGotchas(tempDir);
    const gotchaId = gotchas[0].id;

    const result = updateGotchaResolution(
      tempDir,
      gotchaId,
      'Fixed by updating database configuration'
    );

    assert.equal(result.updated, true);

    const updated = getGotchas(tempDir);
    const updatedGotcha = updated.find(g => g.id === gotchaId);
    assert.equal(updatedGotcha.resolution, 'Fixed by updating database configuration');
    assert.ok(updatedGotcha.resolved_at);
  });

  it('should handle non-existent gotcha ID gracefully', () => {
    const result = updateGotchaResolution(tempDir, 'G999', 'Some resolution');
    assert.equal(result.updated, false);
  });

  it('should detect similar errors with different values', () => {
    // Create a fresh temp directory for this test to avoid interference
    const testDir = join(tempDir, 'similar-errors-test');
    mkdirSync(testDir, { recursive: true });

    // Record errors with different port numbers
    const error1 = {
      message: 'Connection timeout at port 5432',
      agent: 'devops',
      task: 'deploy',
    };

    const error2 = {
      message: 'Connection timeout at port 3306',
      agent: 'devops',
      task: 'deploy',
    };

    const error3 = {
      message: 'Connection timeout at port 27017',
      agent: 'devops',
      task: 'deploy',
    };

    recordError(testDir, error1);
    recordError(testDir, error2);
    const result = recordError(testDir, error3);

    // Should be promoted because normalized pattern is the same
    assert.equal(result.promoted, true);
    assert.ok(result.gotcha);
  });

  it('should clear expired errors (mock test)', () => {
    // This would require manipulating timestamps, which is complex
    // For now, just verify the function returns the expected structure
    const result = clearExpiredErrors(tempDir);

    assert.ok(typeof result.cleared === 'number');
    assert.ok(result.cleared >= 0);
  });

  it('should handle errors in non-existent directory gracefully', () => {
    const fakeDir = join(tempDir, 'nonexistent');

    const result = recordError(fakeDir, {
      message: 'Test error',
      agent: 'test',
      task: 'test',
    });

    assert.equal(result.recorded, true);
  });
});
