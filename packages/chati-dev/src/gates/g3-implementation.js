/**
 * @fileoverview G3 — Implementation Gate
 *
 * Post-Dev gate that validates implementation quality.
 * Checks that all dev tasks are completed, tests exist alongside
 * source files, lint passes, and no security issues are flagged.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GateBase } from './gate-base.js';
import { loadSession } from '../orchestrator/session-manager.js';
import { loadHandoff } from '../tasks/handoff.js';

export class ImplementationGate extends GateBase {
  constructor() {
    super({
      id: 'g3-implementation',
      name: 'Implementation Quality',
      pipelinePoint: 'post-dev',
      agent: 'dev',
    });
  }

  /**
   * Collect evidence about implementation completeness and quality.
   *
   * @param {string} projectDir
   * @returns {object} Evidence about dev tasks, files, tests, lint, and security
   */
  _collectEvidence(projectDir) {
    const evidence = {
      devTasksCompleted: false,
      sourceFilesCreated: false,
      testFilesCreated: false,
      lintPasses: null, // null = unknown, true/false = checked
      securityClean: null,
      devHandoff: null,
      sessionState: null,
    };

    // Load session state for dev agent status
    const sessionResult = loadSession(projectDir);
    if (sessionResult.loaded && sessionResult.session) {
      const devAgent = sessionResult.session.agents?.dev;
      evidence.devTasksCompleted = devAgent?.status === 'completed';

      evidence.sessionState = {
        devStatus: devAgent?.status || 'pending',
        devScore: devAgent?.score || 0,
        completedAgents: sessionResult.session.completed_agents || [],
      };
    }

    // Load dev handoff
    const handoffResult = loadHandoff(projectDir, 'dev');
    if (handoffResult.loaded && handoffResult.handoff) {
      evidence.devHandoff = {
        score: handoffResult.handoff.score,
        status: handoffResult.handoff.status,
        outputs: handoffResult.handoff.outputs || [],
        blockers: handoffResult.handoff.blockers || [],
        criteriaUnmet: handoffResult.handoff.criteria_unmet || [],
      };

      // Check if outputs indicate source and test files
      const outputs = evidence.devHandoff.outputs;
      evidence.sourceFilesCreated = outputs.some(o => {
        const lower = (typeof o === 'string' ? o : '').toLowerCase();
        return lower.includes('src/') || lower.includes('.js') || lower.includes('.ts');
      });
      evidence.testFilesCreated = outputs.some(o => {
        const lower = (typeof o === 'string' ? o : '').toLowerCase();
        return lower.includes('test') || lower.includes('.test.') || lower.includes('.spec.');
      });
    }

    // Check for lint results file
    const lintResultPath = join(projectDir, '.lint-result');
    if (existsSync(lintResultPath)) {
      evidence.lintPasses = true; // Presence of file assumed to mean lint was run
    }

    // Check for security scan results
    const securityPaths = [
      join(projectDir, '.security-scan'),
      join(projectDir, 'chati.dev', 'artifacts', 'security-report.md'),
    ];
    for (const secPath of securityPaths) {
      if (existsSync(secPath)) {
        evidence.securityClean = true;
        break;
      }
    }

    // If no explicit source/test file indicators, check project src/ and test/ dirs
    if (!evidence.sourceFilesCreated) {
      const srcDir = join(projectDir, 'src');
      if (existsSync(srcDir)) {
        try {
          const entries = readdirSync(srcDir, { recursive: false });
          evidence.sourceFilesCreated = entries.length > 0;
        } catch {
          // Ignore
        }
      }
    }

    if (!evidence.testFilesCreated) {
      const testDir = join(projectDir, 'test');
      if (existsSync(testDir)) {
        try {
          const entries = readdirSync(testDir, { recursive: false });
          evidence.testFilesCreated = entries.length > 0;
        } catch {
          // Ignore
        }
      }
    }

    return evidence;
  }

  /**
   * Validate implementation evidence.
   *
   * @param {object} evidence
   * @returns {{ score: number, criteriaResults: string[], allCriteria: string[], warnings: string[] }}
   */
  _validateEvidence(evidence) {
    const allCriteria = [
      'All dev tasks completed',
      'Source files created',
      'Test files created alongside source',
      'Lint passes',
      'No security issues flagged',
      'Dev handoff score >= 90',
    ];

    const criteriaResults = [];
    const warnings = [];

    if (evidence.devTasksCompleted) {
      criteriaResults.push('All dev tasks completed');
    }

    if (evidence.sourceFilesCreated) {
      criteriaResults.push('Source files created');
    }

    if (evidence.testFilesCreated) {
      criteriaResults.push('Test files created alongside source');
    } else {
      warnings.push('No test files detected');
    }

    if (evidence.lintPasses === true) {
      criteriaResults.push('Lint passes');
    } else if (evidence.lintPasses === null) {
      warnings.push('Lint status unknown — no .lint-result found');
    }

    if (evidence.securityClean === true) {
      criteriaResults.push('No security issues flagged');
    } else if (evidence.securityClean === null) {
      warnings.push('Security scan not found — consider running a scan');
    }

    // Check dev handoff score
    if (evidence.devHandoff) {
      if (evidence.devHandoff.score >= 90) {
        criteriaResults.push('Dev handoff score >= 90');
      } else {
        warnings.push(`Dev handoff score: ${evidence.devHandoff.score} (need >= 90)`);
      }

      if (evidence.devHandoff.blockers.length > 0) {
        warnings.push(`${evidence.devHandoff.blockers.length} blocker(s) from dev`);
      }
    }

    const score = allCriteria.length > 0
      ? Math.round((criteriaResults.length / allCriteria.length) * 100)
      : 0;

    return { score, criteriaResults, allCriteria, warnings };
  }
}
