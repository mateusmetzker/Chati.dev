---
id: qa-impl-regression-check
agent: qa-implementation
trigger: qa-impl-sast-scan
phase: build
requires_input: false
parallelizable: false
outputs: [regression-report.yaml]
handoff_to: qa-impl-performance-test
autonomous_gate: false
criteria:
  - Regression tests executed against baseline
  - Zero new regressions detected
  - Baseline updated if intentional changes
---

# Regression Testing

## Purpose
Execute regression tests to ensure new changes have not broken existing functionality, compare results against a known-good baseline, and identify any unexpected behavior changes.

## Prerequisites
- test-results.yaml with PASS status
- sast-report.yaml with no blocking vulnerabilities
- Baseline test results from previous release (if available)
- Regression test suite configured
- Test fixtures for comparison

## Steps

1. **Establish or Load Baseline**
   - Check for existing baseline: `.chati/test-baseline.yaml`
   - If first release (no baseline), current test results become baseline
   - If baseline exists, load expected behaviors and test outputs
   - Document baseline version and date

2. **Identify Regression Test Scope**
   - **Critical workflows**: Full greenfield and brownfield pipelines
   - **Core functionality**: Agent execution, mode transitions, state management
   - **Integration points**: File operations, MCP tool calls, CLI commands
   - **User-facing features**: Error messages, help text, i18n output

3. **Execute Regression Test Suite**
   - Run: `npm run test:regression` or full test suite with baseline comparison
   - Capture outputs for comparison (test results, stdout, file artifacts)
   - Execute critical path end-to-end tests
   - Run with same configuration as baseline (Node version, env vars)

4. **Compare Test Results**
   - **Test status changes**: Tests that were passing now fail, or vice versa
   - **Output differences**: stdout/stderr changes, different error messages
   - **Behavior changes**: Different execution paths, timing differences
   - **File artifact changes**: session.yaml structure, config format, generated files

5. **Categorize Differences**
   - **True regressions**: Unintended breakage of existing functionality
   - **Intentional changes**: Expected differences from new features/fixes
   - **Environment differences**: Different Node version, OS, filesystem
   - **Non-deterministic**: Timing, random IDs, timestamps

6. **Analyze True Regressions**
   - For each regression:
     - Identify affected feature/workflow
     - Determine root cause (code change, dependency update, config change)
     - Assess impact (critical path, edge case, cosmetic)
     - Map to risk level (critical, high, medium, low)
   - Prioritize by risk and user impact

7. **Validate Intentional Changes**
   - Review intentional changes against task requirements
   - Ensure changes are documented in implementation notes
   - Verify changes don't have unintended side effects
   - Update baseline expectations if changes are correct

8. **Check for Behavioral Regressions**
   - **Performance regressions**: Slower execution (>10% increase)
   - **Memory regressions**: Higher memory usage (>15% increase)
   - **Error handling regressions**: Errors not caught, poor error messages
   - **User experience regressions**: Different workflow, removed features

9. **Execute Smoke Tests on Critical Paths**
   - **Installer workflow**: `npx chati-dev init` end-to-end
   - **Agent handoff**: Verify complete pipeline execution
   - **Mode transitions**: Test autonomous and manual transitions
   - **Upgrade path**: Simulate upgrade from previous version
   - Capture any anomalies or unexpected behaviors

10. **Cross-Reference with Known Issues**
    - Check if regressions match known issues from issue tracker
    - Verify if workarounds exist for identified regressions
    - Flag new regressions not in known issues
    - Update known issues list

11. **Generate Regression Report**
    - Summarize all identified regressions
    - Categorize by severity and type
    - Provide root cause analysis for critical regressions
    - Recommend fixes or baseline updates
    - Document intentional changes

12. **Update Baseline (if appropriate)**
    - If all changes are intentional and verified, update baseline
    - Save new test-baseline.yaml with current outputs
    - Document baseline version and changes
    - Commit baseline to version control

## Decision Points

- **First Release (No Baseline)**: If this is the first release, there's no baseline for comparison. Create initial baseline from current test results. Mark status as PASS with note "Baseline established."

- **Performance Degradation**: If tests are 5-10% slower, classify as WARNING. If >10% slower, classify as REGRESSION requiring investigation. If intentional (e.g., added features), document justification.

- **Intentional Breaking Changes**: If changes intentionally break backward compatibility (documented in release notes), update baseline and mark as PASS. Ensure migration guide exists.

## Error Handling

**Missing Baseline**
- If baseline file is missing but this is not first release, log warning
- Attempt to create baseline from previous release tag (git)
- If unavailable, treat as first release and establish baseline
- Flag for manual review to ensure no regressions missed

**Test Execution Failure**
- If regression tests fail to execute (not test failures, but execution errors), investigate environment
- Check for missing dependencies, filesystem issues, permission problems
- Log detailed error and environment info
- Escalate to dev agent for environment fixes

**Non-Deterministic Test Failures**
- If tests fail inconsistently (different results on multiple runs), identify source of non-determinism
- Common causes: timestamps, random IDs, async timing, filesystem ordering
- Recommend: Seed random generators, mock timestamps, sort outputs
- Mark as test quality issue rather than regression

**Baseline Version Mismatch**
- If baseline is from a significantly older version (>2 releases back), warn that comparison may not be meaningful
- Recommend establishing new baseline for current release
- Document gap in regression tracking

## Output Format

```yaml
# regression-report.yaml
version: 1.0.0
created: YYYY-MM-DD
agent: qa-implementation
phase: build

baseline:
  version: 1.0.0
  date: YYYY-MM-DD
  source: .chati/test-baseline.yaml
  tests_count: 247
  status: LOADED # or ESTABLISHED (first release), MISSING, OUTDATED

comparison:
  status: FAIL # PASS, FAIL, WARNING
  total_differences: 8
  true_regressions: 3
  intentional_changes: 4
  non_deterministic: 1

scope:
  critical_workflows:
    - Greenfield pipeline end-to-end
    - Brownfield pipeline end-to-end
    - Mode transitions (autonomous and manual)
  core_functionality:
    - Agent task execution
    - State management operations
    - File operations
  integration_points:
    - MCP tool calls
    - CLI command parsing
    - YAML parsing and writing
  user_facing:
    - Error messages
    - Help text
    - i18n translations

execution:
  test_suite: npm run test:regression
  node_version: 22.x
  os: darwin
  execution_time: 56.2s
  baseline_execution_time: 52.1s
  time_delta: +7.9% # WARNING: approaching 10% threshold

regressions:
  critical:
    - id: REG-001
      severity: CRITICAL
      type: functional
      feature: Mode transition validation
      description: "Autonomous transition from clarity to build no longer checks 95% threshold"
      baseline_behavior: "Transition blocked when qa-planning score < 95%"
      current_behavior: "Transition proceeds regardless of score"
      root_cause: "Removed threshold check in mode-governance.js line 87 during refactor"
      affected_tests:
        - test/integration/mode-transitions.test.js::autonomous-transition-threshold
      risk_level: critical
      user_impact: "Quality gates bypassed, low-quality specs reach build phase"
      fix_recommendation: "Restore threshold check in mode-governance.js"
      estimated_effort: 1 hour

  high:
    - id: REG-002
      severity: HIGH
      type: functional
      feature: Session state persistence
      description: "session.yaml no longer includes mode_transitions array"
      baseline_behavior: "mode_transitions[] populated with audit trail"
      current_behavior: "mode_transitions[] empty or missing"
      root_cause: "State schema update removed array initialization"
      affected_tests:
        - test/unit/state-manager.test.js::mode-transitions-audit
      risk_level: high
      user_impact: "No audit trail for mode transitions, deviation tracking lost"
      fix_recommendation: "Initialize mode_transitions[] in state schema"
      estimated_effort: 2 hours

  medium:
    - id: REG-003
      severity: MEDIUM
      type: performance
      feature: YAML parsing
      description: "YAML file parsing 18% slower than baseline"
      baseline_time: 12ms per file
      current_time: 14.2ms per file
      delta: +18%
      root_cause: "Upgraded yaml package to 2.3.4 (security fix), new version slower"
      affected_workflows: "All file operations, noticeable on large projects"
      risk_level: medium
      user_impact: "Slightly slower CLI startup and agent execution"
      fix_recommendation: "Accept performance trade-off for security, or explore alternative YAML parser"
      estimated_effort: Research needed

  low: []

intentional_changes:
  - id: CHANGE-001
    feature: Error message format
    description: "Error messages now include suggested recovery actions"
    baseline: "Error: Invalid YAML syntax"
    current: "Error: Invalid YAML syntax. Check line 12 for unclosed bracket. Run 'npx chati-dev validate' to verify."
    justification: "Improved UX as per task requirement in Phase 1"
    documented_in: "Story 1.2: Enhanced error messages"
    approved: true

  - id: CHANGE-002
    feature: CLI help text
    description: "Added --verbose flag to all commands"
    baseline: "--help, --version"
    current: "--help, --version, --verbose"
    justification: "New feature for debugging, documented in CHANGELOG"
    documented_in: "Feature: CLI debugging support"
    approved: true

  - id: CHANGE-003
    feature: State schema version
    description: "session.yaml schema version updated to 2.0"
    baseline: "version: 1.0"
    current: "version: 2.0"
    justification: "Schema breaking change for mode governance"
    documented_in: "Migration guide in UPGRADE.md"
    approved: true

  - id: CHANGE-004
    feature: Default language
    description: "Default language changed from Portuguese to English"
    baseline: "default_locale: pt"
    current: "default_locale: en"
    justification: "Per spec V7 requirement"
    documented_in: "CHATI-DEV-SPEC-V7.md section 5.2"
    approved: true

non_deterministic:
  - id: NONDETERR-001
    test: test/e2e/installer.test.js::session-id-generation
    description: "Session ID differs between runs (expected)"
    baseline: "session_id: abc123"
    current: "session_id: def456"
    root_cause: "Session IDs are randomly generated UUIDs"
    resolution: "Exclude session_id from regression comparison"
    action: "Update regression test to ignore session_id field"

behavioral_checks:
  performance:
    overall_execution_time:
      baseline: 52.1s
      current: 56.2s
      delta: +7.9%
      status: WARNING # Approaching 10% threshold

    per_module:
      orchestrator:
        baseline: 8.2s
        current: 8.4s
        delta: +2.4%
        status: PASS

      state_management:
        baseline: 12.5s
        current: 13.1s
        delta: +4.8%
        status: PASS

      yaml_parsing:
        baseline: 12.0s
        current: 14.2s
        delta: +18.3%
        status: REGRESSION # >10% threshold

  memory:
    baseline: 145 MB
    current: 152 MB
    delta: +4.8%
    status: PASS # <15% threshold

  error_handling:
    status: REGRESSION
    issue: "File permission errors no longer caught in file-ops.js"
    baseline_behavior: "Graceful error with recovery suggestion"
    current_behavior: "Unhandled exception, process crash"
    fix_required: true

  user_experience:
    status: IMPROVED
    improvements:
      - Enhanced error messages with recovery actions
      - Added --verbose flag for debugging
      - Improved help text clarity

smoke_tests:
  installer_workflow:
    command: npx chati-dev init
    status: PASS
    execution_time: 8.2s
    notes: "Completed successfully, session.yaml created"

  agent_handoff:
    workflow: "greenfield-wu -> brief -> detail"
    status: FAIL
    issue: "Handoff from greenfield-wu to brief failed validation"
    error: "Missing required field: project_type"
    regression_id: REG-004 # New regression, needs investigation

  mode_transitions:
    autonomous_transition:
      status: FAIL
      issue: "Autonomous transition from clarity to build bypassed 95% check"
      regression_id: REG-001

    manual_transition:
      status: PASS

  upgrade_path:
    scenario: "v1.0.0 -> v1.1.0"
    status: PASS
    notes: "Migration successful, backup created"

assessment:
  status: FAIL
  rationale: |
    - 3 true regressions (1 CRITICAL, 1 HIGH, 1 MEDIUM)
    - CRITICAL: Mode transition threshold check bypassed (REG-001)
    - HIGH: State audit trail lost (REG-002)
    - MEDIUM: Performance degradation in YAML parsing (REG-003)
    - Smoke test failure in agent handoff (REG-004)

  blocking_issues:
    - REG-001: Mode transition threshold check bypassed (CRITICAL)
    - REG-002: State audit trail missing (HIGH)
    - REG-004: Agent handoff validation failure (severity TBD)

  conditional_pass_criteria:
    - Fix all CRITICAL and HIGH regressions
    - Investigate and resolve REG-004 (agent handoff)
    - Accept or fix MEDIUM performance regression (REG-003)
    - Re-run regression tests to verify fixes

  recommendations:
    - Priority 1: Restore mode transition threshold check (REG-001)
    - Priority 2: Fix state audit trail initialization (REG-002)
    - Priority 3: Investigate agent handoff failure (REG-004)
    - Priority 4: Decide on YAML performance trade-off (REG-003)
    - Update baseline after fixes to include intentional changes

baseline_update:
  required: true
  reason: "4 intentional changes need baseline update after regressions fixed"
  deferred_until: "All regressions resolved"
  changes_to_include:
    - CHANGE-001: Enhanced error messages
    - CHANGE-002: CLI --verbose flag
    - CHANGE-003: State schema v2.0
    - CHANGE-004: Default language English

next_steps:
  - Return to dev agent for regression fixes
  - Priority fixes: REG-001, REG-002, REG-004
  - Re-run qa-impl-regression-check after fixes
  - If rerun passes, update baseline and proceed to qa-impl-performance-test
  - Do NOT proceed to performance testing until regressions resolved

handoff:
  to: dev
  reason: "3 true regressions + 1 smoke test failure"
  priority_fixes:
    - mode-governance.js: Restore 95% threshold check for autonomous transitions
    - state-manager.js: Initialize mode_transitions[] array in state schema
    - Agent handoff: Investigate missing project_type field validation
```
