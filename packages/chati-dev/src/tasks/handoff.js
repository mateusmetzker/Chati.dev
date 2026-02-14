/**
 * Handoff Manager — Manages context handoffs between tasks and agents.
 *
 * A handoff preserves critical context when execution transitions from
 * one agent to another. It captures what was done, what was produced,
 * and what the next agent needs to know.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Build a handoff document from task execution results.
 *
 * @param {object} params
 * @param {object} params.task - Completed task definition
 * @param {object} [params.validation] - Validation results
 * @param {string[]} [params.outputs] - Produced artifact paths
 * @param {object} [params.decisions] - Key decisions made during execution
 * @param {string} [params.summary] - Human-readable summary
 * @param {string[]} [params.blockers] - Unresolved issues
 * @returns {object} Handoff document
 */
export function buildHandoff(params) {
  const { task, validation, outputs, decisions, summary, blockers } = params;

  return {
    from: {
      agent: task.agent,
      task_id: task.id,
      phase: task.phase,
    },
    to: task.handoff_to || null,
    timestamp: new Date().toISOString(),
    status: validation?.valid ? 'complete' : 'partial',
    score: validation?.score ?? null,
    summary: summary || `Task ${task.id} completed.`,
    outputs: outputs || task.outputs || [],
    decisions: decisions || {},
    blockers: blockers || [],
    criteria_met: task.criteria.filter((_, i) => {
      const unmet = new Set(validation?.unmet || []);
      return !unmet.has(task.criteria[i]);
    }),
    criteria_unmet: validation?.unmet || [],
  };
}

/**
 * Serialize a handoff document to YAML-like markdown.
 *
 * @param {object} handoff - Handoff document from buildHandoff
 * @returns {string} Formatted handoff string
 */
export function formatHandoff(handoff) {
  const lines = [
    '---',
    `from_agent: ${handoff.from.agent}`,
    `from_task: ${handoff.from.task_id}`,
    `from_phase: ${handoff.from.phase}`,
    `to: ${handoff.to || 'orchestrator'}`,
    `timestamp: ${handoff.timestamp}`,
    `status: ${handoff.status}`,
    `score: ${handoff.score ?? 'N/A'}`,
    '---',
    '',
    `# Handoff: ${handoff.from.agent} → ${handoff.to || 'orchestrator'}`,
    '',
    '## Summary',
    handoff.summary,
    '',
  ];

  if (handoff.outputs.length > 0) {
    lines.push('## Outputs');
    for (const output of handoff.outputs) {
      lines.push(`- ${output}`);
    }
    lines.push('');
  }

  if (Object.keys(handoff.decisions).length > 0) {
    lines.push('## Decisions');
    for (const [key, value] of Object.entries(handoff.decisions)) {
      lines.push(`- **${key}**: ${value}`);
    }
    lines.push('');
  }

  if (handoff.blockers.length > 0) {
    lines.push('## Blockers');
    for (const blocker of handoff.blockers) {
      lines.push(`- ${blocker}`);
    }
    lines.push('');
  }

  if (handoff.criteria_met.length > 0) {
    lines.push('## Criteria Met');
    for (const c of handoff.criteria_met) {
      lines.push(`- [x] ${c}`);
    }
    lines.push('');
  }

  if (handoff.criteria_unmet.length > 0) {
    lines.push('## Criteria Unmet');
    for (const c of handoff.criteria_unmet) {
      lines.push(`- [ ] ${c}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Save a handoff document to the artifacts directory.
 *
 * @param {string} projectDir - Project root directory
 * @param {object} handoff - Handoff document
 * @returns {{ saved: boolean, path: string|null, error: string|null }}
 */
export function saveHandoff(projectDir, handoff) {
  try {
    const handoffsDir = join(projectDir, 'chati.dev', 'artifacts', 'handoffs');
    if (!existsSync(handoffsDir)) {
      mkdirSync(handoffsDir, { recursive: true });
    }

    const filename = `${handoff.from.agent}-handoff.md`;
    const filePath = join(handoffsDir, filename);
    const content = formatHandoff(handoff);

    writeFileSync(filePath, content, 'utf-8');
    return { saved: true, path: filePath, error: null };
  } catch (err) {
    return { saved: false, path: null, error: `Failed to save handoff: ${err.message}` };
  }
}

/**
 * Load the most recent handoff from a specific agent.
 *
 * @param {string} projectDir - Project root directory
 * @param {string} agentName - Agent that produced the handoff
 * @returns {{ loaded: boolean, handoff: object|null, error: string|null }}
 */
export function loadHandoff(projectDir, agentName) {
  const filePath = join(projectDir, 'chati.dev', 'artifacts', 'handoffs', `${agentName}-handoff.md`);

  if (!existsSync(filePath)) {
    return { loaded: false, handoff: null, error: `No handoff found from agent '${agentName}'.` };
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = parseHandoffContent(raw);
    return { loaded: true, handoff: parsed, error: null };
  } catch (err) {
    return { loaded: false, handoff: null, error: `Failed to parse handoff: ${err.message}` };
  }
}

/**
 * Parse a handoff markdown document back into structured data.
 *
 * @param {string} content - Handoff file content
 * @returns {object} Parsed handoff data
 */
export function parseHandoffContent(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);

  const meta = {};
  let body = content;

  if (frontmatterMatch) {
    const yamlPart = frontmatterMatch[1];
    body = frontmatterMatch[2];

    for (const line of yamlPart.split('\n')) {
      const match = line.match(/^(\w[\w_-]*):\s*(.+)$/);
      if (match) {
        meta[match[1]] = match[2].trim();
      }
    }
  }

  // Extract sections from body
  const sections = {};
  let currentSection = null;
  const sectionLines = {};

  for (const line of body.split('\n')) {
    const headerMatch = line.match(/^## (.+)/);
    if (headerMatch) {
      currentSection = headerMatch[1].toLowerCase().replace(/\s+/g, '_');
      sectionLines[currentSection] = [];
    } else if (currentSection) {
      sectionLines[currentSection].push(line);
    }
  }

  // Parse list items from sections
  for (const [key, lines] of Object.entries(sectionLines)) {
    sections[key] = lines
      .map(l => l.trim())
      .filter(l => l.startsWith('- '))
      .map(l => l.replace(/^- (\[.\] )?/, '').trim());
  }

  return {
    from_agent: meta.from_agent || null,
    from_task: meta.from_task || null,
    to: meta.to || null,
    timestamp: meta.timestamp || null,
    status: meta.status || 'unknown',
    score: meta.score !== 'N/A' ? parseInt(meta.score, 10) || null : null,
    summary: (sectionLines.summary || []).join(' ').trim(),
    outputs: sections.outputs || [],
    decisions: sections.decisions || [],
    blockers: sections.blockers || [],
    criteria_met: sections.criteria_met || [],
    criteria_unmet: sections.criteria_unmet || [],
  };
}
