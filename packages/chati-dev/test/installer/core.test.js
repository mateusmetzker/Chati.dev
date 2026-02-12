import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { installFramework } from '../../src/installer/core.js';

describe('installFramework', () => {
  let tempDir;
  const testConfig = {
    projectName: 'test-project',
    projectType: 'greenfield',
    language: 'en',
    selectedIDEs: ['claude-code'],
    selectedMCPs: [],
    version: '1.3.0',
  };

  before(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'chati-core-'));
    testConfig.targetDir = tempDir;
    await installFramework(testConfig);
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates .chati/ directory', () => {
    assert.ok(existsSync(join(tempDir, '.chati')));
  });

  it('creates session.yaml', () => {
    assert.ok(existsSync(join(tempDir, '.chati', 'session.yaml')));
  });

  it('creates chati.dev/ framework directory', () => {
    assert.ok(existsSync(join(tempDir, 'chati.dev')));
  });

  it('creates data/ directory', () => {
    assert.ok(existsSync(join(tempDir, 'chati.dev', 'data')));
  });

  it('creates .chati/memories/ directory tree', () => {
    assert.ok(existsSync(join(tempDir, '.chati', 'memories')));
    assert.ok(existsSync(join(tempDir, '.chati', 'memories', 'shared', 'durable')));
    assert.ok(existsSync(join(tempDir, '.chati', 'memories', 'shared', 'daily')));
    assert.ok(existsSync(join(tempDir, '.chati', 'memories', 'shared', 'session')));
  });

  it('creates per-agent memory directories', () => {
    const agents = ['greenfield-wu', 'brownfield-wu', 'brief', 'detail', 'architect',
      'ux', 'phases', 'tasks', 'qa-planning', 'qa-implementation', 'dev', 'devops'];
    for (const agent of agents) {
      assert.ok(
        existsSync(join(tempDir, '.chati', 'memories', agent, 'durable')),
        `${agent}/durable should exist`
      );
      assert.ok(
        existsSync(join(tempDir, '.chati', 'memories', agent, 'daily')),
        `${agent}/daily should exist`
      );
    }
  });

  it('creates CLAUDE.md at root', () => {
    assert.ok(existsSync(join(tempDir, 'CLAUDE.md')));
  });

  it('creates config.yaml with version', () => {
    const configPath = join(tempDir, 'chati.dev', 'config.yaml');
    assert.ok(existsSync(configPath));
    const content = readFileSync(configPath, 'utf-8');
    assert.ok(content.includes('1.3.0'));
  });

  it('creates artifact directories', () => {
    assert.ok(existsSync(join(tempDir, 'chati.dev', 'artifacts', '0-WU')));
    assert.ok(existsSync(join(tempDir, 'chati.dev', 'artifacts', 'handoffs')));
    assert.ok(existsSync(join(tempDir, 'chati.dev', 'artifacts', 'decisions')));
  });

  it('creates claude-code thin router', () => {
    const routerPath = join(tempDir, '.claude', 'commands', 'chati.md');
    assert.ok(existsSync(routerPath));
    const content = readFileSync(routerPath, 'utf-8');
    assert.ok(content.includes('Thin Router'));
  });
});
