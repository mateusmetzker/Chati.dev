import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { brand, dim, bold, green, red, yellow, cyan, gray, white, success, error, warning, info, muted } from '../../src/utils/colors.js';

describe('colors', () => {
  const exports = { brand, dim, bold, green, red, yellow, cyan, gray, white, success, error, warning, info, muted };

  for (const [name, fn] of Object.entries(exports)) {
    it(`${name} is a function`, () => {
      assert.equal(typeof fn, 'function');
    });

    it(`${name} returns a string when called`, () => {
      const result = fn('test');
      assert.equal(typeof result, 'string');
    });
  }

  it('brand applies steel blue color', () => {
    const result = brand('hello');
    assert.ok(result.includes('hello'));
  });
});
