# Role-Based Access Control (RBAC) for Multi-Tenancy

## Context & Objectives

Multi-tenant Superset requires role-based access control that ensures users can only access resources (datasets, charts, dashboards) within their assigned tenant. Roles may come from OAuth claims (IdP) or be managed via Flask-AppBuilder's Security API.

**Objective**: Implement tenant-scoped RBAC that guarantees data isolation through connection and schema boundaries, with role mapping from OAuth claims to Superset permissions.

## Architecture & Components

### Role Model

#### Standard Superset Roles (Tenant-Aware)
- **Admin**: Full access to tenant resources + tenant management
- **Alpha**: Create/edit datasets, charts, dashboards within tenant
- **Gamma**: View-only access to tenant resources
- **SqlLab**: SQL Lab access with tenant schema restrictions

#### Platform Admin Role (Admin Tenant)
- **PlatformAdmin**: Cross-tenant access for platform operators
  - Can access all tenants' resources
  - Can provision new tenants
  - Can manage feature flags and default configurations
  - Can view cross-tenant monitoring and analytics
  - Can manage admin tenant templates

#### Tenant-Specific Roles (Optional)
- **`tenant_{slug}_admin`**: Admin for specific tenant only
- **`tenant_{slug}_editor`**: Editor for specific tenant only
- **`tenant_{slug}_viewer`**: Viewer for specific tenant only

### Role Sources

#### 1. OAuth Claims (Primary)
Roles come from OAuth `groups` or `roles` claim:

```json
{
  "sub": "user-123",
  "email": "user@acme.com",
  "groups": ["admin", "editor"],
  "tenant_id": "acme-corp"
}
```

**Note**: With realms, each tenant has its own realm with groups. **Group names must be consistent across all realms** for the mapping logic to work correctly. Standard group names are: "admin", "editor", "viewer", "sqllab". The isolation comes from the realm itself, not from group name prefixes.

**Mapping Logic** (in `MultiTenantSecurityManager.oauth_user_info()`):
```python
def map_oauth_roles_to_superset(self, oauth_groups: list[str]) -> list[str]:
    """
    Map OAuth groups/roles to Superset roles.
    
    **Important**: This mapping expects consistent group names across all realms.
    Standard group names that must be used in all tenant realms:
    - 'admin' → 'Admin'
    - 'editor' → 'Alpha'
    - 'viewer' → 'Gamma'
    - 'sqllab' → 'SqlLab'
    
    If a realm uses different group names, they will be treated as custom roles
    and prefixed with the tenant slug.
    
    Mapping strategy:
    - 'admin' → 'Admin'
    - 'editor' or 'editors' → 'Alpha'
    - 'viewer' or 'viewers' → 'Gamma'
    - 'sqllab' → 'SqlLab'
    - Custom/unrecognized groups: 'tenant_{slug}_{group}'
    """
    tenant = g.get('tenant')
    mapped_roles = []
    
    # Standard mapping - expects consistent group names across all realms
    role_mapping = {
        'admin': 'Admin',
        'editor': 'Alpha',
        'viewer': 'Gamma',
        'sqllab': 'SqlLab'
    }
    
    for group in oauth_groups:
        group_lower = group.lower()
        
        # Check for standard role keywords
        # Note: This requires all realms to use the same group names
        for keyword, superset_role in role_mapping.items():
            if keyword in group_lower:
                mapped_roles.append(superset_role)
                break
        else:
            # Custom tenant-specific role (for non-standard group names)
            mapped_roles.append(f"tenant_{tenant.slug}_{group}")
    
    return list(set(mapped_roles))  # Deduplicate
```

#### 2. Flask-AppBuilder Security API (Fallback/Override)
Admins can assign roles via Superset UI or API:

```python
# Via API
POST /api/v1/security/users/{user_id}/roles
{
  "role_ids": [1, 2]  # Admin, Alpha role IDs
}
```

**Priority**: OAuth claims take precedence on login, but FAB-assigned roles persist and are merged.

### Data Isolation Guarantees

#### 1. Connection-Level Isolation
Each tenant has a dedicated database connection (`db_sqlalchemy_uri`). Users can only access databases associated with their tenant:

```python
from superset.models.core import Database
from flask import g
from superset.security.manager import security_manager

def get_tenant_databases():
    """Return databases for current tenant (or all if platform admin)"""
    user = security_manager.get_user()
    tenant = g.get('tenant')
    
    # Platform admins can access all tenants
    if tenant and tenant.is_admin_tenant and user.has_role('PlatformAdmin'):
        return db.session.query(Database).all()
    
    # Regular users: only their tenant's databases
    tenant_id = g.get('tenant_id')
    return db.session.query(Database).filter(
        Database.extra.contains(f'"tenant_id": {tenant_id}')
    ).all()
```

**Query Filtering**:
- All database queries filtered by `tenant_id` in `extra` JSON field
- SQL Lab queries restricted to tenant's database connections
- Dataset queries use tenant's database connection
- **Exception**: PlatformAdmin users in admin tenant can access all databases

#### 2. Schema-Level Isolation
Tenants may share a database but use different schemas:

```python
# Set default schema for tenant connection
def get_tenant_engine(tenant: Tenant):
    """Get SQLAlchemy engine with tenant schema"""
    engine = create_engine(tenant.db_sqlalchemy_uri)
    
    # Set default schema
    if tenant.default_schema:
        with engine.connect() as conn:
            conn.execute(text(f"SET search_path TO {tenant.default_schema}"))
    
    return engine
```

**Schema Enforcement**:
- All queries use tenant's `default_schema`
- Row-level security (RLS) filters by schema if needed
- Dataset SQL includes schema qualification

#### 3. Row-Level Security (RLS)
Additional filtering via Superset's RLS feature:

```python
# RLS filter for tenant isolation
def get_tenant_rls_filter(tenant: Tenant) -> str:
    """Generate RLS filter SQL for tenant"""
    return f"tenant_id = '{tenant.slug}'"
```

**RLS Integration**:
- Apply tenant RLS filter to all dataset queries
- Merge with user-defined RLS filters
- Enforce at query execution time

### Permission Model

#### View Menu Permissions
- **Tenant Resources**: `[Tenant: {slug}]` view menu
  - `can_read on [Tenant: acme-corp]`
  - `can_write on [Tenant: acme-corp]`
  - `can_delete on [Tenant: acme-corp]`

#### Dataset Permissions
- Datasets inherit tenant permissions
- Users can only access datasets in their tenant's database

#### Dashboard Permissions
- Dashboards scoped to tenant
- Users can only view/edit dashboards with tenant association

### Implementation Components

#### 1. Tenant-Aware Permission View
```python
from superset.security.manager import SupersetSecurityManager

class MultiTenantSecurityManager(SupersetSecurityManager):
    def get_user_datasets(self, user) -> list:
        """Return datasets accessible to user (tenant-scoped, or all if platform admin)"""
        tenant = g.get('tenant')
        tenant_id = g.get('tenant_id')
        
        # Platform admins can access all datasets
        if tenant and tenant.is_admin_tenant and user.has_role('PlatformAdmin'):
            datasets = db.session.query(SqlaTable).all()
        elif tenant_id:
            # Regular users: only their tenant's datasets
            datasets = db.session.query(SqlaTable).filter(
                SqlaTable.extra.contains(f'"tenant_id": {tenant_id}')
            ).all()
        else:
            return []
        
        # Apply permission filtering
        accessible = []
        for dataset in datasets:
            if self.can_access('can_read', 'Dataset', dataset.id, user):
                accessible.append(dataset)
        
        return accessible
    
    def can_access_tenant(self, user, target_tenant_id: int) -> bool:
        """Check if user can access a specific tenant"""
        user_tenant_id = getattr(g.get('tenant'), 'id', None) if g.get('tenant') else None
        
        # Platform admins can access all tenants
        if user.has_role('PlatformAdmin'):
            return True
        
        # Regular users can only access their own tenant
        return user_tenant_id == target_tenant_id
```

#### 2. Tenant Context Middleware
```python
from flask import g, request

def enforce_tenant_isolation():
    """Ensure all queries are tenant-scoped"""
    tenant_id = g.get('tenant_id')
    if not tenant_id:
        abort(403, "Tenant not identified")
    
    # Set tenant context for SQL queries
    g.tenant_context = {
        'tenant_id': tenant_id,
        'default_schema': g.tenant.default_schema
    }
```

#### 3. Query Modification
```python
from superset.connectors.sqla.models import SqlaTable

def modify_query_for_tenant(query: str, tenant: Tenant) -> str:
    """Add tenant isolation to SQL query"""
    # If query doesn't specify schema, add tenant's default schema
    if tenant.default_schema and 'FROM ' in query.upper():
        # Simple heuristic: prepend schema to table names
        # (More sophisticated parsing would use SQLGlot)
        query = query.replace('FROM ', f'FROM {tenant.default_schema}.')
    
    return query
```

## Design Principles & Patterns

### Strategy Pattern
- **RoleMappingStrategy**: Abstract base for role mapping (OAuth vs FAB)
- **OAuthRoleMappingStrategy**: Map OAuth claims to roles
- **FABRoleMappingStrategy**: Use FAB Security API roles

### Decorator Pattern
- **@tenant_required**: Decorator to enforce tenant context
- **@tenant_scoped_query**: Decorator to add tenant filtering to queries

### Facade Pattern
- **TenantRBACFacade**: Simplified interface for tenant-aware permission checks

## Testing Plan

### Unit Tests
- `test_oauth_role_mapping()` - OAuth groups to Superset roles
- `test_tenant_databases_filtering()` - Only tenant databases returned
- `test_schema_isolation()` - Queries use tenant schema
- `test_rls_tenant_filter()` - RLS includes tenant filter

### Integration Tests
- `test_user_can_only_access_tenant_resources()` - Full isolation test
- `test_cross_tenant_access_denied()` - Verify no cross-tenant access
- `test_role_permissions()` - Admin/Alpha/Gamma permissions within tenant

### E2E Tests (Playwright)
- `test_tenant_user_can_view_datasets()` - User sees only tenant datasets
- `test_tenant_user_cannot_access_other_tenant()` - Access denied for wrong tenant
- `test_role_based_access()` - Different roles have different permissions

## Compatibility & Versioning

- **Feature Flag**: `MULTI_TENANCY_ENABLED` (default: False)
- **Backward Compatibility**: When disabled, standard Superset RBAC applies
- **Role Migration**: Existing roles work, new tenant-scoped roles optional
- **Breaking Changes**: None - additive feature

## Security Considerations

- **Tenant Isolation**: Critical - no cross-tenant data access
- **Role Validation**: Verify OAuth roles are valid for tenant
- **Query Injection**: Parameterized queries, schema validation
- **Permission Escalation**: Prevent users from accessing Admin functions outside tenant
- **Audit Logging**: Log all permission checks and access attempts
- **Group Name Standardization**: All realms must use consistent group names ("admin", "editor", "viewer", "sqllab") for mapping to work correctly

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cross-tenant data leakage | Critical | Multiple layers: connection, schema, RLS filtering |
| OAuth role mapping errors | High | Default to least privilege (Gamma), validation |
| Schema injection | High | Validate schema names, use parameterized queries |
| Permission bypass | Critical | Test all query paths, audit logging |

## Contribution Plan

- **PR Title**: `feat(multitenancy): tenant-scoped RBAC with OAuth role mapping`
- **Labels**: `enhancement`, `multitenancy`, `security`, `rbac`
- **Artifacts**:
  - Tenant-aware permission methods
  - OAuth role mapping logic
  - Query filtering for tenant isolation
  - Unit/integration/E2E tests
  - Security documentation

