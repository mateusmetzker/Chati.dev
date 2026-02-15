---
id: orchestrator-spawn-terminal
agent: orchestrator
trigger: orchestrator-internal
phase: build
requires_input: false
parallelizable: true
outputs: [terminal-manifest]
handoff_to: null
autonomous_gate: true
criteria:
  - Parallelizable tasks identified
  - Isolated contexts prepared
  - Terminal coordination successful
  - Results merged correctly
---

# Orchestrator Spawn Terminal Task

## Purpose
Coordinate parallel execution of independent tasks across multiple terminal instances, managing context isolation and result aggregation.

## Prerequisites
- Multi-terminal IDE support (Claude Code, VS Code, Cursor, Windsurf)
- Task definitions with `parallelizable: true` flag
- Session state at `.chati/session.yaml`
- Agent definitions in `chati.dev/agents/`

## Steps

### 1. Identify Parallelizable Tasks
Analyze the current work queue for tasks that can run concurrently:
- Check task definitions for `parallelizable: true`
- Verify tasks have no dependencies on each other
- Confirm tasks don't modify overlapping files
- Ensure sufficient terminal capacity (max 4 terminals recommended)

### 2. Assess Terminal Availability
Check IDE capabilities:
- Detect IDE type (Claude Code, VS Code, etc.)
- Query available terminal slots
- Check system resource constraints (CPU, memory)
- Verify each terminal has independent context

### 3. Group Tasks for Distribution
Organize tasks into terminal assignments:
- Balance workload across terminals (similar duration)
- Group related tasks when possible
- Assign priority tasks to separate terminals
- Keep task count per terminal manageable (1-3 tasks)

### 4. Prepare Isolated Contexts
For each terminal, create independent context package:
- Subset of session state relevant to tasks
- Specific agent definitions needed
- Relevant handoff documents
- Task-specific configurations

### 5. Generate Terminal Manifests
Create execution plan for each terminal:
- Terminal ID
- Assigned tasks list
- Context package path
- Expected outputs
- Success criteria
- Timeout limits

### 6. Coordinate Spawning
Manage terminal creation and task dispatch:
- Spawn terminals sequentially (avoid race conditions)
- Assign unique identifiers (TERM-001, TERM-002, etc.)
- Send context package to each terminal
- Initiate task execution
- Monitor spawn success

### 7. Monitor Parallel Execution
Track progress across all terminals:
- Poll each terminal for status updates
- Detect completion, failures, or blocks
- Enforce timeout limits (default: 30 minutes per terminal)
- Log execution events

### 8. Collect Terminal Outputs
Gather results as terminals complete:
- Read output artifacts from each terminal
- Validate outputs against success criteria
- Check for errors or warnings
- Preserve terminal logs

### 9. Merge Results
Aggregate outputs into unified view:
- Combine artifacts from all terminals
- Resolve any conflicts (rare, due to task isolation)
- Update session state with all completions
- Create consolidated handoff

### 10. Cleanup and Report
Finalize parallel execution:
- Close terminal instances
- Archive terminal logs
- Update orchestrator state
- Generate execution summary for user

## Decision Points

### When Terminal Capacity is Limited
If IDE supports fewer terminals than ideal:
1. Prioritize highest-value tasks for parallelization
2. Run remaining tasks sequentially
3. Consider batching tasks differently

### When Task Dependencies are Ambiguous
If unclear whether tasks are truly independent:
1. Default to sequential execution (safe)
2. Analyze file access patterns
3. Ask user to confirm independence

### When Terminal Fails to Spawn
If terminal creation fails:
1. Retry up to 3 times with backoff
2. Fall back to sequential execution
3. Log spawn failure for diagnostics

### When Outputs Conflict
If multiple terminals produce overlapping artifacts (should be rare):
1. Halt execution immediately
2. Escalate to user with conflict details
3. Suggest manual resolution

## Error Handling

### Terminal Spawn Failure
If terminal creation fails:
- Log error details (IDE response, system limits)
- Attempt sequential fallback
- Escalate if critical tasks affected

### Task Execution Timeout
If terminal exceeds time limit:
- Send termination signal
- Preserve partial outputs
- Mark task as `failed-timeout`
- Continue with other terminals

### Context Isolation Breach
If tasks accidentally access shared state:
- Detect via file lock conflicts
- Halt affected terminals
- Escalate with breach details

### Result Merge Conflict
If outputs cannot be combined:
- Preserve all terminal outputs separately
- Escalate to user for manual merge
- Provide conflict resolution guidance

### Terminal Unresponsive
If terminal stops communicating:
- Wait for graceful timeout (5 minutes)
- Force terminate if needed
- Mark tasks as `unknown`
- Suggest investigation

### Partial Completion
If some terminals succeed, others fail:
- Accept successful outputs
- Re-queue failed tasks for retry
- Update session with partial progress

## Output Format

```yaml
terminal_manifest:
  timestamp: "2026-02-13T16:00:00Z"
  session_id: "sess-20260210-140000"
  spawn_id: "SPAWN-001"

  parallelization_plan:
    total_tasks: 6
    parallelizable_tasks: 4
    sequential_tasks: 2
    terminal_count: 2

  terminal_assignments:
    - terminal_id: "TERM-001"
      tasks:
        - task_id: "dev-implement-auth"
          agent: "dev"
          estimated_duration_minutes: 15
          outputs_expected:
            - "src/auth/login.ts"
            - "src/auth/register.ts"
        - task_id: "dev-implement-api-client"
          agent: "dev"
          estimated_duration_minutes: 10
          outputs_expected:
            - "src/api/client.ts"

    - terminal_id: "TERM-002"
      tasks:
        - task_id: "dev-implement-database-models"
          agent: "dev"
          estimated_duration_minutes: 12
          outputs_expected:
            - "src/models/user.ts"
            - "src/models/session.ts"
        - task_id: "dev-implement-utils"
          agent: "dev"
          estimated_duration_minutes: 8
          outputs_expected:
            - "src/utils/validators.ts"

  context_isolation:
    - terminal: "TERM-001"
      context_package: ".chati/parallel/TERM-001-context.yaml"
      allowed_paths:
        - "src/auth/"
        - "src/api/"
      forbidden_paths:
        - "src/models/"
        - "src/utils/"

    - terminal: "TERM-002"
      context_package: ".chati/parallel/TERM-002-context.yaml"
      allowed_paths:
        - "src/models/"
        - "src/utils/"
      forbidden_paths:
        - "src/auth/"
        - "src/api/"

  execution:
    spawned_at: "2026-02-13T16:00:15Z"
    terminals_spawned: 2
    spawn_success: true
    errors: []

  monitoring:
    - terminal: "TERM-001"
      status: "in_progress"
      started_at: "2026-02-13T16:00:20Z"
      current_task: "dev-implement-auth"
      progress: "40%"

    - terminal: "TERM-002"
      status: "in_progress"
      started_at: "2026-02-13T16:00:25Z"
      current_task: "dev-implement-database-models"
      progress: "60%"

  completion:
    all_completed: true
    completed_at: "2026-02-13T16:22:00Z"
    total_duration_minutes: 22

    terminal_results:
      - terminal: "TERM-001"
        status: "completed"
        tasks_completed: 2
        tasks_failed: 0
        outputs:
          - "src/auth/login.ts"
          - "src/auth/register.ts"
          - "src/api/client.ts"
        duration_minutes: 20

      - terminal: "TERM-002"
        status: "completed"
        tasks_completed: 2
        tasks_failed: 0
        outputs:
          - "src/models/user.ts"
          - "src/models/session.ts"
          - "src/utils/validators.ts"
        duration_minutes: 18

  merged_results:
    total_outputs: 7
    conflicts: 0
    artifacts:
      - path: "src/auth/login.ts"
        source: "TERM-001"
        size_kb: 8
      - path: "src/auth/register.ts"
        source: "TERM-001"
        size_kb: 6
      - path: "src/api/client.ts"
        source: "TERM-001"
        size_kb: 12
      - path: "src/models/user.ts"
        source: "TERM-002"
        size_kb: 5
      - path: "src/models/session.ts"
        source: "TERM-002"
        size_kb: 4
      - path: "src/utils/validators.ts"
        source: "TERM-002"
        size_kb: 7

  session_updates:
    tasks_completed: 4
    artifacts_created: 7
    parallel_execution_logged: true

  performance:
    sequential_estimate_minutes: 45
    parallel_actual_minutes: 22
    time_saved_minutes: 23
    efficiency_gain: "51%"

  cleanup:
    terminals_closed: true
    logs_archived:
      - ".chati/logs/parallel/SPAWN-001-TERM-001.log"
      - ".chati/logs/parallel/SPAWN-001-TERM-002.log"

  summary: |
    ✓ Parallel Execution Complete

    2 terminals executed 4 tasks in parallel:
    - TERM-001: Auth + API Client (20 min)
    - TERM-002: Database Models + Utils (18 min)

    7 artifacts created across 4 modules
    Time saved: 23 minutes (51% faster than sequential)

    Next: Continue with sequential tasks
```

### Example: Partial Failure

```yaml
terminal_manifest:
  completion:
    all_completed: false

    terminal_results:
      - terminal: "TERM-001"
        status: "completed"
        tasks_completed: 2
        tasks_failed: 0

      - terminal: "TERM-002"
        status: "failed"
        tasks_completed: 1
        tasks_failed: 1
        error:
          task: "dev-implement-utils"
          error_type: "dependency-missing"
          message: "Package 'validator' not installed"

  recovery_plan:
    successful_tasks: 3
    failed_tasks: 1
    requeue_tasks:
      - "dev-implement-utils"
    action: "accept-partial-results-and-retry-failed"
```
