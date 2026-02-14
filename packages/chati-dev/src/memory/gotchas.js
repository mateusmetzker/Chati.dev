import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';

const GOTCHAS_FILE = '.chati/memories/shared/gotchas.json';
const ERROR_LOG_FILE = '.chati/memories/shared/error-log.json';
const ERROR_PATTERN_THRESHOLD = 3; // Promote after 3 occurrences
const ERROR_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const ERROR_RETENTION_DAYS = 7;

/**
 * Normalize error message to detect patterns.
 * Strips numbers, file paths, and specific identifiers.
 * @param {string} message - Error message
 * @returns {string} Normalized message
 */
function normalizeErrorMessage(message) {
  return message
    .replace(/\d+/g, 'N') // Replace numbers with N
    .replace(/\/[^\s]+/g, '/PATH') // Replace paths
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, 'UUID') // UUIDs
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 'EMAIL') // Emails
    .toLowerCase()
    .trim();
}

/**
 * Hash an error message to create a pattern identifier.
 * @param {string} message - Error message
 * @returns {string} Hash (first 8 chars)
 */
function hashErrorMessage(message) {
  const normalized = normalizeErrorMessage(message);
  return createHash('md5').update(normalized).digest('hex').substring(0, 8);
}

/**
 * Load gotchas from disk.
 * @param {string} projectDir - Project directory
 * @returns {object[]} Array of gotcha objects
 */
function loadGotchas(projectDir) {
  const gotchasPath = join(projectDir, GOTCHAS_FILE);
  if (!existsSync(gotchasPath)) {
    return [];
  }
  try {
    const content = readFileSync(gotchasPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Save gotchas to disk.
 * @param {string} projectDir - Project directory
 * @param {object[]} gotchas - Array of gotcha objects
 */
function saveGotchas(projectDir, gotchas) {
  const gotchasPath = join(projectDir, GOTCHAS_FILE);
  const dir = dirname(gotchasPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(gotchasPath, JSON.stringify(gotchas, null, 2), 'utf-8');
}

/**
 * Load error log from disk.
 * @param {string} projectDir - Project directory
 * @returns {object[]} Array of error log entries
 */
function loadErrorLog(projectDir) {
  const errorLogPath = join(projectDir, ERROR_LOG_FILE);
  if (!existsSync(errorLogPath)) {
    return [];
  }
  try {
    const content = readFileSync(errorLogPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Save error log to disk.
 * @param {string} projectDir - Project directory
 * @param {object[]} errorLog - Array of error log entries
 */
function saveErrorLog(projectDir, errorLog) {
  const errorLogPath = join(projectDir, ERROR_LOG_FILE);
  const dir = dirname(errorLogPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(errorLogPath, JSON.stringify(errorLog, null, 2), 'utf-8');
}

/**
 * Generate a unique gotcha ID.
 * @param {object[]} gotchas - Existing gotchas
 * @returns {string} New ID in format G001, G002, etc.
 */
function generateGotchaId(gotchas) {
  const maxId = gotchas.reduce((max, g) => {
    const num = parseInt(g.id.substring(1), 10);
    return num > max ? num : max;
  }, 0);
  return `G${String(maxId + 1).padStart(3, '0')}`;
}

/**
 * Record an error occurrence. If this error has appeared 3+ times in 24h, promote to gotcha.
 * @param {string} projectDir - Project directory
 * @param {object} error - { message, agent, task, context }
 * @returns {{ recorded: boolean, promoted: boolean, gotcha: object|null }}
 */
export function recordError(projectDir, error) {
  const { message, agent, task, context = {} } = error;
  const hash = hashErrorMessage(message);
  const timestamp = new Date().toISOString();

  // Load error log
  const errorLog = loadErrorLog(projectDir);

  // Add new error entry
  errorLog.push({
    message,
    agent,
    task,
    timestamp,
    hash,
    context,
  });

  // Save error log
  saveErrorLog(projectDir, errorLog);

  // Check if this pattern should be promoted
  const now = Date.now();
  const recentErrors = errorLog.filter(e => {
    const errorTime = new Date(e.timestamp).getTime();
    return e.hash === hash && (now - errorTime) <= ERROR_WINDOW_MS;
  });

  if (recentErrors.length >= ERROR_PATTERN_THRESHOLD) {
    // Promote to gotcha
    const gotchas = loadGotchas(projectDir);

    // Check if already exists
    const existingGotcha = gotchas.find(g => g.pattern === hash);

    if (existingGotcha) {
      // Update existing gotcha
      existingGotcha.count = recentErrors.length;
      existingGotcha.last_seen = timestamp;
      saveGotchas(projectDir, gotchas);

      return {
        recorded: true,
        promoted: false,
        gotcha: existingGotcha,
      };
    }

    // Create new gotcha
    const gotchaId = generateGotchaId(gotchas);
    const newGotcha = {
      id: gotchaId,
      pattern: hash,
      message: normalizeErrorMessage(message),
      original_message: message,
      agent,
      task,
      count: recentErrors.length,
      first_seen: recentErrors[0].timestamp,
      last_seen: timestamp,
      promoted_at: timestamp,
      resolution: null,
      context,
    };

    gotchas.push(newGotcha);
    saveGotchas(projectDir, gotchas);

    return {
      recorded: true,
      promoted: true,
      gotcha: newGotcha,
    };
  }

  return {
    recorded: true,
    promoted: false,
    gotcha: null,
  };
}

/**
 * Get all gotchas (promoted errors).
 * @param {string} projectDir - Project directory
 * @returns {object[]} Array of gotcha objects
 */
export function getGotchas(projectDir) {
  return loadGotchas(projectDir);
}

/**
 * Calculate relevance score for a gotcha given a context.
 * @param {object} gotcha - Gotcha object
 * @param {object} context - { agent, task, keywords }
 * @returns {number} Relevance score (0-100)
 */
function calculateRelevance(gotcha, context) {
  let score = 0;

  // Agent match (30 points)
  if (context.agent && gotcha.agent === context.agent) {
    score += 30;
  }

  // Task match (20 points)
  if (context.task && gotcha.task === context.task) {
    score += 20;
  }

  // Keyword matches (50 points total)
  if (context.keywords && Array.isArray(context.keywords)) {
    const gotchaText = `${gotcha.message} ${gotcha.original_message || ''} ${JSON.stringify(gotcha.context || {})}`.toLowerCase();
    const matchedKeywords = context.keywords.filter(kw =>
      gotchaText.includes(kw.toLowerCase())
    );
    const keywordScore = Math.min(50, (matchedKeywords.length / context.keywords.length) * 50);
    score += keywordScore;
  }

  // Only add bonuses if there's some base relevance
  if (score > 0) {
    // Recency bonus (up to 10 points)
    const daysSinceLastSeen = (Date.now() - new Date(gotcha.last_seen).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen < 7) {
      score += 10 * (1 - daysSinceLastSeen / 7);
    }

    // Frequency bonus (up to 10 points)
    const frequencyBonus = Math.min(10, gotcha.count * 2);
    score += frequencyBonus;
  }

  return Math.round(score);
}

/**
 * Get relevant gotchas for a given agent/task context.
 * Matches by agent, task, and error pattern similarity.
 * @param {string} projectDir - Project directory
 * @param {object} context - { agent, task, keywords }
 * @returns {object[]} Relevant gotchas sorted by relevance
 */
export function getRelevantGotchas(projectDir, context) {
  const gotchas = loadGotchas(projectDir);

  const scored = gotchas.map(gotcha => ({
    ...gotcha,
    relevance: calculateRelevance(gotcha, context),
  }));

  return scored
    .filter(g => g.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance);
}

/**
 * Get error tracking statistics.
 * @param {string} projectDir - Project directory
 * @returns {{ totalErrors: number, totalGotchas: number, recentErrors: number, topPatterns: object[] }}
 */
export function getGotchaStats(projectDir) {
  const gotchas = loadGotchas(projectDir);
  const errorLog = loadErrorLog(projectDir);

  const now = Date.now();
  const recentErrors = errorLog.filter(e => {
    const errorTime = new Date(e.timestamp).getTime();
    return (now - errorTime) <= ERROR_WINDOW_MS;
  });

  // Count errors by pattern
  const patternCounts = {};
  errorLog.forEach(e => {
    patternCounts[e.hash] = (patternCounts[e.hash] || 0) + 1;
  });

  const topPatterns = Object.entries(patternCounts)
    .map(([hash, count]) => {
      const gotcha = gotchas.find(g => g.pattern === hash);
      return {
        hash,
        count,
        message: gotcha ? gotcha.message : 'Unknown pattern',
        promoted: !!gotcha,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalErrors: errorLog.length,
    totalGotchas: gotchas.length,
    recentErrors: recentErrors.length,
    topPatterns,
  };
}

/**
 * Clear expired error entries (older than 7 days).
 * @param {string} projectDir - Project directory
 * @returns {{ cleared: number }}
 */
export function clearExpiredErrors(projectDir) {
  const errorLog = loadErrorLog(projectDir);
  const retentionMs = ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const originalCount = errorLog.length;
  const filtered = errorLog.filter(e => {
    const errorTime = new Date(e.timestamp).getTime();
    return (now - errorTime) <= retentionMs;
  });

  saveErrorLog(projectDir, filtered);

  return {
    cleared: originalCount - filtered.length,
  };
}

/**
 * Update gotcha resolution.
 * @param {string} projectDir - Project directory
 * @param {string} gotchaId - Gotcha ID
 * @param {string} resolution - Resolution description
 * @returns {{ updated: boolean }}
 */
export function updateGotchaResolution(projectDir, gotchaId, resolution) {
  const gotchas = loadGotchas(projectDir);
  const gotcha = gotchas.find(g => g.id === gotchaId);

  if (!gotcha) {
    return { updated: false };
  }

  gotcha.resolution = resolution;
  gotcha.resolved_at = new Date().toISOString();
  saveGotchas(projectDir, gotchas);

  return { updated: true };
}
