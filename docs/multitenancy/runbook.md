# Multi-Tenancy Operational Runbook

## Context & Objectives

This runbook provides operational procedures for managing multi-tenant Superset deployments, including tenant lifecycle management, secret rotation, health checks, and monitoring.

**Objective**: Document step-by-step procedures for common operational tasks to ensure reliable multi-tenant Superset operations.

## Operational Procedures

### 0. Setup Admin Tenant (Automatic Initialization)

The Admin tenant is automatically created during Superset initialization if `MULTI_TENANCY_ENABLED` feature flag is `True`. This happens when running `superset init` or during app startup.

#### Automatic Creation

The admin tenant is created in `SupersetAppInitializer.init_app_in_ctx()` when:
- `MULTI_TENANCY_ENABLED` feature flag is `True`
- Admin tenant does not already exist

**Configuration Required** (in `superset_config.py`):

```python
# Enable multi-tenancy
FEATURE_FLAGS = {
    'MULTI_TENANCY_ENABLED': True,
}

# Admin tenant configuration
ADMIN_TENANT_CONFIG = {
    'slug': 'admin',  # Default: 'admin'
    'name': 'Platform Administration',
    'oauth_issuer': os.environ.get('ADMIN_TENANT_OAUTH_ISSUER', 'https://platform.okta.com/oauth2/default'),
    'client_id': os.environ.get('ADMIN_TENANT_CLIENT_ID', ''),
    'client_secret': os.environ.get('ADMIN_TENANT_CLIENT_SECRET', ''),
    'scopes': os.environ.get('ADMIN_TENANT_SCOPES', 'openid,profile,email,platform_admin'),
    'db_sqlalchemy_uri': os.environ.get('ADMIN_TENANT_DB_URI', 'postgresql://admin:pass@localhost:5432/platform_db'),
    'default_schema': os.environ.get('ADMIN_TENANT_SCHEMA', 'public'),
}
```

#### Initialization Process

**0.1. Run Superset Init**
```bash
# Initialize Superset (creates admin tenant if MULTI_TENANCY_ENABLED=True)
superset init
```

**0.2. Verify Admin Tenant Created**
```bash
# Check admin tenant exists
curl http://localhost:8088/api/v1/tenant/admin \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**0.3. Test Admin Tenant Access**
```bash
curl -I https://admin.mydomain.com/health
```

#### Manual Override (If Needed)

If automatic initialization fails or you need to customize the admin tenant, you can create it manually via API (see section 1 below), but this should only be necessary in exceptional cases.

#### Post-Initialization: Create Templates

After admin tenant is created, you can create connection and asset templates:

**0.4. Create Connection Templates**
```bash
# Create a PostgreSQL connection template
curl -X POST http://localhost:8088/api/v1/database \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "database_name": "PostgreSQL Template",
    "sqlalchemy_uri": "postgresql://{user}:{password}@{host}:{port}/{database_name}",
    "extra": {
      "is_template": true,
      "template_name": "postgresql-default",
      "template_tags": ["default"],
      "placeholders": ["user", "password", "host", "port", "database_name"]
    }
  }'
```

**0.5. Create Dashboard/Dataset Templates**
- Create dashboards, datasets, and charts in admin tenant
- Mark them as templates by setting `is_template: true` in `extra` JSON
- Tag templates (e.g., `template_tags: ["default", "enterprise"]`)

### 1. Add New Tenant

#### Prerequisites
- Admin access to Superset
- Tenant OAuth provider configured (Okta, Azure AD, etc.)
- Database connection details for tenant
- Asset bundle (optional) for pre-convisioned datasets/charts/dashboards

#### Steps

**1.1. Gather Tenant Information**
```bash
# Required information:
TENANT_SLUG="acme-corp"
TENANT_NAME="Acme Corporation"
OAUTH_ISSUER="https://acme.okta.com/oauth2/default"
OAUTH_CLIENT_ID="0oa1abc2def3ghi4jkl"
OAUTH_CLIENT_SECRET="secret-123"
OAUTH_SCOPES="openid,profile,email"
DB_URI="postgresql://user:pass@host:5432/acme_db"
DEFAULT_SCHEMA="acme_schema"
```

**1.2. Provision Tenant via API**

**Option A: Using Admin Tenant Templates (Recommended)**
```bash
curl -X POST http://localhost:8088/api/v1/tenant/provision \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": {
      "slug": "'$TENANT_SLUG'",
      "name": "'$TENANT_NAME'",
      "oauth_issuer": "'$OAUTH_ISSUER'",
      "client_id": "'$OAUTH_CLIENT_ID'",
      "client_secret": "'$OAUTH_CLIENT_SECRET'",
      "scopes": "'$OAUTH_SCOPES'",
      "db_sqlalchemy_uri": "'$DB_URI'",
      "default_schema": "'$DEFAULT_SCHEMA'"
    },
    "connection_template": {
      "use_admin_template": true,
      "template_name": "postgresql-default",
      "placeholders": {
        "user": "acme_user",
        "password": "acme_pass",
        "host": "db.example.com",
        "port": 5432,
        "database_name": "acme_db"
      }
    },
    "assets": {
      "use_admin_templates": true,
      "template_tags": ["default"]
    },
    "idempotency_key": "provision-'$TENANT_SLUG'-'$(date +%Y-%m-%d)'"
  }'
```

**Option B: Direct Configuration (No Templates)**
```bash
curl -X POST http://localhost:8088/api/v1/tenant/provision \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant": {
      "slug": "'$TENANT_SLUG'",
      "name": "'$TENANT_NAME'",
      "oauth_issuer": "'$OAUTH_ISSUER'",
      "client_id": "'$OAUTH_CLIENT_ID'",
      "client_secret": "'$OAUTH_CLIENT_SECRET'",
      "scopes": "'$OAUTH_SCOPES'",
      "db_sqlalchemy_uri": "'$DB_URI'",
      "default_schema": "'$DEFAULT_SCHEMA'"
    },
    "database": {
      "database_name": "'$TENANT_NAME' Database",
      "expose_in_sqllab": true,
      "allow_ctas": true,
      "allow_cvas": true,
      "allow_dml": false,
      "allow_run_async": true
    },
    "assets": {
      "bundle_path": "/path/to/tenant-assets.zip",
      "overwrite": true
    },
    "idempotency_key": "provision-'$TENANT_SLUG'-'$(date +%Y-%m-%d)'"
  }'
```

**1.3. Verify Tenant Creation**
```bash
# Check tenant exists
curl http://localhost:8088/api/v1/tenant/$TENANT_SLUG \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Test OAuth login
curl -I https://$TENANT_SLUG.mydomain.com/login/oauth
```

**1.4. Test Tenant Access**
1. Navigate to `https://$TENANT_SLUG.mydomain.com`
2. Verify OAuth login redirects to correct IdP
3. Complete OAuth flow
4. Verify user can access tenant-specific datasets/dashboards

#### Troubleshooting

**Issue**: Tenant not found after creation
- **Check**: Verify DNS configured for `*.mydomain.com`
- **Check**: Verify tenant `is_active = TRUE` in database
- **Fix**: `UPDATE tenants SET is_active = TRUE WHERE slug = '$TENANT_SLUG';`

**Issue**: OAuth login fails
- **Check**: Verify OAuth client credentials in tenant record
- **Check**: Verify OAuth issuer URL is accessible
- **Check**: Verify redirect URI matches Superset URL

### 2. Rotate OAuth Client Secret

#### Steps

**2.1. Update Secret in OAuth Provider**
- Update client secret in IdP (Okta, Azure AD, etc.)
- Note new secret value

**2.2. Update Tenant Record**
```bash
# Via API (recommended)
curl -X PATCH http://localhost:8088/api/v1/tenant/$TENANT_SLUG \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "client_secret": "new-secret-456"
  }'
```

**Or via Database (if API unavailable)**:
```sql
-- Update encrypted client_secret
UPDATE tenants 
SET client_secret = encrypt('new-secret-456'),
    updated_at = CURRENT_TIMESTAMP,
    changed_by_fk = (SELECT id FROM ab_user WHERE username = 'admin')
WHERE slug = 'acme-corp';
```

**2.3. Verify Secret Rotation**
```bash
# Test OAuth login with new secret
curl -I https://$TENANT_SLUG.mydomain.com/login/oauth
```

**2.4. Monitor for Errors**
- Check application logs for OAuth authentication errors
- Monitor error rate for tenant in monitoring dashboard

#### Rollback Procedure
If new secret causes issues:
```sql
-- Revert to previous secret
UPDATE tenants 
SET client_secret = encrypt('old-secret-123'),
    updated_at = CURRENT_TIMESTAMP
WHERE slug = 'acme-corp';
```

### 3. Deprovision Tenant

#### Steps

**3.1. Backup Tenant Data (Optional)**
```bash
# Export tenant assets
curl http://localhost:8088/api/v1/assets/export/?q=\(tenant_id:1\) \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o tenant-backup.zip
```

**3.2. Deactivate Tenant**
```bash
# Soft delete (recommended)
curl -X PATCH http://localhost:8088/api/v1/tenant/$TENANT_SLUG \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

**3.3. Delete Tenant Resources (Optional)**
```bash
# Delete database connection
curl -X DELETE http://localhost:8088/api/v1/database/$DATABASE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Delete datasets, charts, dashboards (via API or SQL)
# Note: This is destructive and should be done carefully
```

**3.4. Hard Delete Tenant Record (Optional)**
```sql
-- WARNING: This permanently deletes tenant
-- Only do this after confirming all resources are removed
DELETE FROM tenants WHERE slug = 'acme-corp';
```

### 4. Health Checks & Monitoring

#### Health Check Endpoints

**4.1. Global Health Check**
```bash
curl http://localhost:8088/health
# Returns: {"status": "healthy"}
```

**4.2. Tenant-Specific Health Check**
```bash
curl https://$TENANT_SLUG.mydomain.com/health
# Returns: {
#   "status": "healthy",
#   "tenant": "acme-corp",
#   "database": "connected",
#   "oauth": "configured"
# }
```

**4.3. Database Connection Health**
```bash
curl http://localhost:8088/api/v1/tenant/$TENANT_SLUG/health/database \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Returns: {
#   "status": "connected",
#   "response_time_ms": 45
# }
```

**4.4. OAuth Provider Health**
```bash
curl http://localhost:8088/api/v1/tenant/$TENANT_SLUG/health/oauth \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Returns: {
#   "status": "configured",
#   "issuer_accessible": true
# }
```

#### Monitoring Metrics

**Key Metrics**:
- `superset.tenant.active_count` - Number of active tenants
- `superset.tenant.provisioning.duration` - Time to provision tenant
- `superset.tenant.auth.failure_rate` - OAuth authentication failure rate per tenant
- `superset.tenant.database.connection_errors` - Database connection errors per tenant
- `superset.tenant.request.count` - Request count per tenant

**Prometheus Query Examples**:
```promql
# Tenant request rate
rate(superset_tenant_request_count[5m])

# OAuth failure rate by tenant
rate(superset_tenant_auth_failures_total[5m]) / rate(superset_tenant_auth_attempts_total[5m])

# Database connection errors
sum(superset_tenant_database_connection_errors) by (tenant_slug)
```

#### Alerting Rules

**Critical Alerts**:
- Tenant database connection down for > 5 minutes
- OAuth authentication failure rate > 10% for any tenant
- Tenant provisioning failure

**Warning Alerts**:
- Tenant database response time > 1 second (p95)
- Tenant request error rate > 1%

### 5. Troubleshooting Common Issues

#### Issue: Tenant Not Found (404)

**Symptoms**:
- Users see "Tenant not found" error page
- Requests to `{tenant}.mydomain.com` fail

**Diagnosis**:
```sql
-- Check if tenant exists and is active
SELECT slug, name, is_active, created_at 
FROM tenants 
WHERE slug = 'acme-corp';
```

**Resolution**:
1. Verify tenant exists: `SELECT * FROM tenants WHERE slug = 'acme-corp';`
2. Verify tenant is active: `UPDATE tenants SET is_active = TRUE WHERE slug = 'acme-corp';`
3. Verify DNS: `dig acme-corp.mydomain.com`
4. Check middleware logs for tenant extraction errors

#### Issue: OAuth Authentication Fails

**Symptoms**:
- Users cannot log in via OAuth
- OAuth redirect fails or returns error

**Diagnosis**:
```bash
# Check tenant OAuth configuration
curl http://localhost:8088/api/v1/tenant/$TENANT_SLUG \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.oauth_issuer, .client_id'

# Test OAuth issuer accessibility
curl -I $OAUTH_ISSUER/.well-known/openid-configuration
```

**Resolution**:
1. Verify OAuth issuer URL is correct and accessible
2. Verify client_id and client_secret match IdP configuration
3. Verify redirect URI in IdP matches Superset URL
4. Check OAuth scopes are correct
5. Review application logs for OAuth errors

#### Issue: Database Connection Errors

**Symptoms**:
- Queries fail with connection errors
- Datasets cannot be loaded

**Diagnosis**:
```sql
-- Check database connection for tenant
SELECT id, database_name, sqlalchemy_uri 
FROM dbs 
WHERE extra::jsonb->>'tenant_id' = '1';
```

**Resolution**:
1. Verify database URI is correct: Test connection manually
2. Check database server is accessible from Superset
3. Verify credentials are correct (may need to rotate)
4. Check database connection pool settings
5. Review database server logs

#### Issue: Cross-Tenant Data Leakage

**Symptoms**:
- Users see data from other tenants
- Queries return wrong tenant's data

**Critical**: This is a security issue - investigate immediately!

**Diagnosis**:
```sql
-- Check tenant isolation in queries
-- Verify all datasets have tenant_id in extra JSON
SELECT id, table_name, extra::jsonb->>'tenant_id' as tenant_id
FROM tables
WHERE extra::jsonb->>'tenant_id' IS NULL;
```

**Resolution**:
1. Immediately disable affected tenant(s)
2. Review query logs for cross-tenant access
3. Verify RLS filters are applied
4. Verify schema isolation is working
5. Fix any queries that bypass tenant filtering
6. Re-enable tenant after fix verified

### 6. Maintenance Procedures

#### Database Maintenance

**Vacuum Tenant Databases**:
```sql
-- For PostgreSQL tenants
VACUUM ANALYZE;
```

**Connection Pool Cleanup**:
```python
# Restart Superset to clear connection pools
# Or use connection pool management API
```

#### Log Rotation

**Application Logs**:
```bash
# Rotate logs for tenant-specific logging
logrotate /etc/logrotate.d/superset-tenant
```

**Audit Logs**:
```sql
-- Archive old audit logs (older than 90 days)
DELETE FROM ab_permission_view_log 
WHERE created_on < NOW() - INTERVAL '90 days';
```

## Design Principles

- **Idempotency**: All operations should be idempotent (safe to retry)
- **Auditability**: All operations logged with user, timestamp, tenant
- **Rollback**: Critical operations have rollback procedures
- **Monitoring**: All operations have health checks and metrics

## Security Considerations

- **Secret Management**: Use encrypted storage for OAuth secrets and DB URIs
- **Access Control**: Only Admins can provision/deprovision tenants
- **Audit Logging**: Log all tenant management operations
- **Secret Rotation**: Regular rotation of OAuth client secrets

## Contribution Plan

- **PR Title**: `docs(multitenancy): operational runbook for tenant management`
- **Labels**: `documentation`, `multitenancy`, `operations`
- **Artifacts**:
  - This runbook document
  - Health check endpoint implementations
  - Monitoring dashboard configuration
  - Alerting rules (Prometheus)

