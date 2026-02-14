---
id: qa-impl-test-execute
agent: qa-implementation
trigger: dev
phase: build
requires_input: false
parallelizable: false
outputs: [test-results.yaml]
handoff_to: qa-impl-sast-scan
autonomous_gate: false
criteria:
  - All unit tests executed
  - All integration tests executed
  - Test results collected and analyzed
  - Failures categorized by severity
---

# Test Suite Execution

## Purpose
Execute the complete test suite (unit and integration tests) for the implemented code, collect results, analyze failures, and provide actionable feedback for remediation.

## Prerequisites
- Implementation complete (dev agent marked tasks as done)
- Test files exist in test/ or **/*.test.js
- Test framework configured (package.json scripts)
- Coverage tool configured
- qa-plan.yaml with coverage targets

## Steps

1. **Verify Test Environment**
   - Check that test framework is installed (npm list vitest / jest / mocha)
   - Verify test scripts exist in package.json (test, test:unit, test:integration)
   - Ensure coverage tool is configured (c8, nyc, or built-in)
   - Validate test environment variables if required

2. **Discover Test Files**
   - Scan for unit test files: **/*.test.js, **/*.spec.js in unit/
   - Scan for integration test files: **/*.test.js in integration/
   - List all discovered test files with count
   - Verify test files match implemented modules (coverage-plan.yaml reference)

3. **Execute Unit Tests**
   - Run: `npm run test:unit` or equivalent
   - Capture exit code (0 = pass, non-zero = fail)
   - Parse test output for results (passed, failed, skipped)
   - Collect execution time and memory usage
   - Save raw output to test-results/unit-output.log

4. **Execute Integration Tests**
   - Run: `npm run test:integration` or equivalent
   - Capture exit code
   - Parse test output for results
   - Collect execution time (integration tests typically slower)
   - Save raw output to test-results/integration-output.log

5. **Generate Coverage Report**
   - Run: `npm run test:coverage` or `c8 npm test`
   - Parse coverage output for percentages (line, branch, function, statement)
   - Generate HTML coverage report for detailed inspection
   - Compare coverage to qa-plan.yaml targets (overall, per-module)
   - Identify modules below target coverage

6. **Analyze Test Failures**
   - For each failed test:
     - Extract test name, file, line number
     - Capture error message and stack trace
     - Categorize failure type (assertion, exception, timeout, setup error)
     - Determine affected module/component
   - Group failures by module for reporting

7. **Categorize by Severity**
   - **CRITICAL**: Failures in critical-risk modules (state management, mode governance, file operations)
   - **HIGH**: Failures in high-risk modules (agent logic, orchestrator, configuration)
   - **MEDIUM**: Failures in medium-risk modules (CLI, i18n, error handling)
   - **LOW**: Failures in low-risk modules (formatting, documentation)
   - Reference risk-matrix.yaml for severity mapping

8. **Check for Test Quality Issues**
   - **Flaky tests**: Tests that fail intermittently (run failed tests 3x to verify)
   - **Skipped tests**: Tests marked as .skip or .todo (should be minimal)
   - **Long-running tests**: Tests exceeding 5 seconds (may indicate inefficiency)
   - **No assertions**: Tests that pass but have no assertions (false positives)

9. **Calculate Test Metrics**
   - **Pass rate**: (passed / total) * 100
   - **Coverage delta**: actual coverage - target coverage
   - **Failure density**: failures per module
   - **Test execution time**: total time for full suite
   - **Flakiness rate**: flaky tests / total tests

10. **Generate Recommendations**
    - For coverage gaps: Suggest specific areas needing tests
    - For failures: Provide first-action recommendations (fix code vs fix test)
    - For flaky tests: Recommend stabilization strategies
    - For long-running tests: Suggest optimization approaches

11. **Compile Test Results Document**
    - Summarize pass/fail status
    - Include coverage report
    - List failures with severity and recommendations
    - Document test quality issues
    - Provide overall assessment (PASS, FAIL, CONDITIONAL)

12. **Log Results and Next Steps**
    - Save test-results.yaml to session
    - Update session.yaml with test execution status
    - If all tests pass and coverage meets targets: proceed to SAST scan
    - If failures exist: flag for dev agent remediation, then re-run

## Decision Points

- **Coverage Below Target but Tests Pass**: If coverage is 2-5% below target but all tests pass, decide whether to proceed with CONDITIONAL status or block for more tests. Recommend: CONDITIONAL if critical modules meet targets, FAIL if critical modules below target.

- **Flaky Test Handling**: If a test fails once but passes on retry, mark as flaky rather than failed. However, if >10% of tests are flaky, treat as a test quality issue and FAIL the build.

- **Integration Test Failures Due to Environment**: If integration tests fail due to missing external dependencies (e.g., filesystem permissions, network), distinguish from code failures. Provide remediation steps for environment setup.

## Error Handling

**Test Script Not Found**
- If package.json lacks test scripts, check for test framework binary (node_modules/.bin/vitest)
- Attempt to run directly: `npx vitest run`
- If no test framework found, FAIL with error: "Test framework not installed"
- Escalate to dev agent for test setup

**Test Execution Timeout**
- If tests hang (no output for 5 minutes), kill process
- Log timeout error with test context (last test executed)
- Investigate long-running tests or infinite loops
- Recommend: Add --testTimeout flag or investigate hanging code

**Coverage Tool Failure**
- If coverage generation fails, proceed with test results only
- Log coverage tool error
- Mark coverage as UNKNOWN in test-results.yaml
- Recommend: Fix coverage configuration, re-run

**Parse Failure (Unrecognized Output Format)**
- If test output format is unrecognized, save raw output
- Attempt to extract pass/fail from exit code only
- Log parse warning
- Recommend: Use standard test reporter (JSON, TAP)

## Output Format

```yaml
# test-results.yaml
version: 1.0.0
created: YYYY-MM-DD
agent: qa-implementation
phase: build

summary:
  status: FAIL # PASS, FAIL, CONDITIONAL
  total_tests: 247
  passed: 235
  failed: 12
  skipped: 0
  pass_rate: 95.1%
  execution_time: 42.3s

unit_tests:
  total: 198
  passed: 191
  failed: 7
  skipped: 0
  pass_rate: 96.5%
  execution_time: 18.7s
  output_log: test-results/unit-output.log

integration_tests:
  total: 49
  passed: 44
  failed: 5
  skipped: 0
  pass_rate: 89.8%
  execution_time: 23.6s
  output_log: test-results/integration-output.log

coverage:
  overall: 76.3%
  target: 75%
  delta: +1.3%
  status: PASS

  by_metric:
    line: 76.3%
    branch: 72.1%
    function: 81.2%
    statement: 76.5%

  by_module:
    orchestrator:
      actual: 87%
      target: 85%
      status: PASS

    state_management:
      actual: 91%
      target: 90%
      status: PASS

    agents:
      actual: 78%
      target: 75%
      status: PASS

    file_operations:
      actual: 73%
      target: 80%
      status: FAIL
      gap: -7%

    validators:
      actual: 92%
      target: 90%
      status: PASS

    cli:
      actual: 68%
      target: 70%
      status: FAIL
      gap: -2%

  html_report: coverage/index.html

failures:
  critical:
    - test: "state_management: concurrent write protection"
      file: test/unit/state-manager.test.js
      line: 142
      module: state_management
      error: "Expected lock to be acquired, but was not"
      stack_trace: |
        AssertionError: Expected lock to be acquired
            at Context.<anonymous> (test/unit/state-manager.test.js:142:12)
      recommendation: "Fix lock acquisition logic in state/session-manager.js"
      severity: CRITICAL
      risk_level: critical

  high:
    - test: "file_operations: permission error handling"
      file: test/integration/file-ops.test.js
      line: 87
      module: file_operations
      error: "Expected error to be thrown, but function succeeded"
      stack_trace: |
        AssertionError: Expected error to be thrown
            at Context.<anonymous> (test/integration/file-ops.test.js:87:15)
      recommendation: "Add permission check in utils/file-ops.js before write"
      severity: HIGH
      risk_level: high

  medium:
    - test: "cli: invalid argument handling"
      file: test/unit/cli-parser.test.js
      line: 203
      module: cli
      error: "TypeError: Cannot read property 'value' of undefined"
      stack_trace: |
        TypeError: Cannot read property 'value' of undefined
            at parseArgs (cli/index.js:45:18)
      recommendation: "Add null check for optional arguments"
      severity: MEDIUM
      risk_level: medium

  low: []

test_quality_issues:
  flaky_tests:
    count: 2
    rate: 0.8%
    tests:
      - name: "agent: task execution with timeout"
        file: test/integration/agent-executor.test.js
        pass_rate: 2/3
        recommendation: "Increase timeout or mock async operations"

  skipped_tests:
    count: 0
    rate: 0%

  long_running_tests:
    count: 5
    threshold: 5s
    tests:
      - name: "upgrade: full migration end-to-end"
        file: test/e2e/upgrade.test.js
        duration: 12.3s
        recommendation: "Acceptable for e2e test, consider splitting if grows >20s"

  no_assertions:
    count: 0

metrics:
  pass_rate: 95.1%
  coverage_delta: +1.3%
  failure_density:
    state_management: 1 failure / 45 tests (2.2%)
    file_operations: 1 failure / 38 tests (2.6%)
    cli: 1 failure / 42 tests (2.4%)
  execution_time: 42.3s
  flakiness_rate: 0.8%

assessment:
  status: FAIL
  rationale: |
    - 12 test failures across critical, high, and medium severity
    - Coverage for file_operations below target (-7%)
    - Critical failure in state management (concurrent write protection)

  blocking_issues:
    - CRITICAL: state_management concurrent write protection failure
    - HIGH: file_operations permission error handling failure
    - Coverage gap in file_operations module (-7%)

  conditional_pass_criteria:
    - Fix all CRITICAL and HIGH severity failures
    - Increase file_operations coverage to 80% (add 7% more tests)
    - Re-run test suite and verify PASS

  recommendations:
    - Priority 1: Fix state_management lock acquisition logic
    - Priority 2: Add permission check in file_operations
    - Priority 3: Add 10-12 tests for file_operations (edge cases, error handling)
    - Priority 4: Fix medium severity CLI parsing issue
    - Address flaky agent test (increase timeout or mock)

next_steps:
  - Return to dev agent for remediation of blocking issues
  - Re-run qa-impl-test-execute after fixes
  - If rerun passes, proceed to qa-impl-sast-scan
  - Do NOT proceed to SAST until all tests pass and coverage targets met

handoff:
  to: dev
  reason: Test failures and coverage gap
  priority_fixes:
    - state_management: concurrent write protection
    - file_operations: permission error handling
    - file_operations: add 10-12 tests for 7% coverage increase
```
