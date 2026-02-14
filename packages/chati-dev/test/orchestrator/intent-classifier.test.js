/**
 * @fileoverview Tests for intent classification.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTENT_TYPES,
  classifyIntent,
  getIntentPhase,
  checkModeAlignment,
} from '../../src/orchestrator/intent-classifier.js';

describe('intent-classifier', () => {
  describe('classifyIntent', () => {
    it('should classify planning intent', () => {
      const result = classifyIntent('I want to plan a new feature');
      assert.equal(result.intent, INTENT_TYPES.PLANNING);
      assert.ok(result.confidence > 0);
      assert.ok(result.keywords.includes('plan'));
    });

    it('should classify implementation intent', () => {
      const result = classifyIntent('Let\'s build the login system');
      assert.equal(result.intent, INTENT_TYPES.IMPLEMENTATION);
      assert.ok(result.keywords.includes('build'));
    });

    it('should classify review intent', () => {
      const result = classifyIntent('Please review and test my code');
      assert.equal(result.intent, INTENT_TYPES.REVIEW);
      assert.ok(result.keywords.includes('review'));
      assert.ok(result.keywords.includes('test'));
    });

    it('should classify deploy intent', () => {
      const result = classifyIntent('Deploy to production please');
      assert.equal(result.intent, INTENT_TYPES.DEPLOY);
      assert.ok(result.keywords.includes('deploy'));
    });

    it('should classify status intent', () => {
      const result = classifyIntent('What is the current status?');
      assert.equal(result.intent, INTENT_TYPES.STATUS);
      assert.ok(result.keywords.includes('status'));
    });

    it('should classify resume intent', () => {
      const result = classifyIntent('Let\'s continue where we left off');
      assert.equal(result.intent, INTENT_TYPES.RESUME);
      assert.ok(result.keywords.includes('continue'));
    });

    it('should classify deviation intent', () => {
      const result = classifyIntent('Actually, let\'s change the plan');
      assert.equal(result.intent, INTENT_TYPES.DEVIATION);
      assert.ok(result.keywords.includes('change'));
    });

    it('should classify question intent', () => {
      const result = classifyIntent('How does this work?');
      assert.equal(result.intent, INTENT_TYPES.QUESTION);
      assert.ok(result.keywords.includes('how'));
    });

    it('should classify help intent', () => {
      const result = classifyIntent('I need help with the setup');
      assert.equal(result.intent, INTENT_TYPES.HELP);
      assert.ok(result.keywords.includes('help'));
    });

    it('should boost implementation intent in build mode', () => {
      const msg = 'add a new feature';
      const withoutContext = classifyIntent(msg);
      const withContext = classifyIntent(msg, { mode: 'build' });

      assert.equal(withContext.intent, INTENT_TYPES.IMPLEMENTATION);
      assert.ok(withContext.confidence >= withoutContext.confidence);
    });

    it('should boost planning intent in clarity mode', () => {
      const msg = 'let me think about the architecture';
      const withContext = classifyIntent(msg, { mode: 'clarity' });

      assert.equal(withContext.intent, INTENT_TYPES.PLANNING);
    });

    it('should include reasoning in result', () => {
      const result = classifyIntent('plan a feature', { mode: 'clarity' });
      assert.ok(result.reasoning);
      assert.ok(result.reasoning.includes('plan'));
    });

    it('should handle empty message', () => {
      const result = classifyIntent('');
      assert.ok(Object.values(INTENT_TYPES).includes(result.intent));
    });

    it('should handle case insensitive matching', () => {
      const result = classifyIntent('DEPLOY TO PRODUCTION');
      assert.equal(result.intent, INTENT_TYPES.DEPLOY);
    });
  });

  describe('getIntentPhase', () => {
    it('should map planning to clarity phase', () => {
      assert.equal(getIntentPhase(INTENT_TYPES.PLANNING), 'clarity');
    });

    it('should map implementation to build phase', () => {
      assert.equal(getIntentPhase(INTENT_TYPES.IMPLEMENTATION), 'build');
    });

    it('should map review to build phase', () => {
      assert.equal(getIntentPhase(INTENT_TYPES.REVIEW), 'build');
    });

    it('should map deploy to deploy phase', () => {
      assert.equal(getIntentPhase(INTENT_TYPES.DEPLOY), 'deploy');
    });

    it('should return null for question intent', () => {
      assert.equal(getIntentPhase(INTENT_TYPES.QUESTION), null);
    });

    it('should return null for status intent', () => {
      assert.equal(getIntentPhase(INTENT_TYPES.STATUS), null);
    });

    it('should return null for resume intent', () => {
      assert.equal(getIntentPhase(INTENT_TYPES.RESUME), null);
    });
  });

  describe('checkModeAlignment', () => {
    it('should detect no change needed when aligned', () => {
      const result = checkModeAlignment(INTENT_TYPES.PLANNING, 'clarity');
      assert.equal(result.needsChange, false);
      assert.equal(result.targetMode, null);
    });

    it('should detect forward transition needed', () => {
      const result = checkModeAlignment(INTENT_TYPES.IMPLEMENTATION, 'clarity');
      assert.equal(result.needsChange, true);
      assert.equal(result.targetMode, 'build');
      assert.ok(result.reason.includes('forward'));
    });

    it('should detect backward transition needed', () => {
      const result = checkModeAlignment(INTENT_TYPES.PLANNING, 'build');
      assert.equal(result.needsChange, true);
      assert.equal(result.targetMode, 'clarity');
      assert.ok(result.reason.includes('backward'));
    });

    it('should handle intents with no phase mapping', () => {
      const result = checkModeAlignment(INTENT_TYPES.STATUS, 'clarity');
      assert.equal(result.needsChange, false);
    });

    it('should detect deploy transition from clarity', () => {
      const result = checkModeAlignment(INTENT_TYPES.DEPLOY, 'clarity');
      assert.equal(result.needsChange, true);
      assert.equal(result.targetMode, 'deploy');
    });
  });
});
