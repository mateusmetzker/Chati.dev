import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getCurrentVersion, compareVersions, checkForUpdate } from '../../src/upgrade/checker.js';

describe('getCurrentVersion', () => {
  let tempDir;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'chati-checker-'));
    mkdirSync(join(tempDir, 'chati.dev'), { recursive: true });
    writeFileSync(join(tempDir, 'chati.dev', 'config.yaml'), 'version: "1.2.0"\n');
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads version from config.yaml', () => {
    const version = getCurrentVersion(tempDir);
    assert.equal(version, '1.2.0');
  });

  it('returns null for missing config', () => {
    const version = getCurrentVersion('/nonexistent/path');
    assert.equal(version, null);
  });
});

describe('compareVersions', () => {
  it('detects upgrade', () => {
    const result = compareVersions('1.0.0', '1.1.0');
    assert.equal(result.valid, true);
    assert.equal(result.isUpgrade, true);
    assert.equal(result.isDowngrade, false);
  });

  it('detects downgrade', () => {
    const result = compareVersions('2.0.0', '1.0.0');
    assert.equal(result.valid, true);
    assert.equal(result.isDowngrade, true);
  });

  it('detects same version', () => {
    const result = compareVersions('1.0.0', '1.0.0');
    assert.equal(result.isSame, true);
  });

  it('reports invalid versions', () => {
    const result = compareVersions('invalid', '1.0.0');
    assert.equal(result.valid, false);
  });

  it('detects diff type', () => {
    const result = compareVersions('1.0.0', '1.1.0');
    assert.equal(result.diff, 'minor');
  });
});

describe('checkForUpdate', () => {
  let tempDir;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'chati-update-'));
    mkdirSync(join(tempDir, 'chati.dev'), { recursive: true });
    writeFileSync(join(tempDir, 'chati.dev', 'config.yaml'), 'version: "1.0.0"\n');
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('detects available update', async () => {
    const result = await checkForUpdate(tempDir, '1.2.0');
    assert.equal(result.hasUpdate, true);
    assert.equal(result.currentVersion, '1.0.0');
    assert.equal(result.latestVersion, '1.2.0');
  });

  it('reports no update when current', async () => {
    const sameDir = mkdtempSync(join(tmpdir(), 'chati-same-'));
    mkdirSync(join(sameDir, 'chati.dev'), { recursive: true });
    writeFileSync(join(sameDir, 'chati.dev', 'config.yaml'), 'version: "1.2.0"\n');

    const result = await checkForUpdate(sameDir, '1.2.0');
    assert.equal(result.hasUpdate, false);

    rmSync(sameDir, { recursive: true, force: true });
  });
});
