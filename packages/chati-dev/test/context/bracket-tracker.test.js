import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBracket, estimateRemaining, isLayerActive, getBracketDefinitions,
} from '../../src/context/bracket-tracker.js';

describe('bracket-tracker', () => {
  describe('calculateBracket', () => {
    it('returns FRESH for 100%', () => {
      const b = calculateBracket(100);
      assert.equal(b.bracket, 'FRESH');
      assert.deepEqual(b.activeLayers, ['L0', 'L1', 'L2', 'L3', 'L4']);
      assert.equal(b.tokenBudget, 8000);
      assert.equal(b.memoryLevel, 'full');
      assert.equal(b.handoffRequired, false);
    });

    it('returns FRESH for 60%', () => {
      assert.equal(calculateBracket(60).bracket, 'FRESH');
    });

    it('returns MODERATE for 59%', () => {
      const b = calculateBracket(59);
      assert.equal(b.bracket, 'MODERATE');
      assert.deepEqual(b.activeLayers, ['L0', 'L1', 'L2', 'L3']);
      assert.equal(b.memoryLevel, 'chunks');
    });

    it('returns MODERATE for 40%', () => {
      assert.equal(calculateBracket(40).bracket, 'MODERATE');
    });

    it('returns DEPLETED for 39%', () => {
      const b = calculateBracket(39);
      assert.equal(b.bracket, 'DEPLETED');
      assert.deepEqual(b.activeLayers, ['L0', 'L1', 'L2']);
      assert.equal(b.memoryLevel, 'metadata');
    });

    it('returns DEPLETED for 25%', () => {
      assert.equal(calculateBracket(25).bracket, 'DEPLETED');
    });

    it('returns CRITICAL for 24%', () => {
      const b = calculateBracket(24);
      assert.equal(b.bracket, 'CRITICAL');
      assert.deepEqual(b.activeLayers, ['L0', 'L1']);
      assert.equal(b.memoryLevel, 'none');
      assert.equal(b.tokenBudget, 1500);
    });

    it('returns CRITICAL for 0%', () => {
      assert.equal(calculateBracket(0).bracket, 'CRITICAL');
    });

    it('clamps values above 100', () => {
      const b = calculateBracket(150);
      assert.equal(b.bracket, 'FRESH');
      assert.equal(b.remainingPercent, 100);
    });

    it('clamps values below 0', () => {
      const b = calculateBracket(-10);
      assert.equal(b.bracket, 'CRITICAL');
      assert.equal(b.remainingPercent, 0);
    });

    it('requires handoff below 15%', () => {
      assert.equal(calculateBracket(14).handoffRequired, true);
      assert.equal(calculateBracket(15).handoffRequired, false);
    });
  });

  describe('estimateRemaining', () => {
    it('returns 100% for 0 turns', () => {
      assert.equal(estimateRemaining(0), 100);
    });

    it('returns 50% for half the turns', () => {
      assert.equal(estimateRemaining(20, 40), 50);
    });

    it('returns 0% when turns exceed max', () => {
      assert.equal(estimateRemaining(50, 40), 0);
    });

    it('uses default maxTurns of 40', () => {
      assert.equal(estimateRemaining(10), 75);
    });
  });

  describe('isLayerActive', () => {
    it('L0 is always active', () => {
      assert.equal(isLayerActive('FRESH', 'L0'), true);
      assert.equal(isLayerActive('CRITICAL', 'L0'), true);
    });

    it('L4 is only active in FRESH', () => {
      assert.equal(isLayerActive('FRESH', 'L4'), true);
      assert.equal(isLayerActive('MODERATE', 'L4'), false);
      assert.equal(isLayerActive('DEPLETED', 'L4'), false);
      assert.equal(isLayerActive('CRITICAL', 'L4'), false);
    });

    it('L2 is not active in CRITICAL', () => {
      assert.equal(isLayerActive('CRITICAL', 'L2'), false);
    });

    it('returns false for unknown bracket', () => {
      assert.equal(isLayerActive('UNKNOWN', 'L0'), false);
    });
  });

  describe('getBracketDefinitions', () => {
    it('returns all 4 brackets', () => {
      const defs = getBracketDefinitions();
      assert.equal(Object.keys(defs).length, 4);
      assert.ok(defs.FRESH);
      assert.ok(defs.MODERATE);
      assert.ok(defs.DEPLETED);
      assert.ok(defs.CRITICAL);
    });
  });
});
