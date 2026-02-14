/**
 * Context Formatter — Produces structured XML for agent prompt injection.
 *
 * Output format: <chati-context bracket="..."> with nested sections.
 * Truncates intelligently based on token budget via priority-based pruning.
 */

/**
 * Format PRISM pipeline results into XML context block.
 * @param {object} options
 * @param {string} options.bracket - Current bracket name
 * @param {number} options.tokenBudget - Max approximate token count
 * @param {object} options.l0 - L0 Constitution result
 * @param {object} [options.l1] - L1 Global result
 * @param {object} [options.l2] - L2 Agent result
 * @param {object} [options.l3] - L3 Workflow result
 * @param {object} [options.l4] - L4 Task result
 * @returns {string} XML context block
 */
export function formatContext(options) {
  const { bracket, tokenBudget, l0, l1, l2, l3, l4 } = options;
  const sections = [];

  // L0 — Constitution (always present)
  if (l0) {
    sections.push(formatConstitution(l0));
  }

  // L1 — Mode + Global
  if (l1) {
    sections.push(formatGlobal(l1));
  }

  // L2 — Agent
  if (l2 && l2.agent) {
    sections.push(formatAgent(l2));
  }

  // L3 — Pipeline/Workflow
  if (l3 && l3.workflow) {
    sections.push(formatWorkflow(l3));
  }

  // L4 — Task
  if (l4 && l4.taskId) {
    sections.push(formatTask(l4));
  }

  let body = sections.join('\n\n');

  // Truncate if over budget (rough estimate: 1 token ≈ 4 chars)
  const maxChars = tokenBudget * 4;
  if (body.length > maxChars) {
    body = truncateByPriority(sections, maxChars);
  }

  return `<chati-context bracket="${bracket}">\n${body}\n</chati-context>`;
}

function formatConstitution(l0) {
  const rulesText = l0.rules.length > 0
    ? l0.rules.map(r => `    <rule id="${esc(r.id)}" priority="${esc(r.priority)}">${esc(r.text)}</rule>`).join('\n')
    : `    <summary>${esc(l0.summary)}</summary>`;

  return `  <constitution articles="${l0.articleCount}">\n${rulesText}\n  </constitution>`;
}

function formatGlobal(l1) {
  const lines = [];
  lines.push(`  <mode name="${esc(l1.mode)}">`);
  if (l1.modeRules.writeScope) {
    lines.push(`    <write-scope>${esc(l1.modeRules.writeScope)}</write-scope>`);
  }
  if (l1.modeRules.allowedActions.length > 0) {
    lines.push(`    <allowed>${l1.modeRules.allowedActions.map(esc).join(', ')}</allowed>`);
  }
  if (l1.modeRules.blockedActions.length > 0) {
    lines.push(`    <blocked>${l1.modeRules.blockedActions.map(esc).join(', ')}</blocked>`);
  }
  lines.push(`  </mode>`);

  if (l1.rules.length > 0) {
    lines.push(`  <global-rules>`);
    for (const r of l1.rules) {
      lines.push(`    <rule id="${esc(r.id)}">${esc(r.text)}</rule>`);
    }
    lines.push(`  </global-rules>`);
  }

  return lines.join('\n');
}

function formatAgent(l2) {
  const lines = [];
  lines.push(`  <agent name="${esc(l2.agent)}">`);
  if (l2.mission) {
    lines.push(`    <mission>${esc(l2.mission)}</mission>`);
  }
  if (l2.authority.exclusive.length > 0) {
    lines.push(`    <exclusive>${l2.authority.exclusive.map(esc).join(', ')}</exclusive>`);
  }
  if (l2.authority.blocked.length > 0) {
    lines.push(`    <blocked>${l2.authority.blocked.map(esc).join(', ')}</blocked>`);
  }
  if (l2.outputs.length > 0) {
    lines.push(`    <outputs>${l2.outputs.map(esc).join(', ')}</outputs>`);
  }
  if (l2.rules.length > 0) {
    for (const r of l2.rules) {
      lines.push(`    <rule id="${esc(r.id)}">${esc(r.text)}</rule>`);
    }
  }
  lines.push(`  </agent>`);
  return lines.join('\n');
}

function formatWorkflow(l3) {
  const p = l3.pipelineContext;
  const lines = [];
  lines.push(`  <pipeline workflow="${esc(l3.workflow)}" progress="${p.progress}%">`);
  if (p.previousStep) lines.push(`    <previous>${esc(p.previousStep)}</previous>`);
  if (p.currentStep) lines.push(`    <current>${esc(p.currentStep)}</current>`);
  if (p.nextStep) lines.push(`    <next>${esc(p.nextStep)}</next>`);
  if (l3.rules.length > 0) {
    for (const r of l3.rules) {
      lines.push(`    <rule id="${esc(r.id)}">${esc(r.text)}</rule>`);
    }
  }
  lines.push(`  </pipeline>`);
  return lines.join('\n');
}

function formatTask(l4) {
  const lines = [];
  lines.push(`  <task id="${esc(l4.taskId)}">`);
  if (l4.criteria.length > 0) {
    lines.push(`    <criteria>`);
    for (const c of l4.criteria) {
      lines.push(`      <criterion>${esc(c)}</criterion>`);
    }
    lines.push(`    </criteria>`);
  }
  if (l4.artifacts.length > 0) {
    lines.push(`    <artifacts>${l4.artifacts.map(esc).join(', ')}</artifacts>`);
  }
  if (Object.keys(l4.handoff).length > 0) {
    lines.push(`    <handoff>`);
    for (const [key, val] of Object.entries(l4.handoff)) {
      lines.push(`      <${esc(key)}>${esc(String(val))}</${esc(key)}>`);
    }
    lines.push(`    </handoff>`);
  }
  lines.push(`  </task>`);
  return lines.join('\n');
}

/**
 * Truncate sections by removing lower-priority layers first (L4 → L3 → L2).
 * L0 and L1 are never truncated.
 */
function truncateByPriority(sections, maxChars) {
  let result = sections.join('\n\n');
  // Remove from end (lowest priority) until within budget
  const trimmed = [...sections];
  while (trimmed.length > 2 && result.length > maxChars) {
    trimmed.pop();
    result = trimmed.join('\n\n');
  }
  // If still over, hard truncate
  if (result.length > maxChars) {
    result = result.slice(0, maxChars) + '\n  <!-- truncated -->';
  }
  return result;
}

/** Escape XML special characters */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
