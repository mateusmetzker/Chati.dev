import { mergeEnvFiles } from './env-merger.js';
import { mergeYamlFiles } from './yaml-merger.js';
import { replaceFile, shouldReplace } from './replace-merger.js';

/**
 * Determine the merge strategy for a given file path.
 *
 * @param {string} filePath - Relative file path from project root
 * @returns {'env' | 'yaml' | 'replace'} The merge strategy to use
 */
export function getMergeStrategy(filePath) {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();

  // Framework-owned files always get replaced
  if (shouldReplace(normalized)) {
    return 'replace';
  }

  // .env files get env merge
  const basename = normalized.split('/').pop() || '';
  if (basename === '.env' || basename.startsWith('.env.')) {
    return 'env';
  }

  // YAML files get yaml merge
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'yaml';
  }

  // Everything else defaults to replace (framework files)
  return 'replace';
}

/**
 * Merge a file using the appropriate strategy based on its path and type.
 *
 * @param {string} filePath - Relative file path from project root
 * @param {string} existingContent - Current file content
 * @param {string} newContent - New file content
 * @returns {string} Merged content
 */
export function mergeFile(filePath, existingContent, newContent) {
  const strategy = getMergeStrategy(filePath);

  switch (strategy) {
    case 'env':
      return mergeEnvFiles(existingContent, newContent);
    case 'yaml':
      return mergeYamlFiles(existingContent, newContent);
    case 'replace':
    default:
      return replaceFile(existingContent, newContent);
  }
}
