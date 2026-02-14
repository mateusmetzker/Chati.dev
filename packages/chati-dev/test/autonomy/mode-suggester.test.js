/**
 * @fileoverview Tests for mode-suggester module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestMode,
  calculateRiskScore,
  getHighRiskDomains,
} from '../../src/autonomy/mode-suggester.js';
import { EXECUTION_MODES } from '../../src/autonomy/mode-manager.js';

describe('mode-suggester', () => {
  describe('suggestMode', () => {
    it('should suggest human-in-the-loop for greenfield project', () => {
      const result = suggestMode({
        isGreenfield: true,
        taskCount: 5,
        riskDomains: [],
        hasHistory: false,
        recentGotchas: 0,
      });

      // greenfield(30) + no-history(25) = 55 > 50
      assert.equal(result.suggestion, EXECUTION_MODES.HUMAN_IN_THE_LOOP);
      assert.ok(result.confidence > 0);
      assert.ok(result.factors.length > 0);
      assert.ok(result.reasoning.toLowerCase().includes('greenfield'));
    });

    it('should suggest autonomous for brownfield project with history', () => {
      const result = suggestMode({
        isGreenfield: false,
        taskCount: 5,
        riskDomains: [],
        hasHistory: true,
        recentGotchas: 0,
      });

      assert.equal(result.suggestion, EXECUTION_MODES.AUTONOMOUS);
      assert.ok(result.confidence > 0);
    });

    it('should suggest human-in-the-loop for high-risk domains', () => {
      const result = suggestMode({
        isGreenfield: true,
        taskCount: 3,
        riskDomains: ['security', 'database', 'infrastructure'],
        hasHistory: false,
        recentGotchas: 0,
      });

      assert.equal(result.suggestion, EXECUTION_MODES.HUMAN_IN_THE_LOOP);
      assert.ok(result.reasoning.includes('High-risk') || result.reasoning.includes('Greenfield'));
    });

    it('should suggest human-in-the-loop for high task count', () => {
      const result = suggestMode({
        isGreenfield: true,
        taskCount: 15,
        riskDomains: [],
        hasHistory: false,
        recentGotchas: 0,
      });

      // greenfield(30) + tasks(20) + no-history(25) = 75 > 50
      assert.equal(result.suggestion, EXECUTION_MODES.HUMAN_IN_THE_LOOP);
      assert.ok(result.reasoning.includes('task count') || result.reasoning.includes('Greenfield'));
    });

    it('should suggest human-in-the-loop with recent gotchas', () => {
      const result = suggestMode({
        isGreenfield: true,
        taskCount: 3,
        riskDomains: [],
        hasHistory: false,
        recentGotchas: 3,
      });

      assert.equal(result.suggestion, EXECUTION_MODES.HUMAN_IN_THE_LOOP);
      assert.ok(result.reasoning.includes('gotcha') || result.reasoning.includes('Greenfield'));
    });

    it('should include factor details', () => {
      const result = suggestMode({
        isGreenfield: true,
        taskCount: 12,
        riskDomains: ['security'],
        hasHistory: false,
        recentGotchas: 1,
      });

      assert.ok(result.factors.length >= 4);
      result.factors.forEach(factor => {
        assert.ok(factor.name);
        assert.ok(typeof factor.impact === 'number');
        assert.ok(['human', 'autonomous', 'neutral'].includes(factor.direction));
        assert.ok(factor.reason);
      });
    });

    it('should calculate score correctly', () => {
      const result = suggestMode({
        isGreenfield: true,
        taskCount: 15,
        riskDomains: ['security', 'database'],
        hasHistory: false,
        recentGotchas: 2,
      });

      assert.ok(result.score > 50);
      assert.equal(result.suggestion, EXECUTION_MODES.HUMAN_IN_THE_LOOP);
    });

    it('should handle minimal context', () => {
      const result = suggestMode({
        isGreenfield: false,
      });

      assert.ok([EXECUTION_MODES.HUMAN_IN_THE_LOOP, EXECUTION_MODES.AUTONOMOUS].includes(result.suggestion));
      assert.ok(result.confidence >= 0);
    });
  });

  describe('calculateRiskScore', () => {
    it('should return low risk for simple brownfield project', () => {
      const result = calculateRiskScore({
        isGreenfield: false,
        taskCount: 3,
        riskDomains: [],
        hasHistory: true,
        recentGotchas: 0,
      });

      assert.equal(result.level, 'low');
      assert.ok(result.score < 30);
      assert.ok(Array.isArray(result.factors));
    });

    it('should return high risk for complex greenfield project', () => {
      const result = calculateRiskScore({
        isGreenfield: true,
        taskCount: 15,
        riskDomains: ['security', 'database', 'authentication'],
        hasHistory: false,
        recentGotchas: 3,
      });

      assert.equal(result.level, 'high');
      assert.ok(result.score >= 60);
      assert.ok(result.factors.length > 0);
    });

    it('should return medium risk for moderate complexity', () => {
      const result = calculateRiskScore({
        isGreenfield: false,
        taskCount: 8,
        riskDomains: ['database'],
        hasHistory: false,
        recentGotchas: 0,
      });

      assert.equal(result.level, 'medium');
      assert.ok(result.score >= 30 && result.score < 60);
    });

    it('should include risk factors in result', () => {
      const result = calculateRiskScore({
        isGreenfield: true,
        taskCount: 15,
        riskDomains: ['security'],
        hasHistory: false,
        recentGotchas: 2,
      });

      assert.ok(result.factors.some(f => f.includes('greenfield')));
      assert.ok(result.factors.some(f => f.includes('task count')));
      assert.ok(result.factors.some(f => f.includes('no project history')));
    });

    it('should identify high-risk domains', () => {
      const result = calculateRiskScore({
        isGreenfield: false,
        taskCount: 3,
        riskDomains: ['security', 'authentication', 'ui'],
        hasHistory: true,
        recentGotchas: 0,
      });

      assert.ok(result.factors.some(f => f.includes('high-risk domain')));
    });
  });

  describe('getHighRiskDomains', () => {
    it('should return list of high-risk domains', () => {
      const domains = getHighRiskDomains();
      assert.ok(Array.isArray(domains));
      assert.ok(domains.length > 0);
      assert.ok(domains.includes('security'));
      assert.ok(domains.includes('database'));
      assert.ok(domains.includes('infrastructure'));
    });

    it('should return a copy of the array', () => {
      const domains1 = getHighRiskDomains();
      const domains2 = getHighRiskDomains();
      assert.notEqual(domains1, domains2);
      assert.deepEqual(domains1, domains2);
    });
  });
});
