import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { containsSecrets, isDestructiveCommand } from '../../../../chati.dev/hooks/constitution-guard.js';

describe('constitution-guard hook', () => {
  describe('containsSecrets', () => {
    it('detects API keys', () => {
      const found = containsSecrets('api_key: sk-1234567890abcdefghijklmnop');
      assert.ok(found.length > 0);
    });

    it('detects passwords', () => {
      const found = containsSecrets('password = "mysecretpassword123"');
      assert.ok(found.length > 0);
    });

    it('detects bearer tokens', () => {
      const found = containsSecrets('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test');
      assert.ok(found.length > 0);
    });

    it('detects AWS keys', () => {
      const found = containsSecrets('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      assert.ok(found.length > 0);
    });

    it('detects private keys', () => {
      const found = containsSecrets('-----BEGIN RSA PRIVATE KEY-----');
      assert.ok(found.length > 0);
    });

    it('allows normal code', () => {
      const found = containsSecrets('const greeting = "hello world";');
      assert.equal(found.length, 0);
    });

    it('allows environment variable references', () => {
      const found = containsSecrets('const apiKey = process.env.API_KEY;');
      assert.equal(found.length, 0);
    });

    it('handles null/empty input', () => {
      assert.deepEqual(containsSecrets(null), []);
      assert.deepEqual(containsSecrets(''), []);
    });
  });

  describe('isDestructiveCommand', () => {
    it('detects rm -rf /', () => {
      assert.equal(isDestructiveCommand('rm -rf /important'), true);
    });

    it('detects git reset --hard', () => {
      assert.equal(isDestructiveCommand('git reset --hard HEAD~1'), true);
    });

    it('detects git push --force', () => {
      assert.equal(isDestructiveCommand('git push --force origin main'), true);
    });

    it('detects DROP TABLE', () => {
      assert.equal(isDestructiveCommand('DROP TABLE users'), true);
    });

    it('allows normal commands', () => {
      assert.equal(isDestructiveCommand('npm test'), false);
      assert.equal(isDestructiveCommand('git status'), false);
      assert.equal(isDestructiveCommand('node app.js'), false);
    });

    it('handles null/empty input', () => {
      assert.equal(isDestructiveCommand(null), false);
      assert.equal(isDestructiveCommand(''), false);
    });
  });
});
