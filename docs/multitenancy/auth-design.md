# Authentication Design for Multi-Tenancy

## Context & Objectives

Multi-tenant Superset requires dynamic OAuth provider selection based on the tenant identified from the request. Each tenant may use a different OAuth2/OIDC provider (e.g., Okta, Azure AD, Google Workspace) with tenant-specific client credentials. The **Admin tenant** serves as the OAuth realm for platform administrators and has special privileges.

**Objective**: Extend `SupersetSecurityManager` to dynamically select and configure OAuth providers per tenant, map OAuth claims to Superset users/roles, handle authentication errors gracefully, and support admin tenant with platform-wide privileges.

## Architecture & Components

### CustomSecurityManager Responsibilities

```
┌─────────────────────────────────────┐
│ MultiTenantSecurityManager         │
│ extends SupersetSecurityManager    │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │                      │
    ▼                      ▼
┌─────────────┐    ┌──────────────┐
│ OAuth       │    │ User/Role    │
│ Provider    │    │ Mapping      │
│ Selection   │    │              │
└─────────────┘    └──────────────┘
```

#### 1. Dynamic OAuth Provider Selection

**Method**: `get_oauth_provider_config(tenant)`

```python
class MultiTenantSecurityManager(SupersetSecurityManager):
    def get_oauth_provider_config(self, tenant: Tenant) -> dict:
        """Return OAuth configuration from tenant record"""
        # Admin tenant may use different OAuth configuration
        if tenant.is_admin_tenant:
            # Admin tenant OAuth for platform operators
            return {
                'OAUTH_PROVIDER': 'generic',  # or 'okta', 'azure', etc.
                'OAUTH_PROVIDER_NAME': f"{tenant.name} (Platform Admin)",
                'OAUTH_BASE_URL': tenant.oauth_issuer,
                'OAUTH_CLIENT_ID': tenant.client_id,
                'OAUTH_CLIENT_SECRET': tenant.client_secret,
                'OAUTH_SCOPES': tenant.scopes.split(',') if tenant.scopes else ['openid', 'profile', 'email', 'platform_admin'],
                'OAUTH_AUTHORIZATION_URL': f"{tenant.oauth_issuer}/authorize",
                'OAUTH_TOKEN_URL': f"{tenant.oauth_issuer}/token",
                'OAUTH_USERINFO_URL': f"{tenant.oauth_issuer}/userinfo",
            }
        else:
            # Regular tenant OAuth
            return {
                'OAUTH_PROVIDER': 'generic',  # or 'okta', 'azure', etc.
                'OAUTH_PROVIDER_NAME': tenant.name,
                'OAUTH_BASE_URL': tenant.oauth_issuer,
                'OAUTH_CLIENT_ID': tenant.client_id,
                'OAUTH_CLIENT_SECRET': tenant.client_secret,
                'OAUTH_SCOPES': tenant.scopes.split(',') if tenant.scopes else ['openid', 'profile', 'email'],
                'OAUTH_AUTHORIZATION_URL': f"{tenant.oauth_issuer}/authorize",
                'OAUTH_TOKEN_URL': f"{tenant.oauth_issuer}/token",
                'OAUTH_USERINFO_URL': f"{tenant.oauth_issuer}/userinfo",
            }
```

**Integration Point**: Override `init_oauth()` to configure provider before Flask-AppBuilder OAuth initialization.

#### 2. OAuth User Info Mapping

**Method**: `oauth_user_info(provider, response)`

```python
def oauth_user_info(self, provider: str, response: dict) -> dict:
    """
    Map OAuth claims to Superset user attributes.
    
    Expected response structure (varies by provider):
    {
        'sub': 'user-id-123',
        'email': 'user@example.com',
        'name': 'John Doe',
        'preferred_username': 'jdoe',
        'groups': ['viewers', 'editors'],  # Role mapping
        'tenant_id': 'acme-corp'  # Optional: verify tenant match
    }
    """
    tenant = g.get('tenant')
    if not tenant:
        raise ValueError("Tenant not set in request context")
    
    # Admin tenant users get special platform admin role
    is_platform_admin = tenant.is_admin_tenant and 'platform_admin' in response.get('groups', [])
    
    # Verify tenant claim matches (if provided by IdP) - skip for admin tenant
    if not tenant.is_admin_tenant and 'tenant_id' in response:
        if response['tenant_id'] != tenant.slug:
            raise ValueError(f"Tenant mismatch: expected {tenant.slug}, got {response['tenant_id']}")
    
    # Map claims to Superset user model
    role_keys = self.map_oauth_roles_to_superset(response.get('groups', []))
    
    # Admin tenant users get platform admin privileges
    if is_platform_admin:
        role_keys.append('PlatformAdmin')  # Special role for cross-tenant access
    
    user_info = {
        'username': response.get('preferred_username') or response.get('email').split('@')[0],
        'email': response.get('email'),
        'first_name': response.get('given_name') or response.get('name', '').split()[0],
        'last_name': response.get('family_name') or response.get('name', '').split()[-1] if ' ' in response.get('name', '') else '',
        'role_keys': role_keys,
        'tenant_id': tenant.id,  # Store tenant association
        'is_platform_admin': is_platform_admin,  # Flag for platform admin privileges
    }
    
    return user_info

def map_oauth_roles_to_superset(self, oauth_groups: list[str]) -> list[str]:
    """
    Map OAuth groups/roles to Superset roles.
    
    Mapping strategy:
    - 'admin' → 'Admin'
    - 'editor' or 'editors' → 'Alpha'
    - 'viewer' or 'viewers' → 'Gamma'
    - Custom roles: 'tenant_{slug}_admin', 'tenant_{slug}_editor', etc.
    """
    tenant = g.get('tenant')
    mapped_roles = []
    
    for group in oauth_groups:
        group_lower = group.lower()
        if 'admin' in group_lower:
            mapped_roles.append('Admin')
        elif 'editor' in group_lower:
            mapped_roles.append('Alpha')
        elif 'viewer' in group_lower:
            mapped_roles.append('Gamma')
        else:
            # Custom tenant-specific role
            mapped_roles.append(f"tenant_{tenant.slug}_{group}")
    
    # Default to Gamma if no roles found
    if not mapped_roles:
        mapped_roles.append('Gamma')
    
    return list(set(mapped_roles))  # Deduplicate
```

#### 3. Session & CSRF Handling

**Session Configuration**:
- **Session Cookie Domain**: Set to root domain (`.mydomain.com`) to share sessions across subdomains
- **Session Key Prefix**: Include tenant ID to prevent cross-tenant session access
- **CSRF Token**: Include tenant validation in CSRF token generation

```python
# In config.py or superset_config.py
SESSION_COOKIE_DOMAIN = '.mydomain.com'  # Shared across subdomains
SESSION_COOKIE_NAME = 'superset_session'
SESSION_KEY_PREFIX = 'tenant_{tenant_id}_'  # Set dynamically per request

# CSRF protection
WTF_CSRF_ENABLED = True
WTF_CSRF_TIME_LIMIT = 3600
```

**Implementation**:
```python
from flask import session

def before_request():
    """Set tenant-specific session prefix"""
    tenant = g.get('tenant')
    if tenant:
        session.permanent = True
        # Session key includes tenant to prevent cross-tenant access
        session['tenant_id'] = tenant.id
```

#### 4. Fallback/Error UX

**Tenant Not Found**:
- **HTTP Status**: 404 Not Found
- **Template**: `superset/templates/tenant_not_found.html`
- **Message**: "The tenant '{slug}' could not be found. Please contact your administrator."

**OAuth Provider Error**:
- **HTTP Status**: 401 Unauthorized
- **Template**: `superset/templates/oauth_error.html`
- **Message**: "Authentication failed for tenant '{tenant_name}'. Please try again or contact support."

**Tenant Mismatch**:
- **HTTP Status**: 403 Forbidden
- **Message**: "Your account is not authorized for this tenant."

**Implementation**:
```python
from flask import render_template, abort

@app.errorhandler(404)
def tenant_not_found(error):
    if g.get('tenant') is None and request.host != app.config.get('ROOT_DOMAIN'):
        return render_template('tenant_not_found.html', 
                             slug=extract_tenant_slug_from_host()), 404
    return error

@app.errorhandler(401)
def oauth_error(error):
    tenant = g.get('tenant')
    if tenant:
        return render_template('oauth_error.html', 
                              tenant_name=tenant.name), 401
    return error
```

## Design Principles & Patterns

### Strategy Pattern
- **OAuthProviderStrategy**: Abstract base for provider-specific implementations
- **GenericOAuthStrategy**: Standard OAuth2/OIDC
- **OktaOAuthStrategy**: Okta-specific claim mapping (future)
- **AzureADOAuthStrategy**: Azure AD-specific mapping (future)

### Adapter Pattern
- **OAuthClaimAdapter**: Adapts provider-specific claims to Superset user model

### Factory Pattern
- **OAuthProviderFactory**: Creates provider-specific OAuth handlers

## Testing Plan

### Unit Tests
- `test_get_oauth_provider_config()` - Verify correct config from tenant
- `test_oauth_user_info_mapping()` - Claim to user attribute mapping
- `test_role_mapping()` - OAuth groups to Superset roles
- `test_tenant_mismatch_detection()` - Reject wrong tenant claims

### Integration Tests
- `test_oauth_login_flow()` - Complete OAuth flow with tenant
- `test_session_isolation()` - Verify sessions don't leak across tenants
- `test_csrf_validation()` - CSRF tokens include tenant validation

### E2E Tests (Playwright)
- `test_tenant_login_success()` - User can log in via tenant OAuth
- `test_tenant_not_found_page()` - Error page displays correctly
- `test_oauth_error_handling()` - OAuth failures show appropriate error

## Compatibility & Versioning

- **Feature Flag**: `MULTI_TENANCY_ENABLED` (default: False)
- **Backward Compatibility**: When disabled, uses standard `SupersetSecurityManager`
- **Configuration**: `CUSTOM_SECURITY_MANAGER = MultiTenantSecurityManager` (opt-in)
- **Breaking Changes**: None - extends existing security manager

## Security Considerations

- **Tenant Isolation**: Users can only authenticate for their assigned tenant
- **Session Security**: Tenant ID in session prevents cross-tenant access
- **CSRF Protection**: Tokens include tenant validation
- **OAuth Secret Storage**: Encrypted in database using Superset's encryption
- **Token Validation**: Verify OAuth tokens are issued by correct tenant's IdP

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth provider misconfiguration | High | Validation on tenant creation, health checks |
| Session leakage across tenants | Critical | Tenant ID in session key, validation on every request |
| Role mapping errors | Medium | Default to least privilege (Gamma), audit logging |
| IdP downtime | High | Graceful error messages, retry logic |

## Contribution Plan

- **PR Title**: `feat(multitenancy): dynamic OAuth provider selection per tenant`
- **Labels**: `enhancement`, `multitenancy`, `security`, `authentication`
- **Artifacts**:
  - `MultiTenantSecurityManager` class
  - OAuth user info mapping logic
  - Error templates for tenant/oauth errors
  - Unit/integration/E2E tests
  - Documentation updates

