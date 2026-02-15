---
id: dev-code-review
agent: dev
trigger: dev-debug
phase: build
requires_input: false
parallelizable: false
outputs: [review-report.yaml]
handoff_to: dev-pr-prepare
autonomous_gate: true
criteria:
  - Follows architecture
  - No security issues
  - Code style consistent
---
# Self Code Review

## Purpose
Perform thorough self-review of implementation against architecture decisions, security best practices, and code quality standards before preparing PR.

## Prerequisites
- All tests passing
- Debugging complete
- Architecture artifacts available at `.chati/artifacts/architecture/`
- Security checklist available
- Code style guide accessible

## Steps

### 1. Review Against Architecture
Verify implementation aligns with architectural decisions:
- Read architecture artifacts
- Check folder structure matches conventions
- Verify module boundaries respected
- Confirm design patterns applied correctly
- Validate technology choices followed

### 2. Check API Contracts
Ensure interfaces match specifications:
- Review API endpoint signatures
- Verify request/response formats
- Check status codes
- Validate error responses
- Confirm backward compatibility

### 3. Review Data Models
Validate data structures and schemas:
- Check database schema alignment
- Verify type definitions complete
- Ensure validation rules implemented
- Review relationships and constraints
- Confirm migrations needed (if applicable)

### 4. Security Review
Audit code for security vulnerabilities:

**Input Validation**
- All user input validated
- Sanitization applied where needed
- Type checking enforced
- Length limits imposed
- Format validation present

**Authentication/Authorization**
- Authentication checks in place
- Authorization verified before operations
- Tokens handled securely
- Session management correct
- No hardcoded credentials

**Data Protection**
- Sensitive data encrypted
- Passwords hashed (never plain text)
- SQL injection prevented (parameterized queries)
- XSS prevented (output sanitization)
- CSRF protection if applicable

**Dependencies**
- No known vulnerable dependencies
- Minimal dependency footprint
- Dependencies from trusted sources
- Lock file committed

### 5. Performance Review
Check for obvious performance issues:
- No N+1 query problems
- Appropriate use of indexes
- Efficient algorithms chosen
- No unnecessary loops
- Lazy loading where appropriate
- Caching considered

### 6. Error Handling Review
Verify robust error management:
- Try-catch around risky operations
- Meaningful error messages
- Proper error propagation
- No swallowed errors
- Cleanup in finally blocks
- Graceful degradation

### 7. Code Style Review
Ensure consistency with codebase:
- Naming conventions followed
- Indentation consistent
- File organization standard
- Comment style matches
- Import order correct
- No dead code

### 8. Documentation Review
Check for adequate documentation:
- Public APIs documented
- Complex logic explained
- Type definitions clear
- README updated if needed
- Breaking changes noted
- Migration guide if needed

### 9. Testing Review
Validate test quality:
- All acceptance criteria tested
- Edge cases covered
- Error scenarios tested
- Test names descriptive
- No redundant tests
- Tests are maintainable

### 10. Accessibility Review (if UI)
For user-facing components:
- Semantic HTML used
- ARIA labels present
- Keyboard navigation works
- Color contrast sufficient
- Screen reader friendly
- Focus management correct

### 11. Create Review Checklist
Score implementation against criteria:

```yaml
architecture_compliance: 9/10
security_score: 10/10
performance_score: 8/10
code_quality_score: 9/10
testing_score: 9/10
documentation_score: 7/10
```

### 12. Document Findings
Record issues and improvements:
- List critical issues (must fix)
- List improvements (should fix)
- List nice-to-haves (optional)
- Note strengths
- Identify tech debt

## Decision Points

### When Critical Issues Found
If security or architecture violations discovered:
1. Fix immediately
2. Re-run tests
3. Update affected documentation
4. Note in review report
5. Don't proceed to PR until resolved

### When Performance Concerns Arise
If performance issues identified:
1. Assess severity
2. Profile if needed
3. Fix if critical
4. Document if acceptable
5. Plan optimization if needed later

### When Documentation is Lacking
If docs are insufficient:
1. Add missing documentation
2. Update README if needed
3. Add code comments
4. Create examples
5. Note in review report

## Error Handling

### Architecture Violations Found
- Document the violation
- Understand the impact
- Propose fix
- May need to loop back to architect
- Get approval for major changes

### Security Issues Discovered
- Fix immediately
- Don't compromise on security
- Research best practices
- Add tests for security scenarios
- Document security measures

### Style Inconsistencies
- Run auto-formatter
- Apply lint fixes
- Manually adjust remaining issues
- Update style guide if needed
- Ensure consistency

### Test Coverage Gaps
- Add missing tests
- Update test report
- Verify new tests pass
- Check coverage metrics
- Document test strategy

## Output Format

Create `.chati/artifacts/build/review-report.yaml`:

```yaml
task_id: "3.2.1"
agent: dev
action: code-review
timestamp: "2026-02-13T13:30:00Z"
duration_minutes: 45

reviewer: dev
review_type: self-review
scope: complete_implementation

architecture_review:
  score: 9
  compliant: true
  findings:
    - aspect: "Module structure"
      status: pass
      notes: "Follows established patterns"
    - aspect: "Design patterns"
      status: pass
      notes: "Repository pattern correctly applied"
    - aspect: "Dependency injection"
      status: pass
      notes: "Clean dependency management"
  issues: []

security_review:
  score: 10
  critical_issues: 0
  findings:
    - category: "Input Validation"
      status: pass
      notes: "All inputs validated using Zod schemas"
    - category: "SQL Injection"
      status: pass
      notes: "Parameterized queries used throughout"
    - category: "XSS Prevention"
      status: pass
      notes: "HTML sanitization applied to message content"
    - category: "Authentication"
      status: pass
      notes: "JWT validation on protected routes"
    - category: "Secrets Management"
      status: pass
      notes: "No hardcoded credentials, uses environment variables"
  recommendations:
    - "Consider adding rate limiting for message endpoints"
    - "Add CORS configuration for production"

performance_review:
  score: 8
  findings:
    - aspect: "Database queries"
      status: good
      notes: "Efficient queries, proper indexing considered"
    - aspect: "Algorithm complexity"
      status: good
      notes: "O(n) or better for all operations"
    - aspect: "Memory usage"
      status: good
      notes: "No obvious memory leaks"
  concerns:
    - description: "Message list pagination not implemented"
      impact: medium
      plan: "Will add in Phase 4"
  optimizations_applied:
    - "Used database indexes for message queries"
    - "Implemented connection pooling"

code_quality_review:
  score: 9
  maintainability_index: 82
  findings:
    - aspect: "Code duplication"
      status: excellent
      metric: "2.3% duplication"
    - aspect: "Function length"
      status: excellent
      metric: "Average 18 lines, max 45 lines"
    - aspect: "Complexity"
      status: good
      metric: "Cyclomatic complexity < 10"
    - aspect: "Naming"
      status: excellent
      notes: "Clear, descriptive names throughout"
  minor_issues:
    - description: "Could extract message formatting to utility"
      severity: low
      file: "chat-service.ts"

testing_review:
  score: 9
  coverage: 89.2
  findings:
    - aspect: "Unit tests"
      status: excellent
      count: 12
    - aspect: "Integration tests"
      status: good
      count: 8
    - aspect: "Edge cases"
      status: excellent
      notes: "Null, empty, max length all tested"
    - aspect: "Error scenarios"
      status: excellent
      notes: "All error paths tested"
  improvements:
    - "Could add performance tests for large message volumes"

documentation_review:
  score: 7
  findings:
    - aspect: "Code comments"
      status: good
      notes: "Complex logic documented"
    - aspect: "API documentation"
      status: adequate
      notes: "JSDoc present for public methods"
    - aspect: "README"
      status: needs_update
      notes: "Should document new chat module"
  action_items:
    - "Add chat module section to README"
    - "Document WebSocket event schema"
    - "Add usage examples"

style_consistency:
  score: 10
  lint_status: pass
  prettier_status: pass
  findings:
    - "Code style consistent with project conventions"
    - "Import order follows ESLint rules"
    - "File organization matches project structure"

critical_issues: []

recommended_improvements:
  - description: "Add README section for chat module"
    priority: should_fix
    effort: small
  - description: "Extract message formatting utility"
    priority: nice_to_have
    effort: small
  - description: "Add rate limiting"
    priority: should_fix
    effort: medium
    timing: "Before production deployment"

strengths:
  - "Excellent test coverage"
  - "Clean separation of concerns"
  - "Strong type safety"
  - "Good error handling"
  - "Security best practices followed"

technical_debt:
  - description: "Message pagination will be needed at scale"
    severity: low
    planned_fix: "Phase 4"
  - description: "WebSocket reconnection logic could be more robust"
    severity: low
    planned_fix: "Future iteration"

overall_assessment: |
  Implementation is production-ready. Code quality is high, security
  practices are solid, and testing is comprehensive. Minor documentation
  improvements recommended but not blocking. Architecture compliance
  is excellent.

ready_for_pr: true

next_steps:
  - "Add README documentation for chat module"
  - "Prepare pull request description"
  - "Create changelog entry"
```

## Success Criteria
- Architecture compliance verified
- No critical security issues
- Code style is consistent
- All review categories scored
- Issues categorized by severity
- Strengths identified
- Ready for PR confirmed
- Review report is complete and thorough
