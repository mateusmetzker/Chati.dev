/**
 * Performance Analyzer — Static analysis of code patterns that affect performance.
 *
 * Scans source files for large files, deep nesting, long functions,
 * excessive imports, and synchronous filesystem operations.
 *
 * @module scripts/performance-analyzer
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/**
 * @typedef {Object} ComplexityResult
 * @property {number} cyclomaticComplexity
 * @property {number} nestingDepth
 * @property {Array<{ name: string, lines: number }>} functionLengths
 */

/**
 * @typedef {Object} FilePerformanceReport
 * @property {string} filePath
 * @property {number} lineCount
 * @property {number} importCount
 * @property {ComplexityResult} complexity
 * @property {boolean} hasSyncFsOps
 * @property {string[]} warnings
 * @property {string[]} errors
 */

/**
 * @typedef {Object} PerformanceReport
 * @property {FilePerformanceReport[]} files
 * @property {{ totalFiles: number, totalWarnings: number, totalErrors: number }} summary
 */

// Thresholds
const THRESHOLDS = {
  fileSizeWarning: 500,
  fileSizeError: 1000,
  nestingDepth: 4,
  functionLength: 50,
  importCount: 15,
  cyclomaticComplexityWarning: 10,
  cyclomaticComplexityError: 20,
};

// Sync fs methods that should be avoided in non-script files
const SYNC_FS_PATTERN = /\b(?:readFileSync|writeFileSync|appendFileSync|mkdirSync|rmdirSync|unlinkSync|renameSync|copyFileSync|readdirSync|statSync|lstatSync|existsSync|accessSync)\b/g;

/**
 * Collects JS/TS source files recursively (excludes tests, node_modules, .git).
 * @param {string} dir
 * @returns {string[]}
 */
function collectSourceFiles(dir) {
  const results = [];
  const sourceExtensions = new Set(['.js', '.ts', '.mjs', '.mts']);

  function walk(currentDir) {
    let entries;
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'build') continue;
      const fullPath = join(currentDir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile() && sourceExtensions.has(extname(entry))) {
        // Skip test files
        if (entry.endsWith('.test.js') || entry.endsWith('.spec.js') ||
            entry.endsWith('.test.ts') || entry.endsWith('.spec.ts')) {
          continue;
        }
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.sort();
}

/**
 * Calculates code complexity metrics for a given source string.
 *
 * @param {string} code
 * @returns {ComplexityResult}
 */
export function calculateComplexity(code) {
  const lines = code.split('\n');

  // Cyclomatic complexity: count decision points
  const decisionPatterns = [
    /\bif\s*\(/g,
    /\belse\s+if\s*\(/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /\?\s*[^:]/g, // ternary
    /&&/g,
    /\|\|/g,
  ];

  let cyclomaticComplexity = 1; // base complexity
  for (const pattern of decisionPatterns) {
    const matches = code.match(pattern);
    if (matches) cyclomaticComplexity += matches.length;
    pattern.lastIndex = 0;
  }

  // Max nesting depth
  let maxNesting = 0;
  let currentNesting = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and strings (simple heuristic)
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    const opens = (trimmed.match(/\{/g) || []).length;
    const closes = (trimmed.match(/\}/g) || []).length;
    currentNesting += opens - closes;
    if (currentNesting > maxNesting) maxNesting = currentNesting;
    if (currentNesting < 0) currentNesting = 0;
  }

  // Function lengths
  const functionLengths = [];
  const funcStartRegex = /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>|(\w+)\s*\([^)]*\)\s*\{)/;

  let funcName = null;
  let funcStartLine = 0;
  let braceDepth = 0;
  let inFunction = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inFunction) {
      const match = trimmed.match(funcStartRegex);
      if (match) {
        funcName = match[1] || match[2] || match[3] || 'anonymous';
        funcStartLine = i;
        inFunction = true;
        braceDepth = 0;
      }
    }

    if (inFunction) {
      const opens = (trimmed.match(/\{/g) || []).length;
      const closes = (trimmed.match(/\}/g) || []).length;
      braceDepth += opens - closes;

      if (braceDepth <= 0 && i > funcStartLine) {
        const length = i - funcStartLine + 1;
        functionLengths.push({ name: funcName, lines: length });
        inFunction = false;
        funcName = null;
      }
    }
  }

  return {
    cyclomaticComplexity,
    nestingDepth: maxNesting,
    functionLengths,
  };
}

/**
 * Analyzes a single file for performance-related patterns.
 *
 * @param {string} filePath
 * @returns {FilePerformanceReport}
 */
export function analyzeFile(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch (err) {
    return {
      filePath,
      lineCount: 0,
      importCount: 0,
      complexity: { cyclomaticComplexity: 0, nestingDepth: 0, functionLengths: [] },
      hasSyncFsOps: false,
      warnings: [`Cannot read file: ${err.message}`],
      errors: [],
    };
  }

  const lines = content.split('\n');
  const lineCount = lines.length;
  const warnings = [];
  const errors = [];

  // Count imports
  const importMatches = content.match(/\b(?:import\s+|require\s*\()/g) || [];
  const importCount = importMatches.length;

  // Check sync fs operations (only flag in non-script files)
  const isScript = filePath.includes('/scripts/') || filePath.includes('/bin/');
  const syncMatches = content.match(SYNC_FS_PATTERN) || [];
  const hasSyncFsOps = syncMatches.length > 0;

  // Calculate complexity
  const complexity = calculateComplexity(content);

  // Generate warnings and errors
  if (lineCount > THRESHOLDS.fileSizeError) {
    errors.push(`File has ${lineCount} lines (threshold: ${THRESHOLDS.fileSizeError})`);
  } else if (lineCount > THRESHOLDS.fileSizeWarning) {
    warnings.push(`File has ${lineCount} lines (threshold: ${THRESHOLDS.fileSizeWarning})`);
  }

  if (complexity.nestingDepth > THRESHOLDS.nestingDepth) {
    warnings.push(`Max nesting depth: ${complexity.nestingDepth} (threshold: ${THRESHOLDS.nestingDepth})`);
  }

  if (importCount > THRESHOLDS.importCount) {
    warnings.push(`${importCount} imports (threshold: ${THRESHOLDS.importCount})`);
  }

  if (hasSyncFsOps && !isScript) {
    warnings.push(`${syncMatches.length} synchronous filesystem operation(s) in non-script file`);
  }

  for (const func of complexity.functionLengths) {
    if (func.lines > THRESHOLDS.functionLength) {
      warnings.push(`Function "${func.name}" is ${func.lines} lines (threshold: ${THRESHOLDS.functionLength})`);
    }
  }

  if (complexity.cyclomaticComplexity > THRESHOLDS.cyclomaticComplexityError) {
    errors.push(`Cyclomatic complexity: ${complexity.cyclomaticComplexity} (threshold: ${THRESHOLDS.cyclomaticComplexityError})`);
  } else if (complexity.cyclomaticComplexity > THRESHOLDS.cyclomaticComplexityWarning) {
    warnings.push(`Cyclomatic complexity: ${complexity.cyclomaticComplexity} (threshold: ${THRESHOLDS.cyclomaticComplexityWarning})`);
  }

  return {
    filePath,
    lineCount,
    importCount,
    complexity,
    hasSyncFsOps,
    warnings,
    errors,
  };
}

/**
 * Analyzes all source files in a directory.
 *
 * @param {string} srcDir
 * @returns {PerformanceReport}
 */
export function analyzePerformance(srcDir) {
  const sourceFiles = collectSourceFiles(srcDir);
  const files = sourceFiles.map((f) => analyzeFile(f));

  const totalWarnings = files.reduce((s, f) => s + f.warnings.length, 0);
  const totalErrors = files.reduce((s, f) => s + f.errors.length, 0);

  return {
    files,
    summary: {
      totalFiles: files.length,
      totalWarnings,
      totalErrors,
    },
  };
}

/**
 * Formats the performance report as a human-readable string.
 *
 * @param {PerformanceReport} report
 * @returns {string}
 */
export function formatPerformanceReport(report) {
  const lines = [];

  lines.push('=== Performance Analysis Report ===');
  lines.push('');
  lines.push(`Files analyzed  : ${report.summary.totalFiles}`);
  lines.push(`Total warnings  : ${report.summary.totalWarnings}`);
  lines.push(`Total errors    : ${report.summary.totalErrors}`);
  lines.push('');

  const filesWithIssues = report.files.filter(
    (f) => f.warnings.length > 0 || f.errors.length > 0
  );

  if (filesWithIssues.length === 0) {
    lines.push('No performance issues detected.');
    return lines.join('\n');
  }

  for (const file of filesWithIssues) {
    lines.push(`--- ${file.filePath} ---`);
    lines.push(`  Lines: ${file.lineCount} | Imports: ${file.importCount} | Complexity: ${file.complexity.cyclomaticComplexity} | Nesting: ${file.complexity.nestingDepth}`);

    for (const err of file.errors) {
      lines.push(`  [ERR] ${err}`);
    }
    for (const warn of file.warnings) {
      lines.push(`  [WRN] ${warn}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
