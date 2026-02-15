#!/usr/bin/env node
/**
 * CLI runner for parallel agent terminal execution.
 *
 * Called by the orchestrator via the Bash tool to spawn multiple agents
 * simultaneously in separate Claude Code processes.
 *
 * Usage:
 *   node run-parallel.js --agents detail,architect,ux \
 *     --task-ids expand-prd,architect-design,ux-wireframe \
 *     --project-dir /path/to/project --previous-agent brief \
 *     --timeout 900000
 *
 * Outputs consolidated JSON to stdout for the orchestrator to parse.
 */

import { fileURLToPath } from 'url';
import { buildAgentPrompt } from './prompt-builder.js';
import { spawnParallelGroup } from './spawner.js';
import { TerminalMonitor } from './monitor.js';
import { collectResults, mergeHandoffs, buildConsolidatedHandoff } from './collector.js';
import { parseAgentOutput } from './handoff-parser.js';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = 'true';
      }
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  if (!args.agents) {
    outputError('Missing required argument: --agents (comma-separated)');
    process.exit(1);
  }
  if (!args['task-ids']) {
    outputError('Missing required argument: --task-ids (comma-separated)');
    process.exit(1);
  }

  const agents = args.agents.split(',').map(s => s.trim());
  const taskIds = args['task-ids'].split(',').map(s => s.trim());

  if (agents.length !== taskIds.length) {
    outputError(`Agent count (${agents.length}) must match task-id count (${taskIds.length})`);
    process.exit(1);
  }

  const projectDir = args['project-dir'] || process.cwd();
  const previousAgent = args['previous-agent'] || null;
  const timeout = parseInt(args.timeout, 10) || 900_000; // default 15 minutes

  // Load session state
  let sessionState = {};
  try {
    const { existsSync, readFileSync } = await import('fs');
    const { join } = await import('path');
    const sessionPath = join(projectDir, '.chati', 'session.yaml');
    if (existsSync(sessionPath)) {
      const raw = readFileSync(sessionPath, 'utf-8');
      // Minimal parse
      sessionState = {};
      for (const line of raw.split('\n')) {
        const m = line.trim().match(/^([\w_-]+):\s*(.+)/);
        if (m) sessionState[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* optional */ }

  // Build prompts for all agents
  const configs = [];
  const startTime = Date.now();

  for (let i = 0; i < agents.length; i++) {
    try {
      const promptResult = buildAgentPrompt({
        agent: agents[i],
        taskId: taskIds[i],
        projectDir,
        previousAgent,
        sessionState,
      });

      configs.push({
        agent: agents[i],
        taskId: taskIds[i],
        model: promptResult.model,
        prompt: promptResult.prompt,
        workingDir: projectDir,
        timeout,
      });
    } catch (err) {
      outputError(`Failed to build prompt for ${agents[i]}: ${err.message}`);
      process.exit(1);
    }
  }

  // Spawn all terminals in parallel
  let group;
  try {
    group = spawnParallelGroup(configs);
  } catch (err) {
    outputError(`Failed to spawn parallel group: ${err.message}`);
    process.exit(1);
  }

  // Monitor until completion
  const monitor = new TerminalMonitor({ pollInterval: 2000, timeout });

  for (const terminal of group.terminals) {
    monitor.addTerminal(terminal);
  }

  await new Promise((resolve) => {
    monitor.onComplete(() => {
      monitor.stopMonitoring();
      resolve();
    });

    // Safety timeout
    const safetyTimer = setTimeout(() => {
      monitor.stopMonitoring();
      resolve();
    }, timeout + 10_000);

    monitor.onComplete(() => clearTimeout(safetyTimer));
    monitor.startMonitoring();
  });

  const elapsed = Date.now() - startTime;

  // Collect and merge results
  const rawResults = collectResults(group.groupId, group.terminals);

  // Parse handoffs from each terminal's stdout
  const agentResults = rawResults.results.map(r => {
    const parsed = parseAgentOutput(r.stdout);
    return {
      ...r,
      handoff: parsed.found ? parsed.handoff : null,
      handoffFound: parsed.found,
    };
  });

  // Merge handoffs
  const mergeInput = agentResults.map(r => ({
    agent: r.agent,
    status: r.handoff?.status || (r.exitCode === 0 ? 'complete' : 'failed'),
    outputs: r.handoff?.outputs || [],
    decisions: r.handoff?.decisions || {},
    blockers: r.handoff?.blockers || [],
    summary: r.handoff?.summary || '',
  }));

  const merged = mergeHandoffs(mergeInput);
  const nextAgent = determineNextAgent(agents);
  const consolidated = buildConsolidatedHandoff(merged, nextAgent);

  // Output consolidated result
  const output = {
    status: rawResults.summary.failed === 0 ? 'complete' : 'partial',
    groupId: group.groupId,
    agents: agents.map((a, i) => ({
      agent: a,
      model: configs[i].model,
      status: agentResults[i].handoff?.status || (agentResults[i].exitCode === 0 ? 'complete' : 'failed'),
      score: agentResults[i].handoff?.score || null,
      exitCode: agentResults[i].exitCode,
      handoffFound: agentResults[i].handoffFound,
    })),
    mergedHandoff: consolidated,
    summary: rawResults.summary,
    elapsed,
    performance: {
      sequentialEstimate: elapsed * agents.length,
      parallelActual: elapsed,
      timeSaved: elapsed * (agents.length - 1),
    },
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(rawResults.summary.failed > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the next sequential agent after a parallel group.
 * GROUP 1 (detail+architect+ux) → phases
 * GROUP 2 (dev tasks) → qa-implementation
 */
function determineNextAgent(agents) {
  const groupKey = agents.sort().join(',');
  if (groupKey.includes('architect') && groupKey.includes('detail') && groupKey.includes('ux')) {
    return 'phases';
  }
  if (agents.every(a => a === 'dev')) {
    return 'qa-implementation';
  }
  return null;
}

function outputError(message) {
  process.stdout.write(JSON.stringify({ status: 'error', error: message }) + '\n');
}

// Guard pattern
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    outputError(err.message);
    process.exit(1);
  });
}

export { parseArgs, determineNextAgent };
