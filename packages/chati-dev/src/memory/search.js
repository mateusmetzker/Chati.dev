import { getGotchas } from './gotchas.js';
import { searchAgentMemories, getAgentMemoryStats } from './agent-memory.js';
import { listDigests } from './session-digest.js';
import { getGotchaStats } from './gotchas.js';

/**
 * Search across all memory types (gotchas, agent memories, session digests).
 * @param {string} projectDir - Project directory
 * @param {string} query - Search query
 * @param {object} [options] - { types: ['gotchas', 'agent', 'session'], agent, limit }
 * @returns {object[]} Unified results sorted by relevance
 */
export function searchAllMemories(projectDir, query, options = {}) {
  const {
    types = ['gotchas', 'agent', 'session'],
    agent = null,
    limit = 20,
  } = options;

  const results = [];
  const queryLower = query.toLowerCase();

  // Search gotchas
  if (types.includes('gotchas')) {
    const gotchas = getGotchas(projectDir);

    gotchas.forEach(gotcha => {
      const matchScore = calculateGotchaMatchScore(gotcha, queryLower, agent);

      if (matchScore > 0) {
        results.push({
          type: 'gotcha',
          id: gotcha.id,
          title: gotcha.message,
          content: gotcha.original_message,
          agent: gotcha.agent,
          task: gotcha.task,
          metadata: {
            count: gotcha.count,
            last_seen: gotcha.last_seen,
            resolved: !!gotcha.resolution,
          },
          relevance: matchScore,
        });
      }
    });
  }

  // Search agent memories
  if (types.includes('agent')) {
    const agentResults = searchAgentMemories(projectDir, query);

    agentResults.forEach(result => {
      if (agent && result.agent !== agent) return;

      results.push({
        type: 'agent_memory',
        id: `${result.agent}-${result.index}`,
        title: result.category,
        content: result.content,
        agent: result.agent,
        metadata: {
          confidence: result.confidence,
          tags: result.tags,
          match_type: result.matchType,
        },
        relevance: calculateAgentMemoryMatchScore(result),
      });
    });
  }

  // Search session digests
  if (types.includes('session')) {
    const digests = listDigests(projectDir);

    digests.forEach(digest => {
      const matchScore = calculateDigestMatchScore(digest, queryLower);

      if (matchScore > 0) {
        results.push({
          type: 'session_digest',
          id: digest.filename,
          title: `Session ${digest.date || 'Unknown'}`,
          content: `Mode: ${digest.mode}, Phase: ${digest.phase}, Completion: ${digest.completion_rate}%`,
          metadata: {
            timestamp: digest.timestamp,
            mode: digest.mode,
            phase: digest.phase,
            completion_rate: digest.completion_rate,
          },
          relevance: matchScore,
        });
      }
    });
  }

  // Sort by relevance and limit
  return results
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

/**
 * Calculate match score for a gotcha.
 * @param {object} gotcha - Gotcha object
 * @param {string} queryLower - Lowercase query
 * @param {string|null} agent - Agent filter
 * @returns {number} Match score (0-100)
 */
function calculateGotchaMatchScore(gotcha, queryLower, agent) {
  let score = 0;

  // Agent match
  if (agent && gotcha.agent === agent) {
    score += 30;
  } else if (agent && gotcha.agent !== agent) {
    return 0; // Filter out non-matching agents
  }

  // Message match
  const messageMatch = gotcha.message.toLowerCase().includes(queryLower);
  const originalMatch = gotcha.original_message?.toLowerCase().includes(queryLower);

  if (messageMatch || originalMatch) {
    score += 40;
  }

  // Task match
  if (gotcha.task?.toLowerCase().includes(queryLower)) {
    score += 20;
  }

  // Frequency bonus
  score += Math.min(10, gotcha.count);

  return score;
}

/**
 * Calculate match score for an agent memory.
 * @param {object} result - Agent memory result
 * @returns {number} Match score (0-100)
 */
function calculateAgentMemoryMatchScore(result) {
  let score = 50; // Base score for matching

  // Exact match in content
  if (result.matchType === 'content') {
    score += 20;
  }

  // Category match
  if (result.matchType === 'category') {
    score += 15;
  }

  // Tag match
  if (result.matchType === 'tag') {
    score += 10;
  }

  // Confidence bonus
  if (result.confidence === 'high') {
    score += 10;
  } else if (result.confidence === 'low') {
    score -= 5;
  }

  return score;
}

/**
 * Calculate match score for a session digest.
 * @param {object} digest - Digest summary
 * @param {string} queryLower - Lowercase query
 * @returns {number} Match score (0-100)
 */
function calculateDigestMatchScore(digest, queryLower) {
  let score = 0;

  // Mode match
  if (digest.mode?.toLowerCase().includes(queryLower)) {
    score += 30;
  }

  // Phase match
  if (digest.phase?.toLowerCase().includes(queryLower)) {
    score += 30;
  }

  // Date match
  if (digest.date?.includes(queryLower)) {
    score += 20;
  }

  // Recency bonus (recent sessions more relevant)
  if (digest.timestamp) {
    const daysSince = (Date.now() - new Date(digest.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      score += 10 * (1 - daysSince / 7);
    }
  }

  return score;
}

/**
 * Get unified memory statistics.
 * @param {string} projectDir - Project directory
 * @returns {object}
 */
export function getUnifiedMemoryStats(projectDir) {
  const gotchaStats = getGotchaStats(projectDir);
  const agentStats = getAgentMemoryStats(projectDir);
  const digests = listDigests(projectDir);

  return {
    gotchas: {
      total: gotchaStats.totalGotchas,
      total_errors: gotchaStats.totalErrors,
      recent_errors: gotchaStats.recentErrors,
    },
    agent_memories: {
      total_agents: Object.keys(agentStats.byAgent).length,
      total_entries: Object.values(agentStats.byAgent).reduce((sum, a) => sum + a.entries, 0),
      by_agent: agentStats.byAgent,
    },
    session_digests: {
      total: digests.length,
      latest: digests[0] || null,
    },
  };
}
