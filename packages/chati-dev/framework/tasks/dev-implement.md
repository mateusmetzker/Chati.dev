---
id: dev-implement
agent: dev
trigger: orchestrator
phase: build
requires_input: false
parallelizable: true
outputs: [source-code]
handoff_to: dev-test-write
autonomous_gate: true
criteria:
  - Code compiles without errors
  - All acceptance criteria implemented
  - No lint errors
---
# Implement Feature

## Purpose
Transform acceptance criteria from the task specification into working source code, following the project's architecture and coding standards.

## Prerequisites
- Task specification exists in `.chati/state/current-task.yaml`
- Architecture decisions documented in `.chati/artifacts/architecture/`
- Development environment configured
- Dependencies installed
- IDE ready with proper extensions

## Steps

### 1. Load Task Context
Read the current task specification to understand:
- Acceptance criteria (Given-When-Then format)
- Affected components
- Data models
- API contracts
- UI requirements

### 2. Review Architecture Constraints
Examine architecture artifacts to ensure compliance with:
- Folder structure conventions
- Module boundaries
- Design patterns in use
- Technology stack choices
- State management approach

### 3. Identify Existing Patterns
Search the codebase for similar implementations:
- Use Grep to find comparable features
- Analyze existing component structure
- Identify reusable utilities
- Note naming conventions
- Review error handling patterns

### 4. Plan Implementation Approach
Create a mental model of:
- Which files need creation vs modification
- Component hierarchy
- Data flow
- Side effects and state changes
- Integration points

### 5. Implement Core Logic
Write the primary functionality:
- Start with data layer (models, schemas, types)
- Implement business logic (services, utilities)
- Add API endpoints or handlers
- Follow single responsibility principle
- Keep functions focused and testable

### 6. Implement User-Facing Layer
Add presentation or interface components:
- UI components (if applicable)
- CLI commands (if applicable)
- API response formatting
- Validation and sanitization
- User feedback mechanisms

### 7. Add Error Handling
Implement comprehensive error management:
- Try-catch blocks around risky operations
- Meaningful error messages
- Proper error propagation
- Fallback behaviors
- Logging for debugging

### 8. Add Type Safety
Ensure full type coverage:
- TypeScript interfaces for all data structures
- Type guards where needed
- Avoid `any` types
- Use generics appropriately
- Document complex types

### 9. Add Documentation
Document the implementation:
- JSDoc comments for public APIs
- Inline comments for complex logic
- README updates if needed
- Code examples in comments
- Architecture decision records

### 10. Verify Compilation
Check that code compiles:
- Run `npm run build` or equivalent
- Fix any TypeScript errors
- Resolve import issues
- Check for unused variables
- Validate syntax

### 11. Run Linting
Ensure code style compliance:
- Run `npm run lint`
- Fix any style violations
- Apply auto-fixes where safe
- Verify naming conventions
- Check formatting

### 12. Create Implementation Log
Document what was built:
- List files created
- List files modified
- Note design decisions
- Record any deviations from spec
- Flag items needing review

## Decision Points

### When Architecture is Unclear
If the architecture doesn't specify how to implement something:
1. Document the ambiguity
2. Propose 2-3 approaches
3. Use AskUserQuestion tool
4. Record decision in `.chati/artifacts/decisions/`

### When Dependencies are Missing
If required libraries aren't available:
1. Check package.json for alternatives
2. Propose dependency additions
3. Get user approval before installing
4. Document dependency purpose

### When Spec is Ambiguous
If acceptance criteria are unclear:
1. Implement the most reasonable interpretation
2. Add TODO comments marking assumptions
3. Flag for QA review
4. Document in implementation log

## Error Handling

### Compilation Errors
- Read error messages carefully
- Check import paths
- Verify type definitions exist
- Ensure all dependencies installed
- Review tsconfig.json settings

### Lint Failures
- Apply auto-fix first: `npm run lint -- --fix`
- Review remaining errors manually
- Check for unused variables
- Verify naming conventions
- Fix formatting issues

### Integration Issues
- Verify API contracts match
- Check data flow assumptions
- Test integration points manually
- Add logging to trace data
- Review component boundaries

### Performance Concerns
- Profile critical paths if needed
- Avoid premature optimization
- Document performance decisions
- Flag expensive operations
- Consider lazy loading

## Output Format

Create `.chati/artifacts/build/implementation-log.yaml`:

```yaml
task_id: "3.2.1"
agent: dev
action: implement
timestamp: "2026-02-13T10:30:00Z"
duration_minutes: 45

files_created:
  - path: "src/modules/chat/chat-service.ts"
    lines: 156
    purpose: "Core chat message handling"
  - path: "src/modules/chat/types.ts"
    lines: 42
    purpose: "Chat domain types"

files_modified:
  - path: "src/index.ts"
    changes: "Added chat module export"
    lines_added: 3
  - path: "src/types/global.d.ts"
    changes: "Extended global chat types"
    lines_added: 12

acceptance_criteria_met:
  - id: "AC-1"
    description: "Chat messages persist to database"
    status: implemented
  - id: "AC-2"
    description: "Real-time updates via WebSocket"
    status: implemented
  - id: "AC-3"
    description: "Message validation and sanitization"
    status: implemented

design_decisions:
  - decision: "Used EventEmitter for message broadcasting"
    rationale: "Simpler than Redux for this use case"
    alternatives_considered: ["Redux", "MobX"]
  - decision: "SQLite for message storage"
    rationale: "Lightweight, embedded, sufficient for MVP"
    alternatives_considered: ["PostgreSQL", "MongoDB"]

deviations_from_spec:
  - description: "Added message edit capability"
    reason: "User feedback indicated this was critical"
    approved_by: "user"

technical_debt:
  - description: "Message pagination not optimized"
    impact: "May slow with 1000+ messages"
    planned_fix: "Implement virtual scrolling in Phase 4"

compilation_status: success
lint_status: success
type_check_status: success

next_steps:
  - "Write tests for chat-service.ts"
  - "Add integration tests for WebSocket flow"
  - "Document chat API in README"
```

## Success Criteria
- All code compiles without errors
- All lint checks pass
- All acceptance criteria have corresponding implementation
- Implementation log is complete and accurate
- Code follows project conventions
- Error handling is comprehensive
- Types are fully specified
