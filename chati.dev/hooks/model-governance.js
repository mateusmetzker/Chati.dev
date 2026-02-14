#!/usr/bin/env node
/**
 * Model Governance Hook — UserPromptSubmit
 *
 * Validates that the model being used matches the agent's assignment.
 * Constitution Article XVI enforcement.
 *
 * Model assignments (from agent definitions):
 * - orchestrator: opus
 * - brief, detail, phases, tasks: sonnet
 * - architect, dev: sonnet | upgrade: opus if complex
 * - ux: sonnet
 * - qa-planning, qa-implementation: sonnet
 * - devops: sonnet
 * - greenfield-wu, brownfield-wu: sonnet
 *
 * This hook is advisory — it warns but does not block.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const AGENT_MODELS = {
  orchestrator: 'opus',
  'greenfield-wu': 'sonnet',
  'brownfield-wu': 'sonnet',
  brief: 'sonnet',
  detail: 'sonnet',
  architect: 'sonnet',
  ux: 'sonnet',
  phases: 'sonnet',
  tasks: 'sonnet',
  'qa-planning': 'sonnet',
  'qa-implementation': 'sonnet',
  dev: 'sonnet',
  devops: 'sonnet',
};

function getCurrentAgent(projectDir) {
  const sessionPath = join(projectDir, '.chati', 'session.yaml');
  if (!existsSync(sessionPath)) return null;

  const raw = readFileSync(sessionPath, 'utf-8');
  const match = raw.match(/^\s*current_agent:\s*(.+)$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const event = JSON.parse(input);
    const projectDir = event.cwd || process.cwd();
    const agent = getCurrentAgent(projectDir);

    if (agent && AGENT_MODELS[agent]) {
      const expected = AGENT_MODELS[agent];
      // Advisory note — appended to context
      process.stdout.write(JSON.stringify({
        result: 'allow',
        prefix: `<!-- [Article XVI] Agent "${agent}" assigned model: ${expected} -->`,
      }));
    } else {
      process.stdout.write(JSON.stringify({ result: 'allow' }));
    }
  } catch {
    process.stdout.write(JSON.stringify({ result: 'allow' }));
  }
}

export { AGENT_MODELS, getCurrentAgent };

main();
