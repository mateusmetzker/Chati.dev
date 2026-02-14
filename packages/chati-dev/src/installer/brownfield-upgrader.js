import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { hashFile } from './file-hasher.js';
import { loadManifest, generateManifest, compareManifests, saveManifest } from './manifest.js';
import { mergeFile } from '../merger/index.js';

/**
 * Categorize changes between current and new manifests.
 *
 * @param {object} currentManifest - The currently installed manifest
 * @param {object} newManifest - The new framework version manifest
 * @returns {{ added: string[], removed: string[], modified: string[], unchanged: string[] }}
 */
export function categorizeChanges(currentManifest, newManifest) {
  return compareManifests(currentManifest, newManifest);
}

/**
 * Detect files the user has modified since installation.
 * Compares the current on-disk hash of each file against the hash
 * recorded in the manifest at install time.
 *
 * @param {string} targetDir - Project root directory
 * @param {object} manifest - The installed manifest
 * @returns {{ path: string, recordedHash: string, currentHash: string }[]}
 */
export function detectUserModifications(targetDir, manifest) {
  const modified = [];
  const files = manifest.files || {};

  for (const [relPath, entry] of Object.entries(files)) {
    const absPath = join(targetDir, relPath);
    if (!existsSync(absPath)) continue;

    const currentHash = hashFile(absPath);
    if (currentHash !== entry.hash) {
      modified.push({
        path: relPath,
        recordedHash: entry.hash,
        currentHash,
      });
    }
  }

  return modified;
}

/**
 * Plan an upgrade without making any changes (dry run).
 * Shows what would happen if upgradeInstallation were called.
 *
 * @param {string} targetDir - Project root where framework is installed
 * @param {string} newFrameworkDir - Directory containing the new framework version
 * @param {string} [newVersion='0.0.0'] - New version string
 * @returns {{ upgraded: string[], skipped: string[], added: string[], removed: string[], preserved: string[], errors: Array<{ path: string, error: string }> }}
 */
export function planUpgrade(targetDir, newFrameworkDir, newVersion = '0.0.0') {
  const result = {
    upgraded: [],
    skipped: [],
    added: [],
    removed: [],
    preserved: [],
    errors: [],
  };

  // Load current manifest
  const currentManifest = loadManifest(targetDir);
  if (!currentManifest) {
    result.errors.push({
      path: '.chati/manifest.json',
      error: 'No existing manifest found. Cannot plan upgrade without a manifest.',
    });
    return result;
  }

  // Build new manifest from the new framework directory
  const newManifest = generateManifest(
    newFrameworkDir,
    collectRelativePaths(newFrameworkDir),
    newVersion
  );

  // Categorize
  const changes = categorizeChanges(currentManifest, newManifest);

  // Detect user modifications
  const userMods = detectUserModifications(targetDir, currentManifest);
  const userModPaths = new Set(userMods.map((m) => m.path));

  // Added files => will be added
  result.added = [...changes.added];

  // Removed files => will be flagged for removal
  result.removed = [...changes.removed];

  // Modified files => check if user also modified them
  for (const filePath of changes.modified) {
    if (userModPaths.has(filePath)) {
      // User modified this file => skip (preserve user changes)
      result.preserved.push(filePath);
      result.skipped.push(filePath);
    } else {
      // User did NOT modify => safe to upgrade
      result.upgraded.push(filePath);
    }
  }

  return result;
}

/**
 * Execute an upgrade: update files from the new framework version
 * while preserving user-modified files.
 *
 * @param {string} targetDir - Project root where framework is installed
 * @param {string} newFrameworkDir - Directory containing the new framework version
 * @param {string} [newVersion='0.0.0'] - New version string
 * @returns {{ upgraded: string[], skipped: string[], added: string[], removed: string[], preserved: string[], errors: Array<{ path: string, error: string }> }}
 */
export function upgradeInstallation(targetDir, newFrameworkDir, newVersion = '0.0.0') {
  const result = {
    upgraded: [],
    skipped: [],
    added: [],
    removed: [],
    preserved: [],
    errors: [],
  };

  // Load current manifest
  const currentManifest = loadManifest(targetDir);
  if (!currentManifest) {
    result.errors.push({
      path: '.chati/manifest.json',
      error: 'No existing manifest found. Cannot upgrade without a manifest.',
    });
    return result;
  }

  // Build new manifest
  const newManifest = generateManifest(
    newFrameworkDir,
    collectRelativePaths(newFrameworkDir),
    newVersion
  );

  // Categorize
  const changes = categorizeChanges(currentManifest, newManifest);

  // Detect user modifications
  const userMods = detectUserModifications(targetDir, currentManifest);
  const userModPaths = new Set(userMods.map((m) => m.path));

  // Process ADDED files
  for (const filePath of changes.added) {
    try {
      const srcPath = join(newFrameworkDir, filePath);
      const destPath = join(targetDir, filePath);
      const destDir = dirname(destPath);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      copyFileSync(srcPath, destPath);
      result.added.push(filePath);
    } catch (err) {
      result.errors.push({ path: filePath, error: err.message });
    }
  }

  // Process MODIFIED files
  for (const filePath of changes.modified) {
    if (userModPaths.has(filePath)) {
      // User modified => try smart merge, otherwise preserve
      try {
        const existingContent = readFileSync(join(targetDir, filePath), 'utf-8');
        const newContent = readFileSync(join(newFrameworkDir, filePath), 'utf-8');
        const merged = mergeFile(filePath, existingContent, newContent);

        // Only write if merge produced a different result from existing
        if (merged !== existingContent) {
          writeFileSync(join(targetDir, filePath), merged, 'utf-8');
          result.upgraded.push(filePath);
        } else {
          result.preserved.push(filePath);
          result.skipped.push(filePath);
        }
      } catch {
        // Merge failed => preserve user's version
        result.preserved.push(filePath);
        result.skipped.push(filePath);
      }
    } else {
      // User did NOT modify => safe to replace
      try {
        const srcPath = join(newFrameworkDir, filePath);
        const destPath = join(targetDir, filePath);
        copyFileSync(srcPath, destPath);
        result.upgraded.push(filePath);
      } catch (err) {
        result.errors.push({ path: filePath, error: err.message });
      }
    }
  }

  // Process REMOVED files (mark but do not delete for safety)
  result.removed = [...changes.removed];

  // Save updated manifest
  try {
    saveManifest(targetDir, newManifest);
  } catch (err) {
    result.errors.push({ path: '.chati/manifest.json', error: err.message });
  }

  return result;
}

/**
 * Collect all relative file paths under a directory recursively.
 * Skips hidden directories (starting with '.').
 *
 * @param {string} rootDir - Directory to scan
 * @param {string} [base=''] - Base path for recursion (internal)
 * @returns {string[]} Array of relative file paths
 */
function collectRelativePaths(rootDir, base = '') {
  const paths = [];

  let entries;
  try {
    entries = readdirSync(join(rootDir, base), { withFileTypes: true });
  } catch {
    return paths;
  }

  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      paths.push(...collectRelativePaths(rootDir, relPath));
    } else if (entry.isFile()) {
      paths.push(relPath);
    }
  }

  return paths;
}
