/**
 * @fileoverview Tests for terminal/isolation module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  WRITE_SCOPES,
  getWriteScope,
  validateWriteScopes,
  isPathAllowed,
  getReadScope,
  buildIsolationEnv,
} from '../../src/terminal/isolation.js';

describe('isolation', () => {
  describe('WRITE_SCOPES', () => {
    it('should define scopes for all 12 agents', () => {
      const agents = [
        'greenfield-wu', 'brownfield-wu', 'brief', 'detail',
        'architect', 'ux', 'phases', 'tasks', 'qa-planning',
        'dev', 'qa-implementation', 'devops',
      ];
      for (const agent of agents) {
        assert.ok(Array.isArray(WRITE_SCOPES[agent]), `Missing scope for ${agent}`);
        assert.ok(WRITE_SCOPES[agent].length > 0, `Empty scope for ${agent}`);
      }
    });
  });

  describe('getWriteScope', () => {
    it('should return write paths for a known agent', () => {
      const scope = getWriteScope('architect');
      assert.deepEqual(scope, ['chati.dev/artifacts/3-Architecture/']);
    });

    it('should return empty array for an unknown agent', () => {
      assert.deepEqual(getWriteScope('nonexistent'), []);
    });

    it('should return empty array for null or undefined', () => {
      assert.deepEqual(getWriteScope(null), []);
      assert.deepEqual(getWriteScope(undefined), []);
    });

    it('should return multiple paths for dev agent', () => {
      const scope = getWriteScope('dev');
      assert.deepEqual(scope, ['src/', 'test/', 'package.json']);
    });
  });

  describe('validateWriteScopes', () => {
    it('should pass when agents have disjoint write scopes', () => {
      const configs = [
        { agent: 'architect' },
        { agent: 'ux' },
        { agent: 'brief' },
      ];
      const result = validateWriteScopes(configs);
      assert.equal(result.valid, true);
      assert.equal(result.conflicts.length, 0);
    });

    it('should detect conflict between dev and qa-implementation on test/', () => {
      const configs = [
        { agent: 'dev' },
        { agent: 'qa-implementation' },
      ];
      const result = validateWriteScopes(configs);
      assert.equal(result.valid, false);
      assert.ok(result.conflicts.length > 0);
      const agents = result.conflicts[0].agents;
      assert.ok(agents.includes('dev'));
      assert.ok(agents.includes('qa-implementation'));
    });

    it('should detect conflict between greenfield-wu and brownfield-wu', () => {
      const configs = [
        { agent: 'greenfield-wu' },
        { agent: 'brownfield-wu' },
      ];
      const result = validateWriteScopes(configs);
      assert.equal(result.valid, false);
      assert.ok(result.conflicts.length > 0);
    });

    it('should handle single config (no conflicts possible)', () => {
      const result = validateWriteScopes([{ agent: 'architect' }]);
      assert.equal(result.valid, true);
      assert.equal(result.conflicts.length, 0);
    });

    it('should handle invalid input gracefully', () => {
      const result = validateWriteScopes(null);
      assert.equal(result.valid, false);
    });
  });

  describe('isPathAllowed', () => {
    it('should allow paths within write scope', () => {
      assert.equal(isPathAllowed('architect', 'chati.dev/artifacts/3-Architecture/design.yaml'), true);
    });

    it('should reject paths outside write scope', () => {
      assert.equal(isPathAllowed('architect', 'src/index.js'), false);
    });

    it('should allow exact match paths', () => {
      assert.equal(isPathAllowed('dev', 'package.json'), true);
    });

    it('should allow nested paths inside scope prefix', () => {
      assert.equal(isPathAllowed('dev', 'src/terminal/spawner.js'), true);
    });

    it('should return false for null/undefined agent or path', () => {
      assert.equal(isPathAllowed(null, 'src/foo.js'), false);
      assert.equal(isPathAllowed('dev', null), false);
      assert.equal(isPathAllowed(null, null), false);
    });

    it('should return false for unknown agent', () => {
      assert.equal(isPathAllowed('unknown-agent', 'src/foo.js'), false);
    });

    it('should normalise backslashes to forward slashes', () => {
      assert.equal(isPathAllowed('dev', 'src\\terminal\\spawner.js'), true);
    });
  });

  describe('getReadScope', () => {
    it('should always return wildcard for any agent', () => {
      assert.deepEqual(getReadScope('architect'), ['*']);
      assert.deepEqual(getReadScope('dev'), ['*']);
      assert.deepEqual(getReadScope('nonexistent'), ['*']);
    });
  });

  describe('buildIsolationEnv', () => {
    it('should return CHATI_WRITE_SCOPE and CHATI_READ_SCOPE', () => {
      const env = buildIsolationEnv('architect');
      assert.equal(env.CHATI_WRITE_SCOPE, 'chati.dev/artifacts/3-Architecture/');
      assert.equal(env.CHATI_READ_SCOPE, '*');
    });

    it('should comma-join multiple write scope paths', () => {
      const env = buildIsolationEnv('dev');
      assert.equal(env.CHATI_WRITE_SCOPE, 'src/,test/,package.json');
      assert.equal(env.CHATI_READ_SCOPE, '*');
    });

    it('should return empty write scope for unknown agent', () => {
      const env = buildIsolationEnv('unknown');
      assert.equal(env.CHATI_WRITE_SCOPE, '');
      assert.equal(env.CHATI_READ_SCOPE, '*');
    });
  });
});
