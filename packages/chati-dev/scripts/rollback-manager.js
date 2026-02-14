/**
 * Rollback Manager — Creates and restores file-level checkpoints.
 *
 * Snapshots the current state of project files, stores checkpoint metadata
 * in .chati/checkpoints/, and supports rollback to any saved state.
 *
 * @module scripts/rollback-manager
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { join, relative, dirname } from 'node:path';

/**
 * @typedef {Object} FileSnapshot
 * @property {string} path    — relative path from targetDir
 * @property {string} hash    — sha256 hex of file content
 * @property {boolean} exists — whether file exists at checkpoint time
 */

/**
 * @typedef {Object} Checkpoint
 * @property {string} id
 * @property {string} label
 * @property {number} timestamp
 * @property {FileSnapshot[]} files
 */

/**
 * @typedef {Object} RollbackResult
 * @property {number} restored
 * @property {number} skipped
 * @property {string[]} errors
 */

/**
 * Computes sha256 hex hash of a file.
 * @param {string} filePath
 * @returns {string}
 */
export function hashFile(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Collects all files recursively from a directory (excludes node_modules, .git, .chati).
 * @param {string} dir
 * @param {string} baseDir
 * @returns {string[]} — relative paths
 */
function collectAllFiles(dir, baseDir) {
  const results = [];
  const skipDirs = new Set(['node_modules', '.git', '.chati', 'dist', 'build']);

  function walk(currentDir) {
    let entries;
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skipDirs.has(entry)) continue;
      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        results.push(relative(baseDir, fullPath));
      }
    }
  }

  walk(dir);
  return results.sort();
}

export class RollbackManager {
  /**
   * @param {string} targetDir — root project directory
   */
  constructor(targetDir) {
    this.targetDir = targetDir;
    this.checkpointDir = join(targetDir, '.chati', 'checkpoints');
    this.backupDir = join(targetDir, '.chati', 'checkpoints', '_backups');
  }

  /**
   * Ensures checkpoint directories exist.
   * @private
   */
  _ensureDirs() {
    if (!existsSync(this.checkpointDir)) {
      mkdirSync(this.checkpointDir, { recursive: true });
    }
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Creates a checkpoint of the current file state.
   *
   * @param {string} label — human-readable label
   * @returns {Checkpoint}
   */
  createCheckpoint(label) {
    this._ensureDirs();

    const id = randomUUID().split('-')[0]; // short id
    const timestamp = Date.now();
    const relativePaths = collectAllFiles(this.targetDir, this.targetDir);

    const files = relativePaths.map((relPath) => {
      const fullPath = join(this.targetDir, relPath);
      let fileHash;
      try {
        fileHash = hashFile(fullPath);
      } catch {
        fileHash = '';
      }
      return { path: relPath, hash: fileHash, exists: true };
    });

    // Save file backups
    const checkpointBackupDir = join(this.backupDir, id);
    mkdirSync(checkpointBackupDir, { recursive: true });

    for (const fileSnap of files) {
      const srcPath = join(this.targetDir, fileSnap.path);
      const destPath = join(checkpointBackupDir, fileSnap.path);
      const destDir = dirname(destPath);
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      try {
        copyFileSync(srcPath, destPath);
      } catch {
        // Skip files that can't be copied
      }
    }

    const checkpoint = { id, label, timestamp, files };
    const checkpointFile = join(this.checkpointDir, `${id}.json`);
    writeFileSync(checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf-8');

    return checkpoint;
  }

  /**
   * Restores files to a checkpoint state.
   * Files added after the checkpoint are NOT deleted (safety measure).
   *
   * @param {string} checkpointId
   * @returns {RollbackResult}
   */
  rollback(checkpointId) {
    const checkpointFile = join(this.checkpointDir, `${checkpointId}.json`);
    if (!existsSync(checkpointFile)) {
      return { restored: 0, skipped: 0, errors: [`Checkpoint "${checkpointId}" not found`] };
    }

    let checkpoint;
    try {
      checkpoint = JSON.parse(readFileSync(checkpointFile, 'utf-8'));
    } catch (err) {
      return { restored: 0, skipped: 0, errors: [`Failed to parse checkpoint: ${err.message}`] };
    }

    const backupDir = join(this.backupDir, checkpointId);
    let restored = 0;
    let skipped = 0;
    const errors = [];

    for (const fileSnap of checkpoint.files) {
      const targetPath = join(this.targetDir, fileSnap.path);
      const backupPath = join(backupDir, fileSnap.path);

      if (!existsSync(backupPath)) {
        skipped++;
        continue;
      }

      // Check if file has actually changed
      if (existsSync(targetPath)) {
        try {
          const currentHash = hashFile(targetPath);
          if (currentHash === fileSnap.hash) {
            skipped++;
            continue;
          }
        } catch {
          // proceed with restore
        }
      }

      try {
        const destDir = dirname(targetPath);
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        copyFileSync(backupPath, targetPath);
        restored++;
      } catch (err) {
        errors.push(`Failed to restore "${fileSnap.path}": ${err.message}`);
      }
    }

    return { restored, skipped, errors };
  }

  /**
   * Lists all saved checkpoints, sorted by timestamp descending.
   * @returns {Checkpoint[]}
   */
  listCheckpoints() {
    if (!existsSync(this.checkpointDir)) return [];

    const entries = readdirSync(this.checkpointDir).filter((f) => f.endsWith('.json'));
    const checkpoints = [];

    for (const entry of entries) {
      try {
        const data = JSON.parse(readFileSync(join(this.checkpointDir, entry), 'utf-8'));
        checkpoints.push(data);
      } catch {
        // Skip corrupt files
      }
    }

    return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Deletes a checkpoint and its backup files.
   *
   * @param {string} checkpointId
   * @returns {boolean}
   */
  deleteCheckpoint(checkpointId) {
    const checkpointFile = join(this.checkpointDir, `${checkpointId}.json`);
    if (!existsSync(checkpointFile)) return false;

    try {
      unlinkSync(checkpointFile);
    } catch {
      return false;
    }

    // Clean up backup directory
    const backupDir = join(this.backupDir, checkpointId);
    if (existsSync(backupDir)) {
      this._removeDirRecursive(backupDir);
    }

    return true;
  }

  /**
   * Returns the most recent checkpoint or null.
   * @returns {Checkpoint|null}
   */
  getLatestCheckpoint() {
    const checkpoints = this.listCheckpoints();
    return checkpoints.length > 0 ? checkpoints[0] : null;
  }

  /**
   * Recursively removes a directory.
   * @param {string} dir
   * @private
   */
  _removeDirRecursive(dir) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        this._removeDirRecursive(fullPath);
      } else {
        unlinkSync(fullPath);
      }
    }

    // Remove the now-empty directory
    try {
      rmdirSync(dir);
    } catch {
      // directory may already be gone
    }
  }
}
