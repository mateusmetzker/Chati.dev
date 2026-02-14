/**
 * Coverage Analyzer — Identifies code coverage gaps by mapping source to test files.
 *
 * Uses naming conventions to correlate source files with their test counterparts,
 * detects uncovered exports, and generates human-readable reports.
 *
 * @module scripts/coverage-analyzer
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

/**
 * @typedef {Object} CoverageReport
 * @property {string[]} coveredFiles    — source files with corresponding tests
 * @property {string[]} uncoveredFiles  — source files without tests
 * @property {string[]} orphanedTests   — test files without corresponding source
 * @property {number} coverageRatio
 * @property {number} totalSourceFiles
 * @property {number} totalTestFiles
 */

/**
 * Recursively collects JS files from a directory, excluding node_modules and .git.
 * @param {string} dir
 * @param {string} [ext='.js']
 * @returns {string[]}
 */
function collectFiles(dir, ext = '.js') {
  const results = [];

  function walk(currentDir) {
    let entries;
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git') continue;
      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && fullPath.endsWith(ext)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

/**
 * Derives the expected test file path for a source file.
 * Convention: src/foo/bar.js -> test/foo/bar.test.js
 *
 * @param {string} srcFile   — absolute path to source file
 * @param {string} srcDir    — root source directory
 * @param {string} testDir   — root test directory
 * @returns {string}
 */
function expectedTestPath(srcFile, srcDir, testDir) {
  const rel = relative(srcDir, srcFile);
  const ext = extname(rel);
  const withoutExt = rel.slice(0, -ext.length);
  return join(testDir, `${withoutExt}.test${ext}`);
}

/**
 * Derives the expected source file path for a test file.
 * Convention: test/foo/bar.test.js -> src/foo/bar.js
 *
 * @param {string} testFile
 * @param {string} srcDir
 * @param {string} testDir
 * @returns {string}
 */
function expectedSourcePath(testFile, srcDir, testDir) {
  const rel = relative(testDir, testFile);
  const noTest = rel.replace(/\.test\./, '.').replace(/\.spec\./, '.');
  return join(srcDir, noTest);
}

/**
 * Analyzes coverage by mapping source files to test files.
 *
 * @param {string} srcDir
 * @param {string} testDir
 * @returns {CoverageReport}
 */
export function analyzeCoverage(srcDir, testDir) {
  const sourceFiles = collectFiles(srcDir, '.js').filter(
    (f) => !f.endsWith('.test.js') && !f.endsWith('.spec.js')
  );
  const testFiles = collectFiles(testDir, '.js').filter(
    (f) => f.endsWith('.test.js') || f.endsWith('.spec.js')
  );

  const coveredFiles = [];
  const uncoveredFiles = [];

  for (const src of sourceFiles) {
    const expected = expectedTestPath(src, srcDir, testDir);
    if (existsSync(expected)) {
      coveredFiles.push(relative(srcDir, src));
    } else {
      uncoveredFiles.push(relative(srcDir, src));
    }
  }

  const orphanedTests = [];
  for (const test of testFiles) {
    const expected = expectedSourcePath(test, srcDir, testDir);
    if (!existsSync(expected)) {
      orphanedTests.push(relative(testDir, test));
    }
  }

  const totalSourceFiles = sourceFiles.length;
  const coverageRatio =
    totalSourceFiles > 0
      ? Math.round((coveredFiles.length / totalSourceFiles) * 10000) / 10000
      : 0;

  return {
    coveredFiles,
    uncoveredFiles,
    orphanedTests,
    coverageRatio,
    totalSourceFiles,
    totalTestFiles: testFiles.length,
  };
}

/**
 * Parses exported function names from a source file via regex heuristics.
 * Handles: export function, export const/let, export default, module.exports.
 *
 * @param {string} srcFilePath
 * @returns {string[]}
 */
export function getUncoveredFunctions(srcFilePath, testFilePath) {
  let srcContent;
  try {
    srcContent = readFileSync(srcFilePath, 'utf-8');
  } catch {
    return [];
  }

  // Extract exported function/const names
  const exportedNames = new Set();

  // ESM: export function foo(
  const exportFuncRe = /export\s+(?:async\s+)?function\s+(\w+)/g;
  let m;
  while ((m = exportFuncRe.exec(srcContent)) !== null) {
    exportedNames.add(m[1]);
  }

  // ESM: export const foo = / export let foo =
  const exportConstRe = /export\s+(?:const|let|var)\s+(\w+)\s*=/g;
  while ((m = exportConstRe.exec(srcContent)) !== null) {
    exportedNames.add(m[1]);
  }

  // ESM: export class Foo
  const exportClassRe = /export\s+class\s+(\w+)/g;
  while ((m = exportClassRe.exec(srcContent)) !== null) {
    exportedNames.add(m[1]);
  }

  // ESM: export { foo, bar }
  const exportBracketRe = /export\s*\{([^}]+)\}/g;
  while ((m = exportBracketRe.exec(srcContent)) !== null) {
    const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim());
    for (const name of names) {
      if (name) exportedNames.add(name);
    }
  }

  if (exportedNames.size === 0) return [];

  // If no test file, all exported names are uncovered
  if (!testFilePath) {
    return [...exportedNames];
  }

  let testContent;
  try {
    testContent = readFileSync(testFilePath, 'utf-8');
  } catch {
    return [...exportedNames];
  }

  // Check which names appear in the test file
  const uncovered = [];
  for (const name of exportedNames) {
    // Look for the name being referenced in tests (import, call, etc.)
    const nameRegex = new RegExp(`\\b${name}\\b`);
    if (!nameRegex.test(testContent)) {
      uncovered.push(name);
    }
  }

  return uncovered;
}

/**
 * Generates a formatted coverage report string.
 *
 * @param {string} srcDir
 * @param {string} testDir
 * @returns {string}
 */
export function generateCoverageReport(srcDir, testDir) {
  const report = analyzeCoverage(srcDir, testDir);
  const lines = [];

  lines.push('=== Coverage Analysis Report ===');
  lines.push('');
  lines.push(`Source directory : ${srcDir}`);
  lines.push(`Test directory   : ${testDir}`);
  lines.push(`Source files     : ${report.totalSourceFiles}`);
  lines.push(`Test files       : ${report.totalTestFiles}`);
  lines.push(`Coverage ratio   : ${(report.coverageRatio * 100).toFixed(1)}%`);
  lines.push('');

  if (report.coveredFiles.length > 0) {
    lines.push(`--- Covered (${report.coveredFiles.length}) ---`);
    for (const f of report.coveredFiles) {
      lines.push(`  [OK] ${f}`);
    }
    lines.push('');
  }

  if (report.uncoveredFiles.length > 0) {
    lines.push(`--- Uncovered (${report.uncoveredFiles.length}) ---`);
    for (const f of report.uncoveredFiles) {
      lines.push(`  [!!] ${f}`);
    }
    lines.push('');
  }

  if (report.orphanedTests.length > 0) {
    lines.push(`--- Orphaned Tests (${report.orphanedTests.length}) ---`);
    for (const f of report.orphanedTests) {
      lines.push(`  [??] ${f}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
