import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  rmSync,
  copyFileSync,
} from 'fs';
import { join, dirname } from 'path';

/**
 * Transaction states.
 * @readonly
 * @enum {string}
 */
const STATE = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMMITTED: 'committed',
  ROLLED_BACK: 'rolled_back',
};

/**
 * Atomic installation transaction with rollback support.
 * Creates a backup before making changes, and can revert
 * all operations if something goes wrong.
 */
export class InstallTransaction {
  /**
   * @param {string} targetDir - The target directory for the installation
   */
  constructor(targetDir) {
    this._targetDir = targetDir;
    this._state = STATE.PENDING;
    this._backupDir = null;
    this._operations = [];
    this._reverseOps = [];
  }

  /**
   * Get the current transaction state.
   * @returns {'pending' | 'active' | 'committed' | 'rolled_back'}
   */
  getState() {
    return this._state;
  }

  /**
   * Begin the transaction.
   * Creates a backup directory and snapshots the current state.
   */
  begin() {
    if (this._state !== STATE.PENDING) {
      throw new Error(`Cannot begin transaction in state: ${this._state}`);
    }

    const timestamp = Date.now();
    this._backupDir = join(this._targetDir, '.chati', `backup-${timestamp}`);
    mkdirSync(this._backupDir, { recursive: true });

    this._state = STATE.ACTIVE;
    this._operations = [];
    this._reverseOps = [];
  }

  /**
   * Execute a list of operations within the transaction.
   * Each operation is recorded with its reverse for potential rollback.
   *
   * @param {Array<{ type: 'write'|'delete'|'mkdir', path: string, content?: string }>} operations
   */
  execute(operations) {
    if (this._state !== STATE.ACTIVE) {
      throw new Error(`Cannot execute operations in state: ${this._state}`);
    }

    for (const op of operations) {
      const absPath = join(this._targetDir, op.path);

      switch (op.type) {
        case 'write': {
          // Backup existing file if it exists
          if (existsSync(absPath)) {
            const backupPath = join(this._backupDir, op.path);
            mkdirSync(dirname(backupPath), { recursive: true });
            copyFileSync(absPath, backupPath);
            this._reverseOps.unshift({
              type: 'restore',
              path: op.path,
              backupPath,
              absPath,
            });
          } else {
            this._reverseOps.unshift({
              type: 'delete',
              absPath,
            });
          }

          // Execute write
          mkdirSync(dirname(absPath), { recursive: true });
          writeFileSync(absPath, op.content || '', 'utf-8');
          this._operations.push(op);
          break;
        }

        case 'delete': {
          // Backup existing file before deleting
          if (existsSync(absPath)) {
            const backupPath = join(this._backupDir, op.path);
            mkdirSync(dirname(backupPath), { recursive: true });
            copyFileSync(absPath, backupPath);
            this._reverseOps.unshift({
              type: 'restore',
              path: op.path,
              backupPath,
              absPath,
            });

            unlinkSync(absPath);
          }
          this._operations.push(op);
          break;
        }

        case 'mkdir': {
          if (!existsSync(absPath)) {
            mkdirSync(absPath, { recursive: true });
            this._reverseOps.unshift({
              type: 'rmdir',
              absPath,
            });
          }
          this._operations.push(op);
          break;
        }

        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    }
  }

  /**
   * Commit the transaction.
   * Marks the transaction as complete and cleans up the backup directory.
   *
   * @returns {{ success: true, operationsExecuted: number }}
   */
  commit() {
    if (this._state !== STATE.ACTIVE) {
      throw new Error(`Cannot commit transaction in state: ${this._state}`);
    }

    // Clean up backup
    if (this._backupDir && existsSync(this._backupDir)) {
      rmSync(this._backupDir, { recursive: true, force: true });
    }

    this._state = STATE.COMMITTED;
    return {
      success: true,
      operationsExecuted: this._operations.length,
    };
  }

  /**
   * Rollback the transaction.
   * Reverses all operations that were executed, restoring from backup.
   *
   * @returns {{ success: true, operationsRolledBack: number }}
   */
  rollback() {
    if (this._state !== STATE.ACTIVE) {
      throw new Error(`Cannot rollback transaction in state: ${this._state}`);
    }

    let rolledBack = 0;

    for (const reverseOp of this._reverseOps) {
      try {
        switch (reverseOp.type) {
          case 'restore': {
            // Restore file from backup
            mkdirSync(dirname(reverseOp.absPath), { recursive: true });
            copyFileSync(reverseOp.backupPath, reverseOp.absPath);
            rolledBack++;
            break;
          }

          case 'delete': {
            // Delete a file that was created during the transaction
            if (existsSync(reverseOp.absPath)) {
              unlinkSync(reverseOp.absPath);
              rolledBack++;
            }
            break;
          }

          case 'rmdir': {
            // Remove directory that was created (only if empty)
            if (existsSync(reverseOp.absPath)) {
              try {
                rmSync(reverseOp.absPath, { recursive: true, force: true });
                rolledBack++;
              } catch {
                // Directory may not be empty due to other changes; skip
              }
            }
            break;
          }
        }
      } catch {
        // Best-effort rollback: continue even if individual reversals fail
      }
    }

    // Clean up backup directory
    if (this._backupDir && existsSync(this._backupDir)) {
      rmSync(this._backupDir, { recursive: true, force: true });
    }

    this._state = STATE.ROLLED_BACK;
    return {
      success: true,
      operationsRolledBack: rolledBack,
    };
  }
}
