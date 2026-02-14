/**
 * @fileoverview G5 — Deploy Ready Gate
 *
 * Pre-Deploy gate that validates everything is ready for deployment.
 * Checks that QA-Implementation passed, documentation is updated,
 * release notes exist, all tasks are complete, and no blockers remain.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GateBase } from './gate-base.js';
import { loadSession } from '../orchestrator/session-manager.js';
import { loadHandoff } from '../tasks/handoff.js';

export class DeployReadyGate extends GateBase {
  constructor() {
    super({
      id: 'g5-deploy-ready',
      name: 'Deploy Ready',
      pipelinePoint: 'pre-deploy',
      agent: 'devops',
    });
  }

  /**
   * Collect evidence about deployment readiness.
   *
   * @param {string} projectDir
   * @returns {object} Evidence about QA status, docs, release notes, blockers
   */
  _collectEvidence(projectDir) {
    const evidence = {
      qaImplPassed: false,
      readmeUpdated: false,
      changelogUpdated: false,
      releaseNotesPrepared: false,
      allTasksCompleted: false,
      noOpenBlockers: true,
      sessionState: null,
    };

    // Check QA-Implementation status
    const qaHandoff = loadHandoff(projectDir, 'qa-implementation');
    if (qaHandoff.loaded && qaHandoff.handoff) {
      evidence.qaImplPassed = qaHandoff.handoff.score >= 90 &&
        qaHandoff.handoff.status === 'complete';
    }

    // Check README exists
    const readmePaths = [
      join(projectDir, 'README.md'),
      join(projectDir, 'readme.md'),
    ];
    for (const readmePath of readmePaths) {
      if (existsSync(readmePath)) {
        evidence.readmeUpdated = true;
        break;
      }
    }

    // Check CHANGELOG exists
    const changelogPaths = [
      join(projectDir, 'CHANGELOG.md'),
      join(projectDir, 'docs', 'CHANGELOG.md'),
      join(projectDir, 'changelog.md'),
      join(projectDir, 'CHANGES.md'),
    ];
    for (const clPath of changelogPaths) {
      if (existsSync(clPath)) {
        evidence.changelogUpdated = true;
        break;
      }
    }

    // Check release notes
    const releaseNotePaths = [
      join(projectDir, 'RELEASE.md'),
      join(projectDir, 'chati.dev', 'artifacts', 'release-notes.md'),
    ];
    for (const rnPath of releaseNotePaths) {
      if (existsSync(rnPath)) {
        evidence.releaseNotesPrepared = true;
        break;
      }
    }

    // Load session state
    const sessionResult = loadSession(projectDir);
    if (sessionResult.loaded && sessionResult.session) {
      const agents = sessionResult.session.agents || {};
      const completedAgents = sessionResult.session.completed_agents || [];

      // Check all required agents are completed
      const requiredAgents = Object.keys(agents).filter(
        a => agents[a].status !== 'skipped'
      );
      const allComplete = requiredAgents.every(
        a => completedAgents.includes(a) || agents[a].status === 'completed'
      );

      evidence.allTasksCompleted = allComplete;

      // Check for open blockers in any handoff
      for (const agentName of completedAgents) {
        const agentHandoff = loadHandoff(projectDir, agentName);
        if (agentHandoff.loaded && agentHandoff.handoff) {
          const blockers = agentHandoff.handoff.blockers || [];
          if (blockers.length > 0) {
            evidence.noOpenBlockers = false;
            break;
          }
        }
      }

      evidence.sessionState = {
        mode: sessionResult.session.mode,
        completedCount: completedAgents.length,
        totalAgents: Object.keys(agents).length,
      };
    }

    return evidence;
  }

  /**
   * Validate deployment readiness evidence.
   *
   * @param {object} evidence
   * @returns {{ score: number, criteriaResults: string[], allCriteria: string[], warnings: string[] }}
   */
  _validateEvidence(evidence) {
    const allCriteria = [
      'QA-Implementation passed',
      'README updated',
      'CHANGELOG updated',
      'Release notes prepared',
      'All tasks completed',
      'No open blockers',
    ];

    const criteriaResults = [];
    const warnings = [];

    if (evidence.qaImplPassed) {
      criteriaResults.push('QA-Implementation passed');
    } else {
      warnings.push('QA-Implementation has not passed');
    }

    if (evidence.readmeUpdated) {
      criteriaResults.push('README updated');
    }

    if (evidence.changelogUpdated) {
      criteriaResults.push('CHANGELOG updated');
    }

    if (evidence.releaseNotesPrepared) {
      criteriaResults.push('Release notes prepared');
    }

    if (evidence.allTasksCompleted) {
      criteriaResults.push('All tasks completed');
    } else {
      warnings.push('Not all tasks are completed');
    }

    if (evidence.noOpenBlockers) {
      criteriaResults.push('No open blockers');
    } else {
      warnings.push('Open blockers remain from agent handoffs');
    }

    const score = allCriteria.length > 0
      ? Math.round((criteriaResults.length / allCriteria.length) * 100)
      : 0;

    return { score, criteriaResults, allCriteria, warnings };
  }
}
