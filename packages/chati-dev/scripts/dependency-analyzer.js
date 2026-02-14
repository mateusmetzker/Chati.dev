/**
 * Dependency Analyzer — Inspects project dependencies for issues and metrics.
 *
 * Reads package.json and optional lock files to produce a comprehensive
 * dependency report including counts, version patterns, and potential problems.
 *
 * @module scripts/dependency-analyzer
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Object} Issue
 * @property {string} severity — 'error' | 'warning' | 'info'
 * @property {string} name     — dependency name
 * @property {string} message
 */

/**
 * @typedef {Object} DependencyStats
 * @property {number} total
 * @property {number} prod
 * @property {number} dev
 * @property {number} peer
 * @property {number} optional
 */

/**
 * @typedef {Object} DependencyReport
 * @property {DependencyStats} stats
 * @property {Issue[]} issues
 * @property {string[]} prodDeps
 * @property {string[]} devDeps
 * @property {string[]} peerDeps
 * @property {string[]} optionalDeps
 * @property {string[]} duplicatesAcrossGroups
 * @property {boolean} hasLockFile
 */

/**
 * Safely reads and parses a JSON file.
 * @param {string} filePath
 * @returns {Object|null}
 */
function readJSON(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Gets basic dependency counts from a target directory.
 *
 * @param {string} targetDir
 * @returns {DependencyStats}
 */
export function getDependencyStats(targetDir) {
  const pkg = readJSON(join(targetDir, 'package.json'));
  if (!pkg) {
    return { total: 0, prod: 0, dev: 0, peer: 0, optional: 0 };
  }

  const prod = Object.keys(pkg.dependencies || {}).length;
  const dev = Object.keys(pkg.devDependencies || {}).length;
  const peer = Object.keys(pkg.peerDependencies || {}).length;
  const optional = Object.keys(pkg.optionalDependencies || {}).length;

  return {
    total: prod + dev + peer + optional,
    prod,
    dev,
    peer,
    optional,
  };
}

/**
 * Checks dependencies for common issues.
 *
 * @param {Record<string, string>} deps — name-to-version map
 * @param {string} group — group label ('prod', 'dev', etc.)
 * @returns {Issue[]}
 */
export function checkForIssues(deps, group = 'prod') {
  const issues = [];

  for (const [name, version] of Object.entries(deps)) {
    // Wildcard version
    if (version === '*' || version === 'latest') {
      issues.push({
        severity: 'error',
        name,
        message: `${group} dependency "${name}" uses wildcard version "${version}" — pin to a specific range`,
      });
    }

    // URL-based version (git, http)
    if (/^(git|http|https|ssh|file):/.test(version) || version.includes('github.com')) {
      issues.push({
        severity: 'warning',
        name,
        message: `${group} dependency "${name}" uses a URL-based version — may cause reproducibility issues`,
      });
    }

    // Very broad range (>= without upper bound)
    if (/^>=/.test(version) && !version.includes('<') && !version.includes(' ')) {
      issues.push({
        severity: 'warning',
        name,
        message: `${group} dependency "${name}" has an unbounded lower version "${version}"`,
      });
    }

    // Version 0.x (potentially unstable)
    if (/^[\^~]?0\./.test(version)) {
      issues.push({
        severity: 'info',
        name,
        message: `${group} dependency "${name}" is pre-1.0 (${version}) — API may be unstable`,
      });
    }

    // Empty version
    if (!version || version.trim() === '') {
      issues.push({
        severity: 'error',
        name,
        message: `${group} dependency "${name}" has an empty version`,
      });
    }
  }

  return issues;
}

/**
 * Full dependency analysis for a target directory.
 *
 * @param {string} targetDir
 * @returns {DependencyReport}
 */
export function analyzeDependencies(targetDir) {
  const pkg = readJSON(join(targetDir, 'package.json'));
  if (!pkg) {
    return {
      stats: { total: 0, prod: 0, dev: 0, peer: 0, optional: 0 },
      issues: [{ severity: 'error', name: '-', message: 'No package.json found' }],
      prodDeps: [],
      devDeps: [],
      peerDeps: [],
      optionalDeps: [],
      duplicatesAcrossGroups: [],
      hasLockFile: false,
    };
  }

  const prodDeps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  const peerDeps = pkg.peerDependencies || {};
  const optionalDeps = pkg.optionalDependencies || {};

  const stats = getDependencyStats(targetDir);

  // Collect issues from all groups
  const issues = [
    ...checkForIssues(prodDeps, 'prod'),
    ...checkForIssues(devDeps, 'dev'),
    ...checkForIssues(peerDeps, 'peer'),
    ...checkForIssues(optionalDeps, 'optional'),
  ];

  // Find duplicates across prod and dev
  const prodNames = new Set(Object.keys(prodDeps));
  const devNames = new Set(Object.keys(devDeps));
  const duplicatesAcrossGroups = [...prodNames].filter((n) => devNames.has(n));

  if (duplicatesAcrossGroups.length > 0) {
    for (const dup of duplicatesAcrossGroups) {
      issues.push({
        severity: 'warning',
        name: dup,
        message: `"${dup}" appears in both dependencies and devDependencies`,
      });
    }
  }

  // Check for lock file
  const hasLockFile =
    existsSync(join(targetDir, 'package-lock.json')) ||
    existsSync(join(targetDir, 'yarn.lock')) ||
    existsSync(join(targetDir, 'pnpm-lock.yaml')) ||
    existsSync(join(targetDir, 'bun.lockb'));

  if (!hasLockFile) {
    issues.push({
      severity: 'warning',
      name: '-',
      message: 'No lock file found — builds may not be reproducible',
    });
  }

  return {
    stats,
    issues,
    prodDeps: Object.keys(prodDeps).sort(),
    devDeps: Object.keys(devDeps).sort(),
    peerDeps: Object.keys(peerDeps).sort(),
    optionalDeps: Object.keys(optionalDeps).sort(),
    duplicatesAcrossGroups,
    hasLockFile,
  };
}

/**
 * Formats a dependency report as a human-readable string.
 *
 * @param {DependencyReport} report
 * @returns {string}
 */
export function formatDependencyReport(report) {
  const lines = [];

  lines.push('=== Dependency Analysis Report ===');
  lines.push('');
  lines.push(`Total dependencies : ${report.stats.total}`);
  lines.push(`  Production       : ${report.stats.prod}`);
  lines.push(`  Development      : ${report.stats.dev}`);
  lines.push(`  Peer             : ${report.stats.peer}`);
  lines.push(`  Optional         : ${report.stats.optional}`);
  lines.push(`Lock file          : ${report.hasLockFile ? 'Yes' : 'No'}`);
  lines.push('');

  if (report.duplicatesAcrossGroups.length > 0) {
    lines.push(`--- Duplicates (prod & dev) ---`);
    for (const dup of report.duplicatesAcrossGroups) {
      lines.push(`  [DUP] ${dup}`);
    }
    lines.push('');
  }

  const errors = report.issues.filter((i) => i.severity === 'error');
  const warnings = report.issues.filter((i) => i.severity === 'warning');
  const infos = report.issues.filter((i) => i.severity === 'info');

  if (errors.length > 0) {
    lines.push(`--- Errors (${errors.length}) ---`);
    for (const issue of errors) {
      lines.push(`  [ERR] ${issue.message}`);
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push(`--- Warnings (${warnings.length}) ---`);
    for (const issue of warnings) {
      lines.push(`  [WRN] ${issue.message}`);
    }
    lines.push('');
  }

  if (infos.length > 0) {
    lines.push(`--- Info (${infos.length}) ---`);
    for (const issue of infos) {
      lines.push(`  [INF] ${issue.message}`);
    }
    lines.push('');
  }

  if (report.issues.length === 0) {
    lines.push('No issues found.');
    lines.push('');
  }

  return lines.join('\n');
}
