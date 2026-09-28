# Quiver Semantic Layer OAuth Implementation Plan

## Objective

Enable semantic layer extensions such as Quiver to store and use OAuth2 tokens
without exposing those tokens to browser code and without requiring a semantic
layer row to exist before authorization begins.

The design uses `extension_storage` as the permanent token store. Tokens are
written directly during the OAuth callback for every user, including the admin
creating the semantic layer. It does not use a temporary KV escrow.

## Target Architecture

```text
Semantic Layer configuration
        |
        +-- Quiver settings produce stable credential_key
        |
        +-- "Connect to Quiver"
        |      +-- OAuth2 + PKCE
        |             +-- callback
        |                    +-- extension_storage
        |                        extension = netflix.quiver
        |                        user      = current user
        |                        access    = backend
        |                        key       = oauth2:v1:<credential hash>
        |                        encrypted = true
        |
        +-- Create Semantic Layer
               +-- uses the same credential_key
```

The admin creating the semantic layer follows the same OAuth path as every
other user. The credential is associated with the extension, current user, and
a stable Quiver credential identity rather than a semantic layer UUID.

## 1. Add a Backend-Only Secrets Namespace

Expose a dedicated Python-only API:

```python
ctx.storage.secrets.get(key)
ctx.storage.secrets.set(key, value)
ctx.storage.secrets.remove(key)
```

This is preferable to adding `backend_only=True` to the ordinary persistent
accessor because it provides safer defaults:

- It exists only in Python.
- It always encrypts values.
- It is always user-scoped.
- It has no `.shared` accessor.
- It does not support listing.
- It cannot accidentally become available in the TypeScript SDK.
- Ordinary `ctx.storage.persistent` behavior remains unchanged.

### Storage Model

Modify `superset/extensions/storage/persistent_model.py` and the corresponding
core model declaration to add:

```python
access: str  # "frontend" or "backend"
```

Existing rows receive `access="frontend"`.

The logical identity becomes:

```text
(extension_id, user_fk, resource_type, resource_uuid, access, key)
```

Including `access` in the lookup identity allows a browser-visible value and a
backend secret to use the same key without allowing frontend `PUT`, `GET`, or
`DELETE` requests to reveal whether the secret exists.

Use an application-level enum backed by a portable string column rather than a
database enum:

```python
class StorageAccess(str, Enum):
    FRONTEND = "frontend"
    BACKEND = "backend"
```

Update:

- `superset/extensions/storage/persistent_model.py`
- `superset-core/src/superset_core/extensions/storage/models.py`
- `superset/extensions/storage/persistent_dao.py`
- Extension storage lookup indexes and unique constraint
- A new migration under `superset/migrations/versions/`

The migration should:

1. Add `access`, non-null, with a server default of `frontend`.
2. Replace the scoped lookup index with one containing `access`.
3. Replace the scoped unique constraint with one containing `access`.
4. Preserve every existing row as frontend-visible.
5. On downgrade, delete backend-only entries before removing the column;
   converting them to frontend-visible entries would expose secrets.

### Secrets API

Add a new core interface, likely at:

```text
superset-core/src/superset_core/extensions/storage/secrets.py
```

Add `secrets` to:

- `superset-core/src/superset_core/extensions/context.py`
- `superset/extensions/context.py`
- The storage injection in `superset/core/api/core_api_injection.py`

The host implementation should call the DAO with:

```python
access=StorageAccess.BACKEND
encrypt=True
user_fk=current_user_id
codec="json"
```

Do not expose backend access in:

- `superset-frontend/packages/superset-core/src/storage/index.ts`
- REST request parameters
- REST request bodies

### DAO Invariants

DAO methods should always receive an access class, defaulting to `FRONTEND`
for backward compatibility.

The secrets accessor must enforce encryption internally. It must not accept an
option that permits `encrypt=False`.

Quota accounting should continue to include both frontend and backend entries.

## 2. Make the Browser API Blind to Backend Entries

Update `superset/extensions/storage/api.py` so every persistent REST operation
is hard-coded to `access=FRONTEND`.

Required behavior:

- `GET`: a backend-only entry behaves as if it does not exist.
- `list`: backend entries are excluded before count, pagination, and payload
  size calculation.
- `PUT`: writes only to the frontend namespace.
- `DELETE`: removes only from the frontend namespace.
- No response reveals the backend key, codec, size, encryption flag, or
  existence.
- Supplying `access`, `backend_only`, or similar fields must not change the
  namespace.

Because access is part of the logical key, frontend `PUT` does not need to
reject a colliding backend key. It creates or updates an independent frontend
entry.

### Storage Tests

Extend:

- `tests/unit_tests/extensions/storage/test_api.py`
- `tests/unit_tests/extensions/storage/test_persistent.py`
- `tests/unit_tests/extensions/storage/test_persistent_dao.py`
- `tests/unit_tests/extensions/storage/test_context.py`

Cover:

- Secret round-trip for the current user.
- Separation between two users.
- Separation between two extensions.
- Forced encryption.
- Absence of a shared secret accessor.
- Browser `GET` cannot read a secret.
- Browser `list` omits secrets and reports the filtered count.
- Browser `DELETE` does not remove a secret.
- Browser `PUT` cannot overwrite a secret.
- Frontend and backend entries can coexist at the same key.
- Unauthenticated use fails closed.
- Existing and migrated rows remain frontend-visible.

## 3. Restore Extension Context During Semantic Layer Execution

Storage depends on ambient extension context, but semantic layer providers are
registered during extension loading and invoked later, outside that loading
context.

The registration process must retain the owning extension manifest.

Update:

- `superset/semantic_layers/registry.py`
- Semantic layer decorator injection in
  `superset/core/api/core_api_injection.py`
- `superset/semantic_layers/models.py`
- Class-level registry consumers in `superset/semantic_layers/api.py`
- Create and update commands under `superset/commands/semantic_layer/`

A registry entry should retain:

```python
@dataclass(frozen=True)
class RegisteredSemanticLayer:
    implementation: type[SemanticLayer]
    extension_manifest: Manifest | None
```

Host semantic layers have `extension_manifest=None`.

### Contextual Adapters

Avoid relying on scattered `with extension_context(...)` calls. Introduce
explicit adapters for:

- Semantic layer class operations
- Semantic layer instances
- Semantic view instances returned by a layer

Each adapter enters the saved extension context before invoking the provider.

Explicit adapters implementing the semantic layer protocols are preferable to
a generic `__getattr__` proxy. When a new protocol method is added, typing and
tests will then show that its context forwarding is missing.

The wrapper must cover at least:

- `from_configuration`
- Configuration schema generation
- Runtime schema generation
- Semantic view discovery
- `get_semantic_view`
- Metrics and dimensions
- Compatible metrics and dimensions
- Values lookup
- Query and table generation
- Row count
- Feature or property access that can call extension code

Tests belong in:

- `tests/unit_tests/semantic_layers/decorators_test.py`
- `tests/unit_tests/semantic_layers/models_test.py`
- A focused new contextual execution test module

The test extension should call `get_context()` and `ctx.storage.secrets` from
both a layer and a returned view.

## 4. Carry the Initiating User Into Background Execution

Extension identity alone is insufficient because personal tokens require the
initiating user.

The execution context should support an explicit principal ID:

```python
extension_context(manifest, user_id=user_id)
```

`get_current_user_id()` should:

1. Prefer the explicit execution principal.
2. Fall back to the authenticated Flask user during request execution.
3. Fail if neither exists.

For async chart and query paths, propagate the initiating user already present
in query or task metadata into the semantic layer execution context. Never
fall back to:

- The semantic layer creator
- The admin who configured it
- The Celery worker or service account

This is required by Superset's async security model: a worker is a continuation
of the initiating principal.

Embedded guests and anonymous or Public users have no personal Quiver token
and should fail closed unless Quiver later defines a separate service credential
design.

## 5. Add Generic Semantic Layer Connection Actions

The semantic layer modal needs a way to initiate OAuth before a `SemanticLayer`
row exists. This should be a generic contribution rather than a Quiver-specific
button in Superset.

Add a typed semantic layer action contract to `superset-core`, for example:

```python
@dataclass(frozen=True)
class SemanticLayerAction:
    id: str
    label: str
    status: Literal["required", "connected", "expired", "error"]
    required: bool
    message: str | None = None
```

Provider hooks could be:

```python
get_configuration_actions(configuration)
execute_configuration_action(action_id, configuration, return_url)
```

The default implementation returns no actions, preserving existing providers.

### API Shape

Extend the existing configuration schema response:

```json
{
  "result": { "...": "JSON schema" },
  "actions": [
    {
      "id": "oauth2",
      "label": "Connect to Quiver",
      "status": "required",
      "required": true
    }
  ]
}
```

Add protected endpoints for executing actions:

```text
POST /api/v1/semantic_layer/type/<type>/actions/<action_id>
POST /api/v1/semantic_layer/<uuid>/actions/<action_id>
GET  /api/v1/semantic_layer/<uuid>/actions
```

The type endpoint supports pre-creation setup and receives partial
configuration. It should require semantic layer write permission.

The UUID endpoint supports existing users connecting their own account. It
should require read access to the semantic layer or data source, rather than
edit permission, because connecting a personal token does not modify the
semantic layer.

The action returns an OAuth authorization URL or a same-origin redirect
response, never a token.

Class hooks and action execution must run through the extension context
adapter.

## 6. Update the Semantic Layer Frontend

Update
`superset-frontend/src/features/semanticLayers/SemanticLayerModal.tsx` to:

1. Read `actions` from the schema response.
2. Render a standard `@superset-ui/core/components` button and status.
3. Send the partial configuration when starting the action.
4. Open the OAuth flow in a popup or redirect.
5. Poll or refetch schema and action status after completion.
6. Disable creation while a required action is not connected.
7. Never receive or store access or refresh tokens.

Update
`superset-frontend/src/features/semanticLayers/SemanticLayerModal.test.tsx`
for:

- Providers without actions.
- A required disconnected action.
- Successful connection and schema refresh.
- Popup cancellation.
- OAuth failure.
- A required action blocking creation.
- Edit-mode reconnection.

For existing users, add a reusable Connect action surfaced when the semantic
layer reports that authentication is required. A typed
`SemanticLayerAuthenticationRequiredError` should carry only:

- Semantic layer UUID
- Action ID
- Human-readable message

The frontend can then call the UUID action endpoint. It must not receive
credential keys or token metadata beyond connected or expired status.

## 7. Define the Quiver Credential Identity

Tokens must be addressable before semantic layer creation and reusable by
multiple Quiver semantic layers.

Build a canonical non-secret identity from fields such as:

```json
{
  "quiver_url": "...",
  "issuer": "...",
  "client_id": "...",
  "audience": "...",
  "scopes": ["..."]
}
```

Normalize URLs and sort scopes, then hash the canonical JSON:

```text
oauth2:v1:<base64url-sha256>
```

Do not include:

- Client secret
- Access token
- Refresh token
- Semantic layer UUID
- Semantic layer name

The resulting record is:

```text
extension_id = netflix.quiver
user_fk      = authenticated user
access       = backend
key          = oauth2:v1:<credential hash>
value        = {
  access_token,
  refresh_token,
  token_type,
  expires_at,
  granted_scopes
}
is_encrypted = true
```

Deleting one semantic layer must not delete this entry because several layers
may share it. Provide an explicit Disconnect Quiver action instead.

Changing identity fields produces a new credential key. Old credentials can
be removed through Disconnect or eventual extension cleanup.

## 8. Implement OAuth in the Quiver Extension

Superset provides storage, execution context, and action UI. The Quiver
extension remains responsible for OAuth protocol behavior.

### Start

The start handler should:

- Require an authenticated user.
- Derive the credential key from submitted non-secret configuration.
- Generate state, nonce, and a PKCE verifier and challenge.
- Bind signed state to the user ID, credential key, return location, nonce,
  and expiry.
- Store the PKCE verifier in a short-lived backend cache inaccessible through
  extension browser storage.
- Redirect to the configured issuer.

The PKCE verifier is temporary protocol state, not token escrow.

### Callback

The callback should:

- Validate the state signature and age.
- Require the same authenticated user recorded in state.
- Consume the nonce and verifier exactly once.
- Exchange the authorization code server-side.
- Write the resulting token directly through `ctx.storage.secrets`.
- Return a minimal success page or redirect.
- Never include tokens in URLs, HTML, `postMessage`, logs, or frontend
  responses.

### Refresh

Before calling Quiver:

1. Load the user's token.
2. Refresh if it is near expiry.
3. Acquire a distributed lock scoped to extension, user, and credential key.
4. Reread after acquiring the lock.
5. Refresh only if it is still necessary.
6. Persist the new access token and any rotated refresh token.

On `invalid_grant`, remove the stored secret and raise the typed authentication
required error.

## 9. Update Documentation

Update `docs/developer_docs/extensions/storage.md` to make the distinction
explicit:

- `encrypt=True` means encryption at rest.
- Ordinary persistent values remain readable by the extension frontend.
- Tokens and backend credentials belong in `ctx.storage.secrets`.
- Secrets are encrypted, user-scoped, backend-only, non-listable, and
  unavailable in TypeScript.
- `.shared` is intentionally unavailable for secrets.
- Secret values remain subject to extension storage quotas.
- User deletion cascades to personal secrets.

Also add semantic layer extension documentation covering:

- Runtime extension context
- Configuration actions
- Pre-creation OAuth
- Personal token behavior in background queries
- Disconnect and reconnect behavior

The existing `api_token` example under ordinary persistent storage should be
changed because it suggests a browser-readable location for bearer
credentials.

## 10. Suggested Pull Request Sequence

### PR 1: Backend-Only Extension Secrets

- Migration and model changes
- DAO access namespace
- `ctx.storage.secrets`
- REST isolation
- Storage tests
- Storage documentation

This PR is independently useful to all backend extensions.

### PR 2: Semantic Layer Runtime Context

- Registered provider metadata
- Contextual layer and view adapters
- Explicit user principal propagation
- Synchronous and asynchronous execution tests

This makes extension storage usable reliably from semantic layer providers.

### PR 3: Semantic Layer Connection Actions

- Core action types and hooks
- Protected action endpoints
- Modal integration
- Authentication-required error contract
- Frontend and API tests
- Developer documentation

### PR 4: Quiver Extension

- Credential key derivation
- OAuth start and callback
- Token storage and refresh locking
- Disconnect and reconnect
- Quiver-specific tests

## Explicit Non-Goals

- Do not refactor `database_user_oauth2_tokens`.
- Do not migrate existing database OAuth flows.
- Do not use `localStorage`, `sessionStorage`, cookies, or frontend Redux state
  for tokens.
- Do not use KV escrow for the initial admin.
- Do not key tokens to semantic layer UUIDs.
- Do not expose a general browser flag for creating backend-only entries.
- Do not introduce shared or service-account credentials as part of the
  personal OAuth implementation.

## Completion Criteria

The work is complete when:

- An admin can authorize Quiver before creating the semantic layer.
- No semantic layer row is required to store that token.
- Another user sees a Connect action and stores a separate personal token.
- Synchronous and asynchronous queries use the initiating user's token.
- Multiple semantic layers can reuse the same user credential.
- Browser storage APIs cannot read, enumerate, overwrite, or delete the token.
- Refresh token rotation is persisted safely.
- Revoked credentials produce a reconnect action.
- Existing Tier 3 storage behavior remains backward compatible.
- Targeted tests and staged-file `pre-commit run` pass.
