import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';
import { hashFile } from './file-hasher.js';

const MANIFEST_FILENAME = 'manifest.json';
const MANIFEST_DIR = '.chati';

/**
 * Generate a manifest for a set of files under a root directory.
 *
 * @param {string} rootDir - Root directory to scan from
 * @param {string[]} relativePaths - Array of relative file paths to include
 * @param {string} [version='0.0.0'] - Version string for the manifest
 * @returns {{ version: string, createdAt: string, files: Record<string, { hash: string, size: number, type: string }> }}
 */
export function generateManifest(rootDir, relativePaths, version = '0.0.0') {
  const files = {};

  for (const relPath of relativePaths) {
    const absPath = join(rootDir, relPath);
    if (!existsSync(absPath)) continue;

    const stat = statSync(absPath);
    if (!stat.isFile()) continue;

    const hash = hashFile(absPath);
    const ext = relPath.split('.').pop() || '';
    files[relPath] = {
      hash,
      size: stat.size,
      type: ext,
    };
  }

  return {
    version,
    createdAt: new Date().toISOString(),
    files,
  };
}

/**
 * Save a manifest to .chati/manifest.json inside the target directory.
 *
 * @param {string} targetDir - Target project directory
 * @param {object} manifest - The manifest object to save
 */
export function saveManifest(targetDir, manifest) {
  const manifestDir = join(targetDir, MANIFEST_DIR);
  if (!existsSync(manifestDir)) {
    mkdirSync(manifestDir, { recursive: true });
  }

  const manifestPath = join(manifestDir, MANIFEST_FILENAME);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

/**
 * Load a manifest from .chati/manifest.json inside the target directory.
 *
 * @param {string} targetDir - Target project directory
 * @returns {object|null} The manifest object, or null if not found
 */
export function loadManifest(targetDir) {
  const manifestPath = join(targetDir, MANIFEST_DIR, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) return null;

  const raw = readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

/**
 * Compare two manifests to find added, removed, modified, and unchanged files.
 *
 * @param {object} oldManifest - Previous manifest
 * @param {object} newManifest - New manifest
 * @returns {{ added: string[], removed: string[], modified: string[], unchanged: string[] }}
 */
export function compareManifests(oldManifest, newManifest) {
  const oldFiles = oldManifest.files || {};
  const newFiles = newManifest.files || {};

  const oldKeys = new Set(Object.keys(oldFiles));
  const newKeys = new Set(Object.keys(newFiles));

  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  // Files in new but not in old => added
  for (const key of newKeys) {
    if (!oldKeys.has(key)) {
      added.push(key);
    }
  }

  // Files in old but not in new => removed
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      removed.push(key);
    }
  }

  // Files in both => compare hashes
  for (const key of oldKeys) {
    if (newKeys.has(key)) {
      if (oldFiles[key].hash === newFiles[key].hash) {
        unchanged.push(key);
      } else {
        modified.push(key);
      }
    }
  }

  return { added, removed, modified, unchanged };
}
