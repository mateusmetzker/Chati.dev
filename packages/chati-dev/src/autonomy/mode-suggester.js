/**
 * @fileoverview Suggests optimal execution mode based on project context
 * Analyzes risk factors to recommend human-in-the-loop vs autonomous execution
 */

import { EXECUTION_MODES } from './mode-manager.js';

// Factor weights for mode suggestion
const WEIGHTS = {
  GREENFIELD: 30,
  HIGH_TASK_COUNT: 20,
  RISK_DOMAIN: 25,
  HAS_HISTORY: 25,
  RECENT_GOTCHA: 15,
};

// Risk domains that increase score towards human-in-the-loop
const HIGH_RISK_DOMAINS = [
  'security',
  'database',
  'infrastructure',
  'authentication',
  'authorization',
  'payment',
  'data-migration',
  'encryption',
];

/**
 * Suggest execution mode based on project context.
 *
 * Factors:
 * - Project type: greenfield → human (higher risk), brownfield → autonomous
 * - Complexity: high (>10 tasks) → human, low → autonomous
 * - Risk: security/infra → human, UI/docs → autonomous
 * - History: first time → human, executed before → autonomous
 * - Gotchas: recent gotchas in domain → human
 *
 * @param {object} context
 * @param {boolean} context.isGreenfield
 * @param {number} [context.taskCount] - Estimated task count
 * @param {string[]} [context.riskDomains] - e.g. ['security', 'database', 'infrastructure']
 * @param {boolean} [context.hasHistory] - Project was built before
 * @param {number} [context.recentGotchas] - Number of recent gotchas
 * @returns {{ suggestion: string, confidence: number, factors: object[], reasoning: string }}
 */
export function suggestMode(context) {
  const factors = [];
  let humanScore = 0;

  // Factor 1: Project type
  if (context.isGreenfield) {
    humanScore += WEIGHTS.GREENFIELD;
    factors.push({
      name: 'project_type',
      value: 'greenfield',
      impact: WEIGHTS.GREENFIELD,
      direction: 'human',
      reason: 'Greenfield projects have higher uncertainty',
    });
  } else {
    humanScore -= WEIGHTS.GREENFIELD;
    factors.push({
      name: 'project_type',
      value: 'brownfield',
      impact: -WEIGHTS.GREENFIELD,
      direction: 'autonomous',
      reason: 'Brownfield projects have established patterns',
    });
  }

  // Factor 2: Task complexity
  const taskCount = context.taskCount || 0;
  if (taskCount > 10) {
    humanScore += WEIGHTS.HIGH_TASK_COUNT;
    factors.push({
      name: 'task_count',
      value: taskCount,
      impact: WEIGHTS.HIGH_TASK_COUNT,
      direction: 'human',
      reason: `High task count (${taskCount}) increases complexity`,
    });
  } else if (taskCount > 0) {
    factors.push({
      name: 'task_count',
      value: taskCount,
      impact: 0,
      direction: 'neutral',
      reason: `Moderate task count (${taskCount}) is manageable`,
    });
  }

  // Factor 3: Risk domains
  const riskDomains = context.riskDomains || [];
  const highRiskCount = riskDomains.filter(domain =>
    HIGH_RISK_DOMAINS.includes(domain.toLowerCase())
  ).length;

  if (highRiskCount > 0) {
    const riskImpact = Math.min(highRiskCount * WEIGHTS.RISK_DOMAIN, 75); // Cap at 75
    humanScore += riskImpact;
    factors.push({
      name: 'risk_domains',
      value: riskDomains,
      impact: riskImpact,
      direction: 'human',
      reason: `High-risk domains detected: ${riskDomains.join(', ')}`,
    });
  } else if (riskDomains.length > 0) {
    factors.push({
      name: 'risk_domains',
      value: riskDomains,
      impact: 0,
      direction: 'neutral',
      reason: `Low-risk domains: ${riskDomains.join(', ')}`,
    });
  }

  // Factor 4: Project history
  if (context.hasHistory) {
    humanScore -= WEIGHTS.HAS_HISTORY;
    factors.push({
      name: 'history',
      value: true,
      impact: -WEIGHTS.HAS_HISTORY,
      direction: 'autonomous',
      reason: 'Project has been built before',
    });
  } else {
    humanScore += WEIGHTS.HAS_HISTORY;
    factors.push({
      name: 'history',
      value: false,
      impact: WEIGHTS.HAS_HISTORY,
      direction: 'human',
      reason: 'First-time project execution',
    });
  }

  // Factor 5: Recent gotchas
  const recentGotchas = context.recentGotchas || 0;
  if (recentGotchas > 0) {
    const gotchaImpact = Math.min(recentGotchas * WEIGHTS.RECENT_GOTCHA, 45); // Cap at 3 gotchas
    humanScore += gotchaImpact;
    factors.push({
      name: 'gotchas',
      value: recentGotchas,
      impact: gotchaImpact,
      direction: 'human',
      reason: `${recentGotchas} recent gotcha(s) detected`,
    });
  }

  // Calculate confidence based on factor strength
  const totalImpact = factors.reduce((sum, f) => sum + Math.abs(f.impact), 0);
  const confidence = Math.min(Math.round((totalImpact / 150) * 100), 100);

  // Determine suggestion
  const suggestion = humanScore > 50
    ? EXECUTION_MODES.HUMAN_IN_THE_LOOP
    : EXECUTION_MODES.AUTONOMOUS;

  // Build reasoning
  const reasoning = buildReasoning(suggestion, humanScore, factors);

  return {
    suggestion,
    confidence,
    factors,
    reasoning,
    score: humanScore,
  };
}

/**
 * Calculate risk score from project context.
 * @param {object} context
 * @returns {{ score: number, level: 'low'|'medium'|'high', factors: string[] }}
 */
export function calculateRiskScore(context) {
  const riskFactors = [];
  let score = 0;

  // Greenfield adds base risk
  if (context.isGreenfield) {
    score += 25;
    riskFactors.push('greenfield project');
  }

  // High task count adds complexity risk
  if (context.taskCount > 10) {
    score += 20;
    riskFactors.push(`high task count (${context.taskCount})`);
  } else if (context.taskCount > 5) {
    score += 10;
    riskFactors.push(`moderate task count (${context.taskCount})`);
  }

  // Risk domains
  const riskDomains = context.riskDomains || [];
  const highRiskCount = riskDomains.filter(domain =>
    HIGH_RISK_DOMAINS.includes(domain.toLowerCase())
  ).length;

  score += highRiskCount * 15;
  if (highRiskCount > 0) {
    riskFactors.push(`${highRiskCount} high-risk domain(s)`);
  }

  // No history adds risk
  if (!context.hasHistory) {
    score += 15;
    riskFactors.push('no project history');
  }

  // Recent gotchas
  if (context.recentGotchas > 0) {
    score += Math.min(context.recentGotchas * 10, 30);
    riskFactors.push(`${context.recentGotchas} recent gotcha(s)`);
  }

  // Determine level
  let level;
  if (score < 30) {
    level = 'low';
  } else if (score < 60) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return {
    score,
    level,
    factors: riskFactors,
  };
}

/**
 * Build human-readable reasoning for mode suggestion.
 * @param {string} suggestion
 * @param {number} score
 * @param {object[]} factors
 * @returns {string}
 */
function buildReasoning(suggestion, score, factors) {
  const lines = [];

  if (suggestion === EXECUTION_MODES.HUMAN_IN_THE_LOOP) {
    lines.push(`Recommending human-in-the-loop mode (score: ${Math.round(score)}/100 towards human).`);
  } else {
    lines.push(`Recommending autonomous mode (score: ${Math.round(score)}/100 towards human, below threshold).`);
  }

  const humanFactors = factors.filter(f => f.direction === 'human');
  const autoFactors = factors.filter(f => f.direction === 'autonomous');

  if (humanFactors.length > 0) {
    lines.push('');
    lines.push('Factors favoring human validation:');
    humanFactors.forEach(f => {
      lines.push(`  • ${f.reason} (+${f.impact})`);
    });
  }

  if (autoFactors.length > 0) {
    lines.push('');
    lines.push('Factors favoring autonomous execution:');
    autoFactors.forEach(f => {
      lines.push(`  • ${f.reason} (${f.impact})`);
    });
  }

  return lines.join('\n');
}

/**
 * Get high-risk domain list.
 * @returns {string[]}
 */
export function getHighRiskDomains() {
  return [...HIGH_RISK_DOMAINS];
}
