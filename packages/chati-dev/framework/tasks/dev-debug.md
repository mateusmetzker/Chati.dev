---
id: dev-debug
agent: dev
trigger: dev-refactor
phase: build
requires_input: false
parallelizable: false
outputs: [debug-log]
handoff_to: dev-code-review
autonomous_gate: true
criteria:
  - All tests passing
  - No runtime errors
---
# Debug and Fix

## Purpose
Identify and resolve any failing tests, runtime errors, or unexpected behaviors discovered during or after refactoring.

## Prerequisites
- Refactoring complete
- Test suite available
- Refactor report exists
- Source maps configured
- Debugging tools available

## Steps

### 1. Run Full Test Suite
Execute all tests to identify failures:
```bash
npm test
```
- Record which tests fail
- Note error messages
- Identify patterns in failures
- Check for flaky tests
- Document success rate

### 2. Analyze Test Failures
Understand why tests are failing:
- Read error messages carefully
- Check stack traces
- Identify failed assertions
- Review test expectations
- Compare expected vs actual output

### 3. Reproduce Issues Locally
Isolate failing tests:
```bash
npm test -- --testNamePattern="specific test"
```
- Run individual tests
- Add console.log for debugging
- Use debugger breakpoints
- Inspect intermediate values
- Verify test setup

### 4. Check Recent Changes
Review what changed:
- Compare with last working state
- Check refactoring changes
- Review type changes
- Inspect renamed functions
- Verify imports updated

### 5. Add Diagnostic Logging
Insert strategic log statements:
```typescript
console.log('Input:', JSON.stringify(input, null, 2));
console.log('Processing step 1 complete');
console.log('Output:', JSON.stringify(output, null, 2));
```
- Log function entry/exit
- Log intermediate values
- Log conditional branches taken
- Log error conditions
- Remove logs after debugging

### 6. Use Interactive Debugger
For complex issues, use debugger:
- Set breakpoints in IDE
- Step through execution
- Inspect variable values
- Watch expressions
- Examine call stack

### 7. Fix Root Causes
Address underlying issues:
- Fix logic errors
- Correct type mismatches
- Update broken references
- Repair data flow
- Resolve timing issues

Common fixes:
```typescript
// Fix async handling
await someAsyncFunction(); // Don't forget await

// Fix null checks
if (value !== null && value !== undefined) { }

// Fix type assertions
const typed = value as ExpectedType;

// Fix array operations
const items = array.filter(item => item !== null);
```

### 8. Fix Flaky Tests
Address intermittent failures:
- Identify timing dependencies
- Add proper waits/delays
- Mock time-dependent functions
- Ensure proper cleanup
- Reset state between tests

### 9. Update Tests if Needed
Sometimes tests need fixing, not code:
- Check if expectations are still valid
- Update mocks if interfaces changed
- Fix test setup
- Adjust assertions
- Update test data

### 10. Verify Fixes
Confirm issues resolved:
- Run failing test multiple times
- Run full suite
- Check for new failures
- Verify coverage maintained
- Test in different scenarios

### 11. Test Runtime Scenarios
Beyond unit tests, verify runtime behavior:
- Start the application
- Exercise the new feature
- Check console for errors
- Verify expected behavior
- Test error cases manually

### 12. Document Debugging Process
Record issues and solutions:
- List bugs found
- Note root causes
- Document fixes applied
- Record lessons learned
- Update tests or code comments

## Decision Points

### When Root Cause is Unclear
If you can't identify the problem:
1. Add more logging
2. Simplify the test case
3. Remove complexity incrementally
4. Compare with working code
5. Ask for user input if stuck

### When Fix Would Be Major
If fix requires significant changes:
1. Document the issue
2. Assess impact
3. Propose solution to user
4. May need to revisit architecture
5. Don't make large changes without approval

### When Tests Need Updating
Determine if test or code is wrong:
1. Review acceptance criteria
2. Check if behavior intentionally changed
3. Verify test assumptions
4. Update test if refactor changed behavior correctly
5. Fix code if behavior is wrong

## Error Handling

### Cannot Reproduce Failure
- Check test isolation
- Verify environment setup
- Clear caches and rebuild
- Check for timing issues
- Run tests multiple times

### Debugger Not Working
- Verify source maps configured
- Check IDE debugger setup
- Use console.log as fallback
- Ensure breakpoints in executed code
- Check for minification issues

### Cascading Failures
When one fix breaks other tests:
- Run tests after each fix
- Commit working states
- Use git to track changes
- Fix issues incrementally
- Consider reverting and retrying

### Performance Issues
If debugging reveals performance problems:
- Profile the code
- Identify bottlenecks
- Note for optimization later
- Don't optimize prematurely
- Document performance concerns

## Output Format

Create `.chati/artifacts/build/debug-log.yaml`:

```yaml
task_id: "3.2.1"
agent: dev
action: debug
timestamp: "2026-02-13T12:45:00Z"
duration_minutes: 30

initial_test_status:
  total_tests: 20
  passing: 17
  failing: 3
  flaky: 0

failures_identified:
  - test: "ChatService should emit message event on send"
    file: "chat-service.test.ts"
    error: "Expected emit to be called with 'message', but was not called"
    category: logic_error
  - test: "should sanitize HTML in messages"
    file: "chat-service.test.ts"
    error: "TypeError: sanitizeHtml is not a function"
    category: refactor_issue
  - test: "Integration: WebSocket receives new messages"
    file: "chat-integration.test.ts"
    error: "Timeout: async callback not invoked within 5000ms"
    category: async_issue

debugging_steps:
  - issue: "Missing emit call"
    approach: "Added logging to trace execution flow"
    finding: "Event emission code removed during refactoring"
    fix: "Re-added this.emit('message', message) call"
  - issue: "sanitizeHtml not a function"
    approach: "Checked imports after refactoring"
    finding: "Import statement not updated when function moved"
    fix: "Updated import to reference new validators.ts module"
  - issue: "WebSocket timeout"
    approach: "Used debugger to step through async flow"
    finding: "Promise never resolved due to missing await"
    fix: "Added await to async WebSocket send call"

fixes_applied:
  - file: "src/modules/chat/chat-service.ts"
    change: "Re-added event emission after message save"
    lines_changed: 2
  - file: "src/modules/chat/chat-service.ts"
    change: "Fixed import path for sanitizeHtml"
    lines_changed: 1
  - file: "src/modules/chat/chat-service.ts"
    change: "Added await to WebSocket broadcast"
    lines_changed: 1

tests_updated:
  - file: "chat-service.test.ts"
    change: "Updated mock setup for new module structure"
    reason: "Test assumptions outdated after refactoring"
  - file: "chat-integration.test.ts"
    change: "Increased timeout to 10000ms for WebSocket test"
    reason: "Integration test needs more time in CI environment"

runtime_verification:
  - scenario: "Send message via API"
    result: success
    notes: "Message persisted and broadcast correctly"
  - scenario: "Send message with HTML"
    result: success
    notes: "HTML properly sanitized"
  - scenario: "Send empty message"
    result: success
    notes: "Validation error thrown as expected"

final_test_status:
  total_tests: 20
  passing: 20
  failing: 0
  flaky: 0
  coverage: 89.2

lessons_learned:
  - "Always update imports when moving functions during refactoring"
  - "Verify async operations have proper await keywords"
  - "Test event emission explicitly, don't assume it works"
  - "Integration tests may need longer timeouts in CI"

remaining_issues:
  - description: "WebSocket test still occasionally times out"
    severity: low
    status: monitoring
    plan: "May need to mock WebSocket in tests"

code_quality_after_fixes:
  lint_status: pass
  type_check_status: pass
  compilation_status: pass
  test_status: pass

next_steps:
  - "Perform self code review"
  - "Check against architecture and standards"
  - "Prepare for PR"
```

## Success Criteria
- All tests pass consistently
- No runtime errors when exercising features
- Code compiles without errors
- Type checking passes
- Linting passes
- Debug log documents all issues found and fixed
- No known bugs remain
