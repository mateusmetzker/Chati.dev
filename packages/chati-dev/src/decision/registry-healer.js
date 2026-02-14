/**
 * Registry Healer - Self-healing for entity-registry.yaml
 * Detects and fixes 6 types of registry issues
 *
 * @module decision/registry-healer
 */

import { readFileSync, writeFileSync, existsSync, statSync, copyFileSync, mkdirSync } from 'fs';
import { join, isAbsolute } from 'path';
import yaml from 'js-yaml';
import { detectNewEntities, detectRemovedEntities, generateEntityMeta } from './registry-updater.js';

/**
 * Run all healing rules and return diagnosis.
 * @param {string} projectDir
 * @param {object} [options] - { autoFix: boolean }
 * @returns {{ healthy: boolean, issues: object[], fixes: object[] }}
 */
export function healRegistry(projectDir, options = {}) {
  const { autoFix = false } = options;

  const issues = [];
  const fixes = [];

  // Rule 1: Missing entities
  const missingIssues = detectMissingEntities(projectDir);
  issues.push(...missingIssues);
  if (autoFix) {
    missingIssues.forEach(issue => {
      fixes.push({
        rule: 'missing_entity',
        action: 'add',
        path: issue.path,
        entity: issue.entity
      });
    });
  }

  // Rule 2: Orphaned entries
  const orphanedIssues = detectOrphanedEntries(projectDir);
  issues.push(...orphanedIssues);
  if (autoFix) {
    orphanedIssues.forEach(issue => {
      fixes.push({
        rule: 'orphaned_entry',
        action: 'remove',
        path: issue.path
      });
    });
  }

  // Rule 3: Stale metadata
  const staleIssues = detectStaleMetadata(projectDir);
  issues.push(...staleIssues);
  if (autoFix) {
    staleIssues.forEach(issue => {
      fixes.push({
        rule: 'stale_metadata',
        action: 'update',
        path: issue.path,
        newMeta: issue.newMeta
      });
    });
  }

  // Rule 4: Duplicates
  const duplicateIssues = detectDuplicates(projectDir);
  issues.push(...duplicateIssues);
  if (autoFix) {
    duplicateIssues.forEach(issue => {
      fixes.push({
        rule: 'duplicate_entry',
        action: 'deduplicate',
        path: issue.path,
        count: issue.count
      });
    });
  }

  // Rule 5: Invalid paths
  const invalidPathIssues = detectInvalidPaths(projectDir);
  issues.push(...invalidPathIssues);
  if (autoFix) {
    invalidPathIssues.forEach(issue => {
      fixes.push({
        rule: 'invalid_path',
        action: 'remove',
        path: issue.path,
        reason: issue.reason
      });
    });
  }

  // Rule 6: Count mismatch
  const countIssues = detectCountMismatch(projectDir);
  issues.push(...countIssues);
  if (autoFix) {
    countIssues.forEach(issue => {
      fixes.push({
        rule: 'count_mismatch',
        action: 'fix_count',
        expected: issue.actual,
        current: issue.recorded
      });
    });
  }

  // Apply fixes if requested
  if (autoFix && fixes.length > 0) {
    const result = applyFixes(projectDir, fixes);
    return {
      healthy: issues.length === 0,
      issues,
      fixes,
      applied: result.applied,
      backup: result.backup
    };
  }

  return {
    healthy: issues.length === 0,
    issues,
    fixes
  };
}

/**
 * Rule 1: Missing entities (file exists but not in registry).
 * @param {string} projectDir
 * @returns {object[]} Issues found
 */
export function detectMissingEntities(projectDir) {
  const newEntities = detectNewEntities(projectDir);
  return newEntities.map(entity => ({
    rule: 'missing_entity',
    severity: 'warning',
    path: entity.path,
    message: `File exists but not in registry: ${entity.path}`,
    entity
  }));
}

/**
 * Rule 2: Orphaned entries (in registry but file doesn't exist).
 * @param {string} projectDir
 * @returns {object[]} Issues found
 */
export function detectOrphanedEntries(projectDir) {
  const removedEntities = detectRemovedEntities(projectDir);
  return removedEntities.map(entity => ({
    rule: 'orphaned_entry',
    severity: 'error',
    path: entity.path,
    message: `Registry entry exists but file not found: ${entity.path}`
  }));
}

/**
 * Rule 3: Stale metadata (file modified after registry entry).
 * @param {string} projectDir
 * @returns {object[]} Issues found
 */
export function detectStaleMetadata(projectDir) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  if (!existsSync(registryPath)) {
    return [];
  }

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  const lastUpdated = registry.metadata?.last_updated
    ? new Date(registry.metadata.last_updated)
    : new Date(0);

  const issues = [];

  Object.entries(registry.entities || {}).forEach(([_type, entities]) => {
    if (Array.isArray(entities)) {
      entities.forEach(entity => {
        if (entity.path) {
          const fullPath = join(projectDir, entity.path);
          if (existsSync(fullPath)) {
            const stats = statSync(fullPath);
            if (stats.mtime > lastUpdated) {
              const newMeta = generateEntityMeta(projectDir, entity.path);
              issues.push({
                rule: 'stale_metadata',
                severity: 'info',
                path: entity.path,
                message: `File modified after registry update: ${entity.path}`,
                newMeta
              });
            }
          }
        }
      });
    }
  });

  return issues;
}

/**
 * Rule 4: Duplicate entries (same path appears twice).
 * @param {string} projectDir
 * @returns {object[]} Issues found
 */
export function detectDuplicates(projectDir) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  if (!existsSync(registryPath)) {
    return [];
  }

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  const pathCounts = new Map();
  const issues = [];

  Object.values(registry.entities || {}).forEach(entities => {
    if (Array.isArray(entities)) {
      entities.forEach(entity => {
        if (entity.path) {
          pathCounts.set(entity.path, (pathCounts.get(entity.path) || 0) + 1);
        }
      });
    }
  });

  pathCounts.forEach((count, path) => {
    if (count > 1) {
      issues.push({
        rule: 'duplicate_entry',
        severity: 'error',
        path,
        count,
        message: `Duplicate registry entries for path: ${path} (${count} times)`
      });
    }
  });

  return issues;
}

/**
 * Rule 5: Invalid paths (malformed or absolute paths).
 * @param {string} projectDir
 * @returns {object[]} Issues found
 */
export function detectInvalidPaths(projectDir) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  if (!existsSync(registryPath)) {
    return [];
  }

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  const issues = [];

  Object.values(registry.entities || {}).forEach(entities => {
    if (Array.isArray(entities)) {
      entities.forEach(entity => {
        if (!entity.path) {
          issues.push({
            rule: 'invalid_path',
            severity: 'error',
            path: '<missing>',
            reason: 'Missing path field',
            message: 'Entity missing path field'
          });
        } else if (isAbsolute(entity.path)) {
          issues.push({
            rule: 'invalid_path',
            severity: 'error',
            path: entity.path,
            reason: 'Absolute path',
            message: `Path should be relative: ${entity.path}`
          });
        } else if (entity.path.includes('..')) {
          issues.push({
            rule: 'invalid_path',
            severity: 'error',
            path: entity.path,
            reason: 'Contains parent directory reference',
            message: `Path contains ..: ${entity.path}`
          });
        }
      });
    }
  });

  return issues;
}

/**
 * Rule 6: Entity count mismatch (metadata.entity_count != actual).
 * @param {string} projectDir
 * @returns {object[]} Issues found
 */
export function detectCountMismatch(projectDir) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  if (!existsSync(registryPath)) {
    return [];
  }

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  let actualCount = 0;

  Object.values(registry.entities || {}).forEach(entities => {
    if (Array.isArray(entities)) {
      actualCount += entities.length;
    }
  });

  const recordedCount = registry.metadata?.entity_count || 0;

  if (actualCount !== recordedCount) {
    return [{
      rule: 'count_mismatch',
      severity: 'warning',
      actual: actualCount,
      recorded: recordedCount,
      message: `Entity count mismatch: metadata says ${recordedCount}, actual is ${actualCount}`
    }];
  }

  return [];
}

/**
 * Apply fixes and create backup before modifying.
 * @param {string} projectDir
 * @param {object[]} fixes
 * @returns {{ applied: number, backup: string }}
 */
export function applyFixes(projectDir, fixes) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');

  if (!existsSync(registryPath)) {
    return { applied: 0, backup: null };
  }

  // Create backup
  const backupDir = join(projectDir, '.chati', 'backups');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `entity-registry-${timestamp}.yaml`);
  copyFileSync(registryPath, backupPath);

  // Load registry
  const registry = yaml.load(readFileSync(registryPath, 'utf8'));

  let applied = 0;

  fixes.forEach(fix => {
    try {
      switch (fix.action) {
        case 'add':
          // Add missing entity
          if (fix.entity) {
            const type = fix.entity.type;
            if (!registry.entities[type]) {
              registry.entities[type] = [];
            }
            registry.entities[type].push(fix.entity);
            applied++;
          }
          break;

        case 'remove':
          // Remove orphaned entry
          Object.keys(registry.entities).forEach(type => {
            if (Array.isArray(registry.entities[type])) {
              registry.entities[type] = registry.entities[type].filter(
                e => e.path !== fix.path
              );
            }
          });
          applied++;
          break;

        case 'update':
          // Update stale metadata
          Object.keys(registry.entities).forEach(type => {
            if (Array.isArray(registry.entities[type])) {
              const index = registry.entities[type].findIndex(
                e => e.path === fix.path
              );
              if (index !== -1) {
                registry.entities[type][index] = {
                  ...registry.entities[type][index],
                  ...fix.newMeta
                };
              }
            }
          });
          applied++;
          break;

        case 'deduplicate':
          // Remove duplicate entries (keep first occurrence)
          Object.keys(registry.entities).forEach(type => {
            if (Array.isArray(registry.entities[type])) {
              const seen = new Set();
              registry.entities[type] = registry.entities[type].filter(e => {
                if (e.path === fix.path) {
                  if (seen.has(e.path)) {
                    return false; // Remove duplicate
                  }
                  seen.add(e.path);
                }
                return true;
              });
            }
          });
          applied++;
          break;

        case 'fix_count':
          // Fix entity count
          registry.metadata = registry.metadata || {};
          registry.metadata.entity_count = fix.expected;
          applied++;
          break;
      }
    } catch {
      // Skip failed fixes
    }
  });

  // Update metadata
  registry.metadata = registry.metadata || {};
  registry.metadata.last_updated = new Date().toISOString();

  // Recalculate entity count
  let totalCount = 0;
  Object.values(registry.entities).forEach(entities => {
    if (Array.isArray(entities)) {
      totalCount += entities.length;
    }
  });
  registry.metadata.entity_count = totalCount;

  // Write updated registry
  writeFileSync(registryPath, yaml.dump(registry), 'utf8');

  return {
    applied,
    backup: backupPath
  };
}
