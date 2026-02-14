---
id: devops-ci-setup
agent: devops
trigger: orchestrator
phase: deploy
requires_input: false
parallelizable: true
outputs: [ci-config]
handoff_to: devops-deploy-config
autonomous_gate: true
criteria:
  - CI pipeline runs
  - All checks pass
---
# Configure CI/CD Pipeline

## Purpose
Set up automated Continuous Integration and Continuous Deployment pipeline to run tests, linting, type checking, and builds on every commit and pull request.

## Prerequisites
- Code repository initialized
- Package.json with test scripts configured
- Project builds successfully locally
- Git repository connected to GitHub
- Access to repository settings

## Steps

### 1. Determine CI/CD Platform
Choose appropriate platform based on project hosting:
- **GitHub Actions**: If hosted on GitHub (most common)
- **GitLab CI**: If hosted on GitLab
- **Circle CI**: If preferred for advanced features
- **Travis CI**: If legacy integration exists

For this guide, we'll use GitHub Actions as default.

### 2. Create Workflow Directory
Set up GitHub Actions structure:
```bash
mkdir -p .github/workflows
```

### 3. Create Main CI Workflow
Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x, 22.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run tests
        run: npm test

      - name: Build project
        run: npm run build

      - name: Upload coverage
        if: matrix.node-version == '22.x'
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unittests
          name: codecov-umbrella
```

### 4. Add Code Quality Checks
Create additional quality workflows:

`.github/workflows/code-quality.yml`:
```yaml
name: Code Quality

on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Check code complexity
        run: npx complexity-report

      - name: Check bundle size
        run: npm run build:analyze

      - name: Security audit
        run: npm audit --audit-level=moderate
```

### 5. Add Branch Protection Rules
Configure GitHub branch protection:
- Navigate to repo Settings > Branches
- Add rule for main/master branch
- Require status checks to pass:
  - CI test job
  - Lint check
  - Type check
  - Build success
- Require pull request reviews
- Require up-to-date branches

### 6. Configure Test Coverage Reporting
Set up coverage tracking:

Add to `package.json`:
```json
{
  "scripts": {
    "test:coverage": "jest --coverage",
    "test:ci": "jest --coverage --ci --maxWorkers=2"
  }
}
```

Sign up for Codecov (optional):
- Visit codecov.io
- Connect GitHub repository
- Add CODECOV_TOKEN to repo secrets
- Coverage reports will upload automatically

### 7. Add Dependency Updates
Create Dependabot configuration:

`.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    reviewers:
      - "team-name"
    labels:
      - "dependencies"
```

### 8. Configure Secrets and Environment Variables
Set up repository secrets:
- Go to repo Settings > Secrets and variables > Actions
- Add necessary secrets:
  - `CODECOV_TOKEN` (if using Codecov)
  - `NPM_TOKEN` (if publishing packages)
  - `DEPLOY_KEY` (if auto-deploying)

### 9. Add Status Badges
Update README with CI status:

```markdown
# Project Name

![CI](https://github.com/username/repo/workflows/CI/badge.svg)
![Code Quality](https://github.com/username/repo/workflows/Code%20Quality/badge.svg)
[![codecov](https://codecov.io/gh/username/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/username/repo)
```

### 10. Test CI Pipeline
Verify workflow execution:
- Create test branch
- Make small change
- Push and create PR
- Monitor Actions tab
- Verify all checks run
- Confirm checks pass or fail appropriately

### 11. Optimize CI Performance
Improve pipeline speed:
- Cache dependencies effectively
- Use matrix strategy for parallel tests
- Minimize npm install time with npm ci
- Skip unnecessary steps on specific paths
- Use conditional job execution

Example path filtering:
```yaml
on:
  push:
    paths:
      - 'src/**'
      - 'tests/**'
      - 'package.json'
```

### 12. Document CI/CD Setup
Create CI documentation:
- How to interpret CI results
- What to do when checks fail
- How to add new checks
- Secrets management
- Troubleshooting guide

## Decision Points

### When Tests are Slow
If CI takes too long (>5 minutes):
1. Profile test execution time
2. Parallelize test suites
3. Use smaller test runner
4. Cache node_modules
5. Run only affected tests

### When Builds Fail Initially
If CI fails on first run:
1. Run locally to reproduce
2. Check environment differences
3. Ensure all dependencies in package.json
4. Verify scripts in package.json
5. Check for missing config files

### When Using Monorepo
If project is a monorepo:
1. Use specialized tools (Turborepo, Nx)
2. Run only affected projects
3. Cache build artifacts
4. Use matrix strategy for packages
5. Consider separate workflows per package

## Error Handling

### Action Not Found
If GitHub Actions fail to find steps:
- Verify action version exists
- Check action name spelling
- Ensure action is public
- Update to latest action version

### Permission Errors
If actions can't access resources:
- Check repository secrets configured
- Verify token permissions
- Review workflow permissions
- Check branch protection rules

### Timeout Issues
If jobs timeout:
- Increase timeout: `timeout-minutes: 30`
- Optimize slow steps
- Split into multiple jobs
- Use faster runners

### Flaky Tests in CI
If tests pass locally but fail in CI:
- Check for timing dependencies
- Verify environment variables
- Check for file system differences
- Add retries for flaky tests
- Increase timeouts

## Output Format

Create `.chati/artifacts/deploy/ci-config-report.yaml`:

```yaml
task_id: "deploy"
agent: devops
action: ci-setup
timestamp: "2026-02-13T16:30:00Z"
duration_minutes: 35

ci_platform: github-actions
ci_url: "https://github.com/username/repo/actions"

workflows_created:
  - name: CI
    file: .github/workflows/ci.yml
    triggers: [push, pull_request]
    jobs: [test]
    node_versions: [18.x, 20.x, 22.x]
    steps:
      - checkout
      - setup-node
      - install-dependencies
      - lint
      - typecheck
      - test
      - build
      - upload-coverage

  - name: Code Quality
    file: .github/workflows/code-quality.yml
    triggers: [pull_request]
    jobs: [quality]
    steps:
      - complexity-check
      - bundle-size
      - security-audit

checks_configured:
  - name: Lint
    command: npm run lint
    required: true
  - name: Type Check
    command: npm run typecheck
    required: true
  - name: Tests
    command: npm test
    required: true
  - name: Build
    command: npm run build
    required: true
  - name: Security Audit
    command: npm audit
    required: false

branch_protection:
  enabled: true
  branch: main
  required_checks:
    - "test (18.x)"
    - "test (20.x)"
    - "test (22.x)"
    - "quality"
  require_reviews: true
  min_reviewers: 1
  dismiss_stale_reviews: true
  require_code_owner_reviews: false

secrets_configured:
  - name: CODECOV_TOKEN
    purpose: Coverage reporting
    status: configured
  - name: NPM_TOKEN
    purpose: Package publishing
    status: not_needed

test_results:
  first_run_status: success
  first_run_duration: 2m 45s
  all_checks_passed: true
  coverage_uploaded: true

optimizations_applied:
  - Dependency caching with actions/setup-node
  - npm ci instead of npm install
  - Matrix strategy for parallel testing
  - Conditional coverage upload (only Node 22.x)

performance_metrics:
  average_ci_duration: 2m 30s
  cache_hit_rate: 85%
  parallel_jobs: 3

documentation:
  - file: README.md
    change: Added CI status badges
  - file: .github/workflows/README.md
    change: Created workflow documentation
  - file: CONTRIBUTING.md
    change: Added CI guidelines

known_issues: []

next_steps:
  - Monitor CI for a few days
  - Optimize if duration exceeds 3 minutes
  - Add pre-commit hooks for local validation
  - Configure deployment workflow
```

## Success Criteria
- CI workflow file created and committed
- Pipeline runs on push and PR
- All checks execute successfully
- Branch protection rules configured
- Status badges added to README
- CI completes in reasonable time (<5 minutes)
- Documentation updated
- Secrets configured properly
