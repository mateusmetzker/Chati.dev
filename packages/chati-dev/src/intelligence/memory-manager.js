import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, relative } from 'path';

const MEMORIES_DIR = '.chati/memories';

/**
 * List memories with optional filters
 */
export function listMemories(targetDir, options = {}) {
  const memoriesPath = join(targetDir, MEMORIES_DIR);
  if (!existsSync(memoriesPath)) return [];

  const memories = [];
  walkMemories(memoriesPath, (filePath) => {
    const meta = parseMemoryFrontmatter(filePath);
    if (!meta) return;

    if (options.agent && meta.agent !== options.agent) return;
    if (options.sector && meta.sector !== options.sector) return;
    if (options.tier && meta.tier !== options.tier) return;

    memories.push({
      ...meta,
      path: relative(memoriesPath, filePath),
    });
  });

  return memories;
}

/**
 * Search memories by query (matches tags and content)
 */
export function searchMemories(targetDir, query) {
  const memoriesPath = join(targetDir, MEMORIES_DIR);
  if (!existsSync(memoriesPath)) return [];

  const queryLower = query.toLowerCase();
  const results = [];

  walkMemories(memoriesPath, (filePath) => {
    const content = readFileSync(filePath, 'utf-8');
    const meta = parseMemoryFrontmatter(filePath);
    if (!meta) return;

    const tagMatch = meta.tags && meta.tags.some(t => t.toLowerCase().includes(queryLower));
    const contentMatch = content.toLowerCase().includes(queryLower);

    if (tagMatch || contentMatch) {
      results.push({
        ...meta,
        path: relative(memoriesPath, filePath),
        matchType: tagMatch ? 'tag' : 'content',
      });
    }
  });

  return results;
}

/**
 * Clean expired or cold memories
 */
export function cleanMemories(targetDir, options = {}) {
  const memoriesPath = join(targetDir, MEMORIES_DIR);
  if (!existsSync(memoriesPath)) return { cleaned: 0, skipped: 0 };

  let cleaned = 0;
  let skipped = 0;

  walkMemories(memoriesPath, (filePath) => {
    const meta = parseMemoryFrontmatter(filePath);
    if (!meta) { skipped++; return; }

    // Clean session-tier memories (they should be cleaned on new session start)
    const isSessionTier = filePath.includes('/session/');

    // Clean expired memories
    const isExpired = meta.expires_at && new Date(meta.expires_at) < new Date();

    if (isSessionTier || isExpired) {
      if (!options.dryRun) {
        unlinkSync(filePath);
      }
      cleaned++;
    } else {
      skipped++;
    }
  });

  return { cleaned, skipped, dryRun: !!options.dryRun };
}

/**
 * Get memory statistics
 */
export function getMemoryStats(targetDir) {
  const memoriesPath = join(targetDir, MEMORIES_DIR);
  if (!existsSync(memoriesPath)) {
    return { total: 0, byAgent: {}, bySector: {}, byTier: {}, diskUsage: 0 };
  }

  const stats = {
    total: 0,
    byAgent: {},
    bySector: {},
    byTier: { hot: 0, warm: 0, cold: 0 },
    diskUsage: 0,
  };

  walkMemories(memoriesPath, (filePath) => {
    const meta = parseMemoryFrontmatter(filePath);
    const fileStats = statSync(filePath);
    stats.diskUsage += fileStats.size;

    if (!meta) return;
    stats.total++;

    if (meta.agent) {
      stats.byAgent[meta.agent] = (stats.byAgent[meta.agent] || 0) + 1;
    }
    if (meta.sector) {
      stats.bySector[meta.sector] = (stats.bySector[meta.sector] || 0) + 1;
    }
    if (meta.tier && stats.byTier[meta.tier] !== undefined) {
      stats.byTier[meta.tier]++;
    }
  });

  return stats;
}

/**
 * Walk memory files recursively
 */
export function walkMemories(dir, callback) {
  if (!existsSync(dir)) return;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkMemories(fullPath, callback);
    } else if (entry.name.endsWith('.md')) {
      callback(fullPath);
    }
  }
}

/**
 * Parse YAML frontmatter from a memory file
 */
export function parseMemoryFrontmatter(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    // Simple YAML parsing for frontmatter (no dependency on js-yaml)
    const lines = fmMatch[1].split('\n');
    const meta = {};
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      let value = line.slice(colonIdx + 1).trim();

      // Handle arrays [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim());
      }
      // Handle numbers
      else if (!isNaN(value) && value !== '') {
        value = parseFloat(value);
      }
      // Handle quoted strings
      else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      meta[key] = value;
    }

    return meta;
  } catch {
    return null;
  }
}
