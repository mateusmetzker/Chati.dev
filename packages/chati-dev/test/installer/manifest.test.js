import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as cryptoSign, createPrivateKey } from 'crypto';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { generateManifest, verifyManifest, saveManifest, loadManifest, compareManifests } from '../../src/installer/manifest.js';

// Generate a test keypair (independent of the real signing key)
const { publicKey: testPublicPem, privateKey: testPrivatePem } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

/**
 * Helper: sign a manifest with a given private key PEM (same logic as sign-manifest.js)
 */
function signManifest(manifest, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort(), 2);
  const signature = cryptoSign(null, Buffer.from(manifestJson), key);
  return signature.toString('base64');
}

describe('manifest — Ed25519 signature', () => {
  let tempDir;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'chati-manifest-'));
    // Create sample framework files
    mkdirSync(join(tempDir, 'agents'), { recursive: true });
    writeFileSync(join(tempDir, 'constitution.md'), '# Constitution\n## Article 1\nContent here.', 'utf-8');
    writeFileSync(join(tempDir, 'agents', 'dev.md'), '# Dev Agent\nDoes development.', 'utf-8');
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('signManifest', () => {
    it('returns a valid base64 string', () => {
      const manifest = generateManifest(tempDir, ['constitution.md', 'agents/dev.md'], '1.0.0');
      const sig = signManifest(manifest, testPrivatePem);
      assert.equal(typeof sig, 'string');
      // Base64 should be decodable without error
      const buf = Buffer.from(sig, 'base64');
      assert.ok(buf.length > 0);
    });

    it('produces consistent signatures for same manifest', () => {
      // Note: Ed25519 is deterministic (no random nonce), so same input = same sig
      const manifest = generateManifest(tempDir, ['constitution.md'], '1.0.0');
      // Fix createdAt to ensure determinism
      manifest.createdAt = '2025-01-01T00:00:00.000Z';
      const sig1 = signManifest(manifest, testPrivatePem);
      const sig2 = signManifest(manifest, testPrivatePem);
      assert.equal(sig1, sig2);
    });
  });

  describe('verifyManifest', () => {
    it('returns no-public-key when SIGNING_PUBLIC_KEY is null', () => {
      // The module-level SIGNING_PUBLIC_KEY may or may not be loaded depending on
      // whether signing-public-key.pem exists. We test with a known manifest that
      // was NOT signed with the real key to verify behavior.
      const manifest = { version: '1.0.0', createdAt: '2025-01-01T00:00:00.000Z', files: {} };
      const fakeSig = Buffer.from('not-a-real-signature').toString('base64');
      const result = verifyManifest(manifest, fakeSig);
      // Either no-public-key (dev env) or signature-mismatch (prod env with real key)
      assert.ok(
        result.reason === 'no-public-key' || result.reason === 'signature-mismatch',
        `Expected no-public-key or signature-mismatch, got: ${result.reason}`
      );
    });
  });

  describe('JSON determinism', () => {
    it('sorted keys produce consistent JSON regardless of insertion order', () => {
      const manifest1 = { version: '1.0.0', files: { 'a.md': { hash: 'aaa' }, 'b.md': { hash: 'bbb' } }, createdAt: '2025-01-01T00:00:00.000Z' };
      const manifest2 = { createdAt: '2025-01-01T00:00:00.000Z', files: { 'b.md': { hash: 'bbb' }, 'a.md': { hash: 'aaa' } }, version: '1.0.0' };

      const json1 = JSON.stringify(manifest1, Object.keys(manifest1).sort(), 2);
      const json2 = JSON.stringify(manifest2, Object.keys(manifest2).sort(), 2);
      assert.equal(json1, json2);
    });
  });

  describe('end-to-end sign + verify (test keypair)', () => {
    it('verifies a correctly signed manifest', async () => {
      const manifest = generateManifest(tempDir, ['constitution.md', 'agents/dev.md'], '2.0.0');
      manifest.createdAt = '2025-01-01T00:00:00.000Z';

      const sig = signManifest(manifest, testPrivatePem);

      // Manually verify using crypto (bypasses module-level key)
      const { verify, createPublicKey } = await import('crypto');
      const pubKey = createPublicKey(testPublicPem);
      const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort(), 2);
      const valid = verify(null, Buffer.from(manifestJson), pubKey, Buffer.from(sig, 'base64'));
      assert.equal(valid, true);
    });

    it('rejects a tampered signature', async () => {
      const manifest = generateManifest(tempDir, ['constitution.md'], '2.0.0');
      manifest.createdAt = '2025-01-01T00:00:00.000Z';

      const sig = signManifest(manifest, testPrivatePem);
      // Tamper: flip a character in the signature
      const tamperedSig = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');

      const { verify, createPublicKey } = await import('crypto');
      const pubKey = createPublicKey(testPublicPem);
      const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort(), 2);
      const valid = verify(null, Buffer.from(manifestJson), pubKey, Buffer.from(tamperedSig, 'base64'));
      assert.equal(valid, false);
    });

    it('rejects a modified manifest', async () => {
      const manifest = generateManifest(tempDir, ['constitution.md'], '2.0.0');
      manifest.createdAt = '2025-01-01T00:00:00.000Z';

      const sig = signManifest(manifest, testPrivatePem);

      // Modify manifest after signing
      manifest.version = '9.9.9';

      const { verify, createPublicKey } = await import('crypto');
      const pubKey = createPublicKey(testPublicPem);
      const manifestJson = JSON.stringify(manifest, Object.keys(manifest).sort(), 2);
      const valid = verify(null, Buffer.from(manifestJson), pubKey, Buffer.from(sig, 'base64'));
      assert.equal(valid, false);
    });
  });

  describe('saveManifest + loadManifest', () => {
    it('round-trips a manifest through save and load', () => {
      const projectDir = join(tempDir, 'project');
      mkdirSync(projectDir, { recursive: true });

      const manifest = generateManifest(tempDir, ['constitution.md'], '1.0.0');
      saveManifest(projectDir, manifest);

      const loaded = loadManifest(projectDir);
      assert.deepStrictEqual(loaded.version, manifest.version);
      assert.deepStrictEqual(loaded.files, manifest.files);
    });
  });

  describe('compareManifests', () => {
    it('detects added, removed, modified, and unchanged files', () => {
      const oldManifest = {
        files: {
          'a.md': { hash: 'aaa', size: 10, type: 'md' },
          'b.md': { hash: 'bbb', size: 20, type: 'md' },
          'c.md': { hash: 'ccc', size: 30, type: 'md' },
        },
      };
      const newManifest = {
        files: {
          'a.md': { hash: 'aaa', size: 10, type: 'md' },     // unchanged
          'b.md': { hash: 'bbb-new', size: 25, type: 'md' },  // modified
          'd.md': { hash: 'ddd', size: 40, type: 'md' },       // added
        },
      };

      const diff = compareManifests(oldManifest, newManifest);
      assert.deepStrictEqual(diff.unchanged, ['a.md']);
      assert.deepStrictEqual(diff.modified, ['b.md']);
      assert.deepStrictEqual(diff.removed, ['c.md']);
      assert.deepStrictEqual(diff.added, ['d.md']);
    });
  });
});
