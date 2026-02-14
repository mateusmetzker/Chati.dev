---
id: dev-pr-prepare
agent: dev
trigger: dev-code-review
phase: build
requires_input: false
parallelizable: false
outputs: [pr-description.md]
handoff_to: dev-iterate
autonomous_gate: true
criteria:
  - Conventional commits
  - PR description complete
---
# Prepare Pull Request

## Purpose
Create well-structured commits and comprehensive pull request description following conventional commit standards and project conventions.

## Prerequisites
- Code review complete
- All tests passing
- Review report available
- Changes ready to commit
- Git repository initialized

## Steps

### 1. Review Changes
Understand what will be committed:
```bash
git status
git diff
```
- List all modified files
- Review all changes
- Identify logical groupings
- Note breaking changes
- Check for unintended changes

### 2. Stage Files Strategically
Group related changes:
```bash
git add src/modules/chat/
git add src/lib/validators.ts
```
- Don't use `git add .` blindly
- Stage related files together
- Avoid staging generated files
- Exclude local config changes
- Check .gitignore compliance

### 3. Create Conventional Commits
Follow conventional commit format:

**Format**: `type(scope): subject`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code restructuring (no feature change)
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

**Examples**:
```bash
git commit -m "feat(chat): add real-time messaging with WebSocket"
git commit -m "test(chat): add unit tests for message validation"
git commit -m "refactor(chat): extract validation to separate module"
git commit -m "docs(chat): add API documentation and examples"
```

### 4. Write Detailed Commit Messages
For complex commits, add body:
```bash
git commit -m "feat(chat): add real-time messaging with WebSocket

- Implement ChatService for message handling
- Add WebSocket integration for real-time updates
- Create message validation with Zod schemas
- Add database persistence for chat messages

Resolves #123"
```

### 5. Check Commit History
Review commits before pushing:
```bash
git log --oneline -10
```
- Verify commit messages are clear
- Check for typos
- Ensure logical order
- Confirm no sensitive data
- Validate conventional format

### 6. Create PR Description
Write comprehensive PR description:

**Template**:
```markdown
## Summary
Brief overview of changes (2-3 sentences)

## Changes
- Bullet list of key changes
- Organized by category
- Clear and specific

## Motivation
Why these changes are needed

## Implementation Details
Technical approach taken
Architecture decisions made
Design patterns used

## Testing
How changes were tested
Coverage metrics
Manual testing performed

## Screenshots/Demos
(If UI changes)

## Breaking Changes
(If any)

## Deployment Notes
(If any special steps needed)

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No security issues
- [ ] Follows code style
- [ ] Reviewed own code
```

### 7. Link Related Issues
Reference related work:
- Link to task/story
- Reference GitHub issues
- Note dependencies
- Link to design docs
- Reference discussions

### 8. Highlight Important Decisions
Call attention to key points:
- Architecture changes
- API modifications
- Breaking changes
- Security considerations
- Performance implications

### 9. Add Testing Information
Document testing performed:
- Unit test coverage
- Integration tests
- Manual testing steps
- Edge cases verified
- Performance testing

### 10. Create Changelog Entry
Update CHANGELOG.md (if exists):
```markdown
## [Unreleased]

### Added
- Real-time chat messaging with WebSocket support
- Message validation and sanitization
- Database persistence for messages

### Changed
- Refactored message handling into separate service

### Fixed
- (Any bugs fixed)
```

### 11. Prepare for Review
Make review easy:
- Clear commit messages
- Logical commit structure
- Comprehensive PR description
- Testing instructions
- Context for decisions

### 12. Document PR Preparation
Record PR details:
- Commit count
- Files changed
- Lines added/removed
- PR description saved
- Checklist completed

## Decision Points

### When to Squash Commits
Consider squashing if:
1. Many WIP commits
2. Commits fix previous commits
3. History is messy
4. Team prefers linear history

Keep separate if:
1. Logical progression of work
2. Each commit is meaningful
3. Easy to review incrementally
4. Team values detailed history

### When to Split PRs
If PR is too large:
1. Split by feature
2. Split by layer (backend/frontend)
3. Create prerequisite PRs
4. Keep PRs reviewable (<500 lines)

### When Breaking Changes Exist
If introducing breaking changes:
1. Clearly mark in PR title
2. Document in BREAKING CHANGES section
3. Provide migration guide
4. Discuss with team first
5. Consider deprecation period

## Error Handling

### Commit Message Mistakes
If commit message is wrong:
```bash
# Amend last commit message
git commit --amend -m "new message"

# Don't amend if already pushed
```

### Forgot to Stage Files
```bash
# Add to last commit
git add forgotten-file.ts
git commit --amend --no-edit
```

### Need to Reorder Commits
```bash
# Interactive rebase (use with caution)
git rebase -i HEAD~3
```

### Sensitive Data Committed
If secrets accidentally committed:
1. Don't push!
2. Remove from history
3. Rotate compromised secrets
4. Add to .gitignore
5. Review commit carefully

## Output Format

Create `.chati/artifacts/build/pr-description.md`:

```markdown
# Add Real-time Chat Messaging

## Summary
Implements real-time chat messaging functionality with WebSocket support,
including message persistence, validation, and broadcasting to connected
clients.

## Changes

### Features Added
- Real-time message sending and receiving via WebSocket
- Message validation using Zod schemas
- HTML sanitization for user-generated content
- Database persistence for chat history
- Message broadcasting to connected clients

### Code Quality
- Comprehensive unit tests (89.2% coverage)
- Integration tests for WebSocket flow
- Refactored for separation of concerns
- Security review completed

### Documentation
- JSDoc comments for public APIs
- README section for chat module
- Usage examples

## Motivation
Enables users to communicate in real-time within the application, a core
feature requirement from Phase 3 of the project roadmap.

## Implementation Details

### Architecture
- Repository pattern for data access
- Service layer for business logic
- Event-driven broadcasting using EventEmitter
- WebSocket integration for real-time updates

### Key Components
- `ChatService`: Core message handling
- `ChatRepository`: Database operations
- `ChatValidator`: Input validation
- `WebSocketService`: Real-time communication

### Technology Choices
- Zod for schema validation
- DOMPurify for HTML sanitization
- SQLite for message storage
- ws library for WebSocket

## Testing

### Unit Tests (12)
- Message validation (null, empty, max length)
- HTML sanitization
- Database persistence
- Event emission
- Error handling

### Integration Tests (8)
- End-to-end message flow
- WebSocket communication
- Database integration
- Error scenarios

### Manual Testing
- ✅ Send message via API
- ✅ Receive real-time updates
- ✅ HTML content sanitized
- ✅ Empty messages rejected
- ✅ Database persistence verified

### Coverage
- Statements: 87.5%
- Branches: 82.3%
- Functions: 91.2%
- Lines: 86.8%

## Security

### Measures Implemented
- ✅ Input validation on all messages
- ✅ HTML sanitization to prevent XSS
- ✅ SQL injection prevention (parameterized queries)
- ✅ Authentication required for message sending
- ✅ No hardcoded credentials

### Recommendations for Production
- Add rate limiting for message endpoints
- Configure CORS properly
- Implement message encryption for sensitive data

## Performance
- Database queries optimized with indexes
- Connection pooling implemented
- O(n) or better algorithm complexity
- Note: Pagination will be needed for large message volumes (planned for Phase 4)

## Breaking Changes
None

## Deployment Notes
- Run database migrations (if applicable)
- Configure WebSocket port in environment variables
- Ensure WebSocket support on hosting platform

## Checklist
- [x] All tests pass
- [x] Code coverage >80%
- [x] Documentation updated
- [x] No security issues
- [x] Code style consistent
- [x] Self-review completed
- [x] No breaking changes
- [x] Changelog updated

## Related
- Closes #123
- Part of Phase 3: Chat Module
- Task ID: 3.2.1
- Architecture Doc: `.chati/artifacts/architecture/chat-design.md`

## Screenshots
(Not applicable - backend feature)

## Reviewer Notes
- Main logic in `src/modules/chat/chat-service.ts`
- Tests in `src/modules/chat/*.test.ts`
- Review security validation in `validators.ts`
- Check WebSocket integration in `chat-integration.test.ts`
```

Also create `.chati/artifacts/build/commit-log.yaml`:

```yaml
task_id: "3.2.1"
agent: dev
action: pr-prepare
timestamp: "2026-02-13T14:15:00Z"
duration_minutes: 25

commits_created:
  - hash: "abc1234"
    type: feat
    scope: chat
    subject: "add real-time messaging with WebSocket"
    body: |
      - Implement ChatService for message handling
      - Add WebSocket integration for real-time updates
      - Create message validation with Zod schemas
      - Add database persistence for chat messages
    files_changed: 8
    insertions: 342
    deletions: 0

  - hash: "def5678"
    type: test
    scope: chat
    subject: "add comprehensive test suite"
    body: |
      - Unit tests for ChatService
      - Integration tests for WebSocket flow
      - Edge case testing (null, empty, max length)
      - Error scenario coverage
    files_changed: 2
    insertions: 425
    deletions: 0

  - hash: "ghi9012"
    type: refactor
    scope: chat
    subject: "extract validation to separate module"
    body: |
      - Create validators.ts utility module
      - Move sanitization logic
      - Improve separation of concerns
      - Reduce code duplication
    files_changed: 3
    insertions: 87
    deletions: 52

  - hash: "jkl3456"
    type: docs
    scope: chat
    subject: "add API documentation and README section"
    body: |
      - JSDoc comments for public APIs
      - README section for chat module
      - Usage examples
      - WebSocket event documentation
    files_changed: 2
    insertions: 78
    deletions: 3

total_commits: 4
total_files_changed: 15
total_insertions: 932
total_deletions: 55

pr_details:
  title: "feat(chat): add real-time messaging with WebSocket"
  description_file: "pr-description.md"
  labels: ["feature", "chat", "phase-3"]
  reviewers_suggested: ["qa-implementation"]
  milestone: "Phase 3"

changelog_updated: true
breaking_changes: false

git_status:
  branch: "feature/chat-messaging"
  commits_ahead: 4
  commits_behind: 0
  ready_to_push: true

next_steps:
  - "Review PR description for completeness"
  - "Push branch to remote"
  - "Create PR on GitHub"
  - "Request code review"
```

## Success Criteria
- All commits follow conventional format
- Commit messages are clear and descriptive
- PR description is comprehensive
- Testing information included
- Related issues linked
- Changelog updated
- Ready to create PR
- PR preparation artifacts complete
