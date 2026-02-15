/**
 * @fileoverview Tests for terminal/handoff-parser module.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentOutput } from '../../src/terminal/handoff-parser.js';

describe('handoff-parser', () => {
  describe('parseAgentOutput', () => {
    it('should extract a valid handoff block', () => {
      const output = `Some agent thinking...
Working on the task...

<chati-handoff>
status: complete
score: 97
summary: PRD criado com sucesso.
outputs:
  - chati.dev/artifacts/2-PRD/prd.md
  - chati.dev/artifacts/2-PRD/appendix.md
decisions:
  framework: next.js
  database: postgres
blockers:
needs_input_question: null
</chati-handoff>

Done.`;

      const result = parseAgentOutput(output);

      assert.equal(result.found, true);
      assert.equal(result.handoff.status, 'complete');
      assert.equal(result.handoff.score, 97);
      assert.equal(result.handoff.summary, 'PRD criado com sucesso.');
      assert.deepEqual(result.handoff.outputs, [
        'chati.dev/artifacts/2-PRD/prd.md',
        'chati.dev/artifacts/2-PRD/appendix.md',
      ]);
      assert.deepEqual(result.handoff.decisions, {
        framework: 'next.js',
        database: 'postgres',
      });
      assert.deepEqual(result.handoff.blockers, []);
      assert.equal(result.handoff.needs_input_question, null);
      assert.equal(result.rawOutput, output);
    });

    it('should return found: false when no handoff block exists', () => {
      const output = 'Just some regular agent output with no handoff.';
      const result = parseAgentOutput(output);

      assert.equal(result.found, false);
      assert.equal(result.handoff, null);
      assert.equal(result.rawOutput, output);
    });

    it('should handle null input', () => {
      const result = parseAgentOutput(null);
      assert.equal(result.found, false);
      assert.equal(result.handoff, null);
      assert.equal(result.rawOutput, '');
    });

    it('should handle undefined input', () => {
      const result = parseAgentOutput(undefined);
      assert.equal(result.found, false);
      assert.equal(result.handoff, null);
    });

    it('should handle empty string', () => {
      const result = parseAgentOutput('');
      assert.equal(result.found, false);
      assert.equal(result.handoff, null);
    });

    it('should handle non-string input', () => {
      const result = parseAgentOutput(42);
      assert.equal(result.found, false);
    });

    it('should parse needs_input status correctly', () => {
      const output = `<chati-handoff>
status: needs_input
score: 50
summary: Need clarification on database choice.
needs_input_question: Should we use PostgreSQL or MongoDB?
</chati-handoff>`;

      const result = parseAgentOutput(output);

      assert.equal(result.found, true);
      assert.equal(result.handoff.status, 'needs_input');
      assert.equal(result.handoff.score, 50);
      assert.equal(result.handoff.needs_input_question, 'Should we use PostgreSQL or MongoDB?');
    });

    it('should parse blockers list', () => {
      const output = `<chati-handoff>
status: partial
score: 60
summary: Partially done.
blockers:
  - Missing API credentials
  - Design specs unclear
</chati-handoff>`;

      const result = parseAgentOutput(output);

      assert.equal(result.found, true);
      assert.deepEqual(result.handoff.blockers, [
        'Missing API credentials',
        'Design specs unclear',
      ]);
    });

    it('should handle inline single-item outputs', () => {
      const output = `<chati-handoff>
status: complete
score: 95
summary: Done.
outputs: chati.dev/artifacts/prd.md
</chati-handoff>`;

      const result = parseAgentOutput(output);

      assert.equal(result.found, true);
      assert.deepEqual(result.handoff.outputs, ['chati.dev/artifacts/prd.md']);
    });

    it('should default status to unknown when missing', () => {
      const output = `<chati-handoff>
score: 80
summary: Some work done.
</chati-handoff>`;

      const result = parseAgentOutput(output);

      assert.equal(result.found, true);
      assert.equal(result.handoff.status, 'unknown');
    });

    it('should handle invalid score gracefully', () => {
      const output = `<chati-handoff>
status: complete
score: not-a-number
summary: Done.
</chati-handoff>`;

      const result = parseAgentOutput(output);

      assert.equal(result.found, true);
      assert.equal(result.handoff.score, null);
    });

    it('should handle needs_input_question set to null string', () => {
      const output = `<chati-handoff>
status: complete
score: 95
summary: Done.
needs_input_question: null
</chati-handoff>`;

      const result = parseAgentOutput(output);
      assert.equal(result.handoff.needs_input_question, null);
    });

    it('should handle empty needs_input_question', () => {
      const output = `<chati-handoff>
status: complete
score: 95
summary: Done.
needs_input_question:
</chati-handoff>`;

      const result = parseAgentOutput(output);
      assert.equal(result.handoff.needs_input_question, null);
    });

    it('should handle minimal valid handoff', () => {
      const output = '<chati-handoff>\nstatus: complete\n</chati-handoff>';
      const result = parseAgentOutput(output);

      assert.equal(result.found, true);
      assert.equal(result.handoff.status, 'complete');
      assert.equal(result.handoff.score, null);
      assert.equal(result.handoff.summary, '');
      assert.deepEqual(result.handoff.outputs, []);
      assert.deepEqual(result.handoff.decisions, {});
      assert.deepEqual(result.handoff.blockers, []);
    });

    it('should handle handoff block surrounded by large output', () => {
      const before = 'x'.repeat(5000);
      const after = 'y'.repeat(5000);
      const output = `${before}\n<chati-handoff>\nstatus: complete\nscore: 99\nsummary: Done.\n</chati-handoff>\n${after}`;

      const result = parseAgentOutput(output);
      assert.equal(result.found, true);
      assert.equal(result.handoff.status, 'complete');
      assert.equal(result.handoff.score, 99);
    });
  });
});
