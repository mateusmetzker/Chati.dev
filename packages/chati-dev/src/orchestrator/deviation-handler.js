/**
 * Deviation Handler — Detects and manages pipeline deviations.
 *
 * Handles user requests that deviate from the planned pipeline flow,
 * such as scope changes, rollbacks, skips, and priority adjustments.
 */

/**
 * Deviation types.
 */
export const DEVIATION_TYPES = {
  SCOPE_CHANGE: 'scope_change',       // User wants to add/remove features
  PRIORITY_CHANGE: 'priority_change', // User wants different order
  ROLLBACK: 'rollback',               // User wants to go back to previous agent
  SKIP: 'skip',                       // User wants to skip an agent
  RESTART: 'restart',                 // User wants to start over
};

/**
 * Keywords for each deviation type.
 */
const DEVIATION_KEYWORDS = {
  [DEVIATION_TYPES.SCOPE_CHANGE]: [
    'also add', 'also need', 'new feature', 'add feature',
    'remove', 'drop', 'forget about', 'forgot about',
    'include', 'exclude', 'extend', 'reduce',
  ],
  [DEVIATION_TYPES.ROLLBACK]: [
    'go back', 'back to', 'return to', 'revert to',
    'redo the', 'restart from',
  ],
  [DEVIATION_TYPES.SKIP]: [
    'skip', "don't need", 'not necessary', 'bypass',
    'omit', 'ignore', 'leave out',
  ],
  [DEVIATION_TYPES.PRIORITY_CHANGE]: [
    'do first', 'more important', 'prioritize',
    'instead of', 'before that',
    'urgent', 'higher priority', 'switch order',
  ],
  [DEVIATION_TYPES.RESTART]: [
    'start over', 'from scratch', 'begin again',
    'fresh start', 'restart project', 'restart the',
    'redo everything',
  ],
};

/**
 * Detect if a user request is a deviation from the current pipeline.
 *
 * @param {string} userMessage - User's input
 * @param {object} _pipelineState - Current pipeline state (reserved for future use)
 * @returns {{ isDeviation: boolean, type: string|null, confidence: number, details: string }}
 */
export function detectDeviation(userMessage, _pipelineState) {
  const messageLower = userMessage.toLowerCase();
  const scores = {};

  // Check each deviation type
  for (const [type, keywords] of Object.entries(DEVIATION_KEYWORDS)) {
    let matchCount = 0;
    for (const kw of keywords) {
      // Split multi-word keywords and check if all words appear
      const keywordWords = kw.split(/\s+/);
      const allWordsPresent = keywordWords.every(word => messageLower.includes(word));
      if (allWordsPresent) {
        matchCount++;
      }
    }
    scores[type] = matchCount;
  }

  // Find highest score
  const maxScore = Math.max(...Object.values(scores));

  if (maxScore === 0) {
    return {
      isDeviation: false,
      type: null,
      confidence: 0,
      details: 'No deviation indicators detected',
    };
  }

  const deviationType = Object.entries(scores)
    .find(([, score]) => score === maxScore)[0];

  // Calculate confidence (0-100)
  const confidence = Math.min(100, Math.round((maxScore / 3) * 100));

  return {
    isDeviation: maxScore > 0, // Any keyword match counts as deviation
    type: deviationType,
    confidence,
    details: `Detected ${maxScore} keyword match(es) for ${deviationType}`,
  };
}

/**
 * Analyze impact of a deviation.
 *
 * @param {string} deviationType
 * @param {object} pipelineState
 * @param {object} [details] - { targetAgent, addedFeatures, removedFeatures }
 * @returns {{ impact: 'low'|'medium'|'high', affectedAgents: string[], recommendation: string, requiresConfirmation: boolean }}
 */
export function analyzeDeviationImpact(deviationType, pipelineState, details = {}) {
  const currentAgent = pipelineState.current_agent;
  const completedAgents = Object.entries(pipelineState.agents || {})
    .filter(([, data]) => data.status === 'completed')
    .map(([name]) => name);

  switch (deviationType) {
    case DEVIATION_TYPES.SCOPE_CHANGE: {
      const affectedAgents = [];

      // If we're past brief/detail, need to re-validate architecture
      if (completedAgents.includes('detail') || completedAgents.includes('architect')) {
        affectedAgents.push('architect', 'phases', 'tasks');
      }

      const impact = affectedAgents.length > 0 ? 'medium' : 'low';

      return {
        impact,
        affectedAgents,
        recommendation: impact === 'medium'
          ? 'Scope changes require re-validation of architecture and task breakdown'
          : 'Scope changes can be integrated into current planning',
        requiresConfirmation: impact !== 'low',
      };
    }

    case DEVIATION_TYPES.ROLLBACK: {
      const targetAgent = details.targetAgent;

      if (!targetAgent) {
        return {
          impact: 'high',
          affectedAgents: [],
          recommendation: 'Target agent for rollback must be specified',
          requiresConfirmation: true,
        };
      }

      // Find agents completed after target
      const agentOrder = Object.keys(pipelineState.agents || {});
      const targetIndex = agentOrder.indexOf(targetAgent);
      const currentIndex = agentOrder.indexOf(currentAgent);

      const affectedAgents = agentOrder.slice(targetIndex + 1, currentIndex + 1);

      return {
        impact: 'high',
        affectedAgents,
        recommendation: `Rollback to ${targetAgent} will undo work from ${affectedAgents.length} agent(s)`,
        requiresConfirmation: true,
      };
    }

    case DEVIATION_TYPES.SKIP: {
      // Can only skip agents that haven't started
      const agentsList = Object.keys(pipelineState.agents || {});
      const currentIndex = agentsList.indexOf(currentAgent);

      const affectedAgents = agentsList.slice(currentIndex + 1, currentIndex + 2);

      return {
        impact: 'medium',
        affectedAgents,
        recommendation: 'Skipping agents may result in incomplete planning or missing validations',
        requiresConfirmation: true,
      };
    }

    case DEVIATION_TYPES.PRIORITY_CHANGE: {
      return {
        impact: 'low',
        affectedAgents: [],
        recommendation: 'Priority changes within current phase are generally safe',
        requiresConfirmation: false,
      };
    }

    case DEVIATION_TYPES.RESTART: {
      return {
        impact: 'high',
        affectedAgents: completedAgents,
        recommendation: 'Restart will discard all progress and begin from initial work understanding',
        requiresConfirmation: true,
      };
    }

    default:
      return {
        impact: 'medium',
        affectedAgents: [],
        recommendation: 'Unknown deviation type',
        requiresConfirmation: true,
      };
  }
}

/**
 * Apply a deviation to the pipeline state.
 *
 * @param {object} pipelineState
 * @param {string} deviationType
 * @param {object} details
 * @returns {{ state: object, applied: boolean, changes: string[] }}
 */
export function applyDeviation(pipelineState, deviationType, details) {
  const changes = [];
  const newState = JSON.parse(JSON.stringify(pipelineState)); // Deep clone

  try {
    switch (deviationType) {
      case DEVIATION_TYPES.SCOPE_CHANGE: {
        // Add to backlog
        if (details.addedFeatures) {
          newState.backlog = newState.backlog || [];
          for (const feature of details.addedFeatures) {
            newState.backlog.push({
              type: 'feature',
              description: feature,
              added_at: new Date().toISOString(),
            });
            changes.push(`Added feature: ${feature}`);
          }
        }

        if (details.removedFeatures) {
          // Mark features as removed (don't delete history)
          newState.backlog = newState.backlog || [];
          for (const feature of details.removedFeatures) {
            newState.backlog.push({
              type: 'feature_removal',
              description: feature,
              removed_at: new Date().toISOString(),
            });
            changes.push(`Removed feature: ${feature}`);
          }
        }

        break;
      }

      case DEVIATION_TYPES.ROLLBACK: {
        const targetAgent = details.targetAgent;

        if (!targetAgent) {
          return {
            state: pipelineState,
            applied: false,
            changes: ['Target agent not specified'],
          };
        }

        // Reset all agents after target
        const agentOrder = Object.keys(newState.agents);
        const targetIndex = agentOrder.indexOf(targetAgent);

        for (let i = targetIndex + 1; i < agentOrder.length; i++) {
          const agentName = agentOrder[i];
          newState.agents[agentName].status = 'pending';
          newState.agents[agentName].score = 0;
          newState.agents[agentName].completed_at = null;
          changes.push(`Reset agent: ${agentName}`);
        }

        newState.current_agent = targetAgent;
        changes.push(`Rolled back to: ${targetAgent}`);

        break;
      }

      case DEVIATION_TYPES.SKIP: {
        const agentToSkip = details.agentName;

        if (!agentToSkip) {
          return {
            state: pipelineState,
            applied: false,
            changes: ['Agent to skip not specified'],
          };
        }

        if (newState.agents[agentToSkip]) {
          newState.agents[agentToSkip].status = 'skipped';
          changes.push(`Skipped agent: ${agentToSkip}`);
        }

        break;
      }

      case DEVIATION_TYPES.RESTART: {
        // Reset all agents
        for (const agentName of Object.keys(newState.agents)) {
          newState.agents[agentName].status = 'pending';
          newState.agents[agentName].score = 0;
          newState.agents[agentName].completed_at = null;
        }

        // Reset to initial state
        newState.current_agent = '';
        newState.backlog = [];
        changes.push('Reset all agents to initial state');

        break;
      }

      default:
        return {
          state: pipelineState,
          applied: false,
          changes: ['Unknown deviation type'],
        };
    }

    // Record deviation in history
    newState.deviations = newState.deviations || [];
    newState.deviations.push({
      type: deviationType,
      details,
      applied_at: new Date().toISOString(),
      changes,
    });

    return {
      state: newState,
      applied: true,
      changes,
    };
  } catch (err) {
    return {
      state: pipelineState,
      applied: false,
      changes: [`Error applying deviation: ${err.message}`],
    };
  }
}

/**
 * Get deviation history from session.
 * @param {object} pipelineState
 * @returns {object[]}
 */
export function getDeviationHistory(pipelineState) {
  return pipelineState.deviations || [];
}
