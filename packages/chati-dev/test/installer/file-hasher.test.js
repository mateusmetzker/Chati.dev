import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { hashFile, hashContent, compareFiles } from '../../src/installer/file-hasher.js';

describe('file-hasher', () => {
  let tempDir;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'chati-hasher-'));
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('hashContent', () => {
    it('returns a 64-character hex SHA-256 digest', () => {
      const hash = hashContent('hello world');
      assert.equal(typeof hash, 'string');
      assert.equal(hash.length, 64);
      assert.match(hash, /^[0-9a-f]{64}$/);
    });

    it('returns consistent hashes for same content', () => {
      const hash1 = hashContent('test content');
      const hash2 = hashContent('test content');
      assert.equal(hash1, hash2);
    });

    it('returns different hashes for different content', () => {
      const hash1 = hashContent('content A');
      const hash2 = hashContent('content B');
      assert.notEqual(hash1, hash2);
    });

    it('normalizes CRLF to LF before hashing', () => {
      const lfHash = hashContent('line1\nline2\nline3');
      const crlfHash = hashContent('line1\r\nline2\r\nline3');
      assert.equal(lfHash, crlfHash);
    });

    it('handles empty string', () => {
      const hash = hashContent('');
      assert.equal(typeof hash, 'string');
      assert.equal(hash.length, 64);
    });
  });

  describe('hashFile', () => {
    it('hashes a file and returns a SHA-256 digest', () => {
      const filePath = join(tempDir, 'sample.txt');
      writeFileSync(filePath, 'file content here', 'utf-8');
      const hash = hashFile(filePath);
      assert.equal(typeof hash, 'string');
      assert.equal(hash.length, 64);
    });

    it('matches hashContent for the same data', () => {
      const content = 'matching content test';
      const filePath = join(tempDir, 'match.txt');
      writeFileSync(filePath, content, 'utf-8');

      const fileHash = hashFile(filePath);
      const contentHash = hashContent(content);
      assert.equal(fileHash, contentHash);
    });

    it('normalizes CRLF in files', () => {
      const lfPath = join(tempDir, 'lf.txt');
      const crlfPath = join(tempDir, 'crlf.txt');
      writeFileSync(lfPath, 'a\nb\nc', 'utf-8');
      writeFileSync(crlfPath, 'a\r\nb\r\nc', 'utf-8');

      const lfHash = hashFile(lfPath);
      const crlfHash = hashFile(crlfPath);
      assert.equal(lfHash, crlfHash);
    });
  });

  describe('compareFiles', () => {
    it('returns match: true for identical files', () => {
      const pathA = join(tempDir, 'cmp-a.txt');
      const pathB = join(tempDir, 'cmp-b.txt');
      writeFileSync(pathA, 'identical', 'utf-8');
      writeFileSync(pathB, 'identical', 'utf-8');

      const result = compareFiles(pathA, pathB);
      assert.equal(result.match, true);
      assert.equal(result.hashA, result.hashB);
    });

    it('returns match: false for different files', () => {
      const pathA = join(tempDir, 'diff-a.txt');
      const pathB = join(tempDir, 'diff-b.txt');
      writeFileSync(pathA, 'content A', 'utf-8');
      writeFileSync(pathB, 'content B', 'utf-8');

      const result = compareFiles(pathA, pathB);
      assert.equal(result.match, false);
      assert.notEqual(result.hashA, result.hashB);
    });

    it('treats CRLF and LF files as matching', () => {
      const pathA = join(tempDir, 'eol-a.txt');
      const pathB = join(tempDir, 'eol-b.txt');
      writeFileSync(pathA, 'x\ny\nz', 'utf-8');
      writeFileSync(pathB, 'x\r\ny\r\nz', 'utf-8');

      const result = compareFiles(pathA, pathB);
      assert.equal(result.match, true);
    });
  });
});
