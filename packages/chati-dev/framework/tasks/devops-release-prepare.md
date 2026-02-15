---
id: devops-release-prepare
agent: devops
trigger: devops-monitoring-setup
phase: deploy
requires_input: false
parallelizable: false
outputs: [release-plan.yaml]
handoff_to: devops-consolidate
autonomous_gate: true
criteria:
  - Version bumped
  - Changelog updated
  - Tag created
---
# Prepare Release

## Purpose
Prepare production release including version bumping, changelog generation, git tagging, and release notes documentation.

## Prerequisites
- All features tested and approved
- Deployment configuration complete
- Monitoring set up
- Production environment ready
- Git repository clean

## Steps

### 1. Determine Release Type
Follow semantic versioning (MAJOR.MINOR.PATCH):

**MAJOR** (1.0.0 → 2.0.0):
- Breaking changes
- Major feature overhaul
- API incompatibility
- Architecture changes

**MINOR** (1.0.0 → 1.1.0):
- New features (backward compatible)
- Significant enhancements
- New functionality
- Deprecations added

**PATCH** (1.0.0 → 1.0.1):
- Bug fixes
- Security patches
- Performance improvements
- Documentation updates

### 2. Review Changes Since Last Release
Identify what changed:

```bash
# View commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# View detailed changes
git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:"%h - %s (%an)"

# Check file changes
git diff $(git describe --tags --abbrev=0)..HEAD --stat
```

### 3. Update Version Number
Bump version in all relevant files:

**Use npm version** (recommended):
```bash
# Patch release
npm version patch -m "chore: release v%s"

# Minor release
npm version minor -m "feat: release v%s"

# Major release
npm version major -m "feat!: release v%s"
```

This automatically:
- Updates package.json version
- Creates git commit
- Creates git tag

**Manual version update**:

Update `package.json`:
```json
{
  "name": "chati-dev",
  "version": "1.1.0",
  "description": "..."
}
```

Update `package-lock.json`:
```bash
npm install
```

If applicable, update version in:
- `src/version.ts`
- `README.md`
- `docs/CHANGELOG.md`
- Docker images
- Helm charts

### 4. Generate Changelog
Update CHANGELOG.md following Keep a Changelog format:

**Using conventional-changelog** (automated):
```bash
npm install -g conventional-changelog-cli
conventional-changelog -p angular -i CHANGELOG.md -s
```

**Manual CHANGELOG.md**:
```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-13

### Added
- Real-time chat messaging with WebSocket support
- Message validation and sanitization
- Comprehensive error tracking with Sentry
- Health check endpoints for monitoring

### Changed
- Improved error messages for better UX
- Refactored message handling for better separation of concerns
- Updated deployment configuration for Railway

### Fixed
- SQL injection vulnerability in message search
- Message length validation off-by-one error
- WebSocket error handling edge cases

### Security
- Added input validation for all user-generated content
- Implemented HTML sanitization to prevent XSS
- Added rate limiting configuration

### Deprecated
- (Nothing deprecated in this release)

### Removed
- (Nothing removed in this release)

## [1.0.0] - 2026-02-01

### Added
- Initial release
- Basic project structure
- CLI installer
- Agent orchestration system

[1.1.0]: https://github.com/user/repo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/user/repo/releases/tag/v1.0.0
```

### 5. Create Git Tag
Tag the release:

```bash
# Create annotated tag
git tag -a v1.1.0 -m "Release version 1.1.0

Features:
- Real-time chat messaging
- Enhanced monitoring and logging
- Improved error handling

Bug Fixes:
- Fixed SQL injection vulnerability
- Corrected message validation

See CHANGELOG.md for full details."

# Verify tag
git tag -l -n9 v1.1.0

# Push tag to remote
git push origin v1.1.0
```

### 6. Create Release Notes
Prepare comprehensive release notes:

**docs/releases/v1.1.0.md**:
```markdown
# Release v1.1.0 - Real-time Chat Messaging

Released: 2026-02-13

## 🎉 What's New

### Real-time Chat Messaging
We've added real-time chat functionality with WebSocket support, allowing users to communicate instantly within the application.

**Key Features:**
- Send and receive messages in real-time
- Message persistence to database
- HTML sanitization for security
- Message validation (length, format)

## 🔧 Improvements

### Enhanced Monitoring
- Added comprehensive logging with Winston
- Integrated Sentry for error tracking
- Health check endpoints for uptime monitoring
- Performance metrics collection

### Better Error Handling
- User-friendly error messages
- Improved error recovery
- Better error context in logs

## 🐛 Bug Fixes

- **Security**: Fixed SQL injection vulnerability in message search
- **Validation**: Corrected message length validation (now properly enforces 1000 char limit)
- **WebSocket**: Enhanced error handling for connection failures

## 🔒 Security

- Input validation on all user-generated content
- HTML sanitization to prevent XSS attacks
- Parameterized queries to prevent SQL injection
- No hardcoded credentials

## 📦 Installation

```bash
npm install chati-dev@1.1.0
```

## ⬆️ Upgrade Guide

### From v1.0.x

No breaking changes! Simply update your package:

```bash
npm update chati-dev
```

Run database migrations:

```bash
npm run migrate
```

### Environment Variables

New optional environment variables:
- `SENTRY_DSN`: For error tracking (optional)
- `LOGTAIL_TOKEN`: For log aggregation (optional)

## 📚 Documentation

- [Chat Module Documentation](../modules/chat.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Monitoring Setup](../MONITORING.md)

## 🙏 Contributors

Thanks to everyone who contributed to this release!

## 📊 Stats

- 932 lines added
- 55 lines removed
- 13 files changed
- 20 tests added
- 91.5% test coverage

## 🔗 Links

- [Full Changelog](https://github.com/user/repo/compare/v1.0.0...v1.1.0)
- [GitHub Release](https://github.com/user/repo/releases/tag/v1.1.0)
- [Issues Closed](https://github.com/user/repo/milestone/2?closed=1)
```

### 7. Create GitHub Release
Publish release on GitHub:

**Using GitHub CLI**:
```bash
gh release create v1.1.0 \
  --title "v1.1.0 - Real-time Chat Messaging" \
  --notes-file docs/releases/v1.1.0.md \
  --latest
```

**Manual via GitHub Web**:
1. Go to Releases page
2. Click "Draft a new release"
3. Choose tag v1.1.0
4. Set title: "v1.1.0 - Real-time Chat Messaging"
5. Paste release notes
6. Mark as latest release
7. Publish release

### 8. Build Release Artifacts
Create distribution files:

```bash
# Build for production
npm run build

# Create tarball
npm pack

# Verify contents
tar -tzf chati-dev-1.1.0.tgz
```

For Docker:
```bash
# Build Docker image
docker build -t chati-dev:1.1.0 .
docker build -t chati-dev:latest .

# Tag for registry
docker tag chati-dev:1.1.0 username/chati-dev:1.1.0
docker tag chati-dev:latest username/chati-dev:latest
```

### 9. Publish to npm (if applicable)
Release package to npm registry:

```bash
# Login to npm
npm login

# Publish package
npm publish --access public

# Verify published
npm view chati-dev
```

For Docker Hub:
```bash
# Login
docker login

# Push images
docker push username/chati-dev:1.1.0
docker push username/chati-dev:latest
```

### 10. Update Documentation
Ensure docs reflect new version:

**README.md**:
```markdown
## Installation

```bash
npm install chati-dev@latest
# or specific version
npm install chati-dev@1.1.0
```

**Update version badges**:
```markdown
![Version](https://img.shields.io/npm/v/chati-dev)
![Downloads](https://img.shields.io/npm/dm/chati-dev)
```

### 11. Create Migration Guide (if needed)
For breaking changes:

**docs/migrations/v1-to-v2.md**:
```markdown
# Migration Guide: v1.x to v2.0

## Breaking Changes

### API Changes
- `sendMessage()` now returns a Promise
- `getMessage()` renamed to `fetchMessage()`

### Configuration Changes
- Environment variable `API_KEY` renamed to `CHAT_API_KEY`

## Step-by-Step Migration

1. Update package:
   ```bash
   npm install chati-dev@2.0.0
   ```

2. Update API calls:
   ```typescript
   // Before
   const msg = sendMessage(text);

   // After
   const msg = await sendMessage(text);
   ```

3. Update environment variables:
   ```bash
   # Rename in .env
   CHAT_API_KEY=... # was API_KEY
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Automatic Migration

We provide a codemod to help:
```bash
npx @chati-dev/codemod v1-to-v2
```
```

### 12. Notify Stakeholders
Communicate release:

**Internal**:
- Slack/team chat announcement
- Email to stakeholders
- Update project management tools

**External**:
- Tweet/social media
- Blog post
- Newsletter
- Documentation site

**Example Slack Message**:
```
🚀 Release v1.1.0 is now live!

✨ What's new:
• Real-time chat messaging
• Enhanced monitoring & logging
• Improved error handling

🐛 Fixes:
• SQL injection vulnerability
• Message validation bugs

📚 Docs: https://docs.yourdomain.com/releases/v1.1.0
🔗 Release: https://github.com/user/repo/releases/tag/v1.1.0
```

## Decision Points

### When to Mark as Pre-release
Use pre-release versions when:
- Still in testing (alpha, beta, rc)
- Not production-ready
- Want early feedback
- Breaking changes not finalized

Format: `1.1.0-beta.1`, `2.0.0-rc.2`

### When to Create Hotfix Release
Create hotfix for:
- Critical security vulnerabilities
- Data loss bugs
- Service outages
- Critical functionality broken

Process:
1. Branch from release tag
2. Fix issue
3. Bump patch version
4. Fast-track release

### When to Rollback
Rollback if:
- Critical bugs discovered post-release
- Security vulnerability introduced
- Data integrity issues
- Widespread user impact

## Error Handling

### Version Conflict
If version already exists:
```bash
# Delete local tag
git tag -d v1.1.0

# Delete remote tag (careful!)
git push --delete origin v1.1.0

# Create with new version
git tag -a v1.1.1 -m "..."
```

### npm Publish Fails
If publish fails:
- Check npm credentials
- Verify version not published
- Check package.json validity
- Ensure registry accessible
- Check for .npmignore issues

### Tag Push Fails
If can't push tags:
```bash
# Fetch latest
git fetch --tags

# Force push (be certain!)
git push --force origin v1.1.0
```

## Output Format

Create `.chati/artifacts/deploy/release-plan.yaml`:

```yaml
task_id: "deploy"
agent: devops
action: release-prepare
timestamp: "2026-02-13T18:45:00Z"
duration_minutes: 40

release_info:
  version: "1.1.0"
  previous_version: "1.0.0"
  release_type: minor
  release_date: "2026-02-13"
  codename: "Real-time Chat"

version_updates:
  - file: package.json
    old: "1.0.0"
    new: "1.1.0"
  - file: package-lock.json
    old: "1.0.0"
    new: "1.1.0"
  - file: src/version.ts
    old: "1.0.0"
    new: "1.1.0"

changelog:
  file: CHANGELOG.md
  updated: true
  sections:
    added: 4
    changed: 3
    fixed: 3
    security: 3

git_tags:
  - tag: v1.1.0
    message: "Release version 1.1.0"
    commit: abc1234
    pushed: true

release_notes:
  file: docs/releases/v1.1.0.md
  created: true
  sections:
    - whats_new
    - improvements
    - bug_fixes
    - security
    - installation
    - upgrade_guide

github_release:
  created: true
  url: "https://github.com/user/repo/releases/tag/v1.1.0"
  title: "v1.1.0 - Real-time Chat Messaging"
  is_latest: true
  is_prerelease: false

artifacts:
  tarball:
    file: chati-dev-1.1.0.tgz
    size_kb: 245
    created: true
  docker_images:
    - tag: "chati-dev:1.1.0"
      pushed: true
    - tag: "chati-dev:latest"
      pushed: true

npm_publish:
  published: true
  package: "chati-dev"
  version: "1.1.0"
  registry: "https://registry.npmjs.org"
  access: public
  url: "https://www.npmjs.com/package/chati-dev/v/1.1.0"

documentation_updates:
  - file: README.md
    change: Updated installation instructions
  - file: docs/MIGRATION.md
    change: Added upgrade guide
  - file: docs/API.md
    change: Updated API documentation

stakeholder_notification:
  internal:
    - channel: slack
      posted: true
    - channel: email
      sent: true
  external:
    - channel: github
      posted: true
    - channel: twitter
      posted: false

breaking_changes: false
migration_guide_needed: false

release_checklist:
  - item: Version bumped
    status: done
  - item: Changelog updated
    status: done
  - item: Git tag created
    status: done
  - item: Release notes written
    status: done
  - item: GitHub release published
    status: done
  - item: npm package published
    status: done
  - item: Docker images pushed
    status: done
  - item: Documentation updated
    status: done
  - item: Stakeholders notified
    status: done

metrics:
  commits_since_last_release: 11
  files_changed: 13
  lines_added: 932
  lines_removed: 55
  contributors: 1
  issues_closed: 3

next_steps:
  - "Monitor release for issues"
  - "Respond to user feedback"
  - "Begin planning v1.2.0"
  - "Archive release artifacts"
```

## Success Criteria
- Version number bumped correctly
- Changelog complete and accurate
- Git tag created and pushed
- Release notes comprehensive
- GitHub release published
- Package published (if applicable)
- Documentation updated
- Stakeholders notified
- Release plan documented
