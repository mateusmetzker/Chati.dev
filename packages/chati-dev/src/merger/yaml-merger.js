import yaml from 'js-yaml';

const MANAGED_START = '# CHATI-MANAGED-START';
const MANAGED_END = '# CHATI-MANAGED-END';

/**
 * Find all CHATI-MANAGED sections in a YAML file.
 *
 * @param {string} content - YAML file content
 * @returns {Array<{ start: number, end: number, content: string }>}
 *   Each section includes the line indices (start/end) and the content between markers.
 */
export function findManagedSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === MANAGED_START) {
      startIdx = i;
    } else if (trimmed === MANAGED_END && startIdx !== -1) {
      const sectionLines = lines.slice(startIdx + 1, i);
      sections.push({
        start: startIdx,
        end: i,
        content: sectionLines.join('\n'),
      });
      startIdx = -1;
    }
  }

  return sections;
}

/**
 * Replace all CHATI-MANAGED sections in existing content with new sections.
 * Sections are matched by position order (1st old section replaced by 1st new section, etc.).
 *
 * @param {string} existing - Existing YAML file content
 * @param {Array<{ content: string }>} newSections - New section contents (in order)
 * @returns {string} Content with managed sections replaced
 */
export function replaceManagedSections(existing, newSections) {
  const lines = existing.split('\n');
  const oldSections = findManagedSections(existing);

  if (oldSections.length === 0 || newSections.length === 0) {
    return existing;
  }

  // Build result by replacing sections from bottom to top to preserve line indices
  const result = [...lines];
  const sectionCount = Math.min(oldSections.length, newSections.length);

  for (let i = sectionCount - 1; i >= 0; i--) {
    const old = oldSections[i];
    const replacement = newSections[i].content.split('\n');
    // Replace lines between markers (exclusive of marker lines)
    result.splice(old.start + 1, old.end - old.start - 1, ...replacement);
  }

  return result.join('\n');
}

/**
 * Deep merge two plain objects. Only adds new keys from source;
 * never overwrites existing values in target.
 *
 * @param {object} target - Existing object (values preserved)
 * @param {object} source - New object (only new keys added)
 * @returns {object} Merged object
 */
export function deepMergeYaml(target, source) {
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    return target;
  }
  if (typeof source !== 'object' || source === null || Array.isArray(source)) {
    return target;
  }

  const merged = { ...target };

  for (const key of Object.keys(source)) {
    if (!(key in merged)) {
      // New key, add it
      merged[key] = source[key];
    } else if (typeof merged[key] === 'object' && !Array.isArray(merged[key]) &&
               typeof source[key] === 'object' && !Array.isArray(source[key])) {
      // Both are objects, recurse
      merged[key] = deepMergeYaml(merged[key], source[key]);
    }
    // Otherwise, keep existing value (do not overwrite)
  }

  return merged;
}

/**
 * Merge two YAML files.
 * - If the existing file has CHATI-MANAGED markers, only those sections are updated.
 * - If no markers are found, uses deep merge (adds new keys only, never overwrites).
 *
 * @param {string} existingContent - Current YAML file content
 * @param {string} newContent - New YAML file content
 * @returns {string} Merged YAML content
 */
export function mergeYamlFiles(existingContent, newContent) {
  const existingSections = findManagedSections(existingContent);
  const newSections = findManagedSections(newContent);

  // If managed sections exist, replace them
  if (existingSections.length > 0 && newSections.length > 0) {
    return replaceManagedSections(existingContent, newSections);
  }

  // No managed sections: use deep merge via js-yaml
  try {
    const existingObj = yaml.load(existingContent) || {};
    const newObj = yaml.load(newContent) || {};
    const merged = deepMergeYaml(existingObj, newObj);
    return yaml.dump(merged, { lineWidth: -1, noRefs: true });
  } catch {
    // If YAML parsing fails, return existing content unchanged
    return existingContent;
  }
}
