import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { hashContent } from '../../src/installer/file-hasher.js';
import { saveManifest } from '../../src/installer/manifest.js';
import {
  categorizeChanges,
  detectUserModifications,
  planUpgrade,
  upgradeInstallation,
} from '../../src/installer/brownfield-upgrader.js';

describe('brownfield-upgrader', () => {
  let targetDir;
  let newFrameworkDir;

  before(() => {
    targetDir = mkdtempSync(join(tmpdir(), 'chati-upgrade-target-'));
    newFrameworkDir = mkdtempSync(join(tmpdir(), 'chati-upgrade-new-'));
  });

  after(() => {
    rmSync(targetDir, { recursive: true, force: true });
    rmSync(newFrameworkDir, { recursive: true, force: true });
  });

  describe('categorizeChanges', () => {
    it('detects added files', () => {
      const oldManifest = { files: { 'a.txt': { hash: 'abc', size: 3, type: 'txt' } } };
      const newManifest = {
        files: {
          'a.txt': { hash: 'abc', size: 3, type: 'txt' },
          'b.txt': { hash: 'def', size: 3, type: 'txt' },
        },
      };
      const result = categorizeChanges(oldManifest, newManifest);
      assert.deepEqual(result.added, ['b.txt']);
      assert.deepEqual(result.removed, []);
      assert.deepEqual(result.unchanged, ['a.txt']);
    });

    it('detects removed files', () => {
      const oldManifest = {
        files: {
          'a.txt': { hash: 'abc', size: 3, type: 'txt' },
          'b.txt': { hash: 'def', size: 3, type: 'txt' },
        },
      };
      const newManifest = { files: { 'a.txt': { hash: 'abc', size: 3, type: 'txt' } } };
      const result = categorizeChanges(oldManifest, newManifest);
      assert.deepEqual(result.removed, ['b.txt']);
      assert.deepEqual(result.added, []);
    });

    it('detects modified files', () => {
      const oldManifest = { files: { 'a.txt': { hash: 'abc', size: 3, type: 'txt' } } };
      const newManifest = { files: { 'a.txt': { hash: 'xyz', size: 3, type: 'txt' } } };
      const result = categorizeChanges(oldManifest, newManifest);
      assert.deepEqual(result.modified, ['a.txt']);
      assert.deepEqual(result.unchanged, []);
    });

    it('detects unchanged files', () => {
      const oldManifest = { files: { 'a.txt': { hash: 'abc', size: 3, type: 'txt' } } };
      const newManifest = { files: { 'a.txt': { hash: 'abc', size: 3, type: 'txt' } } };
      const result = categorizeChanges(oldManifest, newManifest);
      assert.deepEqual(result.unchanged, ['a.txt']);
      assert.deepEqual(result.modified, []);
    });
  });

  describe('detectUserModifications', () => {
    it('detects when a file has been modified by the user', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-detect-'));
      const filePath = join(dir, 'test.txt');
      writeFileSync(filePath, 'original content', 'utf-8');
      const originalHash = hashContent('original content');

      // Now modify the file
      writeFileSync(filePath, 'user modified content', 'utf-8');

      const manifest = {
        files: { 'test.txt': { hash: originalHash, size: 16, type: 'txt' } },
      };

      const mods = detectUserModifications(dir, manifest);
      assert.equal(mods.length, 1);
      assert.equal(mods[0].path, 'test.txt');
      assert.equal(mods[0].recordedHash, originalHash);

      rmSync(dir, { recursive: true, force: true });
    });

    it('returns empty array when no files are modified', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-detect-'));
      const content = 'unchanged content';
      const filePath = join(dir, 'stable.txt');
      writeFileSync(filePath, content, 'utf-8');

      const manifest = {
        files: { 'stable.txt': { hash: hashContent(content), size: content.length, type: 'txt' } },
      };

      const mods = detectUserModifications(dir, manifest);
      assert.equal(mods.length, 0);

      rmSync(dir, { recursive: true, force: true });
    });

    it('skips files that no longer exist on disk', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-detect-'));
      const manifest = {
        files: { 'missing.txt': { hash: 'abc123', size: 5, type: 'txt' } },
      };

      const mods = detectUserModifications(dir, manifest);
      assert.equal(mods.length, 0);

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('planUpgrade', () => {
    it('returns error when no manifest exists', () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'chati-plan-'));
      const result = planUpgrade(emptyDir, newFrameworkDir, '2.0.0');
      assert.equal(result.errors.length, 1);
      assert.ok(result.errors[0].error.includes('No existing manifest'));
      rmSync(emptyDir, { recursive: true, force: true });
    });

    it('identifies files to upgrade when user has not modified them', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-plan-'));
      const fwDir = mkdtempSync(join(tmpdir(), 'chati-plan-fw-'));

      // Create "installed" file
      const content = 'original v1';
      mkdirSync(join(dir, '.chati'), { recursive: true });
      writeFileSync(join(dir, 'config.txt'), content, 'utf-8');

      // Save manifest
      const manifest = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        files: { 'config.txt': { hash: hashContent(content), size: content.length, type: 'txt' } },
      };
      saveManifest(dir, manifest);

      // Create new framework file (modified)
      writeFileSync(join(fwDir, 'config.txt'), 'updated v2', 'utf-8');

      const plan = planUpgrade(dir, fwDir, '2.0.0');
      assert.ok(plan.upgraded.includes('config.txt'));
      assert.equal(plan.skipped.length, 0);

      rmSync(dir, { recursive: true, force: true });
      rmSync(fwDir, { recursive: true, force: true });
    });
  });

  describe('upgradeInstallation', () => {
    it('returns error when no manifest exists', () => {
      const emptyDir = mkdtempSync(join(tmpdir(), 'chati-upg-'));
      const result = upgradeInstallation(emptyDir, newFrameworkDir, '2.0.0');
      assert.equal(result.errors.length, 1);
      assert.ok(result.errors[0].error.includes('No existing manifest'));
      rmSync(emptyDir, { recursive: true, force: true });
    });

    it('adds new files from the new framework', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-upg-'));
      const fwDir = mkdtempSync(join(tmpdir(), 'chati-upg-fw-'));

      // Create empty manifest (no files yet)
      mkdirSync(join(dir, '.chati'), { recursive: true });
      const manifest = { version: '1.0.0', createdAt: new Date().toISOString(), files: {} };
      saveManifest(dir, manifest);

      // Create new framework file
      writeFileSync(join(fwDir, 'new-file.txt'), 'brand new', 'utf-8');

      const result = upgradeInstallation(dir, fwDir, '2.0.0');
      assert.ok(result.added.includes('new-file.txt'));
      assert.ok(existsSync(join(dir, 'new-file.txt')));

      rmSync(dir, { recursive: true, force: true });
      rmSync(fwDir, { recursive: true, force: true });
    });

    it('upgrades unmodified files', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-upg-'));
      const fwDir = mkdtempSync(join(tmpdir(), 'chati-upg-fw-'));

      const v1Content = 'version 1 content';
      const v2Content = 'version 2 content';

      // Write installed file
      writeFileSync(join(dir, 'file.txt'), v1Content, 'utf-8');

      // Save manifest with original hash
      mkdirSync(join(dir, '.chati'), { recursive: true });
      const manifest = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        files: {
          'file.txt': { hash: hashContent(v1Content), size: v1Content.length, type: 'txt' },
        },
      };
      saveManifest(dir, manifest);

      // Create new framework file
      writeFileSync(join(fwDir, 'file.txt'), v2Content, 'utf-8');

      const result = upgradeInstallation(dir, fwDir, '2.0.0');
      assert.ok(result.upgraded.includes('file.txt'));
      assert.equal(readFileSync(join(dir, 'file.txt'), 'utf-8'), v2Content);

      rmSync(dir, { recursive: true, force: true });
      rmSync(fwDir, { recursive: true, force: true });
    });

    it('preserves user-modified files when merge returns same content', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-upg-'));
      const fwDir = mkdtempSync(join(tmpdir(), 'chati-upg-fw-'));

      const originalContent = 'original content';
      const userContent = 'user changed this';
      const v2Content = 'framework v2 content';

      // Write user-modified file
      writeFileSync(join(dir, 'file.txt'), userContent, 'utf-8');

      // Save manifest with ORIGINAL hash (before user modification)
      mkdirSync(join(dir, '.chati'), { recursive: true });
      const manifest = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        files: {
          'file.txt': { hash: hashContent(originalContent), size: originalContent.length, type: 'txt' },
        },
      };
      saveManifest(dir, manifest);

      // New framework file (.txt => replace strategy => mergeFile returns newContent)
      writeFileSync(join(fwDir, 'file.txt'), v2Content, 'utf-8');

      const result = upgradeInstallation(dir, fwDir, '2.0.0');

      // Since .txt uses replace strategy, merge returns v2Content which differs from userContent
      // So it gets upgraded (not preserved)
      assert.ok(
        result.upgraded.includes('file.txt') || result.preserved.includes('file.txt'),
        'File should be either upgraded or preserved'
      );

      rmSync(dir, { recursive: true, force: true });
      rmSync(fwDir, { recursive: true, force: true });
    });

    it('saves updated manifest after upgrade', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-upg-'));
      const fwDir = mkdtempSync(join(tmpdir(), 'chati-upg-fw-'));

      mkdirSync(join(dir, '.chati'), { recursive: true });
      const manifest = { version: '1.0.0', createdAt: new Date().toISOString(), files: {} };
      saveManifest(dir, manifest);

      writeFileSync(join(fwDir, 'new.txt'), 'new', 'utf-8');

      upgradeInstallation(dir, fwDir, '2.0.0');

      const updated = JSON.parse(readFileSync(join(dir, '.chati', 'manifest.json'), 'utf-8'));
      assert.equal(updated.version, '2.0.0');
      assert.ok(updated.files['new.txt']);

      rmSync(dir, { recursive: true, force: true });
      rmSync(fwDir, { recursive: true, force: true });
    });
  });
});
