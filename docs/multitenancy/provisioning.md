# Tenant Provisioning Architecture

## Context & Objectives

Tenant provisioning automates the creation of tenant-specific database connections, datasets, charts, and dashboards. This enables rapid onboarding of new tenants with pre-configured analytics assets. The **Admin tenant** holds default connection templates, dashboard templates, and dataset templates that are cloned into new tenants during provisioning.

**Note**: The Admin tenant is automatically created during Superset initialization (`superset init`) when `MULTI_TENANCY_ENABLED` is `True`. See [Admin Tenant Initialization](#admin-tenant-initialization) section below.

**Objective**: Provide idempotent API endpoints for tenant provisioning that create database connections and import asset bundles (datasets, charts, dashboards) with proper error handling and rollback capabilities. Support cloning templates from the Admin tenant.

## Architecture & Components

### Provisioning Flow

```
┌─────────────────┐
│ POST /api/v1/   │
│ tenant/provision│
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ 1. Create Tenant Record │
│    (if not exists)      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 2. Get Admin Tenant     │
│    Templates            │
│    (connection, assets) │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 3. Clone Connection     │
│    Template             │
│    (replace placeholders│
│     with tenant values) │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 4. Create Database      │
│    Connection           │
│    POST /api/v1/database│
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 5. Clone Asset Templates│
│    (dashboards,         │
│     datasets, charts)   │
│    from Admin Tenant    │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │ Success?│
    └────┬────┘
         │
    ┌────┴────┐
    │   NO    │───► Rollback: Delete DB, tenant
    │   YES   │
    └────┬────┘
         │
         ▼
┌─────────────────────────┐
│ 6. Return Provisioning  │
│    Status & Details     │
└─────────────────────────┘
```

### API Endpoints

#### 1. Provision Tenant (`POST /api/v1/tenant/provision`)

**Request Schema**:
```json
{
  "tenant": {
    "slug": "acme-corp",
    "name": "Acme Corporation",
    "oauth_issuer": "https://acme.okta.com/oauth2/default",
    "client_id": "0oa1abc2def3ghi4jkl",
    "client_secret": "secret-123",
    "scopes": "openid,profile,email",
    "db_sqlalchemy_uri": "postgresql://user:pass@host:5432/acme_db",
    "default_schema": "acme_schema"
  },
  "database": {
    "database_name": "Acme Corp Database",
    "expose_in_sqllab": true,
    "allow_ctas": true,
    "allow_cvas": true,
    "allow_dml": false,
    "allow_run_async": true,
    "cache_timeout": 3600,
    "configuration_method": "sqlalchemy_form"
  },
  "assets": {
    "bundle_path": "/path/to/tenant-assets.zip",  // Optional: custom bundle
    "use_admin_templates": true,  // Clone from admin tenant templates
    "template_tags": ["default"],  // Which template tags to clone
    "overwrite": true,
    "passwords": {}
  },
  "connection_template": {
    "use_admin_template": true,  // Use admin tenant connection template
    "template_name": "postgresql-default",  // Template identifier
    "placeholders": {  // Replace in template
      "database_name": "acme_db",
      "host": "db.example.com",
      "port": 5432
    }
  },
  "idempotency_key": "provision-acme-2024-01-15"  // Optional
}
```

**Response Schema**:
```json
{
  "tenant_id": 1,
  "tenant_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "database_id": 5,
  "provisioning_status": "completed",
  "assets_imported": {
    "datasets": 12,
    "charts": 8,
    "dashboards": 3
  },
  "warnings": []
}
```

**Idempotency**:
- If `idempotency_key` provided and provisioning exists, return existing result
- If tenant with same `slug` exists, update instead of create (if `overwrite: true`)

### Database vs Schema Isolation

**Important**: The provisioning process creates a Superset Database Connection (metadata object), not an actual database. The actual database or schema must exist before provisioning.

**Isolation Patterns**:

1. **Separate Database Pattern** (Full Isolation):
   - Each tenant has its own database
   - `db_sqlalchemy_uri` points to different databases
   - Example: `postgresql://host:5432/acme_db` vs `postgresql://host:5432/contoso_db`
   - **Pros**: Maximum isolation, easier backup/restore per tenant
   - **Cons**: More database instances to manage

2. **Shared Database, Schema Isolation** (Cost-Effective):
   - Tenants share the same database
   - `db_sqlalchemy_uri` points to the same database
   - `default_schema` differentiates tenants
   - Example: Both use `postgresql://host:5432/shared_db` but `default_schema` is `acme_schema` vs `contoso_schema`
   - **Pros**: Fewer database instances, lower cost
   - **Cons**: Requires careful schema management, less isolation

**Connection Template Examples**:

```json
// Separate database pattern
{
  "sqlalchemy_uri": "postgresql://{user}:{password}@{host}:{port}/{database_name}",
  "placeholders": {
    "database_name": "acme_db"  // Different per tenant
  }
}

// Shared database, schema isolation pattern
{
  "sqlalchemy_uri": "postgresql://{user}:{password}@{host}:{port}/shared_db",
  "default_schema": "acme_schema"  // Different per tenant
}
```

**Pre-Provisioning Requirements**:
- Database must exist (for separate database pattern)
- Schema must exist (for shared database pattern)
- User credentials must have access to the database/schema

#### 2. Create Database Connection (`POST /api/v1/database`)

**Reused from Superset Core**: Use existing database creation API with tenant-specific URI.

**Note**: This creates a Superset Database Connection object (metadata), not an actual database. The database/schema referenced in `db_sqlalchemy_uri` must already exist.

**Implementation**:
```python
from superset.commands.database.create import CreateDatabaseCommand
from superset.commands.database.exceptions import DatabaseInvalidError

def create_tenant_database(tenant: Tenant, db_config: dict) -> Database:
    """
    Create database connection for tenant.
    
    Note: This creates a Superset Database Connection (metadata object),
    not an actual database. The database/schema must exist before calling this.
    
    Args:
        tenant: Tenant object with db_sqlalchemy_uri and default_schema
        db_config: Database configuration (database_name, expose_in_sqllab, etc.)
    
    Returns:
        Database: Superset Database Connection object
    """
    try:
        # Use tenant's SQLAlchemy URI (points to existing database/schema)
        db_config['sqlalchemy_uri'] = tenant.db_sqlalchemy_uri
        
        # Create database connection via Superset command
        # This validates the connection but does not create the database
        command = CreateDatabaseCommand(db_config)
        database = command.run()
        
        # Associate database connection with tenant
        database.extra = json.dumps({
            **json.loads(database.extra or '{}'),
            'tenant_id': tenant.id,
            'tenant_slug': tenant.slug,
            'default_schema': tenant.default_schema
        })
        db.session.commit()
        
        return database
    except DatabaseInvalidError as e:
        logger.error(f"Failed to create database connection for tenant {tenant.slug}: {e}")
        raise
```

#### 3. Clone Admin Tenant Templates

**Admin Tenant Templates**: The admin tenant stores template assets that are cloned during provisioning.

**Template Storage**:
- Templates stored in admin tenant with `is_template = TRUE` flag
- Templates tagged (e.g., "default", "enterprise", "basic")
- Connection templates with placeholders (e.g., `{database_name}`, `{host}`, `{port}`)

**Implementation**:
```python
from superset.models.multitenancy import Tenant
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.connectors.sqla.models import SqlaTable

def clone_admin_templates(tenant: Tenant, template_tags: list[str] = None) -> dict:
    """Clone templates from admin tenant to new tenant"""
    admin_tenant = Tenant.get_admin_tenant()
    if not admin_tenant:
        raise ValueError("Admin tenant not found")
    
    template_tags = template_tags or ['default']
    
    # Clone dashboards
    admin_dashboards = db.session.query(Dashboard).filter(
        Dashboard.extra.contains('"is_template": true'),
        Dashboard.extra.contains(f'"template_tags": {json.dumps(template_tags)}')
    ).all()
    
    cloned_dashboards = []
    for admin_dashboard in admin_dashboards:
        cloned = clone_dashboard(admin_dashboard, tenant)
        cloned_dashboards.append(cloned)
    
    # Clone datasets
    admin_datasets = db.session.query(SqlaTable).filter(
        SqlaTable.extra.contains('"is_template": true'),
        SqlaTable.extra.contains(f'"template_tags": {json.dumps(template_tags)}')
    ).all()
    
    cloned_datasets = []
    for admin_dataset in admin_datasets:
        cloned = clone_dataset(admin_dataset, tenant)
        cloned_datasets.append(cloned)
    
    # Clone charts (linked to cloned datasets)
    cloned_charts = []
    for admin_dataset in admin_datasets:
        admin_charts = db.session.query(Slice).filter(
            Slice.datasource_id == admin_dataset.id,
            Slice.datasource_type == 'table'
        ).all()
        for admin_chart in admin_charts:
            cloned = clone_chart(admin_chart, tenant, cloned_datasets)
            cloned_charts.append(cloned)
    
    db.session.commit()
    
    return {
        'datasets': len(cloned_datasets),
        'charts': len(cloned_charts),
        'dashboards': len(cloned_dashboards)
    }

def clone_connection_template(tenant: Tenant, template_name: str, placeholders: dict) -> dict:
    """
    Clone connection template from admin tenant with placeholder replacement.
    
    Note: This creates a Superset Database Connection (metadata object),
    not an actual database. The database/schema referenced in the resulting
    URI must already exist.
    
    Args:
        tenant: Target tenant for the connection
        template_name: Name of the connection template in admin tenant
        placeholders: Dictionary of placeholder values to replace in template URI
    
    Returns:
        Database: Superset Database Connection object
    """
    admin_tenant = Tenant.get_admin_tenant()
    
    # Get connection template from admin tenant
    template = db.session.query(Database).filter(
        Database.extra.contains(f'"is_template": true'),
        Database.extra.contains(f'"template_name": "{template_name}"')
    ).first()
    
    if not template:
        raise ValueError(f"Connection template '{template_name}' not found")
    
    # Replace placeholders in SQLAlchemy URI
    # Example: postgresql://{user}:{password}@{host}:{port}/{database_name}
    # becomes: postgresql://acme_user:pass@db.example.com:5432/acme_db
    template_uri = template.sqlalchemy_uri
    for key, value in placeholders.items():
        template_uri = template_uri.replace(f"{{{key}}}", str(value))
    
    # Create database connection for tenant
    # The database/schema must exist before this call
    db_config = {
        'sqlalchemy_uri': template_uri,
        'database_name': placeholders.get('database_name', f"{tenant.name} Database"),
        'expose_in_sqllab': template.extra.get('expose_in_sqllab', True),
        'allow_ctas': template.extra.get('allow_ctas', True),
        'allow_cvas': template.extra.get('allow_cvas', True),
        'allow_dml': template.extra.get('allow_dml', False),
        'allow_run_async': template.extra.get('allow_run_async', True),
    }
    
    return create_tenant_database(tenant, db_config)
```

#### 4. Import Asset Bundle (`POST /api/v1/assets/import`)

**Reused from Superset Core**: Use existing asset import API for custom bundles.

**Bundle Structure**:
```
tenant-assets.zip
├── metadata.yaml          # Bundle metadata
├── databases/             # Database definitions
│   └── database_1.yaml
├── datasets/              # Dataset definitions
│   ├── dataset_1.yaml
│   └── dataset_2.yaml
├── charts/                # Chart definitions
│   ├── chart_1.yaml
│   └── chart_2.yaml
└── dashboards/            # Dashboard definitions
    └── dashboard_1.yaml
```

**Implementation**:
```python
from superset.commands.importers.v1.assets import ImportAssetsCommand

def import_tenant_assets(tenant: Tenant, bundle_path: str, overwrite: bool = True) -> dict:
    """Import asset bundle for tenant (alternative to template cloning)"""
    try:
        # Set tenant context for import
        g.tenant = tenant
        g.tenant_id = tenant.id
        
        # Import assets
        command = ImportAssetsCommand(
            contents=load_bundle(bundle_path),
            overwrite=overwrite,
            passwords={}  # Passwords should be provided separately
        )
        result = command.run()
        
        # Update imported assets with tenant association
        for dataset in result.get('datasets', []):
            dataset.extra = json.dumps({
                **json.loads(dataset.extra or '{}'),
                'tenant_id': tenant.id
            })
        
        db.session.commit()
        
        return {
            'datasets': len(result.get('datasets', [])),
            'charts': len(result.get('charts', [])),
            'dashboards': len(result.get('dashboards', []))
        }
    except Exception as e:
        logger.error(f"Failed to import assets for tenant {tenant.slug}: {e}")
        raise
```

### Idempotency & Overwrite Semantics

**Idempotency Key**:
- Store in `provisioning_logs` table with key, tenant_id, status, timestamp
- If key exists and status is "completed", return cached result
- If key exists and status is "failed", retry provisioning

**Overwrite Behavior**:
- **Tenant**: If tenant with same slug exists, update (if `overwrite: true`) or error
- **Database**: If database connection exists for tenant, update URI/config
- **Assets**: Use Superset's import `overwrite` flag (default: true)

### Rollback on Failure

**Transaction Management**:
```python
from sqlalchemy.exc import SQLAlchemyError

@db.session.begin_nested()  # Savepoint
def provision_tenant(provisioning_request: dict) -> dict:
    try:
        # 1. Create/update tenant
        tenant = create_or_update_tenant(provisioning_request['tenant'])
        
        # 2. Create database (from template or direct config)
        if provisioning_request.get('connection_template', {}).get('use_admin_template'):
            # Clone connection template from admin tenant
            database = clone_connection_template(
                tenant,
                provisioning_request['connection_template']['template_name'],
                provisioning_request['connection_template']['placeholders']
            )
        else:
            # Use direct database configuration
            database = create_tenant_database(tenant, provisioning_request['database'])
        
        # 3. Import assets (from templates or custom bundle)
        assets_config = provisioning_request.get('assets', {})
        if assets_config.get('use_admin_templates'):
            # Clone templates from admin tenant
            assets_result = clone_admin_templates(
                tenant,
                template_tags=assets_config.get('template_tags', ['default'])
            )
        elif assets_config.get('bundle_path'):
            # Import custom asset bundle
            assets_result = import_tenant_assets(
                tenant, 
                assets_config['bundle_path'],
                overwrite=assets_config.get('overwrite', True)
            )
        else:
            # No assets to import
            assets_result = {'datasets': 0, 'charts': 0, 'dashboards': 0}
        
        # Commit all changes
        db.session.commit()
        
        return {
            'tenant_id': tenant.id,
            'database_id': database.id,
            'assets_imported': assets_result,
            'status': 'completed'
        }
    except Exception as e:
        # Rollback to savepoint
        db.session.rollback()
        logger.error(f"Provisioning failed: {e}")
        
        # Cleanup: Delete tenant if it was just created
        if tenant and tenant.id and not tenant_existed_before:
            db.session.delete(tenant)
            db.session.commit()
        
        raise ProvisioningError(f"Failed to provision tenant: {e}")
```

**Partial Failure Handling**:
- If database creation fails: Rollback tenant creation
- If asset import fails: Keep tenant and database, log warning, return partial success

### Admin Tenant Initialization

The admin tenant is automatically created during Superset initialization when `MULTI_TENANCY_ENABLED` is `True`.

**Implementation Location**: `superset/initialization/__init__.py` in `SupersetAppInitializer.init_app_in_ctx()`

**Initialization Logic**:
```python
def init_app_in_ctx(self) -> None:
    """Runs init logic in the context of the app"""
    # ... existing initialization ...
    
    # Initialize multi-tenancy if enabled
    if feature_flag_manager.is_feature_enabled("MULTI_TENANCY_ENABLED"):
        from superset.commands.tenant.init import InitAdminTenantCommand
        
        try:
            command = InitAdminTenantCommand()
            command.run()
            logger.info("Admin tenant initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize admin tenant: {e}")
            raise
```

**InitAdminTenantCommand**:
```python
from superset.models.multitenancy import Tenant
from superset import db
from flask import current_app
import logging

logger = logging.getLogger(__name__)

class InitAdminTenantCommand:
    """Initialize admin tenant during Superset startup"""
    
    def run(self) -> Tenant:
        """Create admin tenant if it doesn't exist"""
        # Check if admin tenant already exists
        admin_tenant = Tenant.get_admin_tenant()
        if admin_tenant:
            logger.info("Admin tenant already exists, skipping initialization")
            return admin_tenant
        
        # Get configuration
        config = current_app.config.get('ADMIN_TENANT_CONFIG', {})
        
        # Create admin tenant
        admin_tenant = Tenant(
            slug=config.get('slug', 'admin'),
            name=config.get('name', 'Platform Administration'),
            is_admin_tenant=True,
            oauth_issuer=config.get('oauth_issuer', ''),
            client_id=config.get('client_id', ''),
            client_secret=config.get('client_secret', ''),
            scopes=config.get('scopes', 'openid,profile,email,platform_admin'),
            db_sqlalchemy_uri=config.get('db_sqlalchemy_uri', ''),
            default_schema=config.get('default_schema', 'public'),
            is_active=True
        )
        
        db.session.add(admin_tenant)
        db.session.commit()
        
        logger.info(f"Admin tenant '{admin_tenant.slug}' created successfully")
        return admin_tenant
```

**Configuration**:
- Admin tenant config can be set via `ADMIN_TENANT_CONFIG` in `superset_config.py`
- Environment variables can override config values
- If not configured, uses sensible defaults (but OAuth and DB URI should be provided)

**Example Configuration**:
```python
# In superset_config.py
FEATURE_FLAGS = {
    'MULTI_TENANCY_ENABLED': True,
}

ADMIN_TENANT_CONFIG = {
    'slug': 'admin',
    'name': 'Platform Administration',
    'oauth_issuer': os.environ.get('ADMIN_TENANT_OAUTH_ISSUER'),
    'client_id': os.environ.get('ADMIN_TENANT_CLIENT_ID'),
    'client_secret': os.environ.get('ADMIN_TENANT_CLIENT_SECRET'),
    'scopes': 'openid,profile,email,platform_admin',
    'db_sqlalchemy_uri': os.environ.get('ADMIN_TENANT_DB_URI'),
    'default_schema': 'public',
}
```

## Design Principles & Patterns

### Command Pattern
- **ProvisionTenantCommand**: Encapsulates provisioning logic
- **RollbackProvisioningCommand**: Undo provisioning on failure

### Transaction Pattern
- Use database savepoints for atomic provisioning
- Rollback on any failure

### Factory Pattern
- **TenantProvisioningFactory**: Creates provisioning commands with different strategies

## Testing Plan

### Unit Tests
- `test_create_tenant_database()` - Database creation with tenant URI
- `test_import_tenant_assets()` - Asset bundle import
- `test_idempotency_key()` - Idempotent provisioning
- `test_overwrite_behavior()` - Overwrite vs error on existing tenant

### Integration Tests
- `test_provision_tenant_full_flow()` - Complete provisioning flow
- `test_provisioning_rollback()` - Rollback on database creation failure
- `test_provisioning_rollback_on_import_failure()` - Partial rollback

### E2E Tests (Playwright)
- `test_tenant_provisioning_api()` - API endpoint testing
- `test_provisioned_tenant_login()` - Verify provisioned tenant works

## Compatibility & Versioning

- **Feature Flag**: `MULTI_TENANCY_ENABLED` (default: False)
- **API Version**: `/api/v1/tenant/provision` (new endpoint)
- **Backward Compatibility**: Existing `/api/v1/database` and `/api/v1/assets/import` unchanged
- **Breaking Changes**: None

## Security Considerations

- **Authentication**: Require Admin role or special `provision_tenant` permission
- **Authorization**: Verify requester has permission to create tenants
- **Secret Handling**: Encrypt `client_secret` and `db_sqlalchemy_uri` in database
- **Input Validation**: Validate SQLAlchemy URI format, OAuth issuer URL
- **Audit Logging**: Log all provisioning operations with user, tenant, timestamp

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Database connection failure | High | Validate URI before creating tenant record |
| Asset import failure | Medium | Partial success, retry mechanism |
| Idempotency key collision | Low | Use UUID-based keys, check before provisioning |
| Rollback failure | Critical | Manual cleanup procedure, monitoring alerts |

## Contribution Plan

- **PR Title**: `feat(multitenancy): tenant provisioning API with asset import`
- **Labels**: `enhancement`, `multitenancy`, `api`
- **Artifacts**:
  - `/api/v1/tenant/provision` endpoint
  - Provisioning command class
  - Rollback logic
  - Unit/integration/E2E tests
  - API documentation (OpenAPI spec)

