import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { logStep, logError, logWarning, logInfo, logMuted, logBanner, logSection, logResult } from '../../src/utils/logger.js';

describe('logger', () => {
  const functions = { logStep, logError, logWarning, logInfo, logMuted, logSection, logResult };

  for (const [name, fn] of Object.entries(functions)) {
    it(`${name} does not throw`, () => {
      assert.doesNotThrow(() => fn('test message'));
    });
  }

  it('logBanner does not throw', () => {
    assert.doesNotThrow(() => logBanner('LOGO\nLINE2', '1.0.0'));
  });

  it('logResult accepts label and value', () => {
    assert.doesNotThrow(() => logResult('Version', '1.2.1'));
  });
});
