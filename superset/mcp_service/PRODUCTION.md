<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# MCP Service Production Deployment Guide

## Current Status

### What's Production-Ready

The following components have been implemented and tested:

- ✅ **Tool Infrastructure**: FastMCP-based tool registration and discovery
- ✅ **Flask App Context Management**: Module-level singleton pattern
- ✅ **Error Handling**: Comprehensive validation and error responses
- ✅ **Pydantic Validation**: Type-safe request/response schemas
- ✅ **Access Control**: RBAC and RLS enforcement through Superset's security manager
- ✅ **Database Connection Pooling**: SQLAlchemy pool management
- ✅ **Health Checks**: Basic health check tool for monitoring

### What's Development-Only

The following features are suitable for development but **require configuration for production**:

- ❌ **Authentication**: `MCP_DEV_USERNAME` single-user authentication (replace with JWT)
- ❌ **Logging**: Basic debug logging (implement structured logging)
- ❌ **Rate Limiting**: No rate limiting implemented (add per-user/per-tool limits)
- ❌ **Monitoring**: No metrics export (add Prometheus/CloudWatch)
- ❌ **Caching**: No caching layer (consider Redis for performance)
- ❌ **HTTPS**: HTTP-only by default (must enable HTTPS for production)

## Required for Production

### 1. Authentication & Authorization

#### JWT Authentication Setup

**Required Configuration**:

```python
# superset_config.py

# Enable JWT authentication
MCP_AUTH_ENABLED = True

# JWT validation settings
MCP_JWT_ISSUER = "https://auth.yourcompany.com"
MCP_JWT_AUDIENCE = "superset-mcp"
MCP_JWT_ALGORITHM = "RS256"  # or "HS256" for shared secrets

# Option A: Use JWKS endpoint (recommended for RS256)
MCP_JWKS_URI = "https://auth.yourcompany.com/.well-known/jwks.json"

# Option B: Static public key (RS256)
MCP_JWT_PUBLIC_KEY = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----"""

# Option C: Shared secret (HS256 - less secure)
MCP_JWT_ALGORITHM = "HS256"
MCP_JWT_SECRET = "your-256-bit-secret-key"

# Optional: Require specific scopes
MCP_REQUIRED_SCOPES = ["superset:read"]

# Disable development authentication
MCP_DEV_USERNAME = None
```

**JWT Issuer Setup Examples**:

**Auth0**:
```python
MCP_JWT_ISSUER = "https://your-tenant.auth0.com/"
MCP_JWT_AUDIENCE = "superset-mcp"
MCP_JWKS_URI = "https://your-tenant.auth0.com/.well-known/jwks.json"
```

**Okta**:
```python
MCP_JWT_ISSUER = "https://your-domain.okta.com/oauth2/default"
MCP_JWT_AUDIENCE = "api://superset-mcp"
MCP_JWKS_URI = "https://your-domain.okta.com/oauth2/default/v1/keys"
```

**AWS Cognito**:
```python
MCP_JWT_ISSUER = "https://cognito-idp.us-east-1.amazonaws.com/your-pool-id"
MCP_JWT_AUDIENCE = "your-app-client-id"
MCP_JWKS_URI = "https://cognito-idp.us-east-1.amazonaws.com/your-pool-id/.well-known/jwks.json"
```

**Self-Hosted (Using Keycloak)**:
```python
MCP_JWT_ISSUER = "https://keycloak.yourcompany.com/realms/superset"
MCP_JWT_AUDIENCE = "superset-mcp"
MCP_JWKS_URI = "https://keycloak.yourcompany.com/realms/superset/protocol/openid-connect/certs"
```

**Testing JWT Configuration**:

```bash
# Validate JWT token
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://mcp.yourcompany.com/health

# Expected response if successful:
# {"status": "healthy", "timestamp": "2025-01-01T10:30:45Z", ...}

# Expected response if auth fails:
# {"error": "Invalid token", "error_type": "AuthenticationError", ...}
```

#### Permission Checking

Superset's existing RBAC is automatically enforced. Ensure roles are configured:

```python
# In Superset UI: Security → List Roles

# Recommended role configuration:
# - Admin: Full access to all MCP tools
# - Alpha: Create/edit charts and dashboards
# - Gamma: Read-only access to shared resources
# - Custom: Fine-grained permissions per use case
```

**Verify Permissions**:

```bash
# Test as non-admin user
curl -H "Authorization: Bearer NON_ADMIN_TOKEN" \
     https://mcp.yourcompany.com/list_charts

# Should only return charts the user has access to
```

### 2. Performance & Reliability

#### Rate Limiting

**Implementation Options**:

**Option A: Flask-Limiter** (application-level):

```python
# superset_config.py
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Add to MCP service initialization
MCP_RATE_LIMITING = {
    "enabled": True,
    "storage_uri": "redis://localhost:6379/0",
    "default_limits": ["100 per minute", "1000 per hour"],
    "per_tool_limits": {
        "execute_sql": "10 per minute",
        "generate_chart": "20 per minute",
        "list_charts": "100 per minute",
    }
}
```

**Option B: Nginx Rate Limiting** (infrastructure-level):

```nginx
# /etc/nginx/conf.d/mcp-rate-limit.conf
limit_req_zone $binary_remote_addr zone=mcp_limit:10m rate=100r/m;

server {
    listen 443 ssl;
    server_name mcp.yourcompany.com;

    location / {
        limit_req zone=mcp_limit burst=20 nodelay;
        proxy_pass http://mcp_backend;
    }
}
```

**Option C: API Gateway** (cloud-native):

AWS API Gateway, Azure API Management, or Google Cloud Endpoints provide built-in rate limiting.

#### Error Handling and Monitoring

**Structured Error Responses**:

All MCP tools return consistent error schemas:

```python
{
    "error": "Resource not found",
    "error_type": "NotFoundError",
    "timestamp": "2025-01-01T10:30:45.123Z",
    "details": {
        "resource_type": "dashboard",
        "resource_id": 123
    }
}
```

**Error Tracking (Sentry)**:

```python
# superset_config.py
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="https://your-dsn@sentry.io/project-id",
    integrations=[FlaskIntegration()],
    environment="production",
    traces_sample_rate=0.1,  # 10% of transactions
)
```

**Metrics Export (Prometheus)**:

```python
# Future implementation - add to superset_config.py
from prometheus_flask_exporter import PrometheusMetrics

MCP_PROMETHEUS_ENABLED = True
MCP_PROMETHEUS_PATH = "/metrics"
```

**Example Prometheus metrics**:
```
# HELP mcp_requests_total Total MCP tool requests
# TYPE mcp_requests_total counter
mcp_requests_total{tool="list_charts",status="success"} 1234

# HELP mcp_request_duration_seconds MCP request duration
# TYPE mcp_request_duration_seconds histogram
mcp_request_duration_seconds_bucket{tool="list_charts",le="0.5"} 1000
mcp_request_duration_seconds_bucket{tool="list_charts",le="1.0"} 1200
```

#### Performance Optimization

**Database Query Optimization**:

```python
# superset_config.py

# Connection pool sizing
SQLALCHEMY_POOL_SIZE = 10           # Connections per worker
SQLALCHEMY_MAX_OVERFLOW = 10        # Additional connections allowed
SQLALCHEMY_POOL_TIMEOUT = 30        # Seconds to wait for connection
SQLALCHEMY_POOL_RECYCLE = 3600      # Recycle connections after 1 hour

# Query optimization
SQLALCHEMY_ECHO = False             # Disable SQL logging in production
```

**Caching Strategy**:

```python
# superset_config.py

# Enable Superset's caching
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_URL": "redis://localhost:6379/1",
    "CACHE_DEFAULT_TIMEOUT": 300,   # 5 minutes
}

# Cache query results
DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_URL": "redis://localhost:6379/2",
    "CACHE_DEFAULT_TIMEOUT": 3600,  # 1 hour
}
```

**MCP-Specific Caching** (future enhancement):

```python
# Cache tool responses in Redis
MCP_CACHE_CONFIG = {
    "enabled": True,
    "backend": "redis",
    "url": "redis://localhost:6379/3",
    "ttl": 300,  # 5 minutes
    "cache_tools": [
        "list_dashboards",
        "list_charts",
        "list_datasets",
        "get_dataset_info",
    ]
}
```

#### Load Testing

**Run load tests before production deployment**:

**Using Locust**:

```python
# locustfile.py
from locust import HttpUser, task, between
import jwt
import time

class MCPUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Generate JWT token
        self.token = generate_jwt_token()

    @task(3)
    def list_charts(self):
        self.client.post(
            "/list_charts",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"request": {"page": 1, "page_size": 10}}
        )

    @task(2)
    def get_chart_info(self):
        self.client.post(
            "/get_chart_info",
            headers={"Authorization": f"Bearer {self.token}"},
            json={"request": {"identifier": 1}}
        )

    @task(1)
    def generate_chart(self):
        self.client.post(
            "/generate_chart",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "request": {
                    "dataset_id": 1,
                    "config": {
                        "chart_type": "table",
                        "columns": [{"name": "col1"}]
                    }
                }
            }
        )
```

**Run load test**:
```bash
locust -f locustfile.py --host https://mcp.yourcompany.com

# Test targets:
# - 100 concurrent users
# - < 2 second p95 response time
# - < 1% error rate
```

## Deployment Architecture

### Production Deployment Overview

```mermaid
graph TB
    subgraph "External"
        Clients[MCP Clients<br/>Claude, Automation Tools]
        AuthProvider[Auth Provider<br/>Auth0, Okta, Cognito]
    end

    subgraph "DMZ / Edge"
        LB[Load Balancer<br/>Nginx / ALB]
        WAF[WAF<br/>Optional]
    end

    subgraph "Application Tier"
        MCP1[MCP Instance 1]
        MCP2[MCP Instance 2]
        MCP3[MCP Instance 3]
        Superset[Superset Web Server]
    end

    subgraph "Data Tier"
        DB[(PostgreSQL<br/>Superset Metadata)]
        Redis[(Redis<br/>Cache)]
    end

    subgraph "Monitoring"
        Prometheus[Prometheus]
        Grafana[Grafana]
        Logs[Log Aggregator<br/>ELK, Splunk]
    end

    Clients --> |HTTPS| WAF
    WAF --> LB
    Clients --> |Get JWT| AuthProvider
    LB --> MCP1
    LB --> MCP2
    LB --> MCP3
    MCP1 --> DB
    MCP2 --> DB
    MCP3 --> DB
    MCP1 --> Redis
    MCP2 --> Redis
    MCP3 --> Redis
    Superset --> DB
    MCP1 -.->|Metrics| Prometheus
    MCP2 -.->|Metrics| Prometheus
    MCP3 -.->|Metrics| Prometheus
    Prometheus --> Grafana
    MCP1 -.->|Logs| Logs
    MCP2 -.->|Logs| Logs
    MCP3 -.->|Logs| Logs
```

## Deployment Guide

### Installation Requirements

**System Dependencies**:

```bash
# Ubuntu/Debian
apt-get update
apt-get install -y \
    python3.11 \
    python3.11-dev \
    python3-pip \
    build-essential \
    libssl-dev \
    libffi-dev \
    libsasl2-dev \
    libldap2-dev

# RHEL/CentOS
yum install -y \
    python311 \
    python311-devel \
    gcc \
    gcc-c++ \
    openssl-devel \
    libffi-devel
```

**Python Package Installation**:

```bash
# Create virtual environment
python3.11 -m venv /opt/superset/venv
source /opt/superset/venv/bin/activate

# Install Superset with MCP support
pip install apache-superset[fastmcp]

# Or from requirements.txt
pip install -r requirements/production.txt
```

**Verify Installation**:

```bash
superset version
superset mcp --help
```

### Configuration

**Create Production Config**:

```python
# /opt/superset/superset_config.py

# Database connection
SQLALCHEMY_DATABASE_URI = "postgresql://user:pass@db-host:5432/superset"

# Secret key (generate with: openssl rand -base64 42)
SECRET_KEY = "your-secret-key-here"

# MCP Service Configuration
MCP_AUTH_ENABLED = True
MCP_JWT_ISSUER = "https://auth.yourcompany.com"
MCP_JWT_AUDIENCE = "superset-mcp"
MCP_JWKS_URI = "https://auth.yourcompany.com/.well-known/jwks.json"
MCP_DEV_USERNAME = None  # Disable dev auth

# Service binding
MCP_SERVICE_HOST = "0.0.0.0"  # Listen on all interfaces
MCP_SERVICE_PORT = 5008

# Security settings
MCP_SESSION_CONFIG = {
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_SECURE": True,        # Requires HTTPS
    "SESSION_COOKIE_SAMESITE": "Strict",
    "PERMANENT_SESSION_LIFETIME": 3600,   # 1 hour
}

# Database connection pool
SQLALCHEMY_POOL_SIZE = 10
SQLALCHEMY_MAX_OVERFLOW = 10
SQLALCHEMY_POOL_TIMEOUT = 30

# Superset webserver address (for screenshot generation)
SUPERSET_WEBSERVER_ADDRESS = "https://superset.yourcompany.com"
WEBDRIVER_BASEURL = "https://superset.yourcompany.com/"

# Enable HTTPS
ENABLE_PROXY_FIX = True
```

**Set Environment Variables**:

```bash
# /opt/superset/.env
export SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py
export FLASK_APP=superset
```

### Process Management

#### Systemd (Recommended)

**Service File**:

```ini
# /etc/systemd/system/superset-mcp.service
[Unit]
Description=Superset MCP Service
After=network.target postgresql.service redis.service
Requires=postgresql.service

[Service]
Type=simple
User=superset
Group=superset
WorkingDirectory=/opt/superset

Environment="SUPERSET_CONFIG_PATH=/opt/superset/superset_config.py"
Environment="FLASK_APP=superset"

ExecStart=/opt/superset/venv/bin/superset mcp run --port 5008

# Restart policy
Restart=always
RestartSec=10s

# Resource limits
LimitNOFILE=65536
MemoryLimit=2G

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=superset-mcp

[Install]
WantedBy=multi-user.target
```

**Enable and Start Service**:

```bash
# Reload systemd
systemctl daemon-reload

# Enable service to start on boot
systemctl enable superset-mcp

# Start service
systemctl start superset-mcp

# Check status
systemctl status superset-mcp

# View logs
journalctl -u superset-mcp -f
```

#### Supervisord

**Configuration**:

```ini
# /etc/supervisor/conf.d/superset-mcp.conf
[program:superset-mcp]
command=/opt/superset/venv/bin/superset mcp run --port 5008
directory=/opt/superset
user=superset
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/superset/mcp.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=10
environment=SUPERSET_CONFIG_PATH="/opt/superset/superset_config.py",FLASK_APP="superset"
```

**Start Service**:

```bash
supervisorctl reread
supervisorctl update
supervisorctl start superset-mcp
supervisorctl status superset-mcp
```

#### Docker

**Dockerfile**:

```dockerfile
FROM apache/superset:latest

# Install MCP dependencies
RUN pip install apache-superset[fastmcp]

# Copy production config
COPY superset_config.py /app/pythonpath/

# Expose MCP port
EXPOSE 5008

# Run MCP service
CMD ["superset", "mcp", "run", "--port", "5008"]
```

**Build and Run**:

```bash
# Build image
docker build -t superset-mcp:latest .

# Run container
docker run -d \
  --name superset-mcp \
  -p 5008:5008 \
  -v /opt/superset/superset_config.py:/app/pythonpath/superset_config.py:ro \
  -e SUPERSET_CONFIG_PATH=/app/pythonpath/superset_config.py \
  superset-mcp:latest

# View logs
docker logs -f superset-mcp
```

#### Kubernetes

**Deployment**:

```yaml
# superset-mcp-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: superset-mcp
  labels:
    app: superset-mcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: superset-mcp
  template:
    metadata:
      labels:
        app: superset-mcp
    spec:
      containers:
      - name: mcp
        image: apache/superset:latest
        command: ["superset", "mcp", "run", "--port", "5008"]
        ports:
        - containerPort: 5008
          name: mcp
        env:
        - name: SUPERSET_CONFIG_PATH
          value: /app/pythonpath/superset_config.py
        - name: FLASK_APP
          value: superset
        volumeMounts:
        - name: config
          mountPath: /app/pythonpath
          readOnly: true
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5008
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5008
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: config
        configMap:
          name: superset-config
---
apiVersion: v1
kind: Service
metadata:
  name: superset-mcp
spec:
  selector:
    app: superset-mcp
  ports:
  - port: 5008
    targetPort: 5008
    name: mcp
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: superset-mcp-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: superset-mcp
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Deploy to Kubernetes**:

```bash
# Create ConfigMap from superset_config.py
kubectl create configmap superset-config \
  --from-file=superset_config.py=/opt/superset/superset_config.py

# Apply deployment
kubectl apply -f superset-mcp-deployment.yaml

# Check status
kubectl get pods -l app=superset-mcp
kubectl logs -l app=superset-mcp -f
```

### Reverse Proxy Configuration

#### Nginx

```nginx
# /etc/nginx/sites-available/mcp.yourcompany.com
upstream mcp_backend {
    # Health checks
    server mcp-1:5008 max_fails=3 fail_timeout=30s;
    server mcp-2:5008 max_fails=3 fail_timeout=30s;
    server mcp-3:5008 max_fails=3 fail_timeout=30s;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=mcp_limit:10m rate=100r/m;

server {
    listen 80;
    server_name mcp.yourcompany.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mcp.yourcompany.com;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/mcp.yourcompany.com.crt;
    ssl_certificate_key /etc/ssl/private/mcp.yourcompany.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/mcp-access.log combined;
    error_log /var/log/nginx/mcp-error.log warn;

    location / {
        # Rate limiting
        limit_req zone=mcp_limit burst=20 nodelay;

        # Proxy configuration
        proxy_pass http://mcp_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffering
        proxy_buffering off;
    }

    # Health check endpoint (bypass rate limiting)
    location /health {
        proxy_pass http://mcp_backend;
        access_log off;
    }
}
```

**Enable Site**:

```bash
ln -s /etc/nginx/sites-available/mcp.yourcompany.com /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### Apache

```apache
# /etc/apache2/sites-available/mcp.yourcompany.com.conf
<VirtualHost *:80>
    ServerName mcp.yourcompany.com
    Redirect permanent / https://mcp.yourcompany.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName mcp.yourcompany.com

    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/mcp.yourcompany.com.crt
    SSLCertificateKeyFile /etc/ssl/private/mcp.yourcompany.com.key
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite HIGH:!aNULL:!MD5

    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options "DENY"
    Header always set X-Content-Type-Options "nosniff"

    # Proxy configuration
    ProxyPreserveHost On
    ProxyPass / http://localhost:5008/
    ProxyPassReverse / http://localhost:5008/

    # Timeouts
    ProxyTimeout 60

    ErrorLog ${APACHE_LOG_DIR}/mcp-error.log
    CustomLog ${APACHE_LOG_DIR}/mcp-access.log combined
</VirtualHost>
```

**Enable Site**:

```bash
a2enmod ssl proxy proxy_http headers
a2ensite mcp.yourcompany.com
apachectl configtest
systemctl reload apache2
```

### Monitoring and Alerting

#### Health Checks

**Manual Health Check**:

```bash
curl https://mcp.yourcompany.com/health
```

**Expected Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-01T10:30:45.123Z",
  "version": "1.0.0"
}
```

#### Prometheus Monitoring

**Prometheus Config**:

```yaml
# /etc/prometheus/prometheus.yml
scrape_configs:
  - job_name: 'superset-mcp'
    scrape_interval: 15s
    static_configs:
      - targets: ['mcp-1:5008', 'mcp-2:5008', 'mcp-3:5008']
    metrics_path: /metrics
```

**Grafana Dashboard**:

Create dashboard with panels for:
- Request rate per tool
- Request latency (p50, p95, p99)
- Error rate
- Active connections
- Memory/CPU usage

#### Alerting Rules

**Prometheus Alerting**:

```yaml
# /etc/prometheus/rules/mcp-alerts.yml
groups:
  - name: mcp-service
    interval: 30s
    rules:
      - alert: MCPHighErrorRate
        expr: rate(mcp_requests_total{status="error"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on MCP service"
          description: "Error rate is {{ $value }} req/sec"

      - alert: MCPHighLatency
        expr: histogram_quantile(0.95, mcp_request_duration_seconds) > 2
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High latency on MCP service"
          description: "P95 latency is {{ $value }} seconds"

      - alert: MCPServiceDown
        expr: up{job="superset-mcp"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "MCP service is down"
          description: "Instance {{ $labels.instance }} is unreachable"
```

#### CloudWatch Monitoring (AWS)

**CloudWatch Agent Config**:

```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/superset/mcp.log",
            "log_group_name": "/aws/superset/mcp",
            "log_stream_name": "{instance_id}",
            "timezone": "UTC"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "SupersetMCP",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          {"name": "cpu_usage_idle", "rename": "CPU_IDLE", "unit": "Percent"}
        ],
        "totalcpu": false
      },
      "mem": {
        "measurement": [
          {"name": "mem_used_percent", "rename": "MEM_USED", "unit": "Percent"}
        ]
      }
    }
  }
}
```

**CloudWatch Alarms**:

```bash
# Create alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name mcp-high-error-rate \
  --alarm-description "MCP error rate > 5%" \
  --metric-name ErrorRate \
  --namespace SupersetMCP \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

## Migration Path (Development → Production)

### Pre-Deployment Checklist

**Configuration**:
- [ ] `MCP_AUTH_ENABLED = True`
- [ ] JWT issuer, audience, and keys configured
- [ ] `MCP_DEV_USERNAME` set to `None`
- [ ] `SESSION_COOKIE_SECURE = True`
- [ ] HTTPS enabled on load balancer/reverse proxy
- [ ] Database connection pool sized appropriately
- [ ] Superset webserver address updated for production URL

**Security**:
- [ ] TLS 1.2+ enforced
- [ ] Security headers configured (HSTS, X-Frame-Options, etc.)
- [ ] Firewall rules restrict access to MCP service
- [ ] Service account credentials rotated
- [ ] Secrets stored in secure vault (not in code)

**Monitoring**:
- [ ] Health check endpoint accessible
- [ ] Metrics exported to monitoring system
- [ ] Alerts configured for critical conditions
- [ ] Log aggregation configured
- [ ] Dashboards created for key metrics

**Performance**:
- [ ] Load testing completed successfully
- [ ] Database queries optimized
- [ ] Caching configured (if needed)
- [ ] Rate limiting enabled
- [ ] Connection pools tuned

**Operations**:
- [ ] Process manager configured (systemd/supervisord/k8s)
- [ ] Auto-restart on failure enabled
- [ ] Log rotation configured
- [ ] Backup and disaster recovery plan documented
- [ ] Runbook for common issues created

### Testing Production Setup

**1. Verify Authentication**:

```bash
# Test with valid JWT
curl -H "Authorization: Bearer VALID_TOKEN" \
     https://mcp.yourcompany.com/health

# Test with invalid JWT
curl -H "Authorization: Bearer INVALID_TOKEN" \
     https://mcp.yourcompany.com/health
# Expected: 401 Unauthorized
```

**2. Verify Authorization**:

```bash
# Test with limited permissions user
curl -H "Authorization: Bearer LIMITED_USER_TOKEN" \
     https://mcp.yourcompany.com/list_charts
# Expected: Only returns charts user can access

# Test permission denial
curl -H "Authorization: Bearer LIMITED_USER_TOKEN" \
     https://mcp.yourcompany.com/generate_dashboard
# Expected: 403 Forbidden if user lacks permission
```

**3. Verify HTTPS**:

```bash
# Should redirect to HTTPS
curl -I http://mcp.yourcompany.com

# Should work with HTTPS
curl -I https://mcp.yourcompany.com
```

**4. Verify Rate Limiting**:

```bash
# Send many requests rapidly
for i in {1..150}; do
  curl -H "Authorization: Bearer TOKEN" \
       https://mcp.yourcompany.com/health &
done
wait
# Expected: Some requests return 429 Too Many Requests
```

**5. Monitor Logs**:

```bash
# Systemd
journalctl -u superset-mcp -f

# Docker
docker logs -f superset-mcp

# Kubernetes
kubectl logs -l app=superset-mcp -f
```

### Rollback Plan

**If issues occur after deployment**:

1. **Immediate Rollback**:
   ```bash
   # Systemd
   systemctl stop superset-mcp
   # Restore previous configuration
   cp /opt/superset/superset_config.py.backup /opt/superset/superset_config.py
   systemctl start superset-mcp

   # Kubernetes
   kubectl rollout undo deployment/superset-mcp
   ```

2. **Partial Rollback** (rollback auth only):
   ```python
   # Temporarily re-enable dev auth
   MCP_AUTH_ENABLED = False
   MCP_DEV_USERNAME = "admin"
   ```

3. **Investigate and Fix**:
   - Review logs for errors
   - Check JWT configuration
   - Verify network connectivity
   - Test database connection
   - Validate Superset configuration

## Troubleshooting

### Common Issues

**Issue**: "Invalid token" errors

**Diagnosis**:
```bash
# Decode JWT to inspect claims
echo "YOUR_JWT_TOKEN" | cut -d'.' -f2 | base64 -d | jq .

# Check issuer, audience, expiration
```

**Solution**:
- Verify `MCP_JWT_ISSUER` matches token's `iss` claim
- Verify `MCP_JWT_AUDIENCE` matches token's `aud` claim
- Check token hasn't expired (`exp` claim)
- Ensure JWKS URI is accessible from MCP server

---

**Issue**: "User not found" errors

**Diagnosis**:
```bash
# Check if user exists in Superset
superset fab list-users | grep username
```

**Solution**:
- Create user in Superset: `superset fab create-user`
- Ensure JWT `sub` claim matches Superset username
- Or configure user auto-provisioning (future feature)

---

**Issue**: High latency

**Diagnosis**:
```bash
# Check database connection pool
# Look for "QueuePool limit" errors in logs
journalctl -u superset-mcp | grep -i pool

# Check database performance
# Monitor slow queries in database logs
```

**Solution**:
- Increase `SQLALCHEMY_POOL_SIZE`
- Add database indexes on frequently queried columns
- Enable query result caching
- Optimize dataset queries

---

**Issue**: Service crashes on startup

**Diagnosis**:
```bash
# Check logs
journalctl -u superset-mcp -n 100

# Common causes:
# - Missing configuration
# - Database connection failure
# - Port already in use
```

**Solution**:
- Verify all required config keys present
- Test database connection: `superset db upgrade`
- Check port availability: `netstat -tuln | grep 5008`

---

**Issue**: Permission denied errors

**Diagnosis**:
```bash
# Check user's roles
superset fab list-users | grep -A 5 username

# Check role permissions in Superset UI
# Security → List Roles → [Role Name] → Permissions
```

**Solution**:
- Grant required permissions to user's role
- Verify RLS rules not too restrictive
- Check dataset permissions

## Performance Tuning

### Database Connection Pool

**Optimal Settings** (4 workers):

```python
SQLALCHEMY_POOL_SIZE = 5          # 5 connections per worker
SQLALCHEMY_MAX_OVERFLOW = 5       # 5 extra connections when busy
# Total: 4 workers × (5 + 5) = 40 max connections
```

**Monitoring**:
```sql
-- PostgreSQL: Check active connections
SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active';

-- PostgreSQL: Check connection limit
SHOW max_connections;
```

### Caching

**Enable Redis Caching**:

```python
# superset_config.py
CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_URL": "redis://localhost:6379/1",
    "CACHE_DEFAULT_TIMEOUT": 300,
}

DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_URL": "redis://localhost:6379/2",
    "CACHE_DEFAULT_TIMEOUT": 3600,
}
```

**Cache Hit Rate Monitoring**:
```bash
# Redis: Monitor cache performance
redis-cli INFO stats | grep -E 'keyspace_hits|keyspace_misses'
```

### Request Timeouts

```python
# superset_config.py

# SQLLab query timeout
SQLLAB_TIMEOUT = 300  # 5 minutes

# SQL query timeout
SQLLAB_ASYNC_TIME_LIMIT_SEC = 300

# Superset webserver request timeout
SUPERSET_WEBSERVER_TIMEOUT = 60
```

## References

- **Superset Configuration**: https://superset.apache.org/docs/configuration/configuring-superset
- **Superset Installation**: https://superset.apache.org/docs/installation/installing-superset-from-scratch
- **FastMCP Documentation**: https://github.com/jlowin/fastmcp
- **JWT Best Practices**: https://tools.ietf.org/html/rfc8725
- **Prometheus Monitoring**: https://prometheus.io/docs/
- **Nginx Configuration**: https://nginx.org/en/docs/
- **Kubernetes Deployment**: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
