---
id: dev-refactor
agent: dev
trigger: dev-test-write
phase: build
requires_input: false
parallelizable: false
outputs: [refactored-code]
handoff_to: dev-debug
autonomous_gate: true
criteria:
  - No code duplication
  - Functions under 50 lines
  - Naming is clear
---
# Refactor Code

## Purpose
Improve code quality, readability, and maintainability while preserving functionality, applying DRY, SOLID principles, and project conventions.

## Prerequisites
- Implementation complete with passing tests
- Test suite provides safety net
- Implementation log and test report available
- Code compiles and lints successfully
- Understanding of project architecture

## Steps

### 1. Review Current Code State
Analyze the implementation for refactoring opportunities:
- Read all newly created files
- Review modified sections
- Identify code smells
- Note complexity hotspots
- Check for duplication

### 2. Identify Duplication
Find repeated code patterns:
- Use Grep to search for similar patterns
- Look for copy-pasted blocks
- Find repeated logic
- Note similar function structures
- Identify duplicated constants or types

### 3. Extract Common Functions
Pull out reusable utilities:
- Create helper functions for repeated logic
- Move to appropriate utility modules
- Name functions clearly and descriptively
- Add proper documentation
- Ensure single responsibility

Example:
```typescript
// Before
function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}

// After - extract to validators.ts
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-zA-Z0-9_]{3,20}$/
};

export function matchesPattern(value: string, pattern: RegExp): boolean {
  return pattern.test(value);
}
```

### 4. Break Down Large Functions
Split functions exceeding 50 lines:
- Identify logical sections
- Extract to named sub-functions
- Maintain clear data flow
- Keep functions focused
- Use descriptive names

### 5. Improve Naming
Enhance clarity through better names:
- Replace abbreviations with full words
- Use domain language
- Make boolean functions ask questions
- Use verbs for functions, nouns for classes
- Be specific and descriptive

Examples:
- `proc()` → `processPayment()`
- `data` → `userProfile`
- `check()` → `isValid()`
- `handle()` → `handleSubmit()`

### 6. Apply SOLID Principles
Refactor toward clean architecture:

**Single Responsibility**: Each class/function does one thing
**Open/Closed**: Open for extension, closed for modification
**Liskov Substitution**: Subtypes must be substitutable
**Interface Segregation**: Small, focused interfaces
**Dependency Inversion**: Depend on abstractions

### 7. Simplify Complex Conditionals
Make logic easier to understand:
- Extract conditions to named variables
- Use early returns to reduce nesting
- Convert complex if-else to strategy patterns
- Use guard clauses
- Simplify boolean expressions

Example:
```typescript
// Before
if (user && user.isActive && user.hasPermission('write') && !user.isBanned) {
  // do something
}

// After
const canWrite = user?.isActive
  && user?.hasPermission('write')
  && !user?.isBanned;

if (canWrite) {
  // do something
}
```

### 8. Optimize Data Structures
Choose appropriate structures:
- Use Map/Set when appropriate
- Consider arrays vs objects
- Use immutable patterns
- Avoid nested structures
- Flatten where possible

### 9. Improve Error Handling
Make errors more robust:
- Create custom error classes
- Add error context
- Use typed errors
- Centralize error handling
- Add recovery mechanisms

### 10. Enhance Type Safety
Strengthen TypeScript usage:
- Replace `any` with specific types
- Use union types appropriately
- Add type guards
- Use const assertions
- Leverage utility types

### 11. Add Code Comments
Document complex logic:
- Explain "why", not "what"
- Document assumptions
- Note edge cases
- Warn about gotchas
- Keep comments up to date

### 12. Run Tests Continuously
Verify refactoring doesn't break functionality:
- Run test suite after each change
- Commit working state frequently
- Use test coverage to find gaps
- Add tests if coverage drops
- Verify all acceptance criteria still pass

## Decision Points

### When to Stop Refactoring
Refactoring is complete when:
1. No obvious duplication remains
2. Functions are reasonably sized
3. Names are clear and consistent
4. Tests still pass
5. Code complexity is acceptable

Don't over-optimize or chase perfection.

### When Architecture Needs Changing
If refactoring reveals architectural issues:
1. Document the problem
2. Assess impact of change
3. Discuss with orchestrator
4. May need to loop back to architect
5. Don't make major changes without approval

### When Performance Suffers
If refactoring impacts performance:
1. Profile before and after
2. Identify the bottleneck
3. Consider optimization
4. Balance readability vs speed
5. Document performance decisions

## Error Handling

### Tests Failing After Refactor
- Identify which tests broke
- Review changes made
- Check for logic errors
- Verify test assumptions still valid
- Revert if necessary and try smaller changes

### Type Errors After Changes
- Review type definitions
- Check generic constraints
- Verify imports
- Update type annotations
- Use type guards where needed

### Lint Violations
- Run auto-fix: `npm run lint -- --fix`
- Review remaining issues
- Update lint rules if too strict
- Ensure consistency with codebase
- Don't disable rules without good reason

### Merge Conflicts (if collaborative)
- Resolve conflicts carefully
- Run tests after merge
- Review combined changes
- Ensure refactoring still makes sense
- Re-run refactoring if needed

## Output Format

Create `.chati/artifacts/build/refactor-report.yaml`:

```yaml
task_id: "3.2.1"
agent: dev
action: refactor
timestamp: "2026-02-13T12:00:00Z"
duration_minutes: 40

files_refactored:
  - path: "src/modules/chat/chat-service.ts"
    changes:
      - "Extracted message validation to validators.ts"
      - "Split handleMessage into 3 smaller functions"
      - "Renamed ambiguous variables"
    lines_before: 156
    lines_after: 142
  - path: "src/modules/chat/utils.ts"
    changes:
      - "Created utility module for shared functions"
      - "Moved sanitization logic here"
    lines_before: 0
    lines_after: 45

duplication_removed:
  - description: "Message validation logic"
    instances: 3
    extracted_to: "src/modules/chat/validators.ts"
  - description: "Database error handling"
    instances: 5
    extracted_to: "src/lib/db-utils.ts"

functions_split:
  - original: "ChatService.handleMessage (78 lines)"
    new_functions:
      - "validateMessage (15 lines)"
      - "persistMessage (22 lines)"
      - "broadcastMessage (18 lines)"
    rationale: "Separate validation, persistence, and broadcasting concerns"

naming_improvements:
  - old: "proc"
    new: "processMessage"
    file: "chat-service.ts"
  - old: "data"
    new: "messageData"
    file: "chat-service.ts"
  - old: "check"
    new: "isValidMessage"
    file: "validators.ts"

solid_principles_applied:
  - principle: "Single Responsibility"
    change: "Split ChatService into ChatService and ChatRepository"
    rationale: "Separate business logic from data access"
  - principle: "Dependency Inversion"
    change: "ChatService now depends on IMessageRepository interface"
    rationale: "Easier to test and swap implementations"

complexity_reduction:
  - function: "validateMessage"
    cyclomatic_complexity_before: 12
    cyclomatic_complexity_after: 5
    changes: "Used early returns, extracted conditions"

type_safety_improvements:
  - change: "Replaced any with MessageData type"
    file: "chat-service.ts"
    impact: "Catch type errors at compile time"
  - change: "Added type guards for message validation"
    file: "validators.ts"
    impact: "Runtime type safety"

test_status:
  all_tests_passing: true
  coverage_before: 87.5
  coverage_after: 89.2
  coverage_change: "+1.7%"
  tests_added: 2
  tests_modified: 4

code_quality_metrics:
  average_function_length: 18
  max_function_length: 45
  functions_over_50_lines: 0
  code_duplication_percentage: 2.3
  maintainability_index: 82

issues_found:
  - description: "Message broadcasting could be extracted to separate service"
    severity: minor
    plan: "Consider for future iteration"
  - description: "Error messages could be more specific"
    severity: minor
    plan: "Improve in dev-iterate if time permits"

next_steps:
  - "Run full test suite to verify refactoring"
  - "Debug any failing tests"
  - "Prepare for code review"
```

## Success Criteria
- All tests still pass
- No code duplication (or minimal <5%)
- All functions under 50 lines
- Variable and function names are clear
- Cyclomatic complexity is reasonable
- Code follows SOLID principles
- Refactor report is complete
- Coverage maintained or improved
