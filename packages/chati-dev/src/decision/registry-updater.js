/**
 * Registry Updater - Auto-updates entity-registry.yaml
 * Scans project for new/changed/removed entities
 *
 * @module decision/registry-updater
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename, relative } from 'path';
import yaml from 'js-yaml';

// Known directories to scan
const KNOWN_DIRS = [
  { path: 'chati.dev/agents', type: 'agent' },
  { path: 'chati.dev/tasks', type: 'task' },
  { path: 'chati.dev/schemas', type: 'schema' },
  { path: 'chati.dev/domains', type: 'domain' },
  { path: 'chati.dev/hooks', type: 'hook' },
  { path: 'chati.dev/workflows', type: 'workflow' },
  { path: 'chati.dev/templates', type: 'template' }
];

/**
 * Scan project for new/changed files and update registry.
 * @param {string} projectDir
 * @param {object} [options] - { dryRun: boolean }
 * @returns {{ added: string[], removed: string[], updated: string[], unchanged: number }}
 */
export function updateRegistry(projectDir, options = {}) {
  const { dryRun = false } = options;
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');

  let registry = {
    metadata: {
      version: '1.0',
      entity_count: 0,
      last_updated: new Date().toISOString()
    },
    entities: {}
  };

  // Load existing registry
  if (existsSync(registryPath)) {
    registry = yaml.load(readFileSync(registryPath, 'utf8'));
  }

  const existingPaths = new Set();
  Object.values(registry.entities || {}).forEach(typeEntities => {
    if (Array.isArray(typeEntities)) {
      typeEntities.forEach(entity => {
        if (entity.path) {
          existingPaths.add(entity.path);
        }
      });
    }
  });

  // Detect new entities
  const newEntities = detectNewEntities(projectDir);
  const newPaths = new Set(newEntities.map(e => e.path));

  // Detect removed entities
  const removedEntities = detectRemovedEntities(projectDir);
  const removedPaths = new Set(removedEntities.map(e => e.path));

  // Track changes
  const changes = {
    added: [],
    removed: [],
    updated: [],
    unchanged: 0
  };

  // Add new entities
  newEntities.forEach(entity => {
    if (!existingPaths.has(entity.path)) {
      changes.added.push(entity.path);

      if (!dryRun) {
        const type = entity.type;
        if (!registry.entities[type]) {
          registry.entities[type] = [];
        }
        registry.entities[type].push(entity);
      }
    }
  });

  // Remove deleted entities
  removedEntities.forEach(entity => {
    if (existingPaths.has(entity.path)) {
      changes.removed.push(entity.path);

      if (!dryRun) {
        const type = entity.type;
        if (registry.entities[type]) {
          registry.entities[type] = registry.entities[type].filter(
            e => e.path !== entity.path
          );
        }
      }
    }
  });

  // Check for updates (files modified after last registry update)
  existingPaths.forEach(path => {
    if (!removedPaths.has(path) && !newPaths.has(path)) {
      const fullPath = join(projectDir, path);
      if (existsSync(fullPath)) {
        const stats = statSync(fullPath);
        const lastUpdated = registry.metadata?.last_updated
          ? new Date(registry.metadata.last_updated)
          : new Date(0);

        if (stats.mtime > lastUpdated) {
          changes.updated.push(path);

          if (!dryRun) {
            // Regenerate metadata
            const newMeta = generateEntityMeta(projectDir, path);
            Object.entries(registry.entities).forEach(([type, entities]) => {
              const index = entities.findIndex(e => e.path === path);
              if (index !== -1) {
                registry.entities[type][index] = { ...newMeta, path };
              }
            });
          }
        } else {
          changes.unchanged++;
        }
      }
    }
  });

  // Update metadata
  if (!dryRun) {
    let totalCount = 0;
    Object.values(registry.entities).forEach(typeEntities => {
      if (Array.isArray(typeEntities)) {
        totalCount += typeEntities.length;
      }
    });

    registry.metadata.entity_count = totalCount;
    registry.metadata.last_updated = new Date().toISOString();

    writeFileSync(registryPath, yaml.dump(registry), 'utf8');
  }

  return changes;
}

/**
 * Detect new entities that aren't in the registry.
 * Scans known directories (chati.dev/agents, chati.dev/tasks, etc).
 * @param {string} projectDir
 * @returns {object[]} New entity candidates
 */
export function detectNewEntities(projectDir) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  const existingPaths = new Set();

  if (existsSync(registryPath)) {
    const registry = yaml.load(readFileSync(registryPath, 'utf8'));
    Object.values(registry.entities || {}).forEach(typeEntities => {
      if (Array.isArray(typeEntities)) {
        typeEntities.forEach(entity => {
          if (entity.path) {
            existingPaths.add(entity.path);
          }
        });
      }
    });
  }

  const newEntities = [];

  KNOWN_DIRS.forEach(({ path: dirPath, type }) => {
    const fullPath = join(projectDir, dirPath);
    if (!existsSync(fullPath)) {
      return;
    }

    const files = scanDirectory(fullPath);
    files.forEach(file => {
      const relativePath = relative(projectDir, file);
      if (!existingPaths.has(relativePath)) {
        const meta = generateEntityMeta(projectDir, relativePath);
        newEntities.push({
          ...meta,
          path: relativePath,
          type
        });
      }
    });
  });

  return newEntities;
}

/**
 * Detect removed entities (in registry but not on disk).
 * @param {string} projectDir
 * @returns {object[]} Removed entity candidates
 */
export function detectRemovedEntities(projectDir) {
  const registryPath = join(projectDir, 'chati.dev', 'entity-registry.yaml');
  if (!existsSync(registryPath)) {
    return [];
  }

  const registry = yaml.load(readFileSync(registryPath, 'utf8'));
  const removedEntities = [];

  Object.entries(registry.entities || {}).forEach(([type, entities]) => {
    if (Array.isArray(entities)) {
      entities.forEach(entity => {
        if (entity.path) {
          const fullPath = join(projectDir, entity.path);
          if (!existsSync(fullPath)) {
            removedEntities.push({ ...entity, type });
          }
        }
      });
    }
  });

  return removedEntities;
}

/**
 * Generate entity metadata from file.
 * Extracts type, purpose, keywords from filename and content.
 * @param {string} projectDir
 * @param {string} filePath
 * @returns {object} Entity metadata
 */
export function generateEntityMeta(projectDir, filePath) {
  const fullPath = join(projectDir, filePath);
  const fileName = basename(filePath, '.md');

  const meta = {
    name: fileName,
    keywords: [],
    purpose: ''
  };

  // Extract keywords from filename
  const nameWords = fileName
    .replace(/[._-]/g, ' ')
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3);
  meta.keywords.push(...nameWords);

  // Try to extract purpose from file content
  if (existsSync(fullPath)) {
    try {
      const content = readFileSync(fullPath, 'utf8');
      const lines = content.split('\n').slice(0, 20); // First 20 lines

      // Look for common purpose patterns
      for (const line of lines) {
        const purposeMatch = line.match(/^#+\s*(.+)$/); // Markdown heading
        if (purposeMatch) {
          meta.purpose = purposeMatch[1].trim();
          break;
        }

        const descMatch = line.match(/^(?:description|purpose|summary):\s*(.+)$/i);
        if (descMatch) {
          meta.purpose = descMatch[1].trim();
          break;
        }
      }

      // Extract additional keywords from content
      const contentWords = content
        .toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 5); // Longer words only
      const wordFreq = new Map();
      contentWords.forEach(w => {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
      });

      // Add top 5 frequent words as keywords
      const topWords = [...wordFreq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
      meta.keywords.push(...topWords);
    } catch {
      // Ignore read errors
    }
  }

  // Remove duplicates
  meta.keywords = [...new Set(meta.keywords)];

  return meta;
}

/**
 * Recursively scan directory for files.
 * @private
 * @param {string} dirPath
 * @returns {string[]} Array of file paths
 */
function scanDirectory(dirPath) {
  const files = [];

  try {
    const entries = readdirSync(dirPath);
    entries.forEach(entry => {
      const fullPath = join(dirPath, entry);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        files.push(...scanDirectory(fullPath));
      } else if (stats.isFile() && entry.endsWith('.md')) {
        files.push(fullPath);
      }
    });
  } catch {
    // Ignore read errors
  }

  return files;
}
