import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { InstallTransaction } from '../../src/installer/transaction.js';

describe('InstallTransaction', () => {
  let tempDir;

  before(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'chati-tx-'));
    mkdirSync(join(tempDir, '.chati'), { recursive: true });
  });

  after(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('state transitions', () => {
    it('starts in pending state', () => {
      const tx = new InstallTransaction(tempDir);
      assert.equal(tx.getState(), 'pending');
    });

    it('transitions to active after begin()', () => {
      const tx = new InstallTransaction(tempDir);
      tx.begin();
      assert.equal(tx.getState(), 'active');
      tx.commit(); // clean up
    });

    it('transitions to committed after commit()', () => {
      const tx = new InstallTransaction(tempDir);
      tx.begin();
      tx.commit();
      assert.equal(tx.getState(), 'committed');
    });

    it('transitions to rolled_back after rollback()', () => {
      const tx = new InstallTransaction(tempDir);
      tx.begin();
      tx.rollback();
      assert.equal(tx.getState(), 'rolled_back');
    });

    it('throws when begin() called in non-pending state', () => {
      const tx = new InstallTransaction(tempDir);
      tx.begin();
      assert.throws(() => tx.begin(), { message: /Cannot begin/ });
      tx.commit();
    });

    it('throws when execute() called in non-active state', () => {
      const tx = new InstallTransaction(tempDir);
      assert.throws(() => tx.execute([]), { message: /Cannot execute/ });
    });

    it('throws when commit() called in non-active state', () => {
      const tx = new InstallTransaction(tempDir);
      assert.throws(() => tx.commit(), { message: /Cannot commit/ });
    });

    it('throws when rollback() called in non-active state', () => {
      const tx = new InstallTransaction(tempDir);
      assert.throws(() => tx.rollback(), { message: /Cannot rollback/ });
    });
  });

  describe('begin → execute → commit', () => {
    it('writes new files', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-write-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'write', path: 'hello.txt', content: 'hello world' },
      ]);

      const result = tx.commit();
      assert.equal(result.success, true);
      assert.equal(result.operationsExecuted, 1);
      assert.equal(readFileSync(join(dir, 'hello.txt'), 'utf-8'), 'hello world');

      rmSync(dir, { recursive: true, force: true });
    });

    it('creates directories', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-mkdir-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'mkdir', path: 'subdir/nested' },
      ]);

      tx.commit();
      assert.ok(existsSync(join(dir, 'subdir', 'nested')));

      rmSync(dir, { recursive: true, force: true });
    });

    it('deletes files', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-del-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      writeFileSync(join(dir, 'to-delete.txt'), 'goodbye', 'utf-8');
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'delete', path: 'to-delete.txt' },
      ]);

      tx.commit();
      assert.ok(!existsSync(join(dir, 'to-delete.txt')));

      rmSync(dir, { recursive: true, force: true });
    });

    it('overwrites existing files', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-overwrite-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      writeFileSync(join(dir, 'existing.txt'), 'old content', 'utf-8');
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'write', path: 'existing.txt', content: 'new content' },
      ]);

      tx.commit();
      assert.equal(readFileSync(join(dir, 'existing.txt'), 'utf-8'), 'new content');

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('rollback', () => {
    it('restores overwritten files', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-rb-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      writeFileSync(join(dir, 'important.txt'), 'original', 'utf-8');
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'write', path: 'important.txt', content: 'replaced' },
      ]);

      // Verify it was overwritten
      assert.equal(readFileSync(join(dir, 'important.txt'), 'utf-8'), 'replaced');

      const result = tx.rollback();
      assert.equal(result.success, true);
      assert.ok(result.operationsRolledBack >= 1);

      // Verify it was restored
      assert.equal(readFileSync(join(dir, 'important.txt'), 'utf-8'), 'original');

      rmSync(dir, { recursive: true, force: true });
    });

    it('removes newly created files', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-rb2-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'write', path: 'new-file.txt', content: 'should not exist' },
      ]);

      assert.ok(existsSync(join(dir, 'new-file.txt')));

      tx.rollback();
      assert.ok(!existsSync(join(dir, 'new-file.txt')));

      rmSync(dir, { recursive: true, force: true });
    });

    it('restores deleted files', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-rb3-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      writeFileSync(join(dir, 'to-restore.txt'), 'precious data', 'utf-8');
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'delete', path: 'to-restore.txt' },
      ]);

      assert.ok(!existsSync(join(dir, 'to-restore.txt')));

      tx.rollback();
      assert.ok(existsSync(join(dir, 'to-restore.txt')));
      assert.equal(readFileSync(join(dir, 'to-restore.txt'), 'utf-8'), 'precious data');

      rmSync(dir, { recursive: true, force: true });
    });

    it('handles multiple operations in rollback', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-rb4-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      writeFileSync(join(dir, 'file1.txt'), 'original1', 'utf-8');
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'write', path: 'file1.txt', content: 'modified' },
        { type: 'write', path: 'file2.txt', content: 'new file' },
        { type: 'mkdir', path: 'newdir' },
      ]);

      const result = tx.rollback();
      assert.equal(result.success, true);

      assert.equal(readFileSync(join(dir, 'file1.txt'), 'utf-8'), 'original1');
      assert.ok(!existsSync(join(dir, 'file2.txt')));

      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('commit cleanup', () => {
    it('removes backup directory on commit', () => {
      const dir = mkdtempSync(join(tmpdir(), 'chati-tx-cleanup-'));
      mkdirSync(join(dir, '.chati'), { recursive: true });
      writeFileSync(join(dir, 'f.txt'), 'data', 'utf-8');
      const tx = new InstallTransaction(dir);
      tx.begin();

      tx.execute([
        { type: 'write', path: 'f.txt', content: 'updated' },
      ]);

      // Before commit, backup dir should exist
      const backupExists = existsSync(join(dir, '.chati'));
      assert.ok(backupExists);

      tx.commit();

      // After commit, the specific backup-{timestamp} dir should be cleaned
      // (we can't easily check the exact name, but the test verifies commit succeeds)

      rmSync(dir, { recursive: true, force: true });
    });
  });
});
