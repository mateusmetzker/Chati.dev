/**
 * @fileoverview Tests for safety-net module
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SAFETY_TRIGGERS,
  checkSafety,
  evaluateTrigger,
  getRecommendedAction,
  getCriticalRiskKeywords,
  isCriticalRisk,
  buildSafetyReport,
} from '../../src/autonomy/safety-net.js';

describe('safety-net', () => {
  describe('checkSafety', () => {
    it('should pass all checks for safe state', () => {
      const result = checkSafety({
        consecutiveFailures: 0,
        lastScore: 90,
        riskFlags: [],
        sessionGotchas: 0,
        agentDurationMs: 60000,
        timeoutMs: 300000,
      });

      assert.equal(result.safe, true);
      assert.equal(result.triggers.length, 0);
    });

    it('should trigger on consecutive failures', () => {
      const result = checkSafety({
        consecutiveFailures: 3,
        lastScore: 90,
        riskFlags: [],
        sessionGotchas: 0,
      });

      assert.equal(result.safe, false);
      assert.ok(result.triggers.length > 0);
      assert.ok(result.triggers.some(t => t.severity === 'critical'));
    });

    it('should trigger on low score', () => {
      const result = checkSafety({
        consecutiveFailures: 0,
        lastScore: 65,
        riskFlags: [],
        sessionGotchas: 0,
      });

      assert.equal(result.safe, false);
      assert.ok(result.triggers.some(t => t.details.includes('Low quality score')));
    });

    it('should trigger on critical risk', () => {
      const result = checkSafety({
        consecutiveFailures: 0,
        lastScore: 90,
        riskFlags: ['security vulnerability detected'],
        sessionGotchas: 0,
      });

      assert.equal(result.safe, false);
      assert.ok(result.triggers.some(t => t.severity === 'critical'));
    });

    it('should trigger on timeout', () => {
      const result = checkSafety({
        consecutiveFailures: 0,
        lastScore: 90,
        riskFlags: [],
        sessionGotchas: 0,
        agentDurationMs: 400000,
        timeoutMs: 300000,
      });

      assert.equal(result.safe, false);
      assert.ok(result.triggers.some(t => t.details.includes('timeout')));
    });

    it('should trigger on gotcha spike', () => {
      const result = checkSafety({
        consecutiveFailures: 0,
        lastScore: 90,
        riskFlags: [],
        sessionGotchas: 5,
      });

      assert.equal(result.safe, false);
      assert.ok(result.triggers.some(t => t.details.includes('gotcha')));
    });

    it('should detect multiple triggers', () => {
      const result = checkSafety({
        consecutiveFailures: 3,
        lastScore: 60,
        riskFlags: ['database drop detected'],
        sessionGotchas: 5,
        agentDurationMs: 400000,
        timeoutMs: 300000,
      });

      assert.equal(result.safe, false);
      assert.ok(result.triggers.length >= 4);
    });
  });

  describe('evaluateTrigger', () => {
    it('should evaluate consecutive failures trigger', () => {
      const triggered = evaluateTrigger(SAFETY_TRIGGERS.CONSECUTIVE_FAILURES, {
        consecutiveFailures: 3,
      });
      assert.equal(triggered.triggered, true);
      assert.equal(triggered.severity, 'critical');

      const notTriggered = evaluateTrigger(SAFETY_TRIGGERS.CONSECUTIVE_FAILURES, {
        consecutiveFailures: 1,
      });
      assert.equal(notTriggered.triggered, false);
    });

    it('should evaluate low score trigger', () => {
      const triggered = evaluateTrigger(SAFETY_TRIGGERS.LOW_SCORE, {
        lastScore: 65,
      });
      assert.equal(triggered.triggered, true);
      assert.equal(triggered.severity, 'warning');

      const notTriggered = evaluateTrigger(SAFETY_TRIGGERS.LOW_SCORE, {
        lastScore: 80,
      });
      assert.equal(notTriggered.triggered, false);
    });

    it('should evaluate critical risk trigger', () => {
      const triggered = evaluateTrigger(SAFETY_TRIGGERS.CRITICAL_RISK, {
        riskFlags: ['security vulnerability in authentication'],
      });
      assert.equal(triggered.triggered, true);
      assert.equal(triggered.severity, 'critical');

      const notTriggered = evaluateTrigger(SAFETY_TRIGGERS.CRITICAL_RISK, {
        riskFlags: ['ui styling issue'],
      });
      assert.equal(notTriggered.triggered, false);
    });

    it('should evaluate timeout trigger', () => {
      const triggered = evaluateTrigger(SAFETY_TRIGGERS.TIMEOUT, {
        agentDurationMs: 400000,
        timeoutMs: 300000,
      });
      assert.equal(triggered.triggered, true);
      assert.equal(triggered.severity, 'critical');

      const notTriggered = evaluateTrigger(SAFETY_TRIGGERS.TIMEOUT, {
        agentDurationMs: 100000,
        timeoutMs: 300000,
      });
      assert.equal(notTriggered.triggered, false);
    });

    it('should evaluate gotcha spike trigger', () => {
      const triggered = evaluateTrigger(SAFETY_TRIGGERS.GOTCHA_SPIKE, {
        sessionGotchas: 5,
      });
      assert.equal(triggered.triggered, true);
      assert.equal(triggered.severity, 'warning');

      const notTriggered = evaluateTrigger(SAFETY_TRIGGERS.GOTCHA_SPIKE, {
        sessionGotchas: 2,
      });
      assert.equal(notTriggered.triggered, false);
    });
  });

  describe('getRecommendedAction', () => {
    it('should warn on no triggers', () => {
      const result = getRecommendedAction([]);
      assert.equal(result.action, 'warn');
      assert.equal(result.resumable, true);
    });

    it('should pause on critical trigger', () => {
      const result = getRecommendedAction([
        { severity: 'critical', details: 'Critical issue' },
      ]);
      assert.equal(result.action, 'pause');
      assert.equal(result.resumable, true);
      assert.ok(result.reason.includes('Critical'));
    });

    it('should warn on warning triggers only', () => {
      const result = getRecommendedAction([
        { severity: 'warning', details: 'Warning 1' },
        { severity: 'warning', details: 'Warning 2' },
      ]);
      assert.equal(result.action, 'warn');
      assert.equal(result.resumable, true);
    });

    it('should pause on mixed triggers with critical', () => {
      const result = getRecommendedAction([
        { severity: 'warning', details: 'Warning' },
        { severity: 'critical', details: 'Critical' },
      ]);
      assert.equal(result.action, 'pause');
    });
  });

  describe('getCriticalRiskKeywords', () => {
    it('should return list of critical risk keywords', () => {
      const keywords = getCriticalRiskKeywords();
      assert.ok(Array.isArray(keywords));
      assert.ok(keywords.length > 0);
      assert.ok(keywords.includes('security'));
      assert.ok(keywords.includes('vulnerability'));
      assert.ok(keywords.includes('database drop'));
    });

    it('should return a copy of the array', () => {
      const keywords1 = getCriticalRiskKeywords();
      const keywords2 = getCriticalRiskKeywords();
      assert.notEqual(keywords1, keywords2);
      assert.deepEqual(keywords1, keywords2);
    });
  });

  describe('isCriticalRisk', () => {
    it('should identify security risks', () => {
      assert.equal(isCriticalRisk('security vulnerability detected'), true);
      assert.equal(isCriticalRisk('SQL injection possible'), true);
      assert.equal(isCriticalRisk('authentication bypass'), true);
    });

    it('should identify data risks', () => {
      assert.equal(isCriticalRisk('data loss possible'), true);
      assert.equal(isCriticalRisk('database drop command'), true);
      assert.equal(isCriticalRisk('data corruption detected'), true);
    });

    it('should not flag low-risk issues', () => {
      assert.equal(isCriticalRisk('ui styling issue'), false);
      assert.equal(isCriticalRisk('documentation typo'), false);
      assert.equal(isCriticalRisk('performance optimization'), false);
    });

    it('should be case insensitive', () => {
      assert.equal(isCriticalRisk('SECURITY VULNERABILITY'), true);
      assert.equal(isCriticalRisk('Security Issue'), true);
    });
  });

  describe('buildSafetyReport', () => {
    it('should build safe report', () => {
      const report = buildSafetyReport({
        consecutiveFailures: 0,
        lastScore: 90,
        riskFlags: [],
        sessionGotchas: 0,
      });

      assert.equal(report.status, 'safe');
      assert.ok(report.message.includes('passed'));
      assert.equal(report.triggers.length, 0);
    });

    it('should build unsafe report for critical issues', () => {
      const report = buildSafetyReport({
        consecutiveFailures: 3,
        lastScore: 90,
        riskFlags: [],
        sessionGotchas: 0,
      });

      assert.equal(report.status, 'unsafe');
      assert.ok(report.message.includes('Critical'));
      assert.ok(report.triggers.length > 0);
    });

    it('should build warning report for non-critical issues', () => {
      const report = buildSafetyReport({
        consecutiveFailures: 0,
        lastScore: 65,
        riskFlags: [],
        sessionGotchas: 0,
      });

      assert.equal(report.status, 'warning');
      assert.ok(report.triggers.length > 0);
    });

    it('should include all triggered conditions', () => {
      const report = buildSafetyReport({
        consecutiveFailures: 3,
        lastScore: 60,
        riskFlags: ['security issue'],
        sessionGotchas: 5,
      });

      assert.ok(report.triggers.length >= 3);
    });
  });
});
