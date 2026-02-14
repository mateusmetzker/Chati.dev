import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Import the logic functions (not the main stdin handler)
import { getCurrentMode, isPathAllowed, MODE_SCOPES } from '../../../../chati.dev/hooks/mode-governance.js';

describe('mode-governance hook', () => {
  let projectDir;

  before(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mode-gov-'));
    mkdirSync(join(projectDir, '.chati'), { recursive: true });
    mkdirSync(join(projectDir, 'chati.dev'), { recursive: true });
  });

  after(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  describe('getCurrentMode', () => {
    it('returns clarity as default when no session', () => {
      const mode = getCurrentMode('/nonexistent');
      assert.equal(mode, 'clarity');
    });

    it('reads mode from session.yaml', () => {
      writeFileSync(join(projectDir, '.chati', 'session.yaml'), 'mode: build\n');
      assert.equal(getCurrentMode(projectDir), 'build');
    });

    it('reads deploy mode', () => {
      writeFileSync(join(projectDir, '.chati', 'session.yaml'), 'mode: deploy\n');
      assert.equal(getCurrentMode(projectDir), 'deploy');
    });
  });

  describe('isPathAllowed', () => {
    it('clarity allows writes to chati.dev/', () => {
      assert.equal(isPathAllowed('chati.dev/agents/test.md', projectDir, 'clarity'), true);
    });

    it('clarity allows writes to .chati/', () => {
      assert.equal(isPathAllowed('.chati/session.yaml', projectDir, 'clarity'), true);
    });

    it('clarity blocks writes to project code', () => {
      assert.equal(isPathAllowed('src/app.js', projectDir, 'clarity'), false);
    });

    it('clarity blocks writes to root files', () => {
      assert.equal(isPathAllowed('package.json', projectDir, 'clarity'), false);
    });

    it('build allows writes anywhere', () => {
      assert.equal(isPathAllowed('src/app.js', projectDir, 'build'), true);
      assert.equal(isPathAllowed('package.json', projectDir, 'build'), true);
    });

    it('deploy allows writes anywhere', () => {
      assert.equal(isPathAllowed('infra/deploy.yaml', projectDir, 'deploy'), true);
    });

    it('blocks paths that escape project', () => {
      const abs = join(projectDir, '..', 'other-project', 'file.js');
      assert.equal(isPathAllowed(abs, projectDir, 'build'), false);
    });

    it('returns false for unknown mode', () => {
      assert.equal(isPathAllowed('any.js', projectDir, 'unknown'), false);
    });
  });

  describe('MODE_SCOPES', () => {
    it('defines 3 modes', () => {
      assert.equal(Object.keys(MODE_SCOPES).length, 3);
      assert.ok(MODE_SCOPES.clarity);
      assert.ok(MODE_SCOPES.build);
      assert.ok(MODE_SCOPES.deploy);
    });

    it('clarity has restricted scope', () => {
      assert.ok(MODE_SCOPES.clarity.allowed.length > 0);
      assert.ok(!MODE_SCOPES.clarity.allowed.includes('*'));
    });

    it('build has wildcard scope', () => {
      assert.ok(MODE_SCOPES.build.allowed.includes('*'));
    });
  });
});
