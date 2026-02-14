/**
 * Test Quality Assessment — Evaluates test file quality through static analysis.
 *
 * Counts test structures, detects anti-patterns, and calculates quality scores
 * to help maintain high testing standards.
 *
 * @module scripts/test-quality-assessment
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Object} FileReport
 * @property {string} filePath
 * @property {number} describeCount
 * @property {number} itCount
 * @property {number} assertionCount
 * @property {number} assertionsPerTest
 * @property {boolean} hasEdgeCases
 * @property {boolean} hasErrorHandling
 * @property {boolean} hasSetupTeardown
 * @property {string[]} antiPatterns
 * @property {number} lineCount
 */

/**
 * @typedef {Object} QualityReport
 * @property {FileReport[]} files
 * @property {Object} overall
 * @property {number} overall.score
 * @property {string} overall.grade
 * @property {string[]} overall.issues
 */

// Patterns for detecting various test constructs
const PATTERNS = {
  describe: /\bdescribe\s*\(/g,
  it: /\b(?:it|test)\s*\(/g,
  assertion: /\b(?:expect|assert|should)\s*[.(]/g,
  edgeCase: /\b(?:edge|boundary|limit|overflow|underflow|empty|null|undefined|NaN|zero|negative|max|min)\b/gi,
  errorHandling: /\b(?:throw|reject|error|catch|fail|invalid|malformed|corrupt)\b/gi,
  beforeEach: /\b(?:beforeEach|beforeAll|before)\s*\(/g,
  afterEach: /\b(?:afterEach|afterAll|after)\s*\(/g,
  emptyTest: /\b(?:it|test)\s*\(\s*(['"`]).*?\1\s*,\s*(?:(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}|function\s*\(\s*\)\s*\{\s*\})\s*\)/g,
  todoTest: /\b(?:it|test)\s*\.\s*(?:skip|todo)\s*\(/g,
};

/**
 * Finds all *.test.js and *.spec.js files recursively.
 * @param {string} dir
 * @returns {string[]}
 */
export function findTestFiles(dir) {
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
      } else if (
        stat.isFile() &&
        (entry.endsWith('.test.js') || entry.endsWith('.spec.js'))
      ) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

/**
 * Assesses quality of a single test file.
 * @param {string} filePath
 * @returns {FileReport}
 */
export function assessSingleFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      filePath,
      describeCount: 0,
      itCount: 0,
      assertionCount: 0,
      assertionsPerTest: 0,
      hasEdgeCases: false,
      hasErrorHandling: false,
      hasSetupTeardown: false,
      antiPatterns: [`Unable to read file: ${err.message}`],
      lineCount: 0,
    };
  }

  const lines = content.split('\n');
  const lineCount = lines.length;

  const describeCount = (content.match(PATTERNS.describe) || []).length;
  const itCount = (content.match(PATTERNS.it) || []).length;
  const assertionCount = (content.match(PATTERNS.assertion) || []).length;
  const assertionsPerTest = itCount > 0 ? Math.round((assertionCount / itCount) * 100) / 100 : 0;

  const hasEdgeCases = PATTERNS.edgeCase.test(content);
  PATTERNS.edgeCase.lastIndex = 0; // reset regex state

  const hasErrorHandling = PATTERNS.errorHandling.test(content);
  PATTERNS.errorHandling.lastIndex = 0;

  const hasBeforeAfter =
    PATTERNS.beforeEach.test(content) || PATTERNS.afterEach.test(content);
  PATTERNS.beforeEach.lastIndex = 0;
  PATTERNS.afterEach.lastIndex = 0;

  // Detect anti-patterns
  const antiPatterns = [];

  if (itCount > 0 && assertionCount === 0) {
    antiPatterns.push('Tests have no assertions');
  }

  const emptyTests = (content.match(PATTERNS.emptyTest) || []).length;
  if (emptyTests > 0) {
    antiPatterns.push(`${emptyTests} empty test(s) found`);
  }

  const todoTests = (content.match(PATTERNS.todoTest) || []).length;
  if (todoTests > 0) {
    antiPatterns.push(`${todoTests} skipped/todo test(s)`);
  }

  // Detect duplicate test names
  const testNames = [];
  const testNameRegex = /\b(?:it|test)\s*\(\s*(['"`])(.*?)\1/g;
  let match;
  while ((match = testNameRegex.exec(content)) !== null) {
    testNames.push(match[2]);
  }
  const duplicates = testNames.filter((name, idx) => testNames.indexOf(name) !== idx);
  if (duplicates.length > 0) {
    const unique = [...new Set(duplicates)];
    antiPatterns.push(`Duplicate test names: ${unique.join(', ')}`);
  }

  if (assertionsPerTest > 0 && assertionsPerTest < 1) {
    antiPatterns.push('Low assertion density (some tests may lack assertions)');
  }

  return {
    filePath,
    describeCount,
    itCount,
    assertionCount,
    assertionsPerTest,
    hasEdgeCases,
    hasErrorHandling,
    hasSetupTeardown: hasBeforeAfter,
    antiPatterns,
    lineCount,
  };
}

/**
 * Calculates an overall quality score from multiple file reports.
 * @param {FileReport[]} reports
 * @returns {{ score: number, grade: string, issues: string[] }}
 */
export function calculateOverallScore(reports) {
  if (reports.length === 0) {
    return { score: 0, grade: 'F', issues: ['No test files found'] };
  }

  const issues = [];
  let score = 100;

  // Aggregate stats
  const totalTests = reports.reduce((s, r) => s + r.itCount, 0);
  const totalAssertions = reports.reduce((s, r) => s + r.assertionCount, 0);
  const filesWithEdgeCases = reports.filter((r) => r.hasEdgeCases).length;
  const filesWithErrorHandling = reports.filter((r) => r.hasErrorHandling).length;
  const filesWithSetup = reports.filter((r) => r.hasSetupTeardown).length;
  const allAntiPatterns = reports.flatMap((r) => r.antiPatterns);

  // Deductions
  if (totalTests === 0) {
    score -= 50;
    issues.push('No test cases found');
  }

  if (totalTests > 0 && totalAssertions / totalTests < 1) {
    score -= 15;
    issues.push('Low assertion density across test suite');
  }

  const edgeCaseRatio = filesWithEdgeCases / reports.length;
  if (edgeCaseRatio < 0.3) {
    score -= 10;
    issues.push(`Only ${Math.round(edgeCaseRatio * 100)}% of files test edge cases`);
  }

  const errorHandlingRatio = filesWithErrorHandling / reports.length;
  if (errorHandlingRatio < 0.3) {
    score -= 10;
    issues.push(`Only ${Math.round(errorHandlingRatio * 100)}% of files test error handling`);
  }

  const setupRatio = filesWithSetup / reports.length;
  if (setupRatio < 0.2) {
    score -= 5;
    issues.push('Few files use setup/teardown (beforeEach/afterEach)');
  }

  // Anti-pattern deductions (capped)
  const antiPatternPenalty = Math.min(allAntiPatterns.length * 3, 20);
  if (antiPatternPenalty > 0) {
    score -= antiPatternPenalty;
    issues.push(`${allAntiPatterns.length} anti-pattern(s) detected across files`);
  }

  score = Math.max(0, Math.min(100, score));

  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return { score, grade, issues };
}

/**
 * Assesses quality of multiple test files.
 * @param {string[]} testFilePaths
 * @returns {QualityReport}
 */
export function assessTestQuality(testFilePaths) {
  const files = testFilePaths.map((fp) => assessSingleFile(fp));
  const overall = calculateOverallScore(files);
  return { files, overall };
}
