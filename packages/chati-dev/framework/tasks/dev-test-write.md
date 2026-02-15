---
id: dev-test-write
agent: dev
trigger: dev-implement
phase: build
requires_input: false
parallelizable: true
outputs: [test-files]
handoff_to: dev-refactor
autonomous_gate: true
criteria:
  - Tests cover all acceptance criteria
  - Edge cases tested
  - Tests pass
---
# Write Tests

## Purpose
Create comprehensive unit and integration tests that verify all acceptance criteria are met and edge cases are handled correctly.

## Prerequisites
- Implementation complete (dev-implement finished)
- Implementation log exists at `.chati/artifacts/build/implementation-log.yaml`
- Test framework configured (Jest, Vitest, or similar)
- Test utilities and helpers available
- Source code compiles successfully

## Steps

### 1. Load Implementation Context
Review the implementation log to understand:
- Which files were created
- Which files were modified
- Acceptance criteria to verify
- Design decisions that need testing
- Known technical debt or edge cases

### 2. Analyze Test Requirements
Map acceptance criteria to test scenarios:
- Given-When-Then statements become test cases
- Identify happy path scenarios
- List error conditions
- Note boundary conditions
- Consider race conditions or timing issues

### 3. Set Up Test Structure
Create test file organization:
- Name test files: `{module}.test.ts` or `{module}.spec.ts`
- Mirror source directory structure
- Set up test suites with `describe` blocks
- Group related tests logically
- Use clear, descriptive test names

### 4. Write Unit Tests
Test individual functions and classes in isolation:
- Mock external dependencies
- Test one function per test case
- Verify return values
- Check state changes
- Validate error throwing

Example structure:
```typescript
describe('ChatService', () => {
  describe('sendMessage', () => {
    it('should persist message to database', async () => {
      // Arrange
      const mockDb = createMockDb();
      const service = new ChatService(mockDb);

      // Act
      const result = await service.sendMessage({
        text: 'Hello',
        userId: '123'
      });

      // Assert
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello' })
      );
      expect(result.id).toBeDefined();
    });
  });
});
```

### 5. Write Integration Tests
Test components working together:
- Use real dependencies where possible
- Test API endpoints end-to-end
- Verify database interactions
- Check event propagation
- Validate state management flows

### 6. Test Edge Cases
Cover boundary and error conditions:
- Null or undefined inputs
- Empty strings or arrays
- Maximum length inputs
- Concurrent operations
- Network failures
- Database errors
- Invalid data formats

### 7. Test Error Handling
Verify error scenarios:
- Exceptions are thrown correctly
- Error messages are meaningful
- Cleanup happens on failure
- State remains consistent
- Errors propagate appropriately

### 8. Add Test Utilities
Create reusable test helpers:
- Factory functions for test data
- Mock builders
- Assertion helpers
- Setup and teardown utilities
- Database seeders

### 9. Check Test Coverage
Verify adequate coverage:
- Run `npm run test:coverage`
- Aim for >80% line coverage
- Ensure all branches tested
- Cover all acceptance criteria
- Don't chase 100% blindly

### 10. Optimize Test Performance
Make tests run efficiently:
- Avoid unnecessary async operations
- Use test.concurrent for independent tests
- Mock expensive operations
- Clear state between tests
- Use beforeEach/afterEach wisely

### 11. Document Test Scenarios
Add clarity to tests:
- Use descriptive test names
- Add comments for complex setup
- Document assumptions
- Note flaky tests
- Reference acceptance criteria

### 12. Create Test Report
Document testing work:
- List test files created
- Note coverage metrics
- Document test strategy
- Flag areas needing more tests
- Record any skipped tests

## Decision Points

### When Coverage is Low
If coverage is below 80%:
1. Identify untested branches
2. Prioritize critical paths
3. Add tests for high-risk areas
4. Document why some code isn't tested
5. Plan to add tests in iteration phase

### When Tests are Flaky
If tests fail intermittently:
1. Identify timing dependencies
2. Add proper async handling
3. Mock time-dependent code
4. Increase timeouts if needed
5. Document flaky tests

### When Integration Tests Fail
If integrated components don't work:
1. Check component boundaries
2. Verify API contracts
3. Review data flow
4. Add debugging logs
5. May need to return to implementation

## Error Handling

### Test Framework Issues
- Verify test framework installed
- Check configuration files
- Review import paths
- Ensure test globals available
- Check for TypeScript config issues

### Mock Setup Problems
- Verify mock library imported
- Check mock syntax
- Ensure mocks reset between tests
- Review mock return values
- Use spy functions for verification

### Async Test Failures
- Always return promises or use async/await
- Set appropriate timeouts
- Handle promise rejections
- Use waitFor utilities
- Check for unhandled promise rejections

### Coverage Tool Errors
- Verify coverage tool configured
- Check ignore patterns
- Review threshold settings
- Ensure source maps generated
- Check for instrumentation issues

## Output Format

Create `.chati/artifacts/build/test-report.yaml`:

```yaml
task_id: "3.2.1"
agent: dev
action: test-write
timestamp: "2026-02-13T11:15:00Z"
duration_minutes: 35

test_files_created:
  - path: "src/modules/chat/chat-service.test.ts"
    test_count: 12
    lines: 245
  - path: "src/modules/chat/chat-integration.test.ts"
    test_count: 8
    lines: 180

test_summary:
  total_tests: 20
  passing: 20
  failing: 0
  skipped: 0
  duration_ms: 1847

coverage:
  statements: 87.5
  branches: 82.3
  functions: 91.2
  lines: 86.8
  uncovered_files: []

acceptance_criteria_coverage:
  - id: "AC-1"
    description: "Chat messages persist to database"
    tests:
      - "ChatService.sendMessage should persist message to database"
      - "ChatService.sendMessage should return saved message with ID"
    status: fully_covered
  - id: "AC-2"
    description: "Real-time updates via WebSocket"
    tests:
      - "ChatService should emit message event on send"
      - "Integration: WebSocket receives new messages"
    status: fully_covered
  - id: "AC-3"
    description: "Message validation and sanitization"
    tests:
      - "ChatService should reject empty messages"
      - "ChatService should sanitize HTML in messages"
      - "ChatService should validate message length"
    status: fully_covered

edge_cases_tested:
  - scenario: "Null or undefined message text"
    test: "should throw ValidationError for null text"
  - scenario: "Message exceeding max length"
    test: "should throw ValidationError for oversized message"
  - scenario: "Concurrent message sends"
    test: "should handle concurrent sends without corruption"
  - scenario: "Database connection lost"
    test: "should throw DatabaseError on connection failure"
  - scenario: "WebSocket disconnect during send"
    test: "should complete send even if broadcast fails"

test_utilities_added:
  - name: "createMockChatService"
    purpose: "Factory for test instances"
  - name: "createTestMessage"
    purpose: "Generate valid test messages"
  - name: "seedChatDatabase"
    purpose: "Populate test database"

areas_needing_attention:
  - description: "Performance testing for 1000+ messages"
    reason: "Not covered in unit tests"
    plan: "Add performance test suite in Phase 4"
  - description: "WebSocket reconnection scenarios"
    reason: "Complex to test, low priority"
    plan: "Add in iteration if time permits"

flaky_tests: []

next_steps:
  - "Review test coverage with QA perspective"
  - "Refactor any duplicate test setup code"
  - "Consider additional edge cases"
```

## Success Criteria
- All tests pass
- Coverage is above 80%
- All acceptance criteria have corresponding tests
- Edge cases are tested
- Error scenarios are covered
- Test report is complete
- Tests run in reasonable time (<5s for unit tests)
