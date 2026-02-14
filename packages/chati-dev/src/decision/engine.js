/**
 * Decision Engine - Core COMPASS module for chati.dev
 * Analyzes intent and recommends: REUSE (>=90%), ADAPT (60-89%), CREATE (<60%)
 *
 * @module decision/engine
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

/**
 * Analyze a request against existing entities and recommend action.
 * Uses keyword matching to find similar existing artifacts.
 *
 * @param {string} projectDir
 * @param {object} request - { description, type, keywords, agent }
 * @returns {{ recommendation: 'REUSE'|'ADAPT'|'CREATE', score: number, matches: object[], reasoning: string }}
 */
export function analyzeRequest(projectDir, request) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');

  if (!existsSync(registryPath)) {
    return {
      recommendation: 'CREATE',
      score: 0,
      matches: [],
      reasoning: 'No entity registry found - first artifact in project'
    };
  }

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  const entities = flattenEntities(registry);

  // Calculate similarity scores for all entities
  const scoredMatches = entities
    .map(entity => ({
      entity,
      score: calculateSimilarity(request, entity)
    }))
    .filter(match => match.score > 0)
    .sort((a, b) => b.score - a.score);

  const topScore = scoredMatches.length > 0 ? scoredMatches[0].score : 0;
  const topMatches = scoredMatches.slice(0, 5).map(m => ({
    path: m.entity.path,
    type: m.entity.type,
    score: m.score,
    purpose: m.entity.purpose || 'No purpose defined'
  }));

  let recommendation;
  let reasoning;

  if (topScore >= 90) {
    recommendation = 'REUSE';
    reasoning = `High similarity (${topScore}%) - existing artifact meets requirements`;
  } else if (topScore >= 60) {
    recommendation = 'ADAPT';
    reasoning = `Moderate similarity (${topScore}%) - adapt existing artifact`;
  } else {
    recommendation = 'CREATE';
    reasoning = topScore > 0
      ? `Low similarity (${topScore}%) - create new artifact`
      : 'No similar artifacts found - create new';
  }

  const decision = {
    timestamp: new Date().toISOString(),
    request: {
      description: request.description,
      type: request.type,
      keywords: request.keywords,
      agent: request.agent
    },
    recommendation,
    score: topScore,
    reasoning,
    topMatches: topMatches.slice(0, 3)
  };

  recordDecision(projectDir, decision);

  return {
    recommendation,
    score: topScore,
    matches: topMatches,
    reasoning
  };
}

/**
 * Calculate similarity between a request and an entity.
 * Uses keyword overlap (Jaccard similarity) + type matching.
 *
 * @param {object} request - { keywords, type }
 * @param {object} entity - { keywords, type, purpose }
 * @returns {number} Score 0-100
 */
export function calculateSimilarity(request, entity) {
  // Normalize and collect keywords
  const requestKeywords = new Set(
    (request.keywords || []).map(k => k.toLowerCase())
  );

  const entityKeywords = new Set();

  // Extract from entity keywords (primary source)
  if (entity.keywords) {
    entity.keywords.forEach(k => entityKeywords.add(k.toLowerCase()));
  }

  // Extract from entity name (secondary source - only key terms)
  if (entity.name) {
    const nameWords = entity.name
      .toLowerCase()
      .replace(/[._-]/g, ' ')
      .split(/\W+/)
      .filter(w => w.length > 3);
    nameWords.forEach(w => entityKeywords.add(w));
  }

  if (requestKeywords.size === 0 || entityKeywords.size === 0) {
    return 0;
  }

  // Calculate Jaccard similarity
  const intersection = new Set(
    [...requestKeywords].filter(k => entityKeywords.has(k))
  );
  const union = new Set([...requestKeywords, ...entityKeywords]);

  let score = (intersection.size / union.size) * 100;

  // Add bonus points for type match (additive, not multiplicative)
  if (request.type && entity.type && request.type === entity.type) {
    score = Math.min(100, score + 25);
  }

  // Add bonus for high intersection ratio (more matches = better)
  const intersectionRatio = intersection.size / requestKeywords.size;
  if (intersectionRatio >= 0.8) {
    score = Math.min(100, score + 15);
  } else if (intersectionRatio >= 0.5) {
    score = Math.min(100, score + 10);
  }

  return Math.round(score);
}

/**
 * Get decision history for auditing.
 * @param {string} projectDir
 * @returns {object[]} Recent decisions
 */
export function getDecisionHistory(projectDir) {
  const historyPath = join(projectDir, '.chati', 'decisions', 'history.json');

  if (!existsSync(historyPath)) {
    return [];
  }

  try {
    const content = readFileSync(historyPath, 'utf8');
    const data = JSON.parse(content);
    return data.decisions || [];
  } catch {
    return [];
  }
}

/**
 * Record a decision for audit trail.
 * @param {string} projectDir
 * @param {object} decision
 */
export function recordDecision(projectDir, decision) {
  const decisionsDir = join(projectDir, '.chati', 'decisions');
  const historyPath = join(decisionsDir, 'history.json');

  // Ensure directory exists
  if (!existsSync(decisionsDir)) {
    mkdirSync(decisionsDir, { recursive: true });
  }

  let history = { decisions: [] };

  if (existsSync(historyPath)) {
    try {
      const content = readFileSync(historyPath, 'utf8');
      history = JSON.parse(content);
    } catch {
      // Keep empty history if parse fails
    }
  }

  history.decisions = history.decisions || [];
  history.decisions.push(decision);

  // Keep last 100 decisions
  if (history.decisions.length > 100) {
    history.decisions = history.decisions.slice(-100);
  }

  writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
}

/**
 * Get engine statistics.
 * @param {string} projectDir
 * @returns {object} { totalDecisions, byRecommendation: { REUSE, ADAPT, CREATE }, avgScore }
 */
export function getEngineStats(projectDir) {
  const history = getDecisionHistory(projectDir);

  const stats = {
    totalDecisions: history.length,
    byRecommendation: {
      REUSE: 0,
      ADAPT: 0,
      CREATE: 0
    },
    avgScore: 0
  };

  if (history.length === 0) {
    return stats;
  }

  let totalScore = 0;

  history.forEach(decision => {
    if (decision.recommendation) {
      stats.byRecommendation[decision.recommendation] =
        (stats.byRecommendation[decision.recommendation] || 0) + 1;
    }
    totalScore += decision.score || 0;
  });

  stats.avgScore = Math.round(totalScore / history.length);

  return stats;
}

/**
 * Flatten entity registry into array of entities.
 * @private
 * @param {object} registry
 * @returns {object[]}
 */
function flattenEntities(registry) {
  const entities = [];

  if (!registry.entities) {
    return entities;
  }

  Object.entries(registry.entities).forEach(([type, typeEntities]) => {
    if (Array.isArray(typeEntities)) {
      typeEntities.forEach(entity => {
        entities.push({
          ...entity,
          type
        });
      });
    }
  });

  return entities;
}
