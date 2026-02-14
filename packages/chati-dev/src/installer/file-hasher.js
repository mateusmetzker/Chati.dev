import { readFileSync } from 'fs';
import { createHash } from 'crypto';

/**
 * Normalize line endings: CRLF -> LF
 * Ensures consistent hashing across platforms.
 */
function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n');
}

/**
 * Compute SHA-256 hash of a string content.
 * Normalizes line endings before hashing.
 *
 * @param {string} content - The string content to hash
 * @returns {string} Hex-encoded SHA-256 digest
 */
export function hashContent(content) {
  const normalized = normalizeLineEndings(content);
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

/**
 * Compute SHA-256 hash of a file.
 * Reads the file as UTF-8, normalizes line endings, then hashes.
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {string} Hex-encoded SHA-256 digest
 */
export function hashFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return hashContent(content);
}

/**
 * Compare two files by their SHA-256 hashes.
 *
 * @param {string} pathA - Absolute path to first file
 * @param {string} pathB - Absolute path to second file
 * @returns {{ match: boolean, hashA: string, hashB: string }}
 */
export function compareFiles(pathA, pathB) {
  const hashA = hashFile(pathA);
  const hashB = hashFile(pathB);
  return {
    match: hashA === hashB,
    hashA,
    hashB,
  };
}
