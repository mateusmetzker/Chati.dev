import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

import {
  mapCodebase,
  saveCodebaseMap,
  loadCodebaseMap,
  scanDirectory,
  detectConventions,
  detectBuildTools,
  detectTestFramework,
  guessDirectoryPurpose,
  parseDependencies,
} from '../../scripts/codebase-mapper.js';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures', 'codebase-mapper');

function setupFixtures() {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });

  // Create a mock project structure
  mkdirSync(join(FIXTURES_DIR, 'src', 'components'), { recursive: true });
  mkdirSync(join(FIXTURES_DIR, 'src', 'utils'), { recursive: true });
  mkdirSync(join(FIXTURES_DIR, 'test'), { recursive: true });
  mkdirSync(join(FIXTURES_DIR, 'docs'), { recursive: true });
  mkdirSync(join(FIXTURES_DIR, 'config'), { recursive: true });
  mkdirSync(join(FIXTURES_DIR, '.vscode'), { recursive: true });

  // Create files
  writeFileSync(join(FIXTURES_DIR, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    type: 'module',
    main: 'src/index.js',
    bin: { cli: 'bin/cli.js' },
    scripts: { test: 'node --test test/**/*.test.js' },
    dependencies: { express: '^4.18.0' },
    devDependencies: { eslint: '^9.0.0' },
    engines: { node: '>=18' },
  }, null, 2));

  writeFileSync(join(FIXTURES_DIR, 'src', 'index.js'), 'export default function main() {}');
  writeFileSync(join(FIXTURES_DIR, 'src', 'components', 'Button.jsx'), 'export default function Button() {}');
  writeFileSync(join(FIXTURES_DIR, 'src', 'utils', 'format-date.js'), 'export function formatDate() {}');
  writeFileSync(join(FIXTURES_DIR, 'src', 'utils', 'parse-input.js'), 'export function parseInput() {}');
  writeFileSync(join(FIXTURES_DIR, 'test', 'index.test.js'), 'import test from "node:test";');
  writeFileSync(join(FIXTURES_DIR, 'docs', 'README.md'), '# Test Project');
  writeFileSync(join(FIXTURES_DIR, 'eslint.config.js'), 'export default {};');
  writeFileSync(join(FIXTURES_DIR, 'vite.config.js'), 'export default {};');
  writeFileSync(join(FIXTURES_DIR, 'tsconfig.json'), '{}');
  writeFileSync(join(FIXTURES_DIR, 'package-lock.json'), '{}');
}

function cleanupFixtures() {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
}

describe('codebase-mapper', () => {
  before(() => setupFixtures());

  describe('guessDirectoryPurpose', () => {
    it('identifies source directories', () => {
      assert.equal(guessDirectoryPurpose('src'), 'source');
      assert.equal(guessDirectoryPurpose('lib'), 'source');
      assert.equal(guessDirectoryPurpose('app'), 'source');
    });

    it('identifies test directories', () => {
      assert.equal(guessDirectoryPurpose('test'), 'test');
      assert.equal(guessDirectoryPurpose('__tests__'), 'test');
      assert.equal(guessDirectoryPurpose('spec'), 'test');
    });

    it('identifies docs directories', () => {
      assert.equal(guessDirectoryPurpose('docs'), 'docs');
      assert.equal(guessDirectoryPurpose('documentation'), 'docs');
    });

    it('identifies config directories', () => {
      assert.equal(guessDirectoryPurpose('config'), 'config');
    });

    it('identifies IDE config directories', () => {
      assert.equal(guessDirectoryPurpose('.vscode'), 'ide-config');
      assert.equal(guessDirectoryPurpose('.cursor'), 'ide-config');
    });

    it('identifies by content when name is unknown', () => {
      assert.equal(guessDirectoryPurpose('mydir', ['app.test.js', 'utils.test.js']), 'test');
    });

    it('returns unknown for unrecognizable directories', () => {
      assert.equal(guessDirectoryPurpose('xyzzy', []), 'unknown');
    });
  });

  describe('scanDirectory', () => {
    it('scans a directory tree', () => {
      const tree = scanDirectory(FIXTURES_DIR, 0, 5);
      assert.equal(tree.type, 'directory');
      assert.ok(tree.children.length > 0);
    });

    it('respects max depth', () => {
      const tree = scanDirectory(FIXTURES_DIR, 0, 0);
      // At depth 0, children should have no grandchildren scanned deeply
      assert.equal(tree.depth, 0);
    });

    it('counts files in directory', () => {
      const tree = scanDirectory(FIXTURES_DIR, 0, 5);
      assert.ok(tree.fileCount >= 0);
    });

    it('handles nonexistent directory gracefully', () => {
      const tree = scanDirectory('/nonexistent/path', 0, 5);
      assert.equal(tree.error, 'unreadable');
    });
  });

  describe('detectConventions', () => {
    it('detects kebab-case naming', () => {
      const files = ['format-date.js', 'parse-input.js', 'my-component.js'];
      const conv = detectConventions(files);
      assert.equal(conv.dominant, 'kebab-case');
    });

    it('detects camelCase naming', () => {
      const files = ['formatDate.js', 'parseInput.js', 'myComponent.js'];
      const conv = detectConventions(files);
      assert.equal(conv.dominant, 'camelCase');
    });

    it('detects PascalCase naming', () => {
      const files = ['Button.jsx', 'Header.jsx', 'Footer.jsx'];
      const conv = detectConventions(files);
      assert.equal(conv.dominant, 'PascalCase');
    });

    it('detects test file pattern', () => {
      const files = ['app.test.js', 'utils.test.js'];
      const conv = detectConventions(files);
      assert.equal(conv.testPattern, '.test.ext');
    });

    it('detects spec file pattern', () => {
      const files = ['app.spec.ts', 'utils.spec.ts'];
      const conv = detectConventions(files);
      assert.equal(conv.testPattern, '.spec.ext');
    });
  });

  describe('detectBuildTools', () => {
    it('detects vite and typescript from config files', () => {
      const tools = detectBuildTools(FIXTURES_DIR);
      assert.ok(tools.includes('vite'));
      assert.ok(tools.includes('typescript'));
    });

    it('returns empty for directory with no build tools', () => {
      const tools = detectBuildTools(join(FIXTURES_DIR, 'docs'));
      assert.deepEqual(tools, []);
    });
  });

  describe('detectTestFramework', () => {
    it('detects node:test from package.json scripts', () => {
      const frameworks = detectTestFramework(FIXTURES_DIR);
      assert.ok(frameworks.includes('node:test'));
    });
  });

  describe('parseDependencies', () => {
    it('parses dependencies from package.json', () => {
      const deps = parseDependencies(FIXTURES_DIR);
      assert.equal(deps.totalDeps, 1);
      assert.equal(deps.totalDevDeps, 1);
      assert.ok(deps.dependencies.express);
    });

    it('detects npm as package manager', () => {
      const deps = parseDependencies(FIXTURES_DIR);
      assert.equal(deps.packageManager, 'npm');
    });

    it('extracts package metadata', () => {
      const deps = parseDependencies(FIXTURES_DIR);
      assert.equal(deps.name, 'test-project');
      assert.equal(deps.version, '1.0.0');
      assert.equal(deps.moduleType, 'module');
    });

    it('handles missing package.json', () => {
      const deps = parseDependencies(join(FIXTURES_DIR, 'docs'));
      assert.equal(deps.packageManager, 'unknown');
      assert.equal(deps.totalDeps, 0);
    });
  });

  describe('mapCodebase', () => {
    it('generates a complete codebase map', () => {
      const map = mapCodebase(FIXTURES_DIR);
      assert.ok(map.root);
      assert.ok(map.scannedAt);
      assert.ok(map.directories);
      assert.ok(map.fileTypes);
      assert.ok(map.conventions);
      assert.ok(map.dependencies);
      assert.ok(Array.isArray(map.entryPoints));
      assert.ok(map.testStructure);
      assert.ok(Array.isArray(map.lintConfig));
      assert.ok(Array.isArray(map.buildTools));
      assert.ok(typeof map.totalFiles === 'number');
      assert.ok(typeof map.totalLines === 'number');
    });

    it('counts files correctly', () => {
      const map = mapCodebase(FIXTURES_DIR);
      assert.ok(map.totalFiles > 0);
    });

    it('throws for nonexistent directory', () => {
      assert.throws(() => mapCodebase('/totally/fake/dir'), /does not exist/);
    });
  });

  describe('saveCodebaseMap / loadCodebaseMap', () => {
    it('saves and loads a codebase map', () => {
      const map = mapCodebase(FIXTURES_DIR);
      const savedPath = saveCodebaseMap(FIXTURES_DIR, map);
      assert.ok(existsSync(savedPath));

      const loaded = loadCodebaseMap(FIXTURES_DIR);
      assert.ok(loaded);
      assert.equal(loaded.root, map.root);
      assert.equal(loaded.totalFiles, map.totalFiles);
    });

    it('returns null for directory without saved map', () => {
      const loaded = loadCodebaseMap('/tmp/nonexistent-dir-for-test');
      assert.equal(loaded, null);
    });
  });

  // Cleanup
  after(() => cleanupFixtures());
});
