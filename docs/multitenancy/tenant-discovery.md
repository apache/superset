# Tenant Discovery Architecture

## Context & Objectives

Multi-tenant Superset requires tenant identification from incoming requests to route users to the correct OAuth provider, database connection, and schema. This document defines the tenant discovery mechanism that enables schema/connection isolation per tenant.

**Objective**: Implement subdomain-based tenant discovery that maps incoming requests to tenant configuration stored in the metadata database, enabling dynamic OAuth provider selection and database connection routing.

## Architecture & Components

### Discovery Pattern: Subdomain-Based Routing

**Pattern**: `{tenant-slug}.mydomain.com`

- **Example**: `acme-corp.mydomain.com` → tenant slug: `acme-corp`
- **Fallback**: Root domain (`mydomain.com`) requires explicit tenant selection or defaults to admin tenant
- **Wildcard DNS**: Configure `*.mydomain.com` to point to Superset load balancer

### Tenants Table Schema

```sql
CREATE TABLE tenants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid VARCHAR(36) UNIQUE NOT NULL,  -- UUID for external API exposure
    slug VARCHAR(255) UNIQUE NOT NULL,  -- Subdomain identifier (e.g., "acme-corp")
    name VARCHAR(255) NOT NULL,          -- Display name
    is_admin_tenant BOOLEAN DEFAULT FALSE,  -- Admin tenant flag (platform operators)
    oauth_issuer VARCHAR(512) NOT NULL,  -- OAuth2/OIDC issuer URL
    client_id VARCHAR(255) NOT NULL,     -- OAuth client ID
    client_secret TEXT NOT NULL,         -- Encrypted OAuth client secret
    scopes TEXT,                         -- Comma-separated OAuth scopes
    db_sqlalchemy_uri TEXT NOT NULL,     -- Encrypted SQLAlchemy connection URI
    default_schema VARCHAR(255),         -- Default schema for this tenant
    is_active BOOLEAN DEFAULT TRUE,      -- Soft delete flag
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_fk INTEGER,
    changed_by_fk INTEGER
);
```

**Indexes**:
- `UNIQUE(slug)` - Fast lookup by subdomain
- `INDEX(is_active)` - Filter active tenants
- `INDEX(is_admin_tenant)` - Fast lookup for admin tenant

### Admin Tenant

The **Admin tenant** is a special tenant with platform-wide privileges:

- **Privileges**: Has access to all tenants for platform operations (provisioning, monitoring, configuration)
- **Templates**: Holds default connection templates, dashboard templates, and dataset templates
- **Configuration**: Manages feature flags, roles, and default configurations common to all tenants
- **OAuth**: Optionally serves as the OAuth realm for platform administrators
- **Discovery**: Root domain (`mydomain.com`) defaults to admin tenant if no subdomain specified
- **Initialization**: Automatically created during `superset init` when `MULTI_TENANCY_ENABLED=True`

**Admin Tenant Characteristics**:
- `is_admin_tenant = TRUE` in database
- Typically uses slug `admin` or `platform`
- Can access cross-tenant resources via special permissions
- Owns template assets that are cloned during tenant provisioning
- Created automatically during Superset initialization (not via API)

### Request Flow

```
┌─────────────────┐
│ Incoming Request│
│ {tenant}.domain │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ Middleware:             │
│ extract_tenant_slug()  │
│ from request.host       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Query Tenants table:    │
│ WHERE slug = ?          │
│ AND is_active = TRUE    │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │ Found?  │
    └────┬────┘
         │
    ┌────┴────┐
    │   NO    │───► Error: Tenant not found (404)
    │   YES   │
    └────┬────┘
         │
         ▼
┌─────────────────────────┐
│ Set Flask g.tenant:     │
│ g.tenant = tenant_obj    │
│ g.tenant_id = tenant.id │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ SecurityManager:        │
│ Select OAuth provider   │
│ from g.tenant           │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Database Connection:     │
│ Use g.tenant.db_uri     │
│ Set default_schema      │
└─────────────────────────┘
```

### Implementation Components

#### 1. Flask Middleware (`superset/middleware/tenant.py`)

```python
from flask import g, request
from superset.models.multitenancy import Tenant
from superset import db

def extract_tenant_from_request():
    """Extract tenant slug from subdomain and set g.tenant"""
    host = request.host.lower()
    
    # Extract subdomain (e.g., "acme-corp" from "acme-corp.mydomain.com")
    parts = host.split('.')
    if len(parts) >= 3:  # subdomain.domain.tld
        tenant_slug = parts[0]
    else:
        # Root domain - check for explicit tenant header or default to admin tenant
        tenant_slug = request.headers.get('X-Tenant-Slug')
        if not tenant_slug:
            # Default to admin tenant for root domain
            tenant_slug = app.config.get('ADMIN_TENANT_SLUG', 'admin')
    
    if tenant_slug:
        tenant = db.session.query(Tenant).filter(
            Tenant.slug == tenant_slug,
            Tenant.is_active == True
        ).first()
        
        if tenant:
            g.tenant = tenant
            g.tenant_id = tenant.id
            g.tenant_slug = tenant.slug
        else:
            # Tenant not found - will be handled by error handler
            g.tenant = None
```

#### 2. Tenant Model (`superset/models/multitenancy.py`)

```python
from superset.models.helpers import AuditMixinNullable, ImportExportMixin
from superset.extensions import encrypted_field_factory
from flask_appbuilder import Model
from sqlalchemy import Column, String, Text, Boolean, Integer

class Tenant(Model, AuditMixinNullable, ImportExportMixin):
    __tablename__ = 'tenants'
    
    slug = Column(String(255), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    is_admin_tenant = Column(Boolean, default=False, nullable=False)
    oauth_issuer = Column(String(512), nullable=False)
    client_id = Column(String(255), nullable=False)
    client_secret = Column(Text, nullable=False)  # Encrypted
    scopes = Column(Text)  # Comma-separated
    db_sqlalchemy_uri = Column(Text, nullable=False)  # Encrypted
    default_schema = Column(String(255))
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Encrypted fields
    _client_secret = encrypted_field_factory(Column(Text))
    _db_sqlalchemy_uri = encrypted_field_factory(Column(Text))
    
    @property
    def is_admin(self) -> bool:
        """Check if this is the admin tenant"""
        return self.is_admin_tenant
    
    @classmethod
    def get_admin_tenant(cls):
        """Get the admin tenant"""
        return db.session.query(cls).filter(
            cls.is_admin_tenant == True,
            cls.is_active == True
        ).first()
```

## Design Principles & Patterns

### Strategy Pattern
- **TenantDiscoveryStrategy**: Abstract base for different discovery methods (subdomain, header, path-based)
- **SubdomainDiscoveryStrategy**: Current implementation
- **HeaderDiscoveryStrategy**: For API clients (future)

### Factory Pattern
- **TenantConnectionFactory**: Creates database connections with tenant-specific URIs and schemas

### Single Responsibility
- Middleware: Extract tenant from request
- Model: Store tenant configuration
- SecurityManager: Use tenant for OAuth selection

## Testing Plan

### Unit Tests
- `test_extract_tenant_from_subdomain()` - Valid subdomain extraction
- `test_tenant_not_found()` - Error handling for missing tenant
- `test_default_tenant_fallback()` - Root domain fallback to admin tenant
- `test_admin_tenant_identification()` - Admin tenant flag detection

### Integration Tests
- `test_request_with_tenant_subdomain()` - Full request flow with tenant
- `test_oauth_provider_selection()` - Verify correct OAuth provider used
- `test_database_connection_routing()` - Verify tenant-specific DB connection

### E2E Tests (Playwright)
- `test_tenant_login_flow()` - Complete login flow with tenant subdomain
- `test_tenant_not_found_ux()` - Error page display for invalid tenant

## Compatibility & Versioning

- **Feature Flag**: `MULTI_TENANCY_ENABLED` (default: False)
- **Backward Compatibility**: When disabled, all requests use default tenant configuration
- **Migration**: Add `tenants` table via Alembic migration
- **Breaking Changes**: None - opt-in feature

## Security Considerations

- **Tenant Isolation**: Ensure no cross-tenant data leakage
- **SQL Injection**: Use parameterized queries for tenant lookup
- **Subdomain Validation**: Whitelist allowed characters in slug (alphanumeric + hyphen)
- **Rate Limiting**: Per-tenant rate limits to prevent abuse

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tenant slug collision | High | Database UNIQUE constraint + validation |
| DNS misconfiguration | Medium | Health check endpoint per tenant |
| Performance on lookup | Low | Cache tenant objects in Redis (TTL: 5min) |
| Missing tenant in request | Medium | Clear error page with support contact |

## Contribution Plan

- **PR Title**: `feat(multitenancy): subdomain-based tenant discovery`
- **Labels**: `enhancement`, `multitenancy`, `security`
- **Artifacts**:
  - Database migration for `tenants` table
  - Middleware implementation
  - Tenant model with encrypted fields
  - Unit/integration tests
  - Documentation updates

