import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDeviation,
  analyzeDeviationImpact,
  applyDeviation,
  getDeviationHistory,
  DEVIATION_TYPES,
} from '../../src/orchestrator/deviation-handler.js';

describe('deviation-handler', () => {
  describe('detectDeviation', () => {
    it('should detect scope change deviation', () => {
      const messages = [
        'Can we also add user authentication?',
        'Please remove the notification feature',
        'I forgot about the email integration',
      ];

      for (const msg of messages) {
        const result = detectDeviation(msg, {});

        assert.equal(result.type, DEVIATION_TYPES.SCOPE_CHANGE);
        assert.ok(result.confidence > 0);
      }
    });

    it('should detect rollback deviation', () => {
      const messages = [
        'Let\'s go back to the brief stage',
        'Can we redo the architecture?',
        'I want to return to detail',
      ];

      for (const msg of messages) {
        const result = detectDeviation(msg, {});

        assert.equal(result.type, DEVIATION_TYPES.ROLLBACK);
        assert.ok(result.confidence > 0);
      }
    });

    it('should detect skip deviation', () => {
      const messages = [
        'Skip the UX phase',
        'We don\'t need the architect step',
        'Just bypass that',
      ];

      for (const msg of messages) {
        const result = detectDeviation(msg, {});

        assert.equal(result.type, DEVIATION_TYPES.SKIP);
        assert.ok(result.confidence > 0);
      }
    });

    it('should detect priority change deviation', () => {
      const messages = [
        'Do the API first',
        'That\'s more important, let\'s prioritize it',
        'Switch the order',
      ];

      for (const msg of messages) {
        const result = detectDeviation(msg, {});

        assert.equal(result.type, DEVIATION_TYPES.PRIORITY_CHANGE);
        assert.ok(result.confidence > 0);
      }
    });

    it('should detect restart deviation', () => {
      const messages = [
        'Let\'s start over from scratch',
        'Restart the whole project',
        'Begin again',
      ];

      for (const msg of messages) {
        const result = detectDeviation(msg, {});

        assert.equal(result.type, DEVIATION_TYPES.RESTART);
        assert.ok(result.confidence > 0);
      }
    });

    it('should not detect deviation in normal messages', () => {
      const messages = [
        'What is the current status?',
        'Show me the project summary',
        'How do I configure this?',
      ];

      for (const msg of messages) {
        const result = detectDeviation(msg, {});

        assert.equal(result.isDeviation, false);
        assert.equal(result.type, null);
      }
    });
  });

  describe('analyzeDeviationImpact', () => {
    const mockState = {
      current_agent: 'architect',
      agents: {
        'greenfield-wu': { status: 'completed' },
        'brief': { status: 'completed' },
        'detail': { status: 'completed' },
        'architect': { status: 'in_progress' },
        'ux': { status: 'pending' },
        'phases': { status: 'pending' },
      },
    };

    it('should analyze scope change impact', () => {
      const result = analyzeDeviationImpact(
        DEVIATION_TYPES.SCOPE_CHANGE,
        mockState
      );

      assert.ok(['low', 'medium', 'high'].includes(result.impact));
      assert.ok(result.recommendation);
      assert.equal(typeof result.requiresConfirmation, 'boolean');
    });

    it('should analyze rollback impact as high', () => {
      const result = analyzeDeviationImpact(
        DEVIATION_TYPES.ROLLBACK,
        mockState,
        { targetAgent: 'brief' }
      );

      assert.equal(result.impact, 'high');
      assert.ok(result.affectedAgents.length > 0);
      assert.equal(result.requiresConfirmation, true);
    });

    it('should analyze skip impact as medium', () => {
      const result = analyzeDeviationImpact(
        DEVIATION_TYPES.SKIP,
        mockState
      );

      assert.equal(result.impact, 'medium');
      assert.equal(result.requiresConfirmation, true);
    });

    it('should analyze restart impact as high', () => {
      const result = analyzeDeviationImpact(
        DEVIATION_TYPES.RESTART,
        mockState
      );

      assert.equal(result.impact, 'high');
      assert.ok(result.affectedAgents.length > 0);
      assert.equal(result.requiresConfirmation, true);
    });

    it('should analyze priority change impact as low', () => {
      const result = analyzeDeviationImpact(
        DEVIATION_TYPES.PRIORITY_CHANGE,
        mockState
      );

      assert.equal(result.impact, 'low');
      assert.equal(result.requiresConfirmation, false);
    });
  });

  describe('applyDeviation', () => {
    it('should apply scope change with added features', () => {
      const state = {
        current_agent: 'detail',
        agents: {},
        backlog: [],
        deviations: [],
      };

      const result = applyDeviation(state, DEVIATION_TYPES.SCOPE_CHANGE, {
        addedFeatures: ['User authentication', 'Email notifications'],
      });

      assert.equal(result.applied, true);
      assert.ok(result.changes.length > 0);
      assert.ok(result.state.backlog.length > 0);
      assert.ok(result.state.backlog.some(b => b.description === 'User authentication'));
    });

    it('should apply scope change with removed features', () => {
      const state = {
        current_agent: 'detail',
        agents: {},
        backlog: [],
        deviations: [],
      };

      const result = applyDeviation(state, DEVIATION_TYPES.SCOPE_CHANGE, {
        removedFeatures: ['Social media integration'],
      });

      assert.equal(result.applied, true);
      assert.ok(result.changes.length > 0);
      assert.ok(result.state.backlog.some(b => b.type === 'feature_removal'));
    });

    it('should apply rollback', () => {
      const state = {
        current_agent: 'architect',
        agents: {
          'brief': { status: 'completed', score: 95, completed_at: '2026-01-01' },
          'detail': { status: 'completed', score: 90, completed_at: '2026-01-02' },
          'architect': { status: 'in_progress', score: 0, completed_at: null },
        },
        deviations: [],
      };

      const result = applyDeviation(state, DEVIATION_TYPES.ROLLBACK, {
        targetAgent: 'brief',
      });

      assert.equal(result.applied, true);
      assert.equal(result.state.current_agent, 'brief');
      assert.equal(result.state.agents.detail.status, 'pending');
      assert.equal(result.state.agents.architect.status, 'pending');
    });

    it('should apply skip', () => {
      const state = {
        current_agent: 'ux',
        agents: {
          'ux': { status: 'pending', score: 0 },
        },
        deviations: [],
      };

      const result = applyDeviation(state, DEVIATION_TYPES.SKIP, {
        agentName: 'ux',
      });

      assert.equal(result.applied, true);
      assert.equal(result.state.agents.ux.status, 'skipped');
    });

    it('should apply restart', () => {
      const state = {
        current_agent: 'architect',
        agents: {
          'brief': { status: 'completed', score: 95, completed_at: '2026-01-01' },
          'detail': { status: 'completed', score: 90, completed_at: '2026-01-02' },
        },
        backlog: [{ item: 'test' }],
        deviations: [],
      };

      const result = applyDeviation(state, DEVIATION_TYPES.RESTART, {});

      assert.equal(result.applied, true);
      assert.equal(result.state.current_agent, '');
      assert.equal(result.state.backlog.length, 0);
      assert.equal(result.state.agents.brief.status, 'pending');
      assert.equal(result.state.agents.detail.status, 'pending');
    });

    it('should record deviation in history', () => {
      const state = {
        current_agent: 'detail',
        agents: {},
        backlog: [],
        deviations: [],
      };

      const result = applyDeviation(state, DEVIATION_TYPES.SCOPE_CHANGE, {
        addedFeatures: ['New feature'],
      });

      assert.equal(result.applied, true);
      assert.ok(result.state.deviations.length > 0);
      assert.equal(result.state.deviations[0].type, DEVIATION_TYPES.SCOPE_CHANGE);
    });
  });

  describe('getDeviationHistory', () => {
    it('should return empty array when no deviations', () => {
      const state = { deviations: [] };
      const result = getDeviationHistory(state);

      assert.ok(Array.isArray(result));
      assert.equal(result.length, 0);
    });

    it('should return deviation history', () => {
      const state = {
        deviations: [
          {
            type: DEVIATION_TYPES.SCOPE_CHANGE,
            details: { addedFeatures: ['Feature 1'] },
            applied_at: '2026-01-01',
            changes: ['Added feature: Feature 1'],
          },
        ],
      };

      const result = getDeviationHistory(state);

      assert.equal(result.length, 1);
      assert.equal(result[0].type, DEVIATION_TYPES.SCOPE_CHANGE);
    });
  });
});
