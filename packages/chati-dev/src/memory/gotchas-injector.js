import { getRelevantGotchas } from './gotchas.js';

/**
 * Build a gotchas context block for injection into agent prompts.
 * @param {string} projectDir - Project directory
 * @param {object} context - { agent, task, keywords }
 * @returns {string} Formatted XML block with relevant gotchas
 */
export function buildGotchasContext(projectDir, context) {
  const relevantGotchas = getRelevantGotchas(projectDir, context);

  if (relevantGotchas.length === 0) {
    return '';
  }

  // Take top 5 most relevant
  const topGotchas = relevantGotchas.slice(0, 5);

  const gotchasXml = topGotchas.map(gotcha => {
    const description = gotcha.resolution
      ? `${gotcha.original_message} — Resolution: ${gotcha.resolution}`
      : gotcha.original_message;

    return `  <gotcha id="${gotcha.id}" pattern="${gotcha.pattern}" count="${gotcha.count}" relevance="${gotcha.relevance}">
    ${escapeXml(description)}
  </gotcha>`;
  }).join('\n');

  return `<gotchas agent="${escapeXml(context.agent || 'unknown')}" count="${topGotchas.length}">
${gotchasXml}
</gotchas>`;
}

/**
 * Escape XML special characters.
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
  if (typeof text !== 'string') {
    return String(text);
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a compact gotchas summary for smaller context windows.
 * @param {string} projectDir - Project directory
 * @param {object} context - { agent, task, keywords }
 * @returns {string} Compact text summary
 */
export function buildCompactGotchasSummary(projectDir, context) {
  const relevantGotchas = getRelevantGotchas(projectDir, context);

  if (relevantGotchas.length === 0) {
    return '';
  }

  const topGotchas = relevantGotchas.slice(0, 3);

  const lines = topGotchas.map((gotcha, idx) => {
    const resolution = gotcha.resolution ? ` → ${gotcha.resolution}` : '';
    return `${idx + 1}. [${gotcha.id}] ${gotcha.message} (seen ${gotcha.count}x)${resolution}`;
  });

  return `⚠️ Gotchas (${context.agent || 'unknown'}):\n${lines.join('\n')}`;
}
