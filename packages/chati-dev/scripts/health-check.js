#!/usr/bin/env node

/**
 * Health Check — Comprehensive framework integrity validation.
 *
 * Exports:
 *   runHealthCheck(frameworkDir) → HealthReport
 *   formatHealthReport(report) → human-readable string
 *
 * HealthReport:
 *   { overall: 'HEALTHY'|'DEGRADED'|'UNHEALTHY', checks: {...}, timestamp }
 *
 * Each check:
 *   { pass: boolean, details: string, severity: 'critical'|'warning'|'info' }
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * Check entity-registry.yaml integrity.
 */
function checkRegistry(frameworkDir) {
  const regPath = join(frameworkDir, 'data', 'entity-registry.yaml');
  if (!existsSync(regPath)) {
    return { pass: false, details: 'entity-registry.yaml not found', severity: 'critical' };
  }

  try {
    const content = readFileSync(regPath, 'utf8');
    const registry = yaml.load(content);

    if (!registry || !registry.entities) {
      return { pass: false, details: 'entity-registry.yaml has no entities section', severity: 'critical' };
    }

    // Count all entities across all categories
    let entityCount = 0;
    for (const category of Object.values(registry.entities)) {
      if (typeof category === 'object' && category !== null) {
        entityCount += Object.keys(category).length;
      }
    }

    const declaredCount = registry.metadata?.entity_count || 0;
    if (declaredCount > 0 && entityCount !== declaredCount) {
      return {
        pass: false,
        details: `Entity count mismatch: declared ${declaredCount}, actual ${entityCount}`,
        severity: 'warning',
      };
    }

    return { pass: true, details: `${entityCount} entities registered`, severity: 'info' };
  } catch (err) {
    return { pass: false, details: `Failed to parse: ${err.message}`, severity: 'critical' };
  }
}

/**
 * Check that all schema files exist and are valid JSON.
 */
function checkSchemas(frameworkDir) {
  const schemasDir = join(frameworkDir, 'schemas');
  if (!existsSync(schemasDir)) {
    return { pass: false, details: 'schemas/ directory not found', severity: 'critical' };
  }

  const expectedSchemas = [
    'session.schema.json',
    'config.schema.json',
    'context.schema.json',
    'memory.schema.json',
    'task.schema.json',
  ];

  const missing = [];
  const invalid = [];

  for (const schema of expectedSchemas) {
    const schemaPath = join(schemasDir, schema);
    if (!existsSync(schemaPath)) {
      missing.push(schema);
      continue;
    }
    try {
      JSON.parse(readFileSync(schemaPath, 'utf8'));
    } catch {
      invalid.push(schema);
    }
  }

  if (missing.length > 0 || invalid.length > 0) {
    const issues = [];
    if (missing.length) issues.push(`missing: ${missing.join(', ')}`);
    if (invalid.length) issues.push(`invalid JSON: ${invalid.join(', ')}`);
    return {
      pass: false,
      details: issues.join('; '),
      severity: missing.length > 0 ? 'critical' : 'warning',
    };
  }

  const actualSchemas = readdirSync(schemasDir).filter(f => f.endsWith('.json'));
  return { pass: true, details: `${actualSchemas.length} schemas valid`, severity: 'info' };
}

/**
 * Check constitution.md exists and has the expected number of articles.
 */
function checkConstitution(frameworkDir) {
  const constPath = join(frameworkDir, 'constitution.md');
  if (!existsSync(constPath)) {
    return { pass: false, details: 'constitution.md not found', severity: 'critical' };
  }

  try {
    const content = readFileSync(constPath, 'utf8');
    const articleMatches = content.match(/^## Article [IVXLCDM]+/gm) || [];
    const articleCount = articleMatches.length;

    if (articleCount < 10) {
      return {
        pass: false,
        details: `Only ${articleCount} articles found (expected 10+)`,
        severity: 'warning',
      };
    }

    return { pass: true, details: `${articleCount} articles found`, severity: 'info' };
  } catch (err) {
    return { pass: false, details: `Failed to read: ${err.message}`, severity: 'critical' };
  }
}

/**
 * Check that all 13 agent definition files exist with valid structure.
 */
function checkAgents(frameworkDir) {
  const agentsDir = join(frameworkDir, 'agents');
  const orchestratorDir = join(frameworkDir, 'orchestrator');

  const expectedAgents = {
    'clarity/greenfield-wu.md': 'greenfield-wu',
    'clarity/brownfield-wu.md': 'brownfield-wu',
    'clarity/brief.md': 'brief',
    'clarity/detail.md': 'detail',
    'clarity/architect.md': 'architect',
    'clarity/ux.md': 'ux',
    'clarity/phases.md': 'phases',
    'clarity/tasks.md': 'tasks',
    'quality/qa-planning.md': 'qa-planning',
    'quality/qa-implementation.md': 'qa-implementation',
    'build/dev.md': 'dev',
    'deploy/devops.md': 'devops',
  };

  const missing = [];
  const invalid = [];

  // Check agent files
  for (const [relPath, name] of Object.entries(expectedAgents)) {
    const fullPath = join(agentsDir, relPath);
    if (!existsSync(fullPath)) {
      missing.push(name);
      continue;
    }
    try {
      const content = readFileSync(fullPath, 'utf8');
      if (!content.includes('## Identity') && !content.includes('## Mission')) {
        invalid.push(name);
      }
    } catch {
      invalid.push(name);
    }
  }

  // Check orchestrator
  const orchPath = join(orchestratorDir, 'chati.md');
  if (!existsSync(orchPath)) {
    missing.push('orchestrator');
  }

  const total = Object.keys(expectedAgents).length + 1; // +1 for orchestrator
  const found = total - missing.length;

  if (missing.length > 0 || invalid.length > 0) {
    const issues = [];
    if (missing.length) issues.push(`missing: ${missing.join(', ')}`);
    if (invalid.length) issues.push(`invalid: ${invalid.join(', ')}`);
    return {
      pass: false,
      details: `${found}/${total} agents found; ${issues.join('; ')}`,
      severity: missing.length > 0 ? 'critical' : 'warning',
    };
  }

  return { pass: true, details: `${found}/${total} agents present`, severity: 'info' };
}

/**
 * Check that workflow files exist and are valid YAML.
 */
function checkWorkflows(frameworkDir) {
  const workflowsDir = join(frameworkDir, 'workflows');
  if (!existsSync(workflowsDir)) {
    return { pass: false, details: 'workflows/ directory not found', severity: 'warning' };
  }

  const invalid = [];

  let files;
  try {
    files = readdirSync(workflowsDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch (err) {
    return { pass: false, details: `Cannot read workflows/: ${err.message}`, severity: 'warning' };
  }

  const total = files.length;
  let valid = 0;

  for (const file of files) {
    try {
      yaml.load(readFileSync(join(workflowsDir, file), 'utf8'));
      valid++;
    } catch {
      invalid.push(file);
    }
  }

  if (total === 0) {
    return { pass: false, details: 'No workflow files found', severity: 'warning' };
  }

  if (invalid.length > 0) {
    return { pass: false, details: `${valid}/${total} valid; invalid: ${invalid.join(', ')}`, severity: 'warning' };
  }

  return { pass: true, details: `${valid} workflows valid`, severity: 'info' };
}

/**
 * Check templates directory.
 */
function checkTemplates(frameworkDir) {
  const templatesDir = join(frameworkDir, 'templates');
  if (!existsSync(templatesDir)) {
    return { pass: false, details: 'templates/ directory not found', severity: 'warning' };
  }

  let files;
  try {
    files = readdirSync(templatesDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  } catch {
    return { pass: false, details: 'Cannot read templates/', severity: 'warning' };
  }

  const total = files.length;
  let valid = 0;

  for (const file of files) {
    try {
      yaml.load(readFileSync(join(templatesDir, file), 'utf8'));
      valid++;
    } catch {
      // Invalid YAML
    }
  }

  if (total === 0) {
    return { pass: false, details: 'No template files found', severity: 'warning' };
  }

  return { pass: valid === total, details: `${valid}/${total} templates valid`, severity: valid < total ? 'warning' : 'info' };
}

/**
 * Check quality gates directory.
 */
function checkQualityGates(frameworkDir) {
  const gatesDir = join(frameworkDir, 'quality-gates');
  if (!existsSync(gatesDir)) {
    return { pass: false, details: 'quality-gates/ directory not found', severity: 'warning' };
  }

  const expected = ['planning-gate.md', 'implementation-gate.md'];
  const missing = expected.filter(f => !existsSync(join(gatesDir, f)));

  if (missing.length > 0) {
    return { pass: false, details: `Missing: ${missing.join(', ')}`, severity: 'warning' };
  }

  return { pass: true, details: `${expected.length} quality gates present`, severity: 'info' };
}

/**
 * Check config.yaml.
 */
function checkConfig(frameworkDir) {
  const configPath = join(frameworkDir, 'config.yaml');
  if (!existsSync(configPath)) {
    return { pass: false, details: 'config.yaml not found', severity: 'critical' };
  }

  try {
    const content = readFileSync(configPath, 'utf8');
    // config.yaml has a markdown header line, extract YAML portion
    const lines = content.split('\n');
    const yamlLines = lines.filter(l => !l.startsWith('#'));
    const config = yaml.load(yamlLines.join('\n'));

    if (!config) {
      return { pass: false, details: 'config.yaml is empty', severity: 'critical' };
    }

    return { pass: true, details: `version: ${config.version || 'unknown'}`, severity: 'info' };
  } catch (err) {
    return { pass: false, details: `Failed to parse: ${err.message}`, severity: 'critical' };
  }
}

/**
 * Check intelligence directory.
 */
function checkIntelligence(frameworkDir) {
  const intellDir = join(frameworkDir, 'intelligence');
  if (!existsSync(intellDir)) {
    return { pass: false, details: 'intelligence/ directory not found', severity: 'warning' };
  }

  const expectedFiles = [
    'context-engine.md',
    'memory-layer.md',
    'decision-engine.md',
    'confidence.yaml',
    'patterns.yaml',
    'gotchas.yaml',
  ];

  const found = expectedFiles.filter(f => existsSync(join(intellDir, f)));

  if (found.length < expectedFiles.length) {
    const missing = expectedFiles.filter(f => !found.includes(f));
    return {
      pass: false,
      details: `${found.length}/${expectedFiles.length} present; missing: ${missing.join(', ')}`,
      severity: 'warning',
    };
  }

  return { pass: true, details: `${found.length} intelligence files present`, severity: 'info' };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run a comprehensive health check on the framework directory.
 * @param {string} frameworkDir - Path to the framework directory (e.g., chati.dev/ or framework/).
 * @returns {object} HealthReport.
 */
export function runHealthCheck(frameworkDir) {
  if (!existsSync(frameworkDir)) {
    return {
      overall: 'UNHEALTHY',
      checks: {
        frameworkDir: { pass: false, details: `Directory not found: ${frameworkDir}`, severity: 'critical' },
      },
      timestamp: new Date().toISOString(),
    };
  }

  const checks = {
    registry: checkRegistry(frameworkDir),
    schemas: checkSchemas(frameworkDir),
    constitution: checkConstitution(frameworkDir),
    agents: checkAgents(frameworkDir),
    workflows: checkWorkflows(frameworkDir),
    templates: checkTemplates(frameworkDir),
    qualityGates: checkQualityGates(frameworkDir),
    config: checkConfig(frameworkDir),
    intelligence: checkIntelligence(frameworkDir),
  };

  // Determine overall health
  const criticalFailures = Object.values(checks).filter(c => !c.pass && c.severity === 'critical');
  const warnings = Object.values(checks).filter(c => !c.pass && c.severity === 'warning');

  let overall;
  if (criticalFailures.length > 0) {
    overall = 'UNHEALTHY';
  } else if (warnings.length > 0) {
    overall = 'DEGRADED';
  } else {
    overall = 'HEALTHY';
  }

  return {
    overall,
    checks,
    timestamp: new Date().toISOString(),
    summary: {
      total: Object.keys(checks).length,
      passed: Object.values(checks).filter(c => c.pass).length,
      failed: Object.values(checks).filter(c => !c.pass).length,
      criticalFailures: criticalFailures.length,
      warnings: warnings.length,
    },
  };
}

/**
 * Format a HealthReport into a human-readable string.
 * @param {object} report - HealthReport from runHealthCheck.
 * @returns {string} Formatted report string.
 */
export function formatHealthReport(report) {
  const statusSymbol = {
    HEALTHY: '[OK]',
    DEGRADED: '[WARN]',
    UNHEALTHY: '[FAIL]',
  };

  const checkSymbol = (check) => check.pass ? '[PASS]' : '[FAIL]';

  const lines = [
    `=== Health Check Report ===`,
    `Status: ${statusSymbol[report.overall] || '[ ? ]'} ${report.overall}`,
    `Time:   ${report.timestamp}`,
    '',
  ];

  if (report.summary) {
    lines.push(`Summary: ${report.summary.passed}/${report.summary.total} checks passed`);
    if (report.summary.criticalFailures > 0) {
      lines.push(`         ${report.summary.criticalFailures} critical failure(s)`);
    }
    if (report.summary.warnings > 0) {
      lines.push(`         ${report.summary.warnings} warning(s)`);
    }
    lines.push('');
  }

  lines.push('Checks:');
  for (const [name, check] of Object.entries(report.checks)) {
    const symbol = checkSymbol(check);
    const severity = check.severity !== 'info' ? ` (${check.severity})` : '';
    lines.push(`  ${symbol} ${name}: ${check.details}${severity}`);
  }

  lines.push('');
  lines.push('=== End Report ===');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('health-check.js') ||
  process.argv[1].endsWith('health-check')
);

if (isMainModule) {
  const frameworkDir = process.argv[2] || join(process.cwd(), 'chati.dev');

  const report = runHealthCheck(frameworkDir);
  console.log(formatHealthReport(report));

  if (report.overall === 'UNHEALTHY') {
    process.exit(1);
  }
}
