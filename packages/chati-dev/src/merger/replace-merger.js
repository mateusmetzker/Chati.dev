/**
 * Framework-owned file paths that should always be fully replaced.
 * These are paths relative to the project root.
 */
const FRAMEWORK_OWNED_PATTERNS = [
  /^chati\.dev\/agents\//,
  /^chati\.dev\/schemas\//,
  /^chati\.dev\/constitution\.md$/,
  /^chati\.dev\/orchestrator\//,
  /^chati\.dev\/workflows\//,
  /^chati\.dev\/quality-gates\//,
  /^chati\.dev\/templates\//,
  /^chati\.dev\/frameworks\//,
  /^chati\.dev\/patterns\//,
  /^chati\.dev\/i18n\//,
  /^chati\.dev\/migrations\//,
  /^chati\.dev\/hooks\//,
  /^chati\.dev\/domains\//,
  /^chati\.dev\/intelligence\//,
];

/**
 * Simple full replacement merger.
 * Returns the new content, completely replacing the existing content.
 *
 * @param {string} _existingContent - Current file content (ignored)
 * @param {string} newContent - New file content
 * @returns {string} The new content
 */
export function replaceFile(_existingContent, newContent) {
  return newContent;
}

/**
 * Check if a file path is framework-owned and should be fully replaced.
 *
 * @param {string} filePath - Relative file path from project root
 * @returns {boolean} True if the file is framework-owned
 */
export function shouldReplace(filePath) {
  // Normalize path separators to forward slashes
  const normalized = filePath.replace(/\\/g, '/');

  for (const pattern of FRAMEWORK_OWNED_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}
