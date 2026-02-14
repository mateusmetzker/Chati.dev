/**
 * Commit Message Generator — Produces conventional commit messages from staged changes.
 *
 * Analyzes changed file paths to determine type and scope, then builds
 * a properly formatted conventional commit string.
 *
 * @module scripts/commit-message-generator
 */

import { dirname, basename, extname } from 'node:path';

/**
 * Path-based rules for detecting commit type.
 * Order matters: first match wins.
 *
 * @type {Array<{ pattern: RegExp, type: string }>}
 */
const TYPE_RULES = [
  { pattern: /\.github\/|\.gitlab-ci|Jenkinsfile|\.circleci/i, type: 'ci' },
  { pattern: /\.test\.|\.spec\.|__tests__|test\/|tests\//i, type: 'test' },
  { pattern: /docs\/|\.md$/i, type: 'docs' },
  { pattern: /package\.json$|package-lock\.json$|yarn\.lock$|pnpm-lock/i, type: 'chore' },
  { pattern: /\.eslint|\.prettier|tsconfig|\.editorconfig|\.gitignore/i, type: 'chore' },
  { pattern: /Dockerfile|docker-compose|\.dockerignore/i, type: 'ci' },
  { pattern: /webpack|rollup|vite\.config|esbuild|babel\.config/i, type: 'build' },
];

/**
 * Detects the conventional commit type from a list of changed files.
 *
 * @param {string[]} files — array of file paths (relative)
 * @returns {string}
 */
export function detectCommitType(files) {
  if (!files || files.length === 0) return 'chore';

  const typeCounts = {};

  for (const file of files) {
    let detected = null;
    for (const rule of TYPE_RULES) {
      if (rule.pattern.test(file)) {
        detected = rule.type;
        break;
      }
    }
    // Default to 'feat' for unmatched source files
    if (!detected) {
      detected = 'feat';
    }
    typeCounts[detected] = (typeCounts[detected] || 0) + 1;
  }

  // Pick the type that covers most files
  let maxType = 'chore';
  let maxCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  }

  return maxType;
}

/**
 * Detects the scope from file paths.
 * Uses the common parent directory or module name.
 *
 * @param {string[]} files — array of file paths (relative)
 * @returns {string}
 */
export function detectScope(files) {
  if (!files || files.length === 0) return '';

  // Normalize paths and extract directory parts
  const dirParts = files.map((f) => {
    const dir = dirname(f);
    return dir.split(/[/\\]/).filter(Boolean);
  });

  if (dirParts.length === 0) return '';

  // Single file: use its immediate parent directory
  if (files.length === 1) {
    const parts = dirParts[0];
    if (parts.length === 0 || (parts.length === 1 && parts[0] === '.')) return '';
    return parts[parts.length - 1];
  }

  // Multiple files: find common prefix
  const shortest = Math.min(...dirParts.map((p) => p.length));
  let commonDepth = 0;
  for (let i = 0; i < shortest; i++) {
    const segment = dirParts[0][i];
    if (dirParts.every((p) => p[i] === segment)) {
      commonDepth = i + 1;
    } else {
      break;
    }
  }

  if (commonDepth === 0) return '';

  const commonParts = dirParts[0].slice(0, commonDepth);
  // Skip generic top-level directories for the scope name
  const skipDirs = new Set(['src', 'lib', 'packages', 'apps', 'modules']);
  const meaningful = commonParts.filter((p) => !skipDirs.has(p));

  if (meaningful.length === 0 && commonParts.length > 0) {
    // If all parts are generic, use the deepest one
    return commonParts[commonParts.length - 1];
  }

  return meaningful.length > 0 ? meaningful[meaningful.length - 1] : '';
}

/**
 * Formats a conventional commit message.
 *
 * @param {string} type
 * @param {string} scope
 * @param {string} description
 * @returns {string}
 */
export function formatCommitMessage(type, scope, description) {
  const scopePart = scope ? `(${scope})` : '';
  return `${type}${scopePart}: ${description}`;
}

/**
 * Generates a conventional commit message from options.
 *
 * @param {Object} options
 * @param {string[]} options.files       — list of changed file paths
 * @param {string}   [options.diff]      — git diff string (used for description hints)
 * @param {string}   [options.type]      — override commit type
 * @returns {string}
 */
export function generateCommitMessage(options = {}) {
  const { files = [], type: overrideType } = options;

  if (files.length === 0) {
    return 'chore: update files';
  }

  const type = overrideType || detectCommitType(files);
  const scope = detectScope(files);

  // Generate description from file names
  let description;
  if (files.length === 1) {
    const name = basename(files[0], extname(files[0]));
    const verb = type === 'feat' ? 'add' : type === 'fix' ? 'fix' : 'update';
    description = `${verb} ${name}`;
  } else if (files.length <= 3) {
    const names = files.map((f) => basename(f, extname(f)));
    const verb = type === 'feat' ? 'add' : type === 'fix' ? 'fix' : 'update';
    description = `${verb} ${names.join(', ')}`;
  } else {
    const verb = type === 'feat' ? 'add' : type === 'fix' ? 'fix' : 'update';
    description = `${verb} ${files.length} files`;
  }

  return formatCommitMessage(type, scope, description);
}
