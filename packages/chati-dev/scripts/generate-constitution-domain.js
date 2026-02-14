#!/usr/bin/env node

/**
 * Generate Constitution Domain — Extracts governance rules from constitution.md
 * and generates a structured YAML domain file.
 *
 * Exports:
 *   generateConstitutionDomain(frameworkDir) → writes domains/constitution.yaml
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

/**
 * Map Roman numerals to integers.
 * @param {string} roman - Roman numeral string.
 * @returns {number} Integer value.
 */
function romanToInt(roman) {
  const values = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let result = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = values[roman[i]] || 0;
    const next = values[roman[i + 1]] || 0;
    result += current < next ? -current : current;
  }
  return result;
}

/**
 * Extract articles from constitution.md content.
 * @param {string} content - Full constitution markdown.
 * @returns {object[]} Array of { id, numeral, title, rules, enforcement }.
 */
function extractArticles(content) {
  const articles = [];

  // Split by article headers
  const articleRegex = /^## Article ([IVXLCDM]+):\s*(.+)/gm;
  let match;
  const articlePositions = [];

  while ((match = articleRegex.exec(content)) !== null) {
    articlePositions.push({
      numeral: match[1],
      title: match[2].trim(),
      start: match.index,
    });
  }

  for (let i = 0; i < articlePositions.length; i++) {
    const pos = articlePositions[i];
    const end = i + 1 < articlePositions.length ? articlePositions[i + 1].start : content.length;
    const section = content.slice(pos.start, end);

    // Extract enforcement
    const enforcementMatch = section.match(/\*\*Enforcement:\s*(BLOCK|GUIDE|WARN)\*\*/);
    const enforcement = enforcementMatch ? enforcementMatch[1].toLowerCase() : 'unknown';

    // Extract numbered rules (lines starting with number followed by period)
    const rules = [];
    const ruleLines = section.match(/^\d+\.\s+.+/gm) || [];
    for (const line of ruleLines) {
      const ruleText = line.replace(/^\d+\.\s+/, '').replace(/\*\*/g, '').trim();
      if (ruleText.length > 10) {
        rules.push(ruleText);
      }
    }

    articles.push({
      id: pos.numeral,
      number: romanToInt(pos.numeral),
      title: pos.title,
      rules,
      enforcement,
    });
  }

  return articles;
}

/**
 * Extract mode definitions from Article XI.
 * @param {string} content - Full constitution markdown.
 * @returns {object|null} Mode definitions.
 */
function extractModes(content) {
  // Find Article XI section
  const xiMatch = content.match(/## Article XI[\s\S]*?(?=## Article [IVXLCDM]+:|$)/);
  if (!xiMatch) return null;

  const section = xiMatch[0];

  const modes = {};

  // Extract from the table
  const tableRegex = /\|\s*\*\*(\w+)\*\*\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/g;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(section)) !== null) {
    const modeName = tableMatch[1].toLowerCase();
    const states = tableMatch[2].trim();
    const reads = tableMatch[3].trim();
    const writes = tableMatch[4].trim();

    modes[modeName] = {
      states: states.split(',').map(s => s.trim()).filter(Boolean),
      reads: reads || 'Entire project',
      writes: writes || 'unknown',
    };
  }

  return Object.keys(modes).length > 0 ? modes : null;
}

/**
 * Extract blocker codes from constitution content.
 * @param {string} content - Full constitution markdown.
 * @returns {{ critical: string[], general: string[] }}
 */
function extractBlockers(content) {
  const critical = [];
  const general = [];

  // Look for C01-C99 pattern (critical blockers)
  const criticalMatches = content.match(/C\d{2}/g) || [];
  for (const c of [...new Set(criticalMatches)]) {
    critical.push(c);
  }

  // Look for G01-G99 pattern (general blockers)
  const generalMatches = content.match(/G\d{2}/g) || [];
  for (const g of [...new Set(generalMatches)]) {
    general.push(g);
  }

  return { critical: critical.sort(), general: general.sort() };
}

/**
 * Extract quality thresholds from constitution content.
 * @param {string} content - Full constitution markdown.
 * @returns {object} Quality thresholds.
 */
function extractQualityThresholds(content) {
  const thresholds = {};

  // Look for percentage thresholds
  const selfValidation = content.match(/>= (\d+)%.*(?:self|validation|criteria|quality)/i);
  if (selfValidation) {
    thresholds.selfValidation = parseInt(selfValidation[1], 10);
  }

  const testCoverage = content.match(/test coverage.*?>= (\d+)%/i) || content.match(/>= (\d+)%.*?test coverage/i);
  if (testCoverage) {
    thresholds.testCoverage = parseInt(testCoverage[1], 10);
  }

  const maxCorrections = content.match(/(?:max|maximum)\s+(\d+)\s+correction/i);
  if (maxCorrections) {
    thresholds.maxCorrectionLoops = parseInt(maxCorrections[1], 10);
  }

  return thresholds;
}

/**
 * Generate a constitution domain YAML file from constitution.md.
 * @param {string} frameworkDir - Path to the framework directory.
 * @returns {{ path: string, domain: object }} The generated domain object and file path.
 */
export function generateConstitutionDomain(frameworkDir) {
  const constPath = join(frameworkDir, 'constitution.md');
  if (!existsSync(constPath)) {
    throw new Error(`constitution.md not found at: ${constPath}`);
  }

  const content = readFileSync(constPath, 'utf8');

  const articles = extractArticles(content);
  const modes = extractModes(content);
  const blockers = extractBlockers(content);
  const thresholds = extractQualityThresholds(content);

  const domain = {
    constitution: {
      version: '1.0',
      source: 'constitution.md',
      generatedAt: new Date().toISOString(),
      articleCount: articles.length,
      articles: articles.map(a => ({
        id: a.id,
        title: a.title,
        enforcement: a.enforcement,
        rules: a.rules,
      })),
    },
  };

  if (modes) {
    domain.constitution.modes = modes;
  }

  if (blockers.critical.length > 0 || blockers.general.length > 0) {
    domain.constitution.blockers = blockers;
  }

  if (Object.keys(thresholds).length > 0) {
    domain.constitution.qualityThresholds = thresholds;
  }

  // Write the domain file
  const domainsDir = join(frameworkDir, 'domains');
  mkdirSync(domainsDir, { recursive: true });

  const outputPath = join(domainsDir, 'constitution.yaml');
  const yamlContent = yaml.dump(domain, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });

  writeFileSync(outputPath, `# Constitution Domain — Auto-generated from constitution.md\n# Do not edit manually. Regenerate with: node scripts/generate-constitution-domain.js\n\n${yamlContent}`, 'utf8');

  return { path: outputPath, domain };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('generate-constitution-domain.js') ||
  process.argv[1].endsWith('generate-constitution-domain')
);

if (isMainModule) {
  const frameworkDir = process.argv[2] || join(process.cwd(), 'chati.dev');

  console.log(`Generating constitution domain from: ${frameworkDir}`);

  try {
    const { path, domain } = generateConstitutionDomain(frameworkDir);
    console.log(`Articles extracted: ${domain.constitution.articleCount}`);
    console.log(`Modes: ${domain.constitution.modes ? Object.keys(domain.constitution.modes).join(', ') : 'none'}`);
    console.log(`Blockers: critical=${domain.constitution.blockers?.critical?.length || 0}, general=${domain.constitution.blockers?.general?.length || 0}`);
    console.log(`Written to: ${path}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
