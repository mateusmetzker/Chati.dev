/**
 * Parse a .env file into structured entries.
 * Preserves comments, blank lines, and order.
 *
 * @param {string} content - Raw .env file content
 * @returns {{ entries: Array<{ key: string|null, value: string|null, raw: string, isComment: boolean, isBlank: boolean }> }}
 */
export function parseEnvFile(content) {
  const lines = content.split('\n');
  const entries = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '') {
      entries.push({ key: null, value: null, raw: line, isComment: false, isBlank: true });
      continue;
    }

    if (trimmed.startsWith('#')) {
      entries.push({ key: null, value: null, raw: line, isComment: true, isBlank: false });
      continue;
    }

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      // Malformed line, preserve as-is
      entries.push({ key: null, value: null, raw: line, isComment: false, isBlank: false });
      continue;
    }

    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    entries.push({ key, value, raw: line, isComment: false, isBlank: false });
  }

  return { entries };
}

/**
 * Format parsed entries back into .env file content.
 *
 * @param {Array<{ key: string|null, value: string|null, raw: string, isComment: boolean, isBlank: boolean }>} entries
 * @returns {string}
 */
export function formatEnvFile(entries) {
  const lines = entries.map((entry) => {
    if (entry.isComment || entry.isBlank || entry.key === null) {
      return entry.raw;
    }
    return `${entry.key}=${entry.value}`;
  });

  return lines.join('\n');
}

/**
 * Merge two .env files.
 * - Preserves existing values for keys that exist in both.
 * - Adds new keys from newContent that do not exist in existingContent.
 * - Preserves comments and blank lines from the existing file.
 *
 * @param {string} existingContent - Current .env file content
 * @param {string} newContent - New .env file content
 * @returns {string} Merged .env file content
 */
export function mergeEnvFiles(existingContent, newContent) {
  const existing = parseEnvFile(existingContent);
  const incoming = parseEnvFile(newContent);

  // Collect existing keys
  const existingKeys = new Set();
  for (const entry of existing.entries) {
    if (entry.key) {
      existingKeys.add(entry.key);
    }
  }

  // Start with all existing entries (preserves structure, comments, values)
  const merged = [...existing.entries];

  // Append new keys that do not exist yet
  const newEntries = [];
  for (const entry of incoming.entries) {
    if (entry.key && !existingKeys.has(entry.key)) {
      newEntries.push(entry);
    }
  }

  if (newEntries.length > 0) {
    // Add a blank separator if the existing file does not end with a blank line
    const lastEntry = merged[merged.length - 1];
    if (lastEntry && !lastEntry.isBlank) {
      merged.push({ key: null, value: null, raw: '', isComment: false, isBlank: true });
    }

    // Add comment indicating new keys
    merged.push({
      key: null,
      value: null,
      raw: '# Added by chati.dev upgrade',
      isComment: true,
      isBlank: false,
    });

    for (const entry of newEntries) {
      merged.push(entry);
    }
  }

  return formatEnvFile(merged);
}
