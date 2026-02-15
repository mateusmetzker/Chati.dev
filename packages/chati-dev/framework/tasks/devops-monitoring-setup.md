---
id: devops-monitoring-setup
agent: devops
trigger: devops-deploy-config
phase: deploy
requires_input: false
parallelizable: false
outputs: [monitoring-config]
handoff_to: devops-release-prepare
autonomous_gate: true
criteria:
  - Health endpoints configured
  - Logging active
---
# Set Up Monitoring and Logging

## Purpose
Configure comprehensive monitoring, logging, and alerting to track application health, performance, and errors in production.

## Prerequisites
- Application deployed
- Health check endpoint exists
- Production environment accessible
- Deployment platform configured
- Access to monitoring tools

## Steps

### 1. Choose Monitoring Stack
Select tools based on needs and budget:

**Free/Open Source**:
- Logging: Winston + file transport
- Metrics: Built-in Node.js metrics
- APM: OpenTelemetry
- Alerts: Email notifications

**Managed Services (Free Tier)**:
- Logging: Better Stack (Logtail), Papertrail
- APM: New Relic, Datadog
- Error Tracking: Sentry
- Uptime: UptimeRobot, BetterUptime

**Enterprise**:
- Full Stack: Datadog, New Relic
- Logging: Splunk, ELK Stack
- APM: AppDynamics
- Metrics: Prometheus + Grafana

### 2. Set Up Structured Logging
Implement comprehensive logging:

**Install logger**:
```bash
npm install winston pino
```

**Create logger utility** (`src/lib/logger.ts`):
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'chati-dev',
    environment: process.env.NODE_ENV
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add remote logging in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Http({
    host: process.env.LOGTAIL_HOST,
    path: process.env.LOGTAIL_PATH,
    ssl: true
  }));
}

export default logger;
```

**Use structured logging**:
```typescript
import logger from './lib/logger';

// Info logs
logger.info('User logged in', {
  userId: user.id,
  email: user.email,
  timestamp: new Date()
});

// Error logs
logger.error('Payment processing failed', {
  userId: user.id,
  amount: payment.amount,
  error: error.message,
  stack: error.stack
});

// Performance logs
logger.info('API request completed', {
  method: req.method,
  path: req.path,
  duration: duration,
  statusCode: res.statusCode
});
```

### 3. Configure Error Tracking
Set up Sentry for error monitoring:

**Install Sentry**:
```bash
npm install @sentry/node @sentry/profiling-node
```

**Initialize Sentry** (`src/lib/sentry.ts`):
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
  ],
});

export default Sentry;
```

**Add error handler**:
```typescript
import Sentry from './lib/sentry';

// Error middleware
app.use(Sentry.Handlers.errorHandler());

app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    error: 'Internal server error',
    requestId: req.id
  });
});
```

### 4. Add Performance Monitoring
Track application performance:

**Create metrics collector** (`src/lib/metrics.ts`):
```typescript
import { performance } from 'perf_hooks';

class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  recordTiming(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }

  recordCounter(name: string, value: number = 1) {
    const current = this.metrics.get(name) || [0];
    this.metrics.set(name, [current[0] + value]);
  }

  getMetrics() {
    const summary: Record<string, any> = {};

    this.metrics.forEach((values, name) => {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;

      summary[name] = {
        count: values.length,
        sum: sum,
        avg: avg,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    });

    return summary;
  }

  reset() {
    this.metrics.clear();
  }
}

export const metrics = new MetricsCollector();
```

**Track operations**:
```typescript
import { metrics } from './lib/metrics';

async function handleRequest(req, res) {
  const start = performance.now();

  try {
    await processRequest(req);
    const duration = performance.now() - start;

    metrics.recordTiming('api.request.duration', duration);
    metrics.recordCounter('api.request.success');

    logger.info('Request processed', { duration, path: req.path });
  } catch (error) {
    metrics.recordCounter('api.request.error');
    throw error;
  }
}
```

### 5. Set Up Health Check Endpoint
Create comprehensive health check:

**src/routes/health.ts**:
```typescript
import { Router } from 'express';
import { metrics } from '../lib/metrics';
import logger from '../lib/logger';

const router = Router();

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION,
    checks: {}
  };

  // Database check
  try {
    await db.ping();
    health.checks.database = { status: 'up' };
  } catch (error) {
    health.checks.database = {
      status: 'down',
      error: error.message
    };
    health.status = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'ok' : 'warning',
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/metrics', (req, res) => {
  res.json(metrics.getMetrics());
});

export default router;
```

### 6. Configure Uptime Monitoring
Set up external uptime checks:

**UptimeRobot** (free):
1. Sign up at uptimerobot.com
2. Add monitor:
   - Type: HTTP(s)
   - URL: https://yourdomain.com/health
   - Interval: 5 minutes
3. Configure alerts:
   - Email notifications
   - Slack webhook (optional)
4. Add status page (public/private)

**Better Uptime** (better features):
1. Sign up at betteruptime.com
2. Create monitor
3. Configure incident management
4. Set up on-call schedule
5. Add status page

### 7. Set Up Log Aggregation
Centralize logs from all sources:

**Better Stack (Logtail)**:
```typescript
import { Logtail } from '@logtail/node';

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

// Add to Winston
logger.add(new LogtailTransport(logtail));

// Manual logging
logtail.info('User action', {
  userId: user.id,
  action: 'login',
  metadata: { ip: req.ip }
});
```

**Papertrail**:
```bash
# Add syslog transport to Winston
npm install winston-syslog

// winston config
new winston.transports.Syslog({
  host: 'logs.papertrailapp.com',
  port: 12345,
  protocol: 'tls4'
})
```

### 8. Configure Alerts
Set up proactive alerting:

**Alert Rules**:
- Error rate exceeds threshold
- Response time > 1 second
- Health check fails
- Memory usage > 90%
- Disk space < 10%
- Failed deployments

**Alert Channels**:
- Email for low priority
- Slack for medium priority
- PagerDuty/on-call for critical

**Create alert handler** (`src/lib/alerts.ts`):
```typescript
interface Alert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

async function sendAlert(alert: Alert) {
  // Log alert
  logger.warn('Alert triggered', alert);

  // Send to Slack
  if (alert.severity === 'high' || alert.severity === 'critical') {
    await sendSlackAlert(alert);
  }

  // Send to email
  if (alert.severity === 'critical') {
    await sendEmailAlert(alert);
  }
}

async function sendSlackAlert(alert: Alert) {
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 ${alert.severity.toUpperCase()}: ${alert.title}`,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: alert.message }
        }
      ]
    })
  });
}
```

### 9. Add Request Tracking
Track individual requests:

**Add request ID middleware**:
```typescript
import { randomUUID } from 'crypto';

app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    logger.info('HTTP request', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });

    metrics.recordTiming('http.request.duration', duration);
    metrics.recordCounter(`http.status.${res.statusCode}`);
  });

  next();
});
```

### 10. Create Monitoring Dashboard
Build internal dashboard:

**Create dashboard endpoint**:
```typescript
router.get('/dashboard', async (req, res) => {
  const dashboard = {
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    application: {
      version: process.env.APP_VERSION,
      environment: process.env.NODE_ENV,
      nodeVersion: process.version
    },
    metrics: metrics.getMetrics(),
    health: await runHealthChecks()
  };

  res.json(dashboard);
});
```

### 11. Document Monitoring Setup
Create runbook:

**docs/MONITORING.md**:
```markdown
# Monitoring & Observability

## Dashboards
- Application: https://dashboard.yourdomain.com
- Uptime: https://status.yourdomain.com
- Errors: https://sentry.io/your-org/your-project
- Logs: https://logtail.com/your-source

## Key Metrics
- Response time: < 200ms (p95)
- Error rate: < 0.1%
- Uptime: > 99.9%
- Memory usage: < 500MB

## Alerts
- Critical: PagerDuty + Email
- High: Slack + Email
- Medium: Slack
- Low: Email digest

## Runbooks
- [High Error Rate](/docs/runbooks/high-error-rate.md)
- [Database Connection Issues](/docs/runbooks/db-issues.md)
- [Memory Leak](/docs/runbooks/memory-leak.md)
```

### 12. Test Monitoring
Verify everything works:
- Trigger test error
- Check error appears in Sentry
- Verify logs in aggregator
- Confirm alerts fire
- Test health endpoint
- Review metrics
- Check uptime monitor

## Decision Points

### When to Add APM
Add full APM (New Relic, Datadog) when:
- Complex distributed system
- Need transaction tracing
- Performance bottlenecks unclear
- Budget allows ($100+/month)

### When Logs Become Too Expensive
If log volume is high:
1. Sample non-critical logs
2. Use log levels effectively
3. Filter sensitive data
4. Archive old logs to S3
5. Consider self-hosted solution

### When to Page On-Call
Page on-call for:
- Service completely down
- Database unreachable
- Security incident
- Data loss risk

Don't page for:
- Individual errors
- Slow requests
- Non-critical feature issues

## Error Handling

### Logs Not Appearing
If logs missing:
1. Check logger configuration
2. Verify transport connected
3. Check log level filtering
4. Verify credentials
5. Check network connectivity

### Alerts Not Firing
If alerts don't trigger:
1. Check alert configuration
2. Verify webhook URL
3. Test alert manually
4. Check threshold values
5. Review alert history

### High Monitoring Costs
If costs too high:
1. Reduce log sampling
2. Use log levels effectively
3. Filter noisy logs
4. Archive old data
5. Consider tier changes

## Output Format

Create `.chati/artifacts/deploy/monitoring-config-report.yaml`:

```yaml
task_id: "deploy"
agent: devops
action: monitoring-setup
timestamp: "2026-02-13T18:00:00Z"
duration_minutes: 50

logging:
  library: winston
  level: info
  structured: true
  destinations:
    - console
    - logtail
  retention_days: 30

error_tracking:
  service: sentry
  dsn_configured: true
  environment: production
  sample_rate: 1.0
  performance_monitoring: true

performance_monitoring:
  custom_metrics: true
  request_tracking: true
  health_endpoint: /health
  metrics_endpoint: /metrics

uptime_monitoring:
  service: betteruptime
  url: "https://yourdomain.com/health"
  interval_minutes: 5
  locations: [us-east, us-west, eu-west]
  status_page: "https://status.yourdomain.com"

alerting:
  channels:
    - type: slack
      severity: [medium, high, critical]
      webhook_configured: true
    - type: email
      severity: [high, critical]
      configured: true

  rules:
    - name: High error rate
      condition: error_rate > 1%
      severity: high
    - name: Service down
      condition: health_check_failed
      severity: critical
    - name: High response time
      condition: p95_latency > 1000ms
      severity: medium

dashboards:
  - name: Application Health
    url: "https://dashboard.yourdomain.com"
    metrics: [uptime, response_time, error_rate, memory]
  - name: Sentry Errors
    url: "https://sentry.io/..."
    purpose: Error tracking

documentation:
  - file: docs/MONITORING.md
    purpose: Monitoring overview
  - file: docs/runbooks/
    purpose: Incident response guides

test_results:
  error_tracking_tested: true
  logs_appearing: true
  alerts_firing: true
  health_check_working: true
  metrics_collecting: true

next_steps:
  - Monitor for 24 hours
  - Tune alert thresholds
  - Create additional runbooks
  - Train team on monitoring
```

## Success Criteria
- Structured logging implemented
- Error tracking configured
- Health endpoints working
- Uptime monitoring active
- Alerts configured and tested
- Logs centralized and searchable
- Dashboard accessible
- Documentation complete
