import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const BRACKETS = [
  { name: 'FRESH',    min: 60, max: 100, layers: ['L0', 'L1', 'L2', 'L3', 'L4'], budget: 2500 },
  { name: 'MODERATE', min: 40, max: 60,  layers: ['L0', 'L1', 'L2', 'L3', 'L4'], budget: 2000 },
  { name: 'DEPLETED', min: 25, max: 40,  layers: ['L0', 'L1', 'L2'],             budget: 1500 },
  { name: 'CRITICAL', min: 0,  max: 25,  layers: ['L0', 'L1'],                   budget: 800 },
];

/**
 * Get context status based on session state
 * (Advisory — actual bracket is calculated at runtime by the orchestrator)
 */
export function getContextStatus(targetDir) {
  const sessionPath = join(targetDir, '.chati', 'session.yaml');
  if (!existsSync(sessionPath)) {
    return {
      bracket: 'FRESH',
      activeLayers: BRACKETS[0].layers,
      tokenBudget: BRACKETS[0].budget,
      memoryLevel: 'none',
      advisory: 'No active session — default FRESH bracket',
    };
  }

  // Read session to determine pipeline state
  const sessionContent = readFileSync(sessionPath, 'utf-8');
  const currentAgent = extractYamlValue(sessionContent, 'current_agent');
  const state = extractYamlValue(sessionContent, 'state');

  // Count completed agents as a rough proxy for context usage
  const completedCount = (sessionContent.match(/status: completed/g) || []).length;
  const inProgressCount = (sessionContent.match(/status: in_progress/g) || []).length;

  // Estimate context usage based on pipeline progress
  // More agents completed = more context consumed
  const estimatedUsage = Math.min(95, completedCount * 8 + inProgressCount * 5);
  const remainingPercent = 100 - estimatedUsage;

  const bracket = BRACKETS.find(b => remainingPercent >= b.min && remainingPercent <= b.max) || BRACKETS[0];

  const memoryLevels = { FRESH: 'none', MODERATE: 'metadata', DEPLETED: 'chunks', CRITICAL: 'full' };

  return {
    bracket: bracket.name,
    activeLayers: bracket.layers,
    tokenBudget: bracket.budget,
    memoryLevel: memoryLevels[bracket.name],
    remainingPercent,
    estimatedUsage,
    currentAgent: currentAgent || 'none',
    pipelineState: state || 'unknown',
    completedAgents: completedCount,
    advisory: `Estimated bracket based on pipeline progress (${completedCount} agents completed)`,
  };
}

/**
 * Estimate context usage for display purposes
 */
export function estimateContextUsage(targetDir) {
  const status = getContextStatus(targetDir);
  return {
    bracket: status.bracket,
    remainingPercent: status.remainingPercent,
    tokenBudget: status.tokenBudget,
    layers: status.activeLayers,
  };
}

/**
 * Simple YAML value extractor (avoids js-yaml dependency)
 */
function extractYamlValue(content, key) {
  const regex = new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm');
  const match = content.match(regex);
  if (!match) return null;
  return match[1].trim().replace(/^["']|["']$/g, '');
}
