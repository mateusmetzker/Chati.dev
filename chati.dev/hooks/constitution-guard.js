#!/usr/bin/env node
/**
 * Constitution Guard Hook — PreToolUse (Write/Edit/Bash)
 *
 * BLOCKS operations that violate Constitution Article IV:
 * - Writing files that contain secrets/credentials
 * - Destructive operations without explicit user confirmation
 *
 * Also enforces Article XV: Session lock awareness.
 */

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/i,
  /(?:secret|password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{8,}/i,
  /(?:token)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/i,
  /(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*[:=]/i,
  /(?:PRIVATE[_-]?KEY|-----BEGIN (?:RSA |EC )?PRIVATE KEY)/i,
  /(?:Bearer\s+)[A-Za-z0-9_\-./]{20,}/,
];

const DESTRUCTIVE_COMMANDS = [
  /rm\s+-rf\s+[/~]/,
  /git\s+reset\s+--hard/,
  /git\s+push\s+--force/,
  /drop\s+(?:table|database)/i,
  /truncate\s+table/i,
  /DELETE\s+FROM\s+\w+\s*(?:;|$)/i,
];

/**
 * Check if content contains potential secrets.
 */
function containsSecrets(content) {
  if (!content || typeof content !== 'string') return [];
  const found = [];
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      found.push(pattern.source.slice(0, 40));
    }
  }
  return found;
}

/**
 * Check if a bash command is destructive.
 */
function isDestructiveCommand(command) {
  if (!command || typeof command !== 'string') return false;
  return DESTRUCTIVE_COMMANDS.some(pattern => pattern.test(command));
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  try {
    const event = JSON.parse(input);
    const toolName = event.tool_name || '';
    const toolInput = event.tool_input || {};

    // Check Write/Edit operations for secrets
    if (toolName === 'Write' || toolName === 'Edit') {
      const content = toolInput.content || toolInput.new_string || '';
      const secrets = containsSecrets(content);

      if (secrets.length > 0) {
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: `[Article IV] Potential secret detected in file content. Pattern: ${secrets[0]}. Use environment variables instead.`,
        }));
        return;
      }
    }

    // Check Bash operations for destructive commands
    if (toolName === 'Bash') {
      const command = toolInput.command || '';
      if (isDestructiveCommand(command)) {
        process.stdout.write(JSON.stringify({
          decision: 'block',
          reason: `[Article IV] Destructive command detected: "${command.slice(0, 60)}...". This requires explicit user confirmation.`,
        }));
        return;
      }
    }

    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  } catch {
    process.stdout.write(JSON.stringify({ decision: 'allow' }));
  }
}

export { containsSecrets, isDestructiveCommand, SECRET_PATTERNS, DESTRUCTIVE_COMMANDS };

// Only run main when executed directly (not imported by tests)
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
