#!/usr/bin/env node

/**
 * Codebase Mapper — Scans a target project and generates a structured map.
 *
 * Exports:
 *   mapCodebase(targetDir) → CodebaseMap
 *   saveCodebaseMap(targetDir, map) → saves to .chati/codebase-map.json
 *   loadCodebaseMap(targetDir) → reads from .chati/codebase-map.json
 *
 * Internal helpers:
 *   scanDirectory(dir, depth, maxDepth) → recursive scanner
 *   detectConventions(files) → naming patterns
 *   detectBuildTools(targetDir) → vite/webpack/esbuild/etc
 *   detectTestFramework(targetDir) → jest/vitest/mocha/node:test
 *   parseDependencies(targetDir) → from package.json
 *   guessDirectoryPurpose(dirName, contents) → 'source'|'test'|'config'|'docs'|etc
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, extname, basename } from 'path';

/**
 * Directories to always ignore during scanning.
 */
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.chati', '.next', '.nuxt', '.cache', '.turbo',
  '__pycache__', '.venv', 'venv', '.tox',
  'vendor', 'target', 'out', '.output',
]);

const IGNORE_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.gitkeep',
]);

/**
 * Maximum depth for recursive directory scanning.
 */
const MAX_DEPTH = 10;

/**
 * Maximum number of files to scan before stopping (safety limit).
 */
const MAX_FILES = 50000;

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Guess the purpose of a directory based on its name and contents.
 * @param {string} dirName - The directory basename.
 * @param {string[]} contents - Filenames inside the directory.
 * @returns {string} Purpose label.
 */
export function guessDirectoryPurpose(dirName, contents = []) {
  const name = dirName.toLowerCase();

  // Direct name matches
  const purposeMap = {
    src: 'source',
    source: 'source',
    lib: 'source',
    app: 'source',
    pages: 'source',
    components: 'source',
    modules: 'source',

    test: 'test',
    tests: 'test',
    __tests__: 'test',
    spec: 'test',
    specs: 'test',
    e2e: 'test',
    cypress: 'test',

    docs: 'docs',
    doc: 'docs',
    documentation: 'docs',
    wiki: 'docs',

    config: 'config',
    configs: 'config',
    configuration: 'config',

    scripts: 'scripts',
    bin: 'scripts',
    tools: 'scripts',

    assets: 'assets',
    static: 'assets',
    public: 'assets',
    images: 'assets',
    img: 'assets',
    fonts: 'assets',
    media: 'assets',

    styles: 'styles',
    css: 'styles',
    scss: 'styles',

    types: 'types',
    typings: 'types',
    '@types': 'types',

    utils: 'utilities',
    helpers: 'utilities',
    shared: 'utilities',
    common: 'utilities',

    api: 'api',
    routes: 'api',
    controllers: 'api',
    endpoints: 'api',

    models: 'data',
    schemas: 'data',
    entities: 'data',
    migrations: 'data',
    database: 'data',
    db: 'data',

    middleware: 'middleware',
    middlewares: 'middleware',

    hooks: 'hooks',

    services: 'services',
    providers: 'services',

    store: 'state',
    stores: 'state',
    state: 'state',
    redux: 'state',
    context: 'state',

    i18n: 'i18n',
    locales: 'i18n',
    lang: 'i18n',
    translations: 'i18n',

    '.github': 'ci',
    '.circleci': 'ci',
    '.gitlab': 'ci',

    '.vscode': 'ide-config',
    '.idea': 'ide-config',
    '.cursor': 'ide-config',
    '.windsurf': 'ide-config',
  };

  if (purposeMap[name]) return purposeMap[name];

  // Content-based guessing
  const hasTestFiles = contents.some(f => /\.(test|spec)\.[jt]sx?$/.test(f));
  if (hasTestFiles) return 'test';

  const hasConfigFiles = contents.some(f =>
    /\.(config|rc)\.[jt]s$/.test(f) || /\.ya?ml$/.test(f) || /\.json$/.test(f),
  );
  if (hasConfigFiles && contents.length <= 5) return 'config';

  return 'unknown';
}

/**
 * Recursively scan a directory and collect file/directory information.
 * @param {string} dir - Directory to scan.
 * @param {number} depth - Current depth.
 * @param {number} maxDepth - Maximum recursion depth.
 * @param {object} acc - Accumulator for results.
 * @returns {object} Directory tree node.
 */
export function scanDirectory(dir, depth = 0, maxDepth = MAX_DEPTH, acc = { fileCount: 0 }) {
  if (depth > maxDepth || acc.fileCount > MAX_FILES) {
    return { name: basename(dir), type: 'directory', depth, truncated: true, children: [] };
  }

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { name: basename(dir), type: 'directory', depth, error: 'unreadable', children: [] };
  }

  const children = [];
  let fileCount = 0;

  for (const entry of entries) {
    if (IGNORE_FILES.has(entry.name)) continue;

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      const child = scanDirectory(join(dir, entry.name), depth + 1, maxDepth, acc);
      children.push(child);
    } else if (entry.isFile()) {
      fileCount++;
      acc.fileCount++;
      children.push({
        name: entry.name,
        type: 'file',
        extension: extname(entry.name),
        depth: depth + 1,
      });
    }
  }

  const dirContents = entries.filter(e => e.isFile()).map(e => e.name);
  const purpose = guessDirectoryPurpose(basename(dir), dirContents);

  return {
    name: basename(dir),
    type: 'directory',
    depth,
    purpose,
    fileCount,
    childDirCount: children.filter(c => c.type === 'directory').length,
    children,
  };
}

/**
 * Detect naming conventions from a list of files.
 * @param {string[]} files - Flat list of filenames.
 * @returns {object} Convention analysis.
 */
export function detectConventions(files) {
  const conventions = {
    naming: { camelCase: 0, kebabCase: 0, snakeCase: 0, pascalCase: 0 },
    testPattern: null,
    configPattern: null,
  };

  for (const file of files) {
    const name = basename(file, extname(file));
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) {
      conventions.naming.camelCase++;
    } else if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) {
      conventions.naming.kebabCase++;
    } else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) {
      conventions.naming.snakeCase++;
    } else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      conventions.naming.pascalCase++;
    }
  }

  // Detect dominant naming convention
  const counts = conventions.naming;
  const max = Math.max(counts.camelCase, counts.kebabCase, counts.snakeCase, counts.pascalCase);
  if (max > 0) {
    if (counts.camelCase === max) conventions.dominant = 'camelCase';
    else if (counts.kebabCase === max) conventions.dominant = 'kebab-case';
    else if (counts.snakeCase === max) conventions.dominant = 'snake_case';
    else conventions.dominant = 'PascalCase';
  } else {
    conventions.dominant = 'unknown';
  }

  // Detect test naming pattern
  const testFiles = files.filter(f => /\.(test|spec)\.[jt]sx?$/.test(f));
  if (testFiles.length > 0) {
    const hasTest = testFiles.some(f => f.includes('.test.'));
    const hasSpec = testFiles.some(f => f.includes('.spec.'));
    conventions.testPattern = hasTest && hasSpec ? 'mixed' : hasTest ? '.test.ext' : '.spec.ext';
  }

  return conventions;
}

/**
 * Detect build tools present in the target directory.
 * @param {string} targetDir - Project root.
 * @returns {string[]} List of detected build tools.
 */
export function detectBuildTools(targetDir) {
  const tools = [];
  const checks = [
    { file: 'vite.config.js', tool: 'vite' },
    { file: 'vite.config.ts', tool: 'vite' },
    { file: 'vite.config.mjs', tool: 'vite' },
    { file: 'webpack.config.js', tool: 'webpack' },
    { file: 'webpack.config.ts', tool: 'webpack' },
    { file: 'rollup.config.js', tool: 'rollup' },
    { file: 'rollup.config.mjs', tool: 'rollup' },
    { file: 'esbuild.config.js', tool: 'esbuild' },
    { file: 'tsconfig.json', tool: 'typescript' },
    { file: 'jsconfig.json', tool: 'jsconfig' },
    { file: 'next.config.js', tool: 'next' },
    { file: 'next.config.mjs', tool: 'next' },
    { file: 'nuxt.config.ts', tool: 'nuxt' },
    { file: 'nuxt.config.js', tool: 'nuxt' },
    { file: 'astro.config.mjs', tool: 'astro' },
    { file: 'svelte.config.js', tool: 'svelte' },
    { file: 'angular.json', tool: 'angular' },
    { file: 'turbo.json', tool: 'turborepo' },
    { file: 'nx.json', tool: 'nx' },
    { file: 'Makefile', tool: 'make' },
    { file: 'Cargo.toml', tool: 'cargo' },
    { file: 'go.mod', tool: 'go' },
    { file: 'pom.xml', tool: 'maven' },
    { file: 'build.gradle', tool: 'gradle' },
    { file: 'pyproject.toml', tool: 'pyproject' },
    { file: 'setup.py', tool: 'setuptools' },
  ];

  const seen = new Set();
  for (const { file, tool } of checks) {
    if (!seen.has(tool) && existsSync(join(targetDir, file))) {
      tools.push(tool);
      seen.add(tool);
    }
  }

  return tools;
}

/**
 * Detect the test framework used in the project.
 * @param {string} targetDir - Project root.
 * @returns {string[]} Detected test frameworks.
 */
export function detectTestFramework(targetDir) {
  const frameworks = [];
  const pkgPath = join(targetDir, 'package.json');

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps.jest) frameworks.push('jest');
      if (allDeps.vitest) frameworks.push('vitest');
      if (allDeps.mocha) frameworks.push('mocha');
      if (allDeps.ava) frameworks.push('ava');
      if (allDeps.tap) frameworks.push('tap');
      if (allDeps.cypress) frameworks.push('cypress');
      if (allDeps.playwright || allDeps['@playwright/test']) frameworks.push('playwright');

      // Check scripts for node:test usage
      const scripts = pkg.scripts || {};
      const testScript = scripts.test || '';
      if (testScript.includes('node --test') || testScript.includes('node:test')) {
        frameworks.push('node:test');
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // Check for config files
  const configChecks = [
    { file: 'jest.config.js', fw: 'jest' },
    { file: 'jest.config.ts', fw: 'jest' },
    { file: 'vitest.config.js', fw: 'vitest' },
    { file: 'vitest.config.ts', fw: 'vitest' },
    { file: '.mocharc.yml', fw: 'mocha' },
    { file: '.mocharc.json', fw: 'mocha' },
    { file: 'cypress.config.js', fw: 'cypress' },
    { file: 'cypress.config.ts', fw: 'cypress' },
    { file: 'playwright.config.ts', fw: 'playwright' },
    { file: 'playwright.config.js', fw: 'playwright' },
  ];

  for (const { file, fw } of configChecks) {
    if (!frameworks.includes(fw) && existsSync(join(targetDir, file))) {
      frameworks.push(fw);
    }
  }

  return [...new Set(frameworks)];
}

/**
 * Parse dependencies from package.json.
 * @param {string} targetDir - Project root.
 * @returns {object} Dependencies info.
 */
export function parseDependencies(targetDir) {
  const pkgPath = join(targetDir, 'package.json');
  const result = {
    packageManager: 'unknown',
    dependencies: {},
    devDependencies: {},
    totalDeps: 0,
    totalDevDeps: 0,
  };

  if (!existsSync(pkgPath)) return result;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    result.dependencies = pkg.dependencies || {};
    result.devDependencies = pkg.devDependencies || {};
    result.totalDeps = Object.keys(result.dependencies).length;
    result.totalDevDeps = Object.keys(result.devDependencies).length;

    // Detect package manager
    if (existsSync(join(targetDir, 'pnpm-lock.yaml'))) result.packageManager = 'pnpm';
    else if (existsSync(join(targetDir, 'yarn.lock'))) result.packageManager = 'yarn';
    else if (existsSync(join(targetDir, 'bun.lockb'))) result.packageManager = 'bun';
    else if (existsSync(join(targetDir, 'package-lock.json'))) result.packageManager = 'npm';

    if (pkg.name) result.name = pkg.name;
    if (pkg.version) result.version = pkg.version;
    if (pkg.type) result.moduleType = pkg.type;
    if (pkg.engines) result.engines = pkg.engines;
  } catch {
    // Invalid JSON
  }

  // Also check for Python
  const reqPath = join(targetDir, 'requirements.txt');
  if (existsSync(reqPath)) {
    try {
      const content = readFileSync(reqPath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
      result.pythonDeps = lines.length;
    } catch {
      // Ignore
    }
  }

  return result;
}

/**
 * Detect linting configuration in the project.
 * @param {string} targetDir - Project root.
 * @returns {string[]} Detected linters.
 */
function detectLintConfig(targetDir) {
  const linters = [];
  const checks = [
    { files: ['eslint.config.js', 'eslint.config.mjs', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', '.eslintrc'], tool: 'eslint' },
    { files: ['.prettierrc', '.prettierrc.json', '.prettierrc.js', 'prettier.config.js'], tool: 'prettier' },
    { files: ['.stylelintrc', '.stylelintrc.json', 'stylelint.config.js'], tool: 'stylelint' },
    { files: ['.pylintrc', 'pylintrc', 'setup.cfg'], tool: 'pylint' },
    { files: ['biome.json', 'biome.jsonc'], tool: 'biome' },
    { files: ['.oxlintrc.json'], tool: 'oxlint' },
  ];

  for (const { files, tool } of checks) {
    for (const file of files) {
      if (existsSync(join(targetDir, file))) {
        linters.push(tool);
        break;
      }
    }
  }

  return linters;
}

/**
 * Detect entry points in the project.
 * @param {string} targetDir - Project root.
 * @returns {string[]} Entry point file paths (relative).
 */
function detectEntryPoints(targetDir) {
  const entries = [];
  const pkgPath = join(targetDir, 'package.json');

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (pkg.main) entries.push(pkg.main);
      if (pkg.module) entries.push(pkg.module);
      if (pkg.bin) {
        if (typeof pkg.bin === 'string') {
          entries.push(pkg.bin);
        } else if (typeof pkg.bin === 'object') {
          entries.push(...Object.values(pkg.bin));
        }
      }
      if (pkg.exports) {
        const extractExportPaths = (exp) => {
          if (typeof exp === 'string') return [exp];
          if (typeof exp === 'object' && exp !== null) {
            return Object.values(exp).flatMap(v => extractExportPaths(v));
          }
          return [];
        };
        entries.push(...extractExportPaths(pkg.exports));
      }
    } catch {
      // Ignore
    }
  }

  // Common entry points
  const commonEntries = [
    'index.js', 'index.ts', 'index.mjs',
    'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
    'src/app.js', 'src/app.ts', 'app.js', 'app.ts',
    'server.js', 'server.ts', 'src/server.js', 'src/server.ts',
  ];

  for (const entry of commonEntries) {
    if (!entries.includes(entry) && existsSync(join(targetDir, entry))) {
      entries.push(entry);
    }
  }

  return [...new Set(entries)];
}

/**
 * Detect test structure in the project.
 * @param {string} targetDir - Project root.
 * @returns {object} Test structure info.
 */
function detectTestStructure(targetDir) {
  const testDirs = [];
  const possibleDirs = ['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress'];

  for (const dir of possibleDirs) {
    if (existsSync(join(targetDir, dir))) {
      testDirs.push(dir);
    }
  }

  // Check for colocated tests (tests alongside source files in src/)
  const srcDir = join(targetDir, 'src');
  let colocated = false;
  if (existsSync(srcDir)) {
    try {
      const srcFiles = readdirSync(srcDir, { recursive: true });
      colocated = srcFiles.some(f => typeof f === 'string' && /\.(test|spec)\.[jt]sx?$/.test(f));
    } catch {
      // Ignore
    }
  }

  return {
    testDirs,
    colocated,
    frameworks: detectTestFramework(targetDir),
  };
}

/**
 * Collect all file paths from a directory tree node.
 * @param {object} tree - Directory tree from scanDirectory.
 * @param {string} basePath - Accumulated path.
 * @returns {string[]} Flat list of file paths.
 */
function collectFilePaths(tree, basePath = '') {
  const paths = [];
  const currentPath = basePath ? join(basePath, tree.name) : tree.name;

  if (tree.type === 'file') {
    paths.push(currentPath);
  } else if (tree.children) {
    for (const child of tree.children) {
      paths.push(...collectFilePaths(child, currentPath));
    }
  }
  return paths;
}

/**
 * Count file types from a flat list of file paths.
 * @param {string[]} files - Flat file path list.
 * @returns {object} Extension counts.
 */
function countFileTypes(files) {
  const counts = {};
  for (const file of files) {
    const ext = extname(file) || '(no extension)';
    counts[ext] = (counts[ext] || 0) + 1;
  }
  // Sort by count descending
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1]),
  );
}

/**
 * Estimate total lines of code across all text files.
 * @param {string} targetDir - Project root.
 * @param {string[]} files - Relative file paths.
 * @returns {number} Estimated total lines.
 */
function estimateTotalLines(targetDir, files) {
  const textExtensions = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.mjs', '.mts',
    '.py', '.rb', '.go', '.rs', '.java', '.kt',
    '.c', '.cpp', '.h', '.hpp', '.cs',
    '.html', '.css', '.scss', '.less', '.sass',
    '.vue', '.svelte', '.astro',
    '.json', '.yaml', '.yml', '.toml', '.xml',
    '.md', '.txt', '.sh', '.bash',
    '.sql', '.graphql', '.gql',
  ]);

  let totalLines = 0;
  let sampledFiles = 0;
  const maxSample = 500;

  for (const file of files) {
    if (sampledFiles >= maxSample) break;
    const ext = extname(file);
    if (!textExtensions.has(ext)) continue;

    try {
      const content = readFileSync(join(targetDir, file), 'utf8');
      totalLines += content.split('\n').length;
      sampledFiles++;
    } catch {
      // Skip unreadable files
    }
  }

  // If we sampled, extrapolate
  const textFileCount = files.filter(f => textExtensions.has(extname(f))).length;
  if (sampledFiles > 0 && sampledFiles < textFileCount) {
    const avgLines = totalLines / sampledFiles;
    totalLines = Math.round(avgLines * textFileCount);
  }

  return totalLines;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map the target project's codebase structure.
 * @param {string} targetDir - Root directory of the project to scan.
 * @returns {object} CodebaseMap with directories, fileTypes, conventions, etc.
 */
export function mapCodebase(targetDir) {
  if (!existsSync(targetDir)) {
    throw new Error(`Target directory does not exist: ${targetDir}`);
  }

  const stat = statSync(targetDir);
  if (!stat.isDirectory()) {
    throw new Error(`Target path is not a directory: ${targetDir}`);
  }

  // Scan directory tree
  const tree = scanDirectory(targetDir, 0, MAX_DEPTH);

  // Collect all file paths
  const allFiles = collectFilePaths(tree);

  // Build the map
  const map = {
    root: targetDir,
    scannedAt: new Date().toISOString(),
    directories: tree,
    fileTypes: countFileTypes(allFiles),
    conventions: detectConventions(allFiles),
    dependencies: parseDependencies(targetDir),
    entryPoints: detectEntryPoints(targetDir),
    testStructure: detectTestStructure(targetDir),
    lintConfig: detectLintConfig(targetDir),
    buildTools: detectBuildTools(targetDir),
    totalFiles: allFiles.length,
    totalLines: estimateTotalLines(targetDir, allFiles),
  };

  return map;
}

/**
 * Save a codebase map to .chati/codebase-map.json.
 * @param {string} targetDir - Project root directory.
 * @param {object} map - The CodebaseMap object.
 */
export function saveCodebaseMap(targetDir, map) {
  const chatiDir = join(targetDir, '.chati');
  mkdirSync(chatiDir, { recursive: true });
  const mapPath = join(chatiDir, 'codebase-map.json');
  writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf8');
  return mapPath;
}

/**
 * Load a previously saved codebase map from .chati/codebase-map.json.
 * @param {string} targetDir - Project root directory.
 * @returns {object|null} The CodebaseMap or null if not found.
 */
export function loadCodebaseMap(targetDir) {
  const mapPath = join(targetDir, '.chati', 'codebase-map.json');
  if (!existsSync(mapPath)) return null;

  try {
    return JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('codebase-mapper.js') ||
  process.argv[1].endsWith('codebase-mapper')
);

if (isMainModule) {
  const targetDir = process.argv[2] || process.cwd();
  console.log(`Mapping codebase: ${targetDir}`);

  try {
    const map = mapCodebase(targetDir);
    const savedPath = saveCodebaseMap(targetDir, map);
    console.log(`Total files: ${map.totalFiles}`);
    console.log(`Estimated lines: ${map.totalLines}`);
    console.log(`File types: ${Object.keys(map.fileTypes).length}`);
    console.log(`Build tools: ${map.buildTools.join(', ') || 'none detected'}`);
    console.log(`Test frameworks: ${map.testStructure.frameworks.join(', ') || 'none detected'}`);
    console.log(`Naming convention: ${map.conventions.dominant}`);
    console.log(`Map saved to: ${savedPath}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
