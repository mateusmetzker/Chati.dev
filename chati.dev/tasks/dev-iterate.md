---
id: dev-iterate
agent: dev
trigger: dev-pr-prepare
phase: build
requires_input: false
parallelizable: false
outputs: [iteration-log]
handoff_to: dev-consolidate
autonomous_gate: true
criteria:
  - All feedback addressed
  - Tests still passing
---
# Apply Feedback and Iterate

## Purpose
Address feedback from QA, code reviews, or user testing, making iterative improvements while maintaining code quality and test coverage.

## Prerequisites
- PR prepared or submitted
- Feedback received (from QA-Planning, user, or team)
- Test suite available
- Review report exists
- Git branch is current

## Steps

### 1. Collect All Feedback
Gather feedback from all sources:
- QA-Planning validation results
- Code review comments
- User testing feedback
- Automated checks (CI/CD)
- Team discussions

### 2. Categorize Feedback
Organize by type and priority:

**Categories**:
- Critical: Blocks deployment
- Important: Should fix before merge
- Minor: Nice to have
- Wontfix: Out of scope

**Types**:
- Bug: Something is broken
- Improvement: Could be better
- Question: Needs clarification
- Suggestion: Alternative approach

### 3. Create Action Plan
Prioritize feedback items:
```yaml
critical:
  - Fix validation bug in message length check
  - Address SQL injection vulnerability

important:
  - Improve error messages for user clarity
  - Add missing edge case tests
  - Update documentation

minor:
  - Refactor helper function names
  - Add code comments
  - Improve variable naming

wontfix:
  - Add emoji support (Phase 5 feature)
  - Implement threading (out of scope)
```

### 4. Address Critical Issues First
Fix blocking problems immediately:
- Security vulnerabilities
- Data corruption risks
- Broken functionality
- Test failures
- Build failures

### 5. Fix Bugs
Resolve identified defects:
- Reproduce the bug
- Write failing test first
- Implement fix
- Verify test passes
- Check for similar issues elsewhere

Example:
```typescript
// Bug: Message length validation off by one
// Before
if (message.length > 500) {
  throw new ValidationError('Message too long');
}

// After
if (message.length > 1000) { // Correct limit
  throw new ValidationError('Message exceeds 1000 characters');
}

// Add test
it('should reject messages over 1000 characters', () => {
  const longMessage = 'a'.repeat(1001);
  expect(() => validateMessage(longMessage)).toThrow();
});
```

### 6. Implement Improvements
Apply suggested enhancements:
- Refactor for clarity
- Improve naming
- Add helpful comments
- Enhance error messages
- Optimize performance

### 7. Add Missing Tests
Fill test coverage gaps:
- Add tests for uncovered branches
- Test edge cases mentioned in feedback
- Add integration tests if needed
- Test error scenarios
- Verify acceptance criteria fully tested

### 8. Update Documentation
Improve docs based on feedback:
- Clarify confusing sections
- Add missing examples
- Update API documentation
- Fix typos
- Add troubleshooting guide

### 9. Respond to Questions
Address clarification requests:
- Answer reviewer questions
- Explain design decisions
- Provide context
- Update docs if question reveals gap
- Add code comments if logic unclear

### 10. Re-run Quality Checks
Verify changes maintain quality:
```bash
npm run lint
npm run typecheck
npm test
npm run build
```
- Ensure all checks pass
- Verify coverage maintained
- Check for new warnings
- Validate performance
- Review diff for unintended changes

### 11. Update PR
Reflect changes in PR:
- Commit changes with clear messages
- Update PR description if needed
- Respond to review comments
- Re-request review
- Mark conversations as resolved

### 12. Document Iteration
Record feedback and responses:
- What feedback was received
- What changes were made
- What was decided not to change
- Lessons learned
- Impact on timeline

## Decision Points

### When Feedback Conflicts
If feedback contradicts:
1. Identify the conflict
2. Understand both perspectives
3. Propose resolution
4. Escalate to user if needed
5. Document decision

### When Scope Creeps
If feedback requests new features:
1. Acknowledge the suggestion
2. Evaluate if in scope
3. If out of scope: document for future
4. If in scope: assess impact on timeline
5. Get user approval before expanding scope

### When Timeline is Impacted
If iterations take longer than expected:
1. Assess remaining work
2. Prioritize critical items
3. Defer nice-to-haves
4. Communicate delays
5. Propose phased completion

## Error Handling

### Tests Break After Changes
- Identify which tests failed
- Check if test or code is wrong
- Fix the root cause
- Verify all tests pass
- Update test report

### New Bugs Introduced
- Revert if necessary
- Identify what changed
- Write test for new bug
- Fix more carefully
- Consider pair programming

### Feedback is Unclear
- Ask for clarification
- Request examples
- Propose interpretation
- Get confirmation before implementing
- Document understanding

### Conflicting Requirements
- Document the conflict
- Present options with trade-offs
- Get stakeholder decision
- Update requirements
- Proceed with chosen approach

## Output Format

Create `.chati/artifacts/build/iteration-log.yaml`:

```yaml
task_id: "3.2.1"
agent: dev
action: iterate
timestamp: "2026-02-13T15:00:00Z"
duration_minutes: 60
iteration_number: 1

feedback_received:
  source: qa-planning
  date: "2026-02-13T14:30:00Z"
  items_count: 8
  critical_count: 2
  important_count: 4
  minor_count: 2

feedback_items:
  - id: "FB-1"
    source: qa-planning
    type: bug
    severity: critical
    description: "Message validation allows messages over 1000 characters"
    acceptance_criteria: "AC-3"
    status: fixed
    resolution: "Corrected validation logic, max length now 1000"
    files_changed: ["validators.ts"]
    test_added: true

  - id: "FB-2"
    source: qa-planning
    type: bug
    severity: critical
    description: "SQL injection possible in message search"
    acceptance_criteria: "security"
    status: fixed
    resolution: "Converted to parameterized query"
    files_changed: ["chat-repository.ts"]
    test_added: true

  - id: "FB-3"
    source: code-review
    type: improvement
    severity: important
    description: "Error messages not user-friendly"
    status: fixed
    resolution: "Rewrote error messages with actionable guidance"
    files_changed: ["chat-service.ts", "validators.ts"]
    test_added: false

  - id: "FB-4"
    source: qa-planning
    type: test-gap
    severity: important
    description: "Missing test for concurrent message sends"
    acceptance_criteria: "AC-1"
    status: fixed
    resolution: "Added integration test for race condition"
    files_changed: ["chat-integration.test.ts"]
    test_added: true

  - id: "FB-5"
    source: code-review
    type: improvement
    severity: important
    description: "README missing usage examples"
    status: fixed
    resolution: "Added comprehensive examples to README"
    files_changed: ["README.md"]
    test_added: false

  - id: "FB-6"
    source: qa-planning
    type: improvement
    severity: important
    description: "WebSocket error handling incomplete"
    status: fixed
    resolution: "Added reconnection logic and error callbacks"
    files_changed: ["websocket-service.ts"]
    test_added: true

  - id: "FB-7"
    source: code-review
    type: style
    severity: minor
    description: "Inconsistent function naming in utils"
    status: fixed
    resolution: "Renamed functions to follow verb-noun pattern"
    files_changed: ["utils.ts"]
    test_added: false

  - id: "FB-8"
    source: user
    type: suggestion
    severity: minor
    description: "Add emoji support in messages"
    status: deferred
    resolution: "Documented as Phase 5 feature"
    files_changed: []
    reason: "Out of scope for current task"

changes_made:
  bugs_fixed: 2
  improvements_implemented: 4
  tests_added: 3
  documentation_updated: 2
  files_modified: 7
  lines_added: 124
  lines_removed: 43

commits_created:
  - hash: "xyz7890"
    message: "fix(chat): correct message length validation to 1000 chars"
    files: ["validators.ts", "validators.test.ts"]
  - hash: "uvw4567"
    message: "fix(chat): prevent SQL injection in message search"
    files: ["chat-repository.ts", "chat-repository.test.ts"]
  - hash: "rst1234"
    message: "improve(chat): make error messages user-friendly"
    files: ["chat-service.ts", "validators.ts"]
  - hash: "opq8901"
    message: "test(chat): add concurrent message send test"
    files: ["chat-integration.test.ts"]
  - hash: "lmn5678"
    message: "docs(chat): add usage examples to README"
    files: ["README.md"]
  - hash: "ijk2345"
    message: "improve(chat): enhance WebSocket error handling"
    files: ["websocket-service.ts", "websocket.test.ts"]
  - hash: "ghi9012"
    message: "style(chat): standardize function naming in utils"
    files: ["utils.ts"]

test_results_after_iteration:
  total_tests: 23
  passing: 23
  failing: 0
  coverage: 91.5
  coverage_change: "+2.3%"

quality_checks:
  lint_status: pass
  type_check_status: pass
  build_status: pass
  security_scan: pass

feedback_not_addressed:
  - id: "FB-8"
    reason: "Out of scope - deferred to Phase 5"
    documented_in: "backlog"

lessons_learned:
  - "Validate against all acceptance criteria before QA"
  - "Always use parameterized queries for user input"
  - "Test edge cases explicitly, don't assume coverage"
  - "User-friendly error messages are part of quality"

impact_assessment:
  timeline_impact: "1 hour delay"
  quality_improvement: "High - critical bugs fixed"
  test_coverage_improvement: "+2.3%"
  user_satisfaction_impact: "Positive - better error UX"

next_iteration_needed: false
ready_for_consolidation: true

next_steps:
  - "Update PR with iteration commits"
  - "Request final QA review"
  - "Prepare development report"
```

## Success Criteria
- All critical feedback addressed
- All important feedback addressed or deferred with reason
- Tests still passing (or improved)
- Coverage maintained or increased
- Quality checks pass
- PR updated with changes
- Feedback documented
- Ready for final consolidation
