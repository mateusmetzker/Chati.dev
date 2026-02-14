import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  searchAllMemories,
  getUnifiedMemoryStats,
} from '../../src/memory/search.js';
import { recordError } from '../../src/memory/gotchas.js';
import { writeAgentMemory } from '../../src/memory/agent-memory.js';
import { buildSessionDigest, saveSessionDigest } from '../../src/memory/session-digest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Memory Search', () => {
  let tempDir;

  before(() => {
    tempDir = join(__dirname, 'tmp-search');
    mkdirSync(tempDir, { recursive: true });

    // Populate test data

    // Create gotchas
    const error = {
      message: 'API authentication failed',
      agent: 'dev',
      task: 'setup-api',
    };
    for (let i = 0; i < 3; i++) {
      recordError(tempDir, error);
    }

    // Create agent memories
    writeAgentMemory(tempDir, 'architect', {
      category: 'API Design',
      content: 'Always use OAuth2 for API authentication',
      tags: ['api', 'security', 'oauth'],
    });

    writeAgentMemory(tempDir, 'dev', {
      category: 'Testing',
      content: 'Mock API calls in unit tests',
      tags: ['api', 'testing', 'mocking'],
    });

    // Create session digest
    const sessionState = {
      project: { name: 'API Project' },
      mode: 'build',
      agents: {
        dev: { status: 'completed' },
      },
    };
    const digest = buildSessionDigest(tempDir, sessionState);
    saveSessionDigest(tempDir, digest);
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should search across all memory types', () => {
    const results = searchAllMemories(tempDir, 'api');

    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);

    // Should find results from multiple sources
    const types = new Set(results.map(r => r.type));
    assert.ok(types.size > 1); // Multiple memory types found
  });

  it('should filter by memory type', () => {
    const gotchasOnly = searchAllMemories(tempDir, 'api', {
      types: ['gotchas'],
    });

    assert.ok(gotchasOnly.every(r => r.type === 'gotcha'));
  });

  it('should filter by agent', () => {
    const devOnly = searchAllMemories(tempDir, 'api', {
      agent: 'dev',
    });

    assert.ok(devOnly.every(r => r.agent === 'dev' || r.type === 'session_digest'));
  });

  it('should respect result limit', () => {
    const limited = searchAllMemories(tempDir, 'api', {
      limit: 2,
    });

    assert.equal(limited.length, 2);
  });

  it('should sort results by relevance', () => {
    const results = searchAllMemories(tempDir, 'authentication');

    assert.ok(results.length > 0);

    // Results should be sorted by relevance (descending)
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].relevance >= results[i].relevance);
    }
  });

  it('should return structured result objects', () => {
    const results = searchAllMemories(tempDir, 'api');

    results.forEach(result => {
      assert.ok(result.type);
      assert.ok(result.id);
      assert.ok(result.title);
      assert.ok(result.content);
      assert.ok(typeof result.relevance === 'number');
      assert.ok(result.metadata);
    });
  });

  it('should handle empty search query', () => {
    const results = searchAllMemories(tempDir, '');

    // Empty query should return no results or all results depending on implementation
    assert.ok(Array.isArray(results));
  });

  it('should handle non-existent directory gracefully', () => {
    const emptyDir = join(tempDir, 'nonexistent');
    const results = searchAllMemories(emptyDir, 'anything');

    assert.deepEqual(results, []);
  });

  it('should get unified memory statistics', () => {
    const stats = getUnifiedMemoryStats(tempDir);

    assert.ok(stats.gotchas);
    assert.ok(typeof stats.gotchas.total === 'number');
    assert.ok(typeof stats.gotchas.total_errors === 'number');

    assert.ok(stats.agent_memories);
    assert.ok(typeof stats.agent_memories.total_agents === 'number');
    assert.ok(typeof stats.agent_memories.total_entries === 'number');
    assert.ok(stats.agent_memories.by_agent);

    assert.ok(stats.session_digests);
    assert.ok(typeof stats.session_digests.total === 'number');
  });

  it('should include gotcha metadata in results', () => {
    const results = searchAllMemories(tempDir, 'authentication', {
      types: ['gotchas'],
    });

    const gotcha = results.find(r => r.type === 'gotcha');
    if (gotcha) {
      assert.ok(gotcha.metadata.count);
      assert.ok(gotcha.metadata.last_seen);
      assert.ok(typeof gotcha.metadata.resolved === 'boolean');
    }
  });

  it('should include agent memory metadata in results', () => {
    const results = searchAllMemories(tempDir, 'oauth', {
      types: ['agent'],
    });

    const agentMemory = results.find(r => r.type === 'agent_memory');
    if (agentMemory) {
      assert.ok(agentMemory.metadata.confidence);
      assert.ok(Array.isArray(agentMemory.metadata.tags));
      assert.ok(agentMemory.metadata.match_type);
    }
  });

  it('should include session digest metadata in results', () => {
    const results = searchAllMemories(tempDir, 'build', {
      types: ['session'],
    });

    const digest = results.find(r => r.type === 'session_digest');
    if (digest) {
      assert.ok(digest.metadata.mode);
      assert.ok(digest.metadata.phase);
      assert.ok(typeof digest.metadata.completion_rate === 'number');
    }
  });

  it('should handle complex multi-type search', () => {
    const results = searchAllMemories(tempDir, 'api', {
      types: ['gotchas', 'agent', 'session'],
      limit: 10,
    });

    assert.ok(results.length <= 10);

    const types = new Set(results.map(r => r.type));
    assert.ok(types.size >= 1);
  });
});
