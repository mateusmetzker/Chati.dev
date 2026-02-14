/**
 * Plan Tracker — Tracks progress of development phases and tasks.
 *
 * Persists plan state to .chati/plan.json and provides progress calculation,
 * visual progress bars, and formatted reports.
 *
 * @module scripts/plan-tracker
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} name
 * @property {string} status — 'pending' | 'in_progress' | 'completed' | 'skipped'
 * @property {string} [assignee]
 * @property {number} [updatedAt]
 */

/**
 * @typedef {Object} Phase
 * @property {string} id
 * @property {string} name
 * @property {string} status — 'pending' | 'in_progress' | 'completed' | 'skipped'
 * @property {Task[]} tasks
 * @property {number} [updatedAt]
 */

/**
 * @typedef {Object} Plan
 * @property {string} name
 * @property {Phase[]} phases
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} Progress
 * @property {number} totalPhases
 * @property {number} completedPhases
 * @property {number} totalTasks
 * @property {number} completedTasks
 * @property {number} percentComplete
 */

const VALID_STATUSES = new Set(['pending', 'in_progress', 'completed', 'skipped']);

export class PlanTracker {
  /**
   * @param {string} targetDir — project root directory
   */
  constructor(targetDir) {
    this.targetDir = targetDir;
    this.planPath = join(targetDir, '.chati', 'plan.json');
  }

  /**
   * Loads the plan from disk. Returns a default empty plan if none exists.
   * @returns {Plan}
   */
  loadPlan() {
    if (!existsSync(this.planPath)) {
      return {
        name: 'Untitled Plan',
        phases: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    try {
      const raw = readFileSync(this.planPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {
        name: 'Untitled Plan',
        phases: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  }

  /**
   * Saves the plan to disk.
   * @param {Plan} plan
   */
  savePlan(plan) {
    const dir = dirname(this.planPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    plan.updatedAt = Date.now();
    writeFileSync(this.planPath, JSON.stringify(plan, null, 2), 'utf-8');
  }

  /**
   * Adds a phase to the plan.
   * @param {{ id: string, name: string, status?: string }} phase
   */
  addPhase(phase) {
    if (!phase.id || !phase.name) {
      throw new Error('Phase must have an id and name');
    }
    const plan = this.loadPlan();
    const existing = plan.phases.find((p) => p.id === phase.id);
    if (existing) {
      throw new Error(`Phase "${phase.id}" already exists`);
    }
    plan.phases.push({
      id: phase.id,
      name: phase.name,
      status: phase.status || 'pending',
      tasks: [],
      updatedAt: Date.now(),
    });
    this.savePlan(plan);
  }

  /**
   * Updates the status of a phase.
   * @param {string} phaseId
   * @param {string} status
   */
  updatePhaseStatus(phaseId, status) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(', ')}`);
    }
    const plan = this.loadPlan();
    const phase = plan.phases.find((p) => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase "${phaseId}" not found`);
    }
    phase.status = status;
    phase.updatedAt = Date.now();
    this.savePlan(plan);
  }

  /**
   * Adds a task to a phase.
   * @param {string} phaseId
   * @param {{ id: string, name: string, status?: string, assignee?: string }} task
   */
  addTask(phaseId, task) {
    if (!task.id || !task.name) {
      throw new Error('Task must have an id and name');
    }
    const plan = this.loadPlan();
    const phase = plan.phases.find((p) => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase "${phaseId}" not found`);
    }
    const existing = phase.tasks.find((t) => t.id === task.id);
    if (existing) {
      throw new Error(`Task "${task.id}" already exists in phase "${phaseId}"`);
    }
    phase.tasks.push({
      id: task.id,
      name: task.name,
      status: task.status || 'pending',
      assignee: task.assignee || null,
      updatedAt: Date.now(),
    });
    phase.updatedAt = Date.now();
    this.savePlan(plan);
  }

  /**
   * Updates the status of a task within a phase.
   * @param {string} phaseId
   * @param {string} taskId
   * @param {string} status
   */
  updateTaskStatus(phaseId, taskId, status) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status "${status}". Must be one of: ${[...VALID_STATUSES].join(', ')}`);
    }
    const plan = this.loadPlan();
    const phase = plan.phases.find((p) => p.id === phaseId);
    if (!phase) {
      throw new Error(`Phase "${phaseId}" not found`);
    }
    const task = phase.tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new Error(`Task "${taskId}" not found in phase "${phaseId}"`);
    }
    task.status = status;
    task.updatedAt = Date.now();
    phase.updatedAt = Date.now();
    this.savePlan(plan);
  }

  /**
   * Calculates overall progress across all phases and tasks.
   * @returns {Progress}
   */
  getProgress() {
    const plan = this.loadPlan();
    const totalPhases = plan.phases.length;
    const completedPhases = plan.phases.filter((p) => p.status === 'completed').length;

    let totalTasks = 0;
    let completedTasks = 0;
    for (const phase of plan.phases) {
      totalTasks += phase.tasks.length;
      completedTasks += phase.tasks.filter((t) => t.status === 'completed').length;
    }

    const percentComplete =
      totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 10000) / 100
        : totalPhases > 0
          ? Math.round((completedPhases / totalPhases) * 10000) / 100
          : 0;

    return { totalPhases, completedPhases, totalTasks, completedTasks, percentComplete };
  }

  /**
   * Generates a visual progress bar.
   *
   * @param {Progress} progress
   * @param {number} [width=30] — bar width in characters
   * @returns {string}
   */
  formatProgressBar(progress, width = 30) {
    const ratio = progress.percentComplete / 100;
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
    return `[${bar}] ${progress.percentComplete.toFixed(1)}%`;
  }

  /**
   * Generates a detailed progress report.
   *
   * @param {Progress} [progress]
   * @returns {string}
   */
  formatProgressReport(progress) {
    const p = progress || this.getProgress();
    const plan = this.loadPlan();
    const lines = [];

    lines.push(`=== Plan: ${plan.name} ===`);
    lines.push('');
    lines.push(`Progress: ${this.formatProgressBar(p)}`);
    lines.push(`Phases : ${p.completedPhases}/${p.totalPhases}`);
    lines.push(`Tasks  : ${p.completedTasks}/${p.totalTasks}`);
    lines.push('');

    const statusIcons = {
      pending: '[ ]',
      in_progress: '[~]',
      completed: '[x]',
      skipped: '[-]',
    };

    for (const phase of plan.phases) {
      const icon = statusIcons[phase.status] || '[ ]';
      const phaseTasks = phase.tasks.length;
      const phaseDone = phase.tasks.filter((t) => t.status === 'completed').length;
      lines.push(`${icon} ${phase.name} (${phaseDone}/${phaseTasks} tasks)`);

      for (const task of phase.tasks) {
        const taskIcon = statusIcons[task.status] || '[ ]';
        const assignee = task.assignee ? ` @${task.assignee}` : '';
        lines.push(`    ${taskIcon} ${task.name}${assignee}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
