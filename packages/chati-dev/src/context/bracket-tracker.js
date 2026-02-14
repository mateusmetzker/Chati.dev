/**
 * Bracket Tracker — Pure arithmetic for context window management.
 *
 * Brackets determine how much context to inject:
 *   FRESH    (60-100%) → All 5 layers active
 *   MODERATE (40-60%)  → L0 + L1 + L2 + L3 (skip L4 task detail)
 *   DEPLETED (25-40%)  → L0 + L1 + L2 only
 *   CRITICAL (<25%)    → L0 + L1 only (handoff mandatory)
 */

const BRACKETS = {
  FRESH:    { min: 60, max: 100, layers: ['L0', 'L1', 'L2', 'L3', 'L4'], tokenBudget: 8000 },
  MODERATE: { min: 40, max: 60,  layers: ['L0', 'L1', 'L2', 'L3'],       tokenBudget: 5000 },
  DEPLETED: { min: 25, max: 40,  layers: ['L0', 'L1', 'L2'],             tokenBudget: 3000 },
  CRITICAL: { min: 0,  max: 25,  layers: ['L0', 'L1'],                   tokenBudget: 1500 },
};

const MEMORY_LEVELS = {
  FRESH:    'full',
  MODERATE: 'chunks',
  DEPLETED: 'metadata',
  CRITICAL: 'none',
};

/**
 * Calculate bracket from remaining context percentage.
 * @param {number} remainingPercent - 0 to 100
 * @returns {{ bracket: string, activeLayers: string[], tokenBudget: number, memoryLevel: string, handoffRequired: boolean }}
 */
export function calculateBracket(remainingPercent) {
  const pct = Math.max(0, Math.min(100, remainingPercent));

  let name = 'CRITICAL';
  if (pct >= 60) name = 'FRESH';
  else if (pct >= 40) name = 'MODERATE';
  else if (pct >= 25) name = 'DEPLETED';

  const def = BRACKETS[name];
  return {
    bracket: name,
    activeLayers: [...def.layers],
    tokenBudget: def.tokenBudget,
    memoryLevel: MEMORY_LEVELS[name],
    handoffRequired: pct < 15,
    remainingPercent: pct,
  };
}

/**
 * Estimate remaining context percentage from prompt/turn count.
 * Heuristic: each turn consumes ~2-4% of context window.
 * @param {number} turnCount - Number of conversation turns so far
 * @param {number} [maxTurns=40] - Estimated max turns before context exhaustion
 * @returns {number} Estimated remaining percentage (0-100)
 */
export function estimateRemaining(turnCount, maxTurns = 40) {
  const used = Math.min(turnCount, maxTurns) / maxTurns;
  return Math.round((1 - used) * 100);
}

/**
 * Check if a specific layer is active for a given bracket.
 * @param {string} bracket - FRESH, MODERATE, DEPLETED, or CRITICAL
 * @param {string} layer - L0, L1, L2, L3, or L4
 * @returns {boolean}
 */
export function isLayerActive(bracket, layer) {
  const def = BRACKETS[bracket];
  if (!def) return false;
  return def.layers.includes(layer);
}

/**
 * Get all bracket definitions (for display/dashboard).
 * @returns {Record<string, { min: number, max: number, layers: string[], tokenBudget: number }>}
 */
export function getBracketDefinitions() {
  return { ...BRACKETS };
}
