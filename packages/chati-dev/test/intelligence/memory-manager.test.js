import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  listMemories, searchMemories, getMemoryStats,
  parseMemoryFrontmatter, walkMemories,
} from '../../src/intelligence/memory-manager.js';

const MEMORY_CONTENT = `---
id: mem-2026-02-12-001
type: decision
agent: architect
tags: [jwt, auth, pattern]
confidence: 0.92
sector: procedural
tier: hot
access_count: 7
created_at: 2026-02-12T10:00:00Z
---

# JWT Authentication Pattern

Chose JWT for stateless API.
`;

describe('memory-manager', () => {
  let tempDir;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'chati-mem-'));
    const memoriesPath = join(tempDir, '.chati', 'memories');

    // Create shared and agent memories
    mkdirSync(join(memoriesPath, 'shared', 'durable'), { recursive: true });
    mkdirSync(join(memoriesPath, 'shared', 'session'), { recursive: true });
    mkdirSync(join(memoriesPath, 'architect', 'durable'), { recursive: true });

    writeFileSync(join(memoriesPath, 'shared', 'durable', 'auth-pattern.md'), MEMORY_CONTENT);
    writeFileSync(join(memoriesPath, 'architect', 'durable', 'db-pattern.md'), `---
id: mem-2026-02-12-002
type: validated_pattern
agent: architect
tags: [database, migration]
confidence: 0.85
sector: semantic
tier: warm
access_count: 3
created_at: 2026-02-11T10:00:00Z
---

# Database Migration Pattern
Always use versioned migrations.
`);
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('listMemories returns all memories', () => {
    const memories = listMemories(tempDir);
    assert.equal(memories.length, 2);
  });

  it('listMemories filters by agent', () => {
    const memories = listMemories(tempDir, { agent: 'architect' });
    assert.equal(memories.length, 2); // both have agent=architect
  });

  it('listMemories filters by sector', () => {
    const memories = listMemories(tempDir, { sector: 'procedural' });
    assert.equal(memories.length, 1);
  });

  it('listMemories filters by tier', () => {
    const memories = listMemories(tempDir, { tier: 'hot' });
    assert.equal(memories.length, 1);
  });

  it('listMemories returns empty for missing directory', () => {
    const memories = listMemories('/nonexistent/path');
    assert.deepEqual(memories, []);
  });

  it('searchMemories finds by tag', () => {
    const results = searchMemories(tempDir, 'jwt');
    assert.equal(results.length, 1);
    assert.equal(results[0].matchType, 'tag');
  });

  it('searchMemories finds by content', () => {
    const results = searchMemories(tempDir, 'versioned migrations');
    assert.equal(results.length, 1);
    assert.equal(results[0].matchType, 'content');
  });

  it('searchMemories returns empty for no match', () => {
    const results = searchMemories(tempDir, 'nonexistent-xyz');
    assert.deepEqual(results, []);
  });

  it('getMemoryStats counts correctly', () => {
    const stats = getMemoryStats(tempDir);
    assert.equal(stats.total, 2);
    assert.equal(stats.byTier.hot, 1);
    assert.equal(stats.byTier.warm, 1);
    assert.equal(stats.byTier.cold, 0);
    assert.ok(stats.diskUsage > 0);
  });

  it('getMemoryStats returns zero for missing dir', () => {
    const stats = getMemoryStats('/nonexistent/path');
    assert.equal(stats.total, 0);
  });

  it('parseMemoryFrontmatter extracts metadata', () => {
    const filePath = join(tempDir, '.chati', 'memories', 'shared', 'durable', 'auth-pattern.md');
    const meta = parseMemoryFrontmatter(filePath);
    assert.equal(meta.id, 'mem-2026-02-12-001');
    assert.equal(meta.confidence, 0.92);
    assert.equal(meta.sector, 'procedural');
    assert.equal(meta.tier, 'hot');
    assert.ok(Array.isArray(meta.tags));
  });

  it('parseMemoryFrontmatter returns null for invalid file', () => {
    const meta = parseMemoryFrontmatter('/nonexistent/file.md');
    assert.equal(meta, null);
  });

  it('walkMemories visits only .md files', () => {
    const memoriesPath = join(tempDir, '.chati', 'memories');
    // Add a non-md file
    writeFileSync(join(memoriesPath, 'shared', 'durable', 'index.json'), '{}');

    const visited = [];
    walkMemories(memoriesPath, (fp) => visited.push(fp));
    assert.ok(visited.every(f => f.endsWith('.md')));
  });
});
