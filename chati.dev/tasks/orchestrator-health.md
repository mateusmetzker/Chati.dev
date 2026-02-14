---
id: orchestrator-health
agent: orchestrator
trigger: user-input
phase: all
requires_input: false
parallelizable: false
outputs: [health-report]
handoff_to: null
autonomous_gate: true
criteria:
  - Framework installation validated
  - Critical files verified
  - Agent definitions checked
  - System dependencies assessed
---

# Orchestrator Health Task

## Purpose
Validate the chati.dev framework installation, check system dependencies, verify agent definitions, and report overall health status.

## Prerequisites
- chati.dev framework installed
- Access to framework directories
- Session file (optional, for session-specific checks)

## Steps

### 1. Check Core Framework Files
Verify essential framework files exist and are valid:
- `chati.dev/constitution.md` (Article I through XI)
- `chati.dev/config.yaml` (framework configuration)
- `chati.dev/installer/install.js` (installer script)
- `.chati/` directory structure

### 2. Validate Agent Definitions
Check all 12 agent YAML files in `chati.dev/agents/`:
- greenfield-wu.yaml
- brownfield-wu.yaml
- brief.yaml
- detail.yaml
- architect.yaml
- ux.yaml
- phases.yaml
- tasks.yaml
- qa-planning.yaml
- dev.yaml
- qa-implementation.yaml
- devops.yaml

For each agent, verify:
- Valid YAML syntax
- Required fields present (name, role, phase, outputs)
- MCP requirements listed
- Success criteria defined

### 3. Check Task Definitions
Verify task files in `chati.dev/tasks/`:
- Count of task files
- Valid frontmatter (YAML)
- Proper structure (agent, trigger, outputs)
- No syntax errors

### 4. Validate Schema Files
Check schema definitions in `chati.dev/schemas/`:
- session.yaml
- handoff.yaml
- config.yaml
- Agent-specific schemas

Verify:
- Valid YAML/JSON schema syntax
- Required fields documented
- Data types specified

### 5. Test Session File
If session exists at `.chati/session.yaml`:
- Validate YAML syntax
- Check schema compliance
- Verify referenced artifacts exist
- Check for corruption indicators

### 6. Verify Directory Structure
Ensure required directories exist:
- `.chati/artifacts/`
- `.chati/artifacts/handoffs/`
- `.chati/logs/`
- `.chati/backups/`
- `chati.dev/agents/`
- `chati.dev/tasks/`
- `chati.dev/schemas/`

### 7. Check System Dependencies
Validate external requirements:
- Node.js version (>= 18)
- IDE environment (Claude Code, VS Code, etc.)
- MCP support available
- File system permissions

### 8. Test Context Engine
Verify context loading works:
- Load constitution
- Parse agent definitions
- Read config values
- Test YAML parsing

### 9. Validate Constitution
Check Article XI governance rules:
- Mode definitions present
- Transition rules defined
- Scope restrictions specified
- Quality gates documented

### 10. Generate Health Report
Compile results into comprehensive report:
- Overall status (healthy/degraded/critical)
- Per-component status
- Issues found
- Recommendations
- Quick fixes (if available)

## Decision Points

### When Core Files are Missing
If essential files (constitution, config) are absent:
1. Check if framework is partially installed
2. Suggest running installer
3. Offer to create minimal viable files

### When Agent Definitions are Invalid
If agent YAML files have errors:
1. Identify specific validation failures
2. Show line numbers and error details
3. Offer to restore from framework defaults

### When Session is Corrupted
If session file is malformed:
1. Attempt recovery from backups
2. Reconstruct from handoff chain
3. Suggest fresh initialization

### When Dependencies are Missing
If system requirements not met:
1. Identify missing dependencies
2. Provide installation instructions
3. Assess if partial operation is possible

## Error Handling

### File Read Failure
If framework files can't be accessed:
- Check file permissions
- Verify installation path
- Suggest permission fix or reinstall

### YAML Parse Error
If any YAML file is malformed:
- Show parse error with line number
- Attempt to identify syntax issue
- Suggest validation tool

### Directory Creation Failure
If required directories can't be created:
- Check filesystem permissions
- Verify disk space
- Suggest manual directory creation

### Schema Validation Failure
If files don't match schema:
- Show validation errors
- Identify out-of-spec fields
- Suggest schema migration

### Partial Installation Detected
If some components present, others missing:
- List missing components
- Assess if framework can function
- Recommend complete reinstall vs. repair

## Output Format

```yaml
health_report:
  timestamp: "2026-02-13T10:30:00Z"
  overall_status: "healthy"  # or "degraded", "critical"
  framework_version: "1.0.0"

  core_files:
    status: "healthy"
    checks:
      - file: "chati.dev/constitution.md"
        status: "ok"
        size_kb: 45
        articles_count: 11
      - file: "chati.dev/config.yaml"
        status: "ok"
        valid_yaml: true
      - file: "chati.dev/installer/install.js"
        status: "ok"
        executable: true
      - file: ".chati/session.yaml"
        status: "ok"
        valid: true
        schema_compliant: true

  agent_definitions:
    status: "healthy"
    total_agents: 12
    valid_agents: 12
    issues: []
    agents:
      - name: "greenfield-wu"
        file: "chati.dev/agents/greenfield-wu.yaml"
        status: "ok"
        valid_yaml: true
        required_fields: true
        mcps_defined: true
      - name: "brownfield-wu"
        file: "chati.dev/agents/brownfield-wu.yaml"
        status: "ok"
      # ... (all 12 agents)

  task_definitions:
    status: "healthy"
    total_tasks: 35  # example count
    valid_tasks: 35
    issues: []
    sample_tasks:
      - "orchestrator-route.md"
      - "orchestrator-status.md"
      - "detail-analyze-requirements.md"

  schemas:
    status: "healthy"
    total_schemas: 8
    valid_schemas: 8
    issues: []
    schemas:
      - "session.yaml"
      - "handoff.yaml"
      - "config.yaml"

  directory_structure:
    status: "healthy"
    all_present: true
    directories:
      - path: ".chati/"
        exists: true
        writable: true
      - path: ".chati/artifacts/"
        exists: true
        writable: true
      - path: ".chati/artifacts/handoffs/"
        exists: true
        writable: true
        files_count: 5
      - path: ".chati/logs/"
        exists: true
        writable: true
      - path: "chati.dev/agents/"
        exists: true
        files_count: 12

  system_dependencies:
    status: "healthy"
    node_version: "22.22.0"
    node_required: ">=18.0.0"
    node_ok: true
    ide: "Claude Code"
    mcp_support: true
    filesystem_permissions: "ok"

  context_engine:
    status: "healthy"
    constitution_loadable: true
    config_parsable: true
    agents_loadable: true
    yaml_parser: "ok"

  constitution_validation:
    status: "healthy"
    articles_present: 11
    article_xi_valid: true
    mode_definitions: ["clarity", "build", "deploy"]
    transition_rules_defined: true
    quality_gates_specified: true

  session_health:
    status: "healthy"
    session_exists: true
    valid_yaml: true
    schema_compliant: true
    age_hours: 8
    last_activity: "2026-02-13T02:15:00Z"
    corruption_indicators: []

  issues_found: []

  recommendations:
    - "Framework is healthy and ready for use"
    - "Session is active and recent (8 hours old)"
    - "All 12 agents are properly defined"

  quick_fixes: []

  summary: |
    ✓ Framework Health: HEALTHY

    All core components validated successfully:
    - Constitution with 11 articles
    - 12 agent definitions
    - 35 task definitions
    - 8 schema files
    - Session active and valid

    System dependencies met:
    - Node.js 22.22.0 (>= 18.0.0 required)
    - IDE: Claude Code with MCP support
    - Filesystem permissions: OK

    No issues found. Framework ready for use.
```

### Example: Degraded State

```yaml
health_report:
  overall_status: "degraded"

  issues_found:
    - severity: "warning"
      component: "agent-definitions"
      issue: "architect.yaml has deprecated MCP 'gdrive' listed as required"
      impact: "Agent may fail if gdrive MCP not configured"
      fix: "Update agent definition or install gdrive MCP"

    - severity: "warning"
      component: "session"
      issue: "Session is 15 days old"
      impact: "Configuration may be stale"
      fix: "Validate session or start fresh"

  recommendations:
    - "Update architect.yaml MCP requirements"
    - "Consider refreshing stale session"
    - "Framework functional but has minor issues"
```

### Example: Critical State

```yaml
health_report:
  overall_status: "critical"

  issues_found:
    - severity: "critical"
      component: "constitution"
      issue: "constitution.md not found"
      impact: "Framework cannot operate without governance rules"
      fix: "Run installer or restore from framework source"

    - severity: "error"
      component: "agent-definitions"
      issue: "5 of 12 agent files missing"
      impact: "Pipeline cannot execute"
      fix: "Reinstall framework"

  recommendations:
    - "CRITICAL: Run framework installer immediately"
    - "Framework is not operational"
```
