/**
 * Framework Analyzer — Detects project technology stack through static analysis.
 *
 * Inspects package.json, configuration files, and file patterns to identify
 * frameworks, languages, package managers, ORMs, databases, and monorepo tools.
 *
 * @module scripts/framework-analyzer
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Object} FrameworkReport
 * @property {string[]} frontendFrameworks
 * @property {string[]} backendFrameworks
 * @property {string[]} languages
 * @property {string} packageManager
 * @property {string[]} monorepoTools
 * @property {string[]} orms
 * @property {string[]} databases
 * @property {string[]} testingFrameworks
 * @property {string[]} buildTools
 * @property {Object} raw — raw detection results before merging
 */

/**
 * Safely reads and parses a JSON file.
 * @param {string} filePath
 * @returns {Object|null}
 */
function readJSON(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Checks if a file or directory exists.
 * @param  {...string} segments
 * @returns {boolean}
 */
function pathExists(...segments) {
  return existsSync(join(...segments));
}

/**
 * Detects technologies from package.json dependencies.
 *
 * @param {string} targetDir
 * @returns {Partial<FrameworkReport>}
 */
export function detectByPackageJson(targetDir) {
  const pkg = readJSON(join(targetDir, 'package.json'));
  if (!pkg) return {};

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };
  const depNames = new Set(Object.keys(allDeps));

  const frontendFrameworks = [];
  const backendFrameworks = [];
  const orms = [];
  const databases = [];
  const testingFrameworks = [];
  const buildTools = [];
  const monorepoTools = [];

  // Frontend
  if (depNames.has('next')) frontendFrameworks.push('Next.js');
  else if (depNames.has('react')) frontendFrameworks.push('React');
  if (depNames.has('nuxt') || depNames.has('nuxt3')) frontendFrameworks.push('Nuxt');
  else if (depNames.has('vue')) frontendFrameworks.push('Vue');
  if (depNames.has('@sveltejs/kit')) frontendFrameworks.push('SvelteKit');
  else if (depNames.has('svelte')) frontendFrameworks.push('Svelte');
  if (depNames.has('@angular/core')) frontendFrameworks.push('Angular');

  // Backend
  if (depNames.has('express')) backendFrameworks.push('Express');
  if (depNames.has('fastify')) backendFrameworks.push('Fastify');
  if (depNames.has('koa')) backendFrameworks.push('Koa');
  if (depNames.has('@nestjs/core')) backendFrameworks.push('NestJS');
  if (depNames.has('hono')) backendFrameworks.push('Hono');
  if (depNames.has('@hapi/hapi') || depNames.has('hapi')) backendFrameworks.push('Hapi');

  // ORM
  if (depNames.has('prisma') || depNames.has('@prisma/client')) orms.push('Prisma');
  if (depNames.has('drizzle-orm')) orms.push('Drizzle');
  if (depNames.has('typeorm')) orms.push('TypeORM');
  if (depNames.has('sequelize')) orms.push('Sequelize');
  if (depNames.has('mongoose')) orms.push('Mongoose');
  if (depNames.has('knex')) orms.push('Knex');

  // Database
  if (depNames.has('pg') || depNames.has('postgres') || depNames.has('@vercel/postgres')) databases.push('PostgreSQL');
  if (depNames.has('mysql2') || depNames.has('mysql')) databases.push('MySQL');
  if (depNames.has('mongodb') || depNames.has('mongoose')) databases.push('MongoDB');
  if (depNames.has('better-sqlite3') || depNames.has('sqlite3')) databases.push('SQLite');
  if (depNames.has('redis') || depNames.has('ioredis')) databases.push('Redis');

  // Testing
  if (depNames.has('jest')) testingFrameworks.push('Jest');
  if (depNames.has('vitest')) testingFrameworks.push('Vitest');
  if (depNames.has('mocha')) testingFrameworks.push('Mocha');
  if (depNames.has('@playwright/test') || depNames.has('playwright')) testingFrameworks.push('Playwright');
  if (depNames.has('cypress')) testingFrameworks.push('Cypress');

  // Build tools
  if (depNames.has('vite')) buildTools.push('Vite');
  if (depNames.has('webpack')) buildTools.push('Webpack');
  if (depNames.has('esbuild')) buildTools.push('esbuild');
  if (depNames.has('rollup')) buildTools.push('Rollup');
  if (depNames.has('tsup')) buildTools.push('tsup');
  if (depNames.has('turbo')) buildTools.push('Turborepo');

  // Monorepo
  if (depNames.has('turbo') || depNames.has('turborepo')) monorepoTools.push('Turborepo');
  if (depNames.has('lerna')) monorepoTools.push('Lerna');
  if (depNames.has('nx') || depNames.has('@nrwl/workspace')) monorepoTools.push('Nx');

  return { frontendFrameworks, backendFrameworks, orms, databases, testingFrameworks, buildTools, monorepoTools };
}

/**
 * Detects technologies from configuration files present in the project.
 *
 * @param {string} targetDir
 * @returns {Partial<FrameworkReport>}
 */
export function detectByConfigFiles(targetDir) {
  const languages = [];
  const buildTools = [];
  const monorepoTools = [];

  // TypeScript
  if (pathExists(targetDir, 'tsconfig.json') || pathExists(targetDir, 'tsconfig.base.json')) {
    languages.push('TypeScript');
  }

  // Python
  if (pathExists(targetDir, 'pyproject.toml') || pathExists(targetDir, 'setup.py') || pathExists(targetDir, 'requirements.txt')) {
    languages.push('Python');
  }

  // Go
  if (pathExists(targetDir, 'go.mod')) {
    languages.push('Go');
  }

  // Rust
  if (pathExists(targetDir, 'Cargo.toml')) {
    languages.push('Rust');
  }

  // Build tools
  if (pathExists(targetDir, 'vite.config.js') || pathExists(targetDir, 'vite.config.ts')) {
    buildTools.push('Vite');
  }
  if (pathExists(targetDir, 'webpack.config.js') || pathExists(targetDir, 'webpack.config.ts')) {
    buildTools.push('Webpack');
  }
  if (pathExists(targetDir, 'rollup.config.js') || pathExists(targetDir, 'rollup.config.mjs')) {
    buildTools.push('Rollup');
  }

  // Monorepo
  if (pathExists(targetDir, 'turbo.json')) monorepoTools.push('Turborepo');
  if (pathExists(targetDir, 'lerna.json')) monorepoTools.push('Lerna');
  if (pathExists(targetDir, 'nx.json')) monorepoTools.push('Nx');
  if (pathExists(targetDir, 'pnpm-workspace.yaml')) monorepoTools.push('pnpm workspaces');

  // Package manager detection
  let packageManager = 'npm'; // default
  if (pathExists(targetDir, 'bun.lockb') || pathExists(targetDir, 'bun.lock')) {
    packageManager = 'bun';
  } else if (pathExists(targetDir, 'pnpm-lock.yaml')) {
    packageManager = 'pnpm';
  } else if (pathExists(targetDir, 'yarn.lock')) {
    packageManager = 'yarn';
  }

  return { languages, buildTools, monorepoTools, packageManager };
}

/**
 * Detects technologies from file patterns in the project directory.
 *
 * @param {string} targetDir
 * @returns {Partial<FrameworkReport>}
 */
export function detectByFilePatterns(targetDir) {
  const languages = [];

  // Check top-level files and src/ for language clues
  const dirsToCheck = [targetDir];
  if (pathExists(targetDir, 'src')) dirsToCheck.push(join(targetDir, 'src'));

  const extensions = new Set();
  for (const dir of dirsToCheck) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      try {
        const stat = statSync(join(dir, entry));
        if (stat.isFile()) {
          const ext = entry.slice(entry.lastIndexOf('.'));
          extensions.add(ext);
        }
      } catch {
        // skip
      }
    }
  }

  if (extensions.has('.ts') || extensions.has('.tsx')) {
    languages.push('TypeScript');
  }
  if (extensions.has('.js') || extensions.has('.jsx') || extensions.has('.mjs')) {
    languages.push('JavaScript');
  }
  if (extensions.has('.py')) {
    languages.push('Python');
  }
  if (extensions.has('.go')) {
    languages.push('Go');
  }
  if (extensions.has('.rs')) {
    languages.push('Rust');
  }

  return { languages };
}

/**
 * Merges multiple partial detection reports, deduplicating arrays.
 *
 * @param  {...Partial<FrameworkReport>} reports
 * @returns {FrameworkReport}
 */
export function mergeDetections(...reports) {
  const merged = {
    frontendFrameworks: [],
    backendFrameworks: [],
    languages: [],
    packageManager: 'npm',
    monorepoTools: [],
    orms: [],
    databases: [],
    testingFrameworks: [],
    buildTools: [],
    raw: {},
  };

  const arrayFields = [
    'frontendFrameworks',
    'backendFrameworks',
    'languages',
    'monorepoTools',
    'orms',
    'databases',
    'testingFrameworks',
    'buildTools',
  ];

  for (const report of reports) {
    if (!report) continue;
    for (const field of arrayFields) {
      if (Array.isArray(report[field])) {
        for (const item of report[field]) {
          if (!merged[field].includes(item)) {
            merged[field].push(item);
          }
        }
      }
    }
    if (report.packageManager) {
      merged.packageManager = report.packageManager;
    }
  }

  // Store raw detections for debugging
  merged.raw = { reports: reports.filter(Boolean) };

  return merged;
}

/**
 * Full framework analysis for a target directory.
 *
 * @param {string} targetDir
 * @returns {FrameworkReport}
 */
export function analyzeFramework(targetDir) {
  const byPackage = detectByPackageJson(targetDir);
  const byConfig = detectByConfigFiles(targetDir);
  const byFiles = detectByFilePatterns(targetDir);

  return mergeDetections(byPackage, byConfig, byFiles);
}
