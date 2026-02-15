/**
 * @fileoverview Parse structured handoff data from spawned agent output.
 *
 * Agents running in separate `claude -p` terminals include a
 * <chati-handoff> block in their output. This module extracts
 * and parses that block so the orchestrator can read the results.
 */

/**
 * Parse the <chati-handoff> block from agent stdout.
 *
 * @param {string} output - Full stdout from the agent process
 * @returns {{ found: boolean, handoff: object|null, rawOutput: string }}
 */
export function parseAgentOutput(output) {
  if (!output || typeof output !== 'string') {
    return { found: false, handoff: null, rawOutput: '' };
  }

  const match = output.match(/<chati-handoff>([\s\S]*?)<\/chati-handoff>/);
  if (!match) {
    return { found: false, handoff: null, rawOutput: output };
  }

  const content = match[1].trim();
  const handoff = parseHandoffFields(content);

  return { found: true, handoff, rawOutput: output };
}

/**
 * Parse YAML-like key-value fields from the handoff block content.
 *
 * Supports:
 *   scalar: value
 *   list:
 *     - item1
 *     - item2
 *   map:
 *     key1: value1
 *     key2: value2
 *
 * @param {string} content - Content inside <chati-handoff> tags
 * @returns {object} Parsed handoff data
 */
function parseHandoffFields(content) {
  const result = {
    status: 'unknown',
    score: null,
    summary: '',
    outputs: [],
    decisions: {},
    blockers: [],
    needs_input_question: null,
  };

  const lines = content.split('\n');
  let currentKey = null;
  let currentType = null; // 'list' | 'map'

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this is a list item (  - value)
    const listMatch = trimmed.match(/^-\s+(.+)/);
    if (listMatch && currentKey && currentType === 'list') {
      if (Array.isArray(result[currentKey])) {
        result[currentKey].push(listMatch[1].trim());
      }
      continue;
    }

    // Check if this is a map item (  key: value) under a map key
    const mapMatch = trimmed.match(/^(\w[\w_-]*):\s+(.+)/);
    if (mapMatch && currentKey && currentType === 'map') {
      if (typeof result[currentKey] === 'object' && !Array.isArray(result[currentKey])) {
        result[currentKey][mapMatch[1]] = mapMatch[2].trim();
      }
      continue;
    }

    // Top-level key: value
    const kvMatch = trimmed.match(/^(\w[\w_-]*):\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      // Known list keys
      if (['outputs', 'blockers'].includes(key)) {
        currentKey = key;
        currentType = 'list';
        // If value is inline (not empty), treat as single item
        if (value && value !== '') {
          result[key] = [value];
          currentKey = null;
          currentType = null;
        }
        continue;
      }

      // Known map keys
      if (['decisions'].includes(key)) {
        currentKey = key;
        currentType = 'map';
        continue;
      }

      // Scalar keys
      currentKey = null;
      currentType = null;

      if (key === 'status') {
        result.status = value || 'unknown';
      } else if (key === 'score') {
        const num = parseInt(value, 10);
        result.score = isNaN(num) ? null : num;
      } else if (key === 'summary') {
        result.summary = value || '';
      } else if (key === 'needs_input_question') {
        result.needs_input_question = value === 'null' || value === '' ? null : value;
      }
    }
  }

  return result;
}
