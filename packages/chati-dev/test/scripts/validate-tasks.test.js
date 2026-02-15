import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

import {
  validateAllTasks,
  validateTask,
  validateHandoffChain,
  getTaskStats,
} from '../../scripts/validate-tasks.js';

const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures', 'validate-tasks');

function setupFixtures() {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
  mkdirSync(FIXTURES_DIR, { recursive: true });

  // Valid task files
  writeFileSync(join(FIXTURES_DIR, 'brief-extract-requirements.md'), `---
id: brief-extract-requirements
agent: brief
trigger: orchestrator
phase: planning
requires_input: true
parallelizable: false
outputs: [requirements-raw.yaml]
handoff_to: brief-validate-completeness
autonomous_gate: true
criteria:
  - All 5 requirement categories populated
  - At least 5 functional requirements captured
  - Confidence >= 85%
---
# Extract Requirements from User Input

## Purpose
Extract and structure requirements from user's initial brain dump.
`);

  writeFileSync(join(FIXTURES_DIR, 'brief-validate-completeness.md'), `---
id: brief-validate-completeness
agent: brief
trigger: brief-extract-requirements
phase: planning
requires_input: false
outputs: [brief-validated.yaml]
handoff_to: detail
criteria:
  - All gaps identified and addressed
  - Completeness score >= 90%
---
# Validate Brief Completeness
Check for gaps and missing information.
`);

  writeFileSync(join(FIXTURES_DIR, 'dev-implement.md'), `---
id: dev-implement
agent: dev
trigger: orchestrator
phase: build
requires_input: false
parallelizable: true
outputs: [source-code]
handoff_to: qa-implementation
criteria:
  - Code compiles without errors
  - All acceptance criteria implemented
---
# Implement Feature
Write the code.
`);

  writeFileSync(join(FIXTURES_DIR, 'orchestrator-route.md'), `---
id: orchestrator-route
agent: orchestrator
trigger: user
phase: planning
outputs: [routing-decision]
criteria:
  - Correct agent selected
  - Context passed successfully
---
# Route User Request
Determine which agent handles the request.
`);

  // Task with no frontmatter
  writeFileSync(join(FIXTURES_DIR, 'bad-no-frontmatter.md'), `
# No frontmatter here
Just plain markdown text.
`);

  // Task with missing required fields
  writeFileSync(join(FIXTURES_DIR, 'bad-missing-fields.md'), `---
phase: planning
---
# Missing ID and Agent
`);

  // Task with unknown agent
  writeFileSync(join(FIXTURES_DIR, 'warn-unknown-agent.md'), `---
id: warn-unknown-agent
agent: nonexistent-agent
phase: planning
criteria:
  - Some criterion
---
# Task for unknown agent
`);

  // Task with broken handoff
  writeFileSync(join(FIXTURES_DIR, 'broken-handoff.md'), `---
id: broken-handoff
agent: brief
trigger: orchestrator
phase: planning
handoff_to: totally-nonexistent-task-999
criteria:
  - Something
---
# Broken Handoff Task
`);
}

function cleanupFixtures() {
  rmSync(FIXTURES_DIR, { recursive: true, force: true });
}

describe('validate-tasks', () => {
  before(() => setupFixtures());

  describe('validateTask', () => {
    it('validates a well-formed task', () => {
      const result = validateTask(FIXTURES_DIR, 'brief-extract-requirements.md');
      assert.ok(result.valid);
      assert.equal(result.errors.length, 0);
      assert.ok(result.frontmatter);
      assert.equal(result.frontmatter.id, 'brief-extract-requirements');
      assert.equal(result.frontmatter.agent, 'brief');
    });

    it('rejects task without frontmatter', () => {
      const result = validateTask(FIXTURES_DIR, 'bad-no-frontmatter.md');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('No YAML frontmatter')));
    });

    it('rejects task missing required fields', () => {
      const result = validateTask(FIXTURES_DIR, 'bad-missing-fields.md');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes("'id'")));
      assert.ok(result.errors.some(e => e.includes("'agent'")));
    });

    it('warns about unknown agent', () => {
      const result = validateTask(FIXTURES_DIR, 'warn-unknown-agent.md');
      assert.ok(result.valid); // Unknown agent is a warning, not an error
      assert.ok(result.warnings.some(w => w.includes('Unknown agent')));
    });

    it('reports missing file', () => {
      const result = validateTask(FIXTURES_DIR, 'nonexistent.md');
      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('not found')));
    });
  });

  describe('validateAllTasks', () => {
    it('validates all tasks in directory', () => {
      const report = validateAllTasks(FIXTURES_DIR);
      assert.ok(report.totalFiles > 0);
      assert.ok(report.tasks.length > 0);
    });

    it('identifies valid and invalid tasks', () => {
      const report = validateAllTasks(FIXTURES_DIR);
      assert.ok(report.totalValid > 0);
      assert.ok(report.totalValid < report.totalFiles); // Some should fail
    });

    it('handles nonexistent directory', () => {
      const report = validateAllTasks('/nonexistent/path');
      assert.equal(report.valid, false);
      assert.ok(report.errors.length > 0);
    });

    it('detects duplicate IDs', () => {
      // Create a temp dir with duplicates
      const dupDir = join(FIXTURES_DIR, '_duplicates');
      mkdirSync(dupDir, { recursive: true });

      writeFileSync(join(dupDir, 'task-a.md'), `---
id: same-id
agent: brief
---
# Task A`);

      writeFileSync(join(dupDir, 'task-b.md'), `---
id: same-id
agent: dev
---
# Task B`);

      const report = validateAllTasks(dupDir);
      assert.equal(report.valid, false);
      assert.ok(report.duplicateIds.length > 0);
      assert.equal(report.duplicateIds[0].id, 'same-id');

      rmSync(dupDir, { recursive: true, force: true });
    });
  });

  describe('validateHandoffChain', () => {
    it('detects broken handoff links', () => {
      const result = validateHandoffChain(FIXTURES_DIR);
      assert.ok(result.brokenLinks.length > 0);
      assert.ok(result.brokenLinks.some(l => l.from === 'broken-handoff'));
    });

    it('validates valid handoff chains', () => {
      // brief-extract-requirements -> brief-validate-completeness is valid
      const result = validateHandoffChain(FIXTURES_DIR);
      assert.ok(!result.brokenLinks.some(l =>
        l.from === 'brief-extract-requirements' && l.to === 'brief-validate-completeness'));
    });

    it('handles nonexistent directory', () => {
      const result = validateHandoffChain('/nonexistent/path');
      assert.equal(result.valid, false);
    });
  });

  describe('getTaskStats', () => {
    it('returns statistics about tasks', () => {
      const stats = getTaskStats(FIXTURES_DIR);
      assert.ok(stats.total > 0);
      assert.ok(typeof stats.byAgent === 'object');
      assert.ok(typeof stats.byPhase === 'object');
    });

    it('counts tasks by agent', () => {
      const stats = getTaskStats(FIXTURES_DIR);
      assert.ok(stats.byAgent.brief > 0);
      assert.ok(stats.byAgent.dev > 0);
    });

    it('counts tasks by phase', () => {
      const stats = getTaskStats(FIXTURES_DIR);
      assert.ok(stats.byPhase.planning > 0);
      assert.ok(stats.byPhase.build > 0);
    });

    it('counts handoffs', () => {
      const stats = getTaskStats(FIXTURES_DIR);
      assert.ok(stats.withHandoffs > 0);
    });

    it('handles nonexistent directory', () => {
      const stats = getTaskStats('/nonexistent/path');
      assert.equal(stats.total, 0);
    });
  });

  after(() => cleanupFixtures());
});
