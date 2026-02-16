import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  readAgentMemory,
  writeAgentMemory,
  searchAgentMemories,
  getAgentMemoryStats,
  getTopMemories,
} from '../../src/memory/agent-memory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Agent Memory', () => {
  let tempDir;

  before(() => {
    tempDir = join(__dirname, 'tmp-agent-memory');
    mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should read non-existent agent memory gracefully', () => {
    const result = readAgentMemory(tempDir, 'architect');

    assert.equal(result.loaded, false);
    assert.deepEqual(result.entries, []);
    assert.equal(result.raw, '');
  });

  it('should write and read agent memory', () => {
    const entry = {
      category: 'Architecture Patterns',
      content: 'Always use microservices for scalable systems',
      confidence: 'high',
      tags: ['microservices', 'scalability'],
    };

    const writeResult = writeAgentMemory(tempDir, 'architect', entry);
    assert.equal(writeResult.saved, true);

    const readResult = readAgentMemory(tempDir, 'architect');
    assert.equal(readResult.loaded, true);
    assert.equal(readResult.entries.length, 1);
    assert.equal(readResult.entries[0].category, 'Architecture Patterns');
    assert.equal(readResult.entries[0].content, 'Always use microservices for scalable systems');
    assert.equal(readResult.entries[0].confidence, 'high');
    assert.deepEqual(readResult.entries[0].tags, ['microservices', 'scalability']);
  });

  it('should append multiple entries to same agent', () => {
    writeAgentMemory(tempDir, 'dev', {
      category: 'Testing',
      content: 'Always write unit tests first',
      confidence: 'high',
      tags: ['tdd', 'testing'],
    });

    writeAgentMemory(tempDir, 'dev', {
      category: 'Code Review',
      content: 'Check for security vulnerabilities',
      confidence: 'medium',
      tags: ['security', 'review'],
    });

    const result = readAgentMemory(tempDir, 'dev');
    assert.equal(result.loaded, true);
    assert.equal(result.entries.length, 2);
    assert.equal(result.entries[0].category, 'Testing');
    assert.equal(result.entries[1].category, 'Code Review');
  });

  it('should use default values for missing fields', () => {
    writeAgentMemory(tempDir, 'brief', {
      content: 'Extract all non-functional requirements',
    });

    const result = readAgentMemory(tempDir, 'brief');
    assert.equal(result.entries[0].category, 'General');
    assert.equal(result.entries[0].confidence, 'medium');
    assert.deepEqual(result.entries[0].tags, []);
  });

  it('should search across all agent memories', () => {
    // Add entries to multiple agents
    writeAgentMemory(tempDir, 'qa-planning', {
      category: 'Test Strategy',
      content: 'Always include edge cases in test plans',
      tags: ['testing', 'edge-cases'],
    });

    writeAgentMemory(tempDir, 'qa-implementation', {
      category: 'Test Execution',
      content: 'Run integration tests in isolated environment',
      tags: ['testing', 'integration'],
    });

    const results = searchAgentMemories(tempDir, 'testing');

    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 2);

    const qaPlanning = results.find(r => r.agent === 'qa-planning');
    const qaImpl = results.find(r => r.agent === 'qa-implementation');

    assert.ok(qaPlanning);
    assert.ok(qaImpl);
    assert.equal(qaPlanning.matchType, 'tag');
  });

  it('should search by category', () => {
    writeAgentMemory(tempDir, 'architect', {
      category: 'Database Design',
      content: 'Normalize to 3NF for transactional systems',
    });

    const results = searchAgentMemories(tempDir, 'database');

    assert.ok(results.length > 0);
    const match = results.find(r => r.matchType === 'category');
    assert.ok(match);
  });

  it('should get agent memory statistics', () => {
    const stats = getAgentMemoryStats(tempDir);

    assert.ok(stats.byAgent);
    assert.ok(Object.keys(stats.byAgent).length > 0);

    const architectStats = stats.byAgent.architect;
    assert.ok(architectStats);
    assert.ok(architectStats.entries > 0);
    assert.ok(Array.isArray(architectStats.categories));
  });

  it('should handle search in empty directory', () => {
    const emptyDir = join(tempDir, 'empty');
    const results = searchAgentMemories(emptyDir, 'anything');

    assert.deepEqual(results, []);
  });

  it('should return top memories sorted by confidence', () => {
    // Write entries with different confidence levels
    writeAgentMemory(tempDir, 'phases', {
      category: 'Planning',
      content: 'Low confidence insight',
      confidence: 'low',
    });
    writeAgentMemory(tempDir, 'phases', {
      category: 'Planning',
      content: 'High confidence insight',
      confidence: 'high',
    });
    writeAgentMemory(tempDir, 'phases', {
      category: 'Planning',
      content: 'Medium confidence insight',
      confidence: 'medium',
    });

    const top = getTopMemories(tempDir, 'phases', 3);
    assert.equal(top.length, 3);
    assert.equal(top[0].confidence, 'high');
    assert.equal(top[1].confidence, 'medium');
    assert.equal(top[2].confidence, 'low');
  });

  it('should respect limit in getTopMemories', () => {
    const top = getTopMemories(tempDir, 'phases', 1);
    assert.equal(top.length, 1);
    assert.equal(top[0].confidence, 'high');
  });

  it('should return empty array for non-existent agent memory', () => {
    const top = getTopMemories(tempDir, 'nonexistent-agent');
    assert.deepEqual(top, []);
  });

  it('should preserve content accurately', () => {
    writeAgentMemory(tempDir, 'dev', {
      category: 'Code Standards',
      content: 'Use ESM imports instead of CommonJS require statements',
      confidence: 'high',
    });

    const result = readAgentMemory(tempDir, 'dev');
    const entry = result.entries.find(e => e.category === 'Code Standards');

    assert.ok(entry);
    assert.equal(entry.content, 'Use ESM imports instead of CommonJS require statements');
    assert.equal(entry.confidence, 'high');
  });
});
