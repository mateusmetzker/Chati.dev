import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Get the path to an agent's memory file.
 * @param {string} projectDir - Project directory
 * @param {string} agentName - Agent name
 * @returns {string} Path to MEMORY.md
 */
function getAgentMemoryPath(projectDir, agentName) {
  return join(projectDir, '.chati', 'memories', agentName, 'MEMORY.md');
}

/**
 * Parse markdown memory file into structured entries.
 * @param {string} content - Markdown content
 * @returns {object[]} Array of entries
 */
function parseMemoryMarkdown(content) {
  const entries = [];
  const lines = content.split('\n');
  let currentCategory = null;
  let currentEntry = null;

  for (const line of lines) {
    // Category header (## Category)
    if (line.startsWith('## ')) {
      if (currentEntry) {
        entries.push(currentEntry);
      }
      currentCategory = line.substring(3).trim();
      currentEntry = null;
    }
    // Entry item (- content)
    else if (line.startsWith('- ') && currentCategory) {
      if (currentEntry) {
        entries.push(currentEntry);
      }

      const content = line.substring(2).trim();

      // Parse tags [tag1, tag2]
      const tagMatch = content.match(/\[([^\]]+)\]\s*$/);
      const tags = tagMatch ? tagMatch[1].split(',').map(t => t.trim()) : [];
      const cleanContent = tagMatch ? content.substring(0, tagMatch.index).trim() : content;

      // Parse confidence (high/medium/low)
      const confidenceMatch = cleanContent.match(/\((high|medium|low)\)\s*$/i);
      const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'medium';
      const finalContent = confidenceMatch ? cleanContent.substring(0, confidenceMatch.index).trim() : cleanContent;

      currentEntry = {
        category: currentCategory,
        content: finalContent,
        confidence,
        tags,
      };
    }
    // Continuation of entry
    else if (line.trim().startsWith('  ') && currentEntry) {
      currentEntry.content += '\n' + line.trim();
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

/**
 * Format entries back to markdown.
 * @param {object[]} entries - Array of entry objects
 * @returns {string} Markdown content
 */
function formatMemoryMarkdown(entries) {
  const byCategory = {};

  entries.forEach(entry => {
    if (!byCategory[entry.category]) {
      byCategory[entry.category] = [];
    }
    byCategory[entry.category].push(entry);
  });

  const sections = Object.entries(byCategory).map(([category, items]) => {
    const itemsText = items.map(item => {
      const confidenceText = item.confidence !== 'medium' ? ` (${item.confidence})` : '';
      const tagsText = item.tags && item.tags.length > 0 ? ` [${item.tags.join(', ')}]` : '';
      return `- ${item.content}${confidenceText}${tagsText}`;
    }).join('\n');

    return `## ${category}\n\n${itemsText}`;
  });

  return sections.join('\n\n') + '\n';
}

/**
 * Read an agent's memory file.
 * @param {string} projectDir - Project directory
 * @param {string} agentName - Agent name
 * @returns {{ loaded: boolean, entries: object[], raw: string }}
 */
export function readAgentMemory(projectDir, agentName) {
  const memoryPath = getAgentMemoryPath(projectDir, agentName);

  if (!existsSync(memoryPath)) {
    return {
      loaded: false,
      entries: [],
      raw: '',
    };
  }

  try {
    const raw = readFileSync(memoryPath, 'utf-8');
    const entries = parseMemoryMarkdown(raw);

    return {
      loaded: true,
      entries,
      raw,
    };
  } catch {
    return {
      loaded: false,
      entries: [],
      raw: '',
    };
  }
}

/**
 * Write/append an entry to an agent's memory.
 * @param {string} projectDir - Project directory
 * @param {string} agentName - Agent name
 * @param {object} entry - { category, content, confidence, tags }
 * @returns {{ saved: boolean }}
 */
export function writeAgentMemory(projectDir, agentName, entry) {
  const memoryPath = getAgentMemoryPath(projectDir, agentName);
  const dir = dirname(memoryPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Read existing entries
  const existing = readAgentMemory(projectDir, agentName);

  // Add new entry with defaults
  const newEntry = {
    category: entry.category || 'General',
    content: entry.content,
    confidence: entry.confidence || 'medium',
    tags: entry.tags || [],
  };

  existing.entries.push(newEntry);

  // Write back
  const markdown = formatMemoryMarkdown(existing.entries);
  writeFileSync(memoryPath, markdown, 'utf-8');

  return { saved: true };
}

/**
 * Search across all agent memories.
 * @param {string} projectDir - Project directory
 * @param {string} query - Search query
 * @returns {object[]} Matching entries with agent attribution
 */
export function searchAgentMemories(projectDir, query) {
  const memoriesDir = join(projectDir, '.chati', 'memories');

  if (!existsSync(memoriesDir)) {
    return [];
  }

  const results = [];
  const queryLower = query.toLowerCase();

  try {
    const agentDirs = readdirSync(memoriesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const agentName of agentDirs) {
      const memory = readAgentMemory(projectDir, agentName);

      if (!memory.loaded) continue;

      memory.entries.forEach((entry, index) => {
        const matchesContent = entry.content.toLowerCase().includes(queryLower);
        const matchesCategory = entry.category.toLowerCase().includes(queryLower);
        const matchesTags = entry.tags.some(t => t.toLowerCase().includes(queryLower));

        if (matchesContent || matchesCategory || matchesTags) {
          results.push({
            agent: agentName,
            ...entry,
            index,
            matchType: matchesContent ? 'content' : matchesCategory ? 'category' : 'tag',
          });
        }
      });
    }
  } catch {
    return [];
  }

  return results;
}

/**
 * Get top memory entries for an agent, sorted by confidence.
 * Used by orchestrator/agents for programmatic memory access.
 * @param {string} projectDir - Project directory
 * @param {string} agentName - Agent name
 * @param {number} [limit=5] - Max entries to return
 * @returns {object[]} Top entries sorted by confidence (high → medium → low)
 */
export function getTopMemories(projectDir, agentName, limit = 5) {
  const memory = readAgentMemory(projectDir, agentName);
  if (!memory.loaded) return [];

  const confidenceOrder = { high: 3, medium: 2, low: 1 };
  const sorted = [...memory.entries].sort((a, b) => {
    return (confidenceOrder[b.confidence] || 2) - (confidenceOrder[a.confidence] || 2);
  });

  return sorted.slice(0, limit);
}

/**
 * Get memory stats per agent.
 * @param {string} projectDir - Project directory
 * @returns {object} { byAgent: { agent: { entries, lastUpdated } } }
 */
export function getAgentMemoryStats(projectDir) {
  const memoriesDir = join(projectDir, '.chati', 'memories');

  if (!existsSync(memoriesDir)) {
    return { byAgent: {} };
  }

  const stats = { byAgent: {} };

  try {
    const agentDirs = readdirSync(memoriesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const agentName of agentDirs) {
      const memoryPath = getAgentMemoryPath(projectDir, agentName);

      if (!existsSync(memoryPath)) continue;

      const memory = readAgentMemory(projectDir, agentName);

      stats.byAgent[agentName] = {
        entries: memory.entries.length,
        lastUpdated: null, // Would need fs.statSync for actual timestamp
        categories: [...new Set(memory.entries.map(e => e.category))],
      };
    }
  } catch {
    return { byAgent: {} };
  }

  return stats;
}
