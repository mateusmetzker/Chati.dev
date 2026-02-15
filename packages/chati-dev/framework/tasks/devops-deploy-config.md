---
id: devops-deploy-config
agent: devops
trigger: devops-ci-setup
phase: deploy
requires_input: false
parallelizable: false
outputs: [deploy-config]
handoff_to: devops-monitoring-setup
autonomous_gate: true
criteria:
  - Deploy config valid
  - Environment variables set
---
# Configure Deployment

## Purpose
Set up deployment configuration for the application to chosen hosting platform (Vercel, Railway, Netlify, Docker, etc.) with proper environment management.

## Prerequisites
- CI/CD pipeline configured
- Application builds successfully
- Hosting platform account created
- Environment variables documented
- Production-ready code

## Steps

### 1. Choose Deployment Platform
Select platform based on project type:

**For Static Sites/JAMstack**:
- Vercel (Next.js, static sites)
- Netlify (static sites, serverless functions)
- GitHub Pages (documentation, static sites)

**For Full-Stack Apps**:
- Vercel (Next.js, serverless)
- Railway (Node.js, databases, Docker)
- Render (web services, databases)
- Fly.io (global deployment, Docker)

**For Containerized Apps**:
- Railway (easiest Docker deployment)
- Fly.io (edge deployment)
- Digital Ocean App Platform
- AWS ECS/Fargate

**For CLI Tools/Packages**:
- npm registry
- GitHub Packages
- Docker Hub

### 2. Install Platform CLI
Install deployment tool:

```bash
# Vercel
npm install -g vercel

# Railway
npm install -g @railway/cli

# Fly.io
curl -L https://fly.io/install.sh | sh

# Netlify
npm install -g netlify-cli
```

### 3. Configure Project for Platform
Create platform-specific config:

**Vercel** (`vercel.json`):
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/src/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

**Railway** (`railway.json`):
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**Fly.io** (`fly.toml`):
```toml
app = "your-app-name"
primary_region = "sjc"

[build]
  [build.args]
    NODE_VERSION = "22"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  http_checks = []
  internal_port = 8080
  protocol = "tcp"
  script_checks = []

  [[services.ports]]
    force_https = true
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

**Dockerfile** (if using containers):
```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
```

### 4. Configure Environment Variables
Set up environment variable management:

**Create `.env.example`**:
```bash
# Application
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@host:port/db

# Authentication
JWT_SECRET=your-secret-here
JWT_EXPIRATION=7d

# External Services
API_KEY=your-api-key
WEBHOOK_SECRET=your-webhook-secret

# Feature Flags
ENABLE_CHAT=true
ENABLE_ANALYTICS=false
```

**Set variables on platform**:
```bash
# Vercel
vercel env add DATABASE_URL production
vercel env add JWT_SECRET production

# Railway
railway variables set DATABASE_URL="postgresql://..."
railway variables set JWT_SECRET="..."

# Fly.io
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="..."
```

### 5. Configure Build Settings
Define build process:

**Update package.json**:
```json
{
  "scripts": {
    "build": "tsc && node scripts/post-build.js",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "deploy": "npm run build && vercel --prod"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

### 6. Set Up Deployment Workflow
Create automated deployment:

**.github/workflows/deploy.yml**:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### 7. Configure Database (if needed)
Set up production database:

**Railway**:
```bash
railway add postgresql
railway variables
# Note DATABASE_URL automatically set
```

**Fly.io Postgres**:
```bash
fly postgres create
fly postgres attach --app your-app-name
```

Run migrations:
```bash
npm run migrate:prod
```

### 8. Configure Domain and SSL
Set up custom domain:

**Vercel**:
```bash
vercel domains add yourdomain.com
# Follow DNS instructions
```

**Railway**:
- Go to project settings
- Add custom domain
- Update DNS records
- SSL automatically provisioned

**Fly.io**:
```bash
fly certs create yourdomain.com
fly certs show yourdomain.com
```

### 9. Set Up Staging Environment
Create staging deployment:

```bash
# Create staging branch
git checkout -b staging

# Deploy to staging
vercel --env=staging
# or
railway environment create staging
```

Configure separate environment variables for staging.

### 10. Create Deployment Scripts
Add convenience scripts:

**scripts/deploy.sh**:
```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Run tests
echo "Running tests..."
npm test

# Build
echo "Building application..."
npm run build

# Deploy
echo "Deploying to production..."
vercel --prod

echo "✅ Deployment complete!"
```

Make executable:
```bash
chmod +x scripts/deploy.sh
```

### 11. Configure Health Checks
Add health endpoint:

**src/routes/health.ts**:
```typescript
export function healthCheck(req, res) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
}
```

Configure platform to use health check:
- Path: `/health`
- Interval: 30 seconds
- Timeout: 10 seconds
- Unhealthy threshold: 3 failures

### 12. Test Deployment
Verify deployment works:
- Deploy to staging first
- Run smoke tests
- Check environment variables
- Verify database connection
- Test all critical paths
- Deploy to production
- Monitor logs

## Decision Points

### When to Use Serverless vs Traditional Hosting
**Choose Serverless** (Vercel, Netlify) when:
- Traffic is intermittent
- Want zero devops overhead
- Primarily static or JAMstack
- Need global CDN
- Budget conscious (pay per use)

**Choose Traditional** (Railway, Fly.io) when:
- Need persistent connections (WebSockets)
- Background jobs required
- Complex database needs
- More control needed
- Predictable costs preferred

### When to Use Docker
Use containers when:
- Complex dependencies
- Specific system requirements
- Need reproducible builds
- Multi-service architecture
- Platform agnostic deployment

### When to Add CDN
Add CDN (Cloudflare, Fastly) when:
- Global user base
- Static asset heavy
- Need DDoS protection
- Performance critical
- High traffic volumes

## Error Handling

### Deployment Fails
If deployment fails:
1. Check build logs
2. Verify environment variables set
3. Test build locally
4. Check platform status page
5. Verify permissions and tokens

### Environment Variables Not Working
If env vars not loading:
1. Verify variable names match
2. Check platform shows variables set
3. Restart application
4. Check for typos
5. Verify no conflicts with .env files

### Database Connection Fails
If can't connect to database:
1. Verify DATABASE_URL correct
2. Check database is running
3. Verify network access
4. Check SSL requirements
5. Test connection locally

### SSL Certificate Issues
If SSL not working:
1. Verify DNS propagated (24-48hrs)
2. Check DNS records correct
3. Force SSL renewal
4. Check certificate status
5. Contact platform support

## Output Format

Create `.chati/artifacts/deploy/deploy-config-report.yaml`:

```yaml
task_id: "deploy"
agent: devops
action: deploy-config
timestamp: "2026-02-13T17:15:00Z"
duration_minutes: 45

deployment_platform: railway
deployment_url: "https://your-app.up.railway.app"
custom_domain: "yourdomain.com"
ssl_enabled: true

configuration_files:
  - file: railway.json
    purpose: Railway deployment config
    created: true
  - file: Dockerfile
    purpose: Container definition
    created: true
  - file: .dockerignore
    purpose: Exclude files from container
    created: true
  - file: .env.example
    purpose: Environment variable template
    created: true

environment_variables:
  production:
    - name: NODE_ENV
      value: production
      source: platform
    - name: PORT
      value: "8080"
      source: platform
    - name: DATABASE_URL
      value: "***"
      source: platform_secret
    - name: JWT_SECRET
      value: "***"
      source: platform_secret
    - name: LOG_LEVEL
      value: info
      source: platform

  staging:
    - name: NODE_ENV
      value: staging
      source: platform
    - name: DATABASE_URL
      value: "***"
      source: platform_secret

database_config:
  type: postgresql
  provider: railway
  version: "15"
  connection_pooling: true
  ssl_required: true
  migrations_run: true

build_config:
  builder: nixpacks
  node_version: "22"
  install_command: npm ci
  build_command: npm run build
  start_command: npm start
  health_check_path: /health

deployment_workflow:
  file: .github/workflows/deploy.yml
  trigger: push_to_main
  environments:
    - staging
    - production
  auto_deploy: true
  rollback_enabled: true

domain_config:
  custom_domain: yourdomain.com
  dns_configured: true
  ssl_certificate: auto_provisioned
  force_https: true
  www_redirect: true

health_checks:
  endpoint: /health
  interval_seconds: 30
  timeout_seconds: 10
  unhealthy_threshold: 3
  healthy_threshold: 2

performance_config:
  auto_scaling: true
  min_instances: 1
  max_instances: 5
  cpu_threshold: 80
  memory_threshold: 85

test_deployment:
  staging_deploy: success
  staging_url: "https://staging-your-app.up.railway.app"
  smoke_tests_passed: true
  production_deploy: success
  production_url: "https://your-app.up.railway.app"

deployment_scripts:
  - name: deploy.sh
    purpose: Manual deployment script
    location: scripts/deploy.sh
  - name: rollback.sh
    purpose: Rollback to previous version
    location: scripts/rollback.sh

documentation_updated:
  - file: README.md
    section: Deployment
  - file: docs/DEPLOYMENT.md
    created: true
  - file: .env.example
    created: true

known_issues: []

next_steps:
  - Set up monitoring and logging
  - Configure alerts
  - Test auto-scaling
  - Document rollback procedure
```

## Success Criteria
- Deployment configuration created
- Application deploys successfully
- Environment variables configured
- Database connected (if applicable)
- Health checks working
- SSL certificate active
- Custom domain configured
- Deployment workflow automated
- Staging environment available
- Documentation complete
