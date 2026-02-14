/**
 * @fileoverview Manages execution mode transitions for chati.dev
 * Handles human-in-the-loop vs autonomous execution modes
 */

import { loadSession, updateSession } from '../orchestrator/session-manager.js';

export const EXECUTION_MODES = {
  HUMAN_IN_THE_LOOP: 'human-in-the-loop',
  AUTONOMOUS: 'autonomous',
};

// Agents that ALWAYS require human validation
const ALWAYS_HUMAN_AGENTS = ['brief', 'deviation'];

/**
 * Get current execution mode from session.
 * @param {string} projectDir
 * @returns {{ mode: string, setAt: string|null, reason: string|null }}
 */
export function getCurrentMode(projectDir) {
  const result = loadSession(projectDir);

  if (!result.loaded || !result.session) {
    return {
      mode: EXECUTION_MODES.HUMAN_IN_THE_LOOP,
      setAt: null,
      reason: null,
    };
  }

  const session = result.session;

  if (!session.execution_mode) {
    return {
      mode: EXECUTION_MODES.HUMAN_IN_THE_LOOP,
      setAt: null,
      reason: null,
    };
  }

  return {
    mode: session.execution_mode.mode || EXECUTION_MODES.HUMAN_IN_THE_LOOP,
    setAt: session.execution_mode.setAt || null,
    reason: session.execution_mode.reason || null,
  };
}

/**
 * Set execution mode with reason and persist to session.
 * @param {string} projectDir
 * @param {string} mode - 'human-in-the-loop' | 'autonomous'
 * @param {string} reason - Why this mode was selected
 * @returns {{ set: boolean, previous: string }}
 */
export function setExecutionMode(projectDir, mode, reason) {
  if (!Object.values(EXECUTION_MODES).includes(mode)) {
    throw new Error(`Invalid execution mode: ${mode}`);
  }

  const result = loadSession(projectDir);

  if (!result.loaded || !result.session) {
    return {
      set: false,
      previous: EXECUTION_MODES.HUMAN_IN_THE_LOOP,
      error: result.error || 'Failed to load session',
    };
  }

  const session = result.session;
  const previous = session.execution_mode?.mode || EXECUTION_MODES.HUMAN_IN_THE_LOOP;

  // Initialize mode_transitions array if it doesn't exist
  if (!session.mode_transitions) {
    session.mode_transitions = [];
  }

  // Record the transition
  const transition = {
    from: previous,
    to: mode,
    timestamp: new Date().toISOString(),
    reason,
  };

  session.mode_transitions.push(transition);

  // Update current mode
  const updates = {
    execution_mode: {
      mode,
      setAt: transition.timestamp,
      reason,
    },
    mode_transitions: session.mode_transitions,
  };

  updateSession(projectDir, updates);

  return {
    set: true,
    previous,
  };
}

/**
 * Check if current mode allows autonomous action for a given agent.
 * Even in autonomous mode, some agents always require human input (brief, deviation).
 * @param {string} mode
 * @param {string} agentName
 * @returns {{ allowed: boolean, reason: string }}
 */
export function canActAutonomously(mode, agentName) {
  // Brief and deviation ALWAYS require human input
  if (ALWAYS_HUMAN_AGENTS.includes(agentName)) {
    return {
      allowed: false,
      reason: `${agentName} always requires human interaction`,
    };
  }

  // In human-in-the-loop mode, nothing is autonomous
  if (mode === EXECUTION_MODES.HUMAN_IN_THE_LOOP) {
    return {
      allowed: false,
      reason: 'Human-in-the-loop mode requires user validation',
    };
  }

  // In autonomous mode, all non-always-human agents can act autonomously
  return {
    allowed: true,
    reason: 'Autonomous mode enabled for this agent',
  };
}

/**
 * Get agents that ALWAYS require human validation regardless of mode.
 * @returns {string[]}
 */
export function getAlwaysHumanAgents() {
  return [...ALWAYS_HUMAN_AGENTS];
}

/**
 * Get mode transition history.
 * @param {string} projectDir
 * @returns {object[]}
 */
export function getModeHistory(projectDir) {
  const result = loadSession(projectDir);
  if (!result.loaded || !result.session) {
    return [];
  }
  return result.session.mode_transitions || [];
}

/**
 * Clear execution mode (reset to default).
 * @param {string} projectDir
 * @returns {{ cleared: boolean }}
 */
export function clearExecutionMode(projectDir) {
  const result = loadSession(projectDir);

  if (!result.loaded || !result.session) {
    return {
      cleared: false,
      error: result.error || 'Failed to load session',
    };
  }

  const previous = result.session.execution_mode;

  updateSession(projectDir, { execution_mode: null });

  return {
    cleared: true,
    previous: previous || null,
  };
}

/**
 * Get mode statistics from history.
 * @param {string} projectDir
 * @returns {{ totalTransitions: number, timeInAutonomous: number, timeInHuman: number, currentStreak: number }}
 */
export function getModeStatistics(projectDir) {
  const history = getModeHistory(projectDir);
  const current = getCurrentMode(projectDir);

  let timeInAutonomous = 0;
  let timeInHuman = 0;
  let currentStreak = 0;

  for (let i = 0; i < history.length; i++) {
    const transition = history[i];
    const nextTransition = history[i + 1];

    // Calculate time in each mode
    if (nextTransition) {
      const duration = new Date(nextTransition.timestamp) - new Date(transition.timestamp);
      if (transition.to === EXECUTION_MODES.AUTONOMOUS) {
        timeInAutonomous += duration;
      } else {
        timeInHuman += duration;
      }
    }

    // Calculate current streak
    if (transition.to === current.mode) {
      currentStreak++;
    } else {
      currentStreak = 0;
    }
  }

  return {
    totalTransitions: history.length,
    timeInAutonomous: Math.floor(timeInAutonomous / 1000), // seconds
    timeInHuman: Math.floor(timeInHuman / 1000), // seconds
    currentStreak,
  };
}
