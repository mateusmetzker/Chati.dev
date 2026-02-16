/**
 * @fileoverview Tests for pipeline management.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PIPELINE_PHASES,
  AGENT_STATUS,
  initPipeline,
  advancePipeline,
  checkPhaseTransition,
  getPipelineProgress,
  resetPipelineTo,
  isPipelineComplete,
  markAgentInProgress,
} from '../../src/orchestrator/pipeline-manager.js';

describe('pipeline-manager', () => {
  describe('PIPELINE_PHASES', () => {
    it('should have 3 phases in order', () => {
      assert.equal(PIPELINE_PHASES.length, 3);
      assert.deepEqual(PIPELINE_PHASES, ['planning', 'build', 'deploy']);
    });
  });

  describe('initPipeline', () => {
    it('should initialize greenfield pipeline', () => {
      const state = initPipeline({ isGreenfield: true, mode: 'planning' });

      assert.equal(state.phase, 'planning');
      assert.equal(state.isGreenfield, true);
      assert.ok(state.startedAt);
      assert.equal(state.completedAt, null);
      assert.ok(state.agents);
      assert.equal(state.completedAgents.length, 0);
      assert.equal(state.currentAgent, null);
    });

    it('should initialize brownfield pipeline', () => {
      const state = initPipeline({ isGreenfield: false, mode: 'planning' });

      assert.equal(state.isGreenfield, false);
      assert.ok(state.agents['brownfield-wu']);
      assert.ok(!state.agents['greenfield-wu']);
    });

    it('should include greenfield-wu but not brownfield-wu for greenfield', () => {
      const state = initPipeline({ isGreenfield: true });

      assert.ok(state.agents['greenfield-wu']);
      assert.ok(!state.agents['brownfield-wu']);
    });

    it('should initialize all agents as pending', () => {
      const state = initPipeline({ isGreenfield: true });

      for (const agentState of Object.values(state.agents)) {
        assert.equal(agentState.status, AGENT_STATUS.PENDING);
        assert.equal(agentState.score, null);
      }
    });

    it('should default to planning mode', () => {
      const state = initPipeline({});
      assert.equal(state.phase, 'planning');
    });
  });

  describe('advancePipeline', () => {
    it('should mark agent as completed', () => {
      const state = initPipeline({ isGreenfield: true });
      state.currentAgent = 'greenfield-wu';
      state.agents['greenfield-wu'].status = AGENT_STATUS.IN_PROGRESS;

      const result = advancePipeline(state, 'greenfield-wu', { score: 100 });

      assert.equal(result.state.agents['greenfield-wu'].status, AGENT_STATUS.COMPLETED);
      assert.equal(result.state.agents['greenfield-wu'].score, 100);
      assert.ok(result.state.agents['greenfield-wu'].completedAt);
    });

    it('should add to completed agents list', () => {
      const state = initPipeline({ isGreenfield: true });
      state.currentAgent = 'greenfield-wu';

      const result = advancePipeline(state, 'greenfield-wu');

      assert.ok(result.state.completedAgents.includes('greenfield-wu'));
    });

    it('should add to history', () => {
      const state = initPipeline({ isGreenfield: true });
      state.currentAgent = 'greenfield-wu';

      const result = advancePipeline(state, 'greenfield-wu', { score: 95 });

      assert.ok(result.state.history.length > 0);
      const lastEntry = result.state.history[result.state.history.length - 1];
      assert.equal(lastEntry.agent, 'greenfield-wu');
      assert.equal(lastEntry.action, 'completed');
      assert.equal(lastEntry.score, 95);
    });

    it('should continue to next agent in same phase', () => {
      const state = initPipeline({ isGreenfield: true });
      state.currentAgent = 'greenfield-wu';

      const result = advancePipeline(state, 'greenfield-wu');

      assert.equal(result.nextAction, 'continue');
      assert.equal(result.nextAgent, 'brief');
      assert.equal(result.needsModeSwitch, false);
    });

    it('should advance phase when QA-Planning passes threshold', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAgents = [
        'greenfield-wu',
        'brief',
        'detail',
        'architect',
        'ux',
        'phases',
        'tasks',
      ];
      state.currentAgent = 'qa-planning';

      for (const agent of state.completedAgents) {
        state.agents[agent].status = AGENT_STATUS.COMPLETED;
      }

      const result = advancePipeline(state, 'qa-planning', { score: 95 });

      assert.equal(result.nextAction, 'advance_phase');
      assert.equal(result.state.phase, 'build');
      assert.equal(result.needsModeSwitch, true);
      assert.equal(result.nextAgent, 'dev');
    });

    it('should not advance phase when QA-Planning score below threshold', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAgents = [
        'greenfield-wu',
        'brief',
        'detail',
        'architect',
        'ux',
        'phases',
        'tasks',
      ];
      state.currentAgent = 'qa-planning';

      for (const agent of state.completedAgents) {
        state.agents[agent].status = AGENT_STATUS.COMPLETED;
      }

      const result = advancePipeline(state, 'qa-planning', { score: 85 });

      assert.equal(result.state.phase, 'planning');
      assert.equal(result.nextAction, 'wait');
    });

    it('should record mode transition', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAgents = [
        'greenfield-wu',
        'brief',
        'detail',
        'architect',
        'ux',
        'phases',
        'tasks',
      ];
      state.currentAgent = 'qa-planning';

      for (const agent of state.completedAgents) {
        state.agents[agent].status = AGENT_STATUS.COMPLETED;
      }

      const result = advancePipeline(state, 'qa-planning', { score: 98 });

      assert.ok(result.state.modeTransitions.length > 0);
      const transition = result.state.modeTransitions[0];
      assert.equal(transition.from, 'planning');
      assert.equal(transition.to, 'build');
      assert.equal(transition.trigger, 'autonomous');
    });

    it('should complete pipeline after devops', () => {
      const state = initPipeline({ isGreenfield: true });
      state.phase = 'deploy';
      state.currentAgent = 'devops';

      const result = advancePipeline(state, 'devops');

      assert.equal(result.nextAction, 'complete');
      assert.equal(result.nextAgent, null);
      assert.ok(result.state.completedAt);
    });
  });

  describe('checkPhaseTransition', () => {
    it('should block transition if QA-Planning not completed', () => {
      const state = initPipeline({ isGreenfield: true });

      const result = checkPhaseTransition(state);

      assert.equal(result.canAdvance, false);
      assert.ok(result.reason.includes('not yet completed'));
    });

    it('should block transition if QA-Planning score below threshold', () => {
      const state = initPipeline({ isGreenfield: true });
      state.agents['qa-planning'].status = AGENT_STATUS.COMPLETED;
      state.agents['qa-planning'].score = 90;

      const result = checkPhaseTransition(state);

      assert.equal(result.canAdvance, false);
      assert.ok(result.reason.includes('below threshold'));
      assert.equal(result.requiredScore, 95);
    });

    it('should allow transition if QA-Planning score meets threshold', () => {
      const state = initPipeline({ isGreenfield: true });
      state.agents['qa-planning'].status = AGENT_STATUS.COMPLETED;
      state.agents['qa-planning'].score = 96;

      const result = checkPhaseTransition(state);

      assert.equal(result.canAdvance, true);
      assert.ok(result.reason.includes('approved'));
    });

    it('should check QA-Implementation for build phase', () => {
      const state = initPipeline({ isGreenfield: true });
      state.phase = 'build';
      state.agents['dev'].status = AGENT_STATUS.COMPLETED;
      state.agents['qa-implementation'].status = AGENT_STATUS.COMPLETED;
      state.agents['qa-implementation'].score = 96;

      const result = checkPhaseTransition(state);

      assert.equal(result.canAdvance, true);
    });

    it('should require dev completion for build phase', () => {
      const state = initPipeline({ isGreenfield: true });
      state.phase = 'build';

      const result = checkPhaseTransition(state);

      assert.equal(result.canAdvance, false);
      assert.ok(result.reason.includes('Dev agent not yet completed'));
    });
  });

  describe('getPipelineProgress', () => {
    it('should calculate progress percentage', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAgents = ['greenfield-wu', 'brief'];

      const progress = getPipelineProgress(state);

      assert.ok(progress.progress > 0);
      assert.ok(progress.progress < 100);
      assert.equal(progress.completedAgents.length, 2);
    });

    it('should identify next agent', () => {
      const state = initPipeline({ isGreenfield: true });
      state.currentAgent = 'greenfield-wu';
      state.completedAgents = ['greenfield-wu'];

      const progress = getPipelineProgress(state);

      assert.equal(progress.nextAgent, 'brief');
    });

    it('should show 0 progress at start', () => {
      const state = initPipeline({ isGreenfield: true });

      const progress = getPipelineProgress(state);

      assert.equal(progress.progress, 0);
    });
  });

  describe('resetPipelineTo', () => {
    it('should reset to target agent', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAgents = ['greenfield-wu', 'brief', 'detail'];
      state.agents['greenfield-wu'].status = AGENT_STATUS.COMPLETED;
      state.agents['brief'].status = AGENT_STATUS.COMPLETED;
      state.agents['detail'].status = AGENT_STATUS.COMPLETED;

      const newState = resetPipelineTo(state, 'brief');

      assert.equal(newState.currentAgent, 'brief');
      assert.equal(newState.agents['brief'].status, AGENT_STATUS.IN_PROGRESS);
      assert.equal(newState.agents['detail'].status, AGENT_STATUS.PENDING);
    });

    it('should update completed agents list', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAgents = ['greenfield-wu', 'brief', 'detail'];

      const newState = resetPipelineTo(state, 'brief');

      assert.ok(newState.completedAgents.includes('greenfield-wu'));
      assert.ok(!newState.completedAgents.includes('brief'));
      assert.ok(!newState.completedAgents.includes('detail'));
    });

    it('should add to history', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAgents = ['greenfield-wu', 'brief'];

      const newState = resetPipelineTo(state, 'brief');

      assert.ok(newState.history.length > 0);
      const lastEntry = newState.history[newState.history.length - 1];
      assert.equal(lastEntry.action, 'reset_to');
      assert.equal(lastEntry.agent, 'brief');
    });

    it('should throw on unknown agent', () => {
      const state = initPipeline({ isGreenfield: true });

      assert.throws(() => {
        resetPipelineTo(state, 'unknown-agent');
      });
    });
  });

  describe('isPipelineComplete', () => {
    it('should return false for active pipeline', () => {
      const state = initPipeline({ isGreenfield: true });
      assert.equal(isPipelineComplete(state), false);
    });

    it('should return true when completedAt is set', () => {
      const state = initPipeline({ isGreenfield: true });
      state.completedAt = new Date().toISOString();

      assert.equal(isPipelineComplete(state), true);
    });
  });

  describe('markAgentInProgress', () => {
    it('should mark agent as in progress', () => {
      const state = initPipeline({ isGreenfield: true });

      const newState = markAgentInProgress(state, 'greenfield-wu');

      assert.equal(newState.agents['greenfield-wu'].status, AGENT_STATUS.IN_PROGRESS);
      assert.ok(newState.agents['greenfield-wu'].startedAt);
      assert.equal(newState.currentAgent, 'greenfield-wu');
    });

    it('should throw on unknown agent', () => {
      const state = initPipeline({ isGreenfield: true });

      assert.throws(() => {
        markAgentInProgress(state, 'unknown-agent');
      });
    });
  });
});
