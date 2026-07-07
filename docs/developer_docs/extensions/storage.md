---
title: Storage
sidebar_position: 8
---

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

# Storage

Superset Extensions have access to a managed storage API for persisting data. The storage system provides multiple tiers with different persistence characteristics, allowing extensions to choose the right storage for their needs.

Each extension receives its own isolated storage namespace. When Superset loads your extension, it binds storage to your extension's unique identifier, ensuring data privacy—two extensions using the same key will never collide, and extensions cannot access each other's data.

Storage is always accessed through the extension context via `getContext()`. This binding to the context is what ties every operation to the current extension's namespace.

## Storage Tiers

| Tier | Storage Type      | Context Property                           | Use Case                               |
| ---- | ----------------- | ------------------------------------------ | -------------------------------------- |
| 1    | Browser storage   | `ctx.storage.local`, `ctx.storage.session` | UI state, wizard progress, draft forms |
| 2    | Server-side cache | `ctx.storage.ephemeral`                    | Job progress, temporary results        |
| 3    | Database          | `ctx.storage.persistent`                   | Saved artifacts, durable config        |

## Tier 1: Local State

Browser-based storage that persists on the user's device. Use this for UI state and settings that don't need to sync across devices.

### Why Use the API Instead of localStorage Directly?

You might wonder why extensions should use `ctx.storage.local` instead of directly accessing `window.localStorage`. The managed API provides several benefits:

- **Automatic namespacing**: Each extension's data is isolated. Two extensions using the same key name won't collide.
- **User isolation**: By default, data is scoped to the current user, preventing data leakage between users on shared devices.
- **Clean uninstall**: When an extension is uninstalled, all its data can be cleanly removed using prefix-based deletion.
- **Future sandboxing**: The async API is designed for a future sandboxed execution model where extensions run in isolated contexts without direct DOM access.
- **Consistent patterns**: The same API shape works across all storage tiers, making it easy to switch between them.

### localState

Data persists across browser sessions until explicitly deleted or the user clears browser storage.

```typescript
import { extensions } from '@apache-superset/core';

const ctx = extensions.getContext();

// Save sidebar state
await ctx.storage.local.set('sidebar_collapsed', true);

// Retrieve it later
const isCollapsed = await ctx.storage.local.get('sidebar_collapsed');

// Remove it
await ctx.storage.local.remove('sidebar_collapsed');
```

### sessionState

Data is cleared when the browser tab is closed. Use for transient state within a single session.

```typescript
import { extensions } from '@apache-superset/core';

const ctx = extensions.getContext();

// Save wizard progress (lost when tab closes)
await ctx.storage.session.set('wizard_step', 3);
await ctx.storage.session.set('unsaved_form', { name: 'Draft' });

// Retrieve on page reload within same tab
const step = await ctx.storage.session.get('wizard_step');
```

Tier 1 has no `shared` accessor. Browser storage is per-device, so a "shared" value would only be visible to other users of that same browser, not to other users of the extension generally — see `.shared` on [Tier 2](#tier-2-ephemeral-state) or [Tier 3](#tier-3-persistent-state) for storage that's actually shared across users.

### When to Use Tier 1

- UI state (sidebar collapsed, panel sizes)
- Recently used items
- Draft form values
- Any data acceptable to lose if user clears browser

### Limitations

- Per-browser, per-device (not shared across devices)
- Subject to browser storage quotas (~5-10 MB)
- Not accessible from backend code

## Tier 2: Ephemeral State

Server-side cache storage with automatic TTL expiration. Use for temporary data that needs to be shared between frontend and backend, or persist across page reloads.

TTL is required for every `set` call. The maximum allowed TTL is controlled by `MAX_TTL` in the server configuration.

### Frontend Usage

```typescript
import { extensions } from '@apache-superset/core';

const ctx = extensions.getContext();

// Store with a 5-minute TTL
await ctx.storage.ephemeral.set('job_progress', { pct: 42, status: 'running' }, { ttl: 300 });

// Retrieve
const progress = await ctx.storage.ephemeral.get('job_progress');

// Remove
await ctx.storage.ephemeral.remove('job_progress');
```

### Backend Usage

```python
from superset_core.extensions.context import get_context
from superset_core.extensions.storage.ephemeral import EphemeralSetOptions

ctx = get_context()

# Store job progress with a 5-minute TTL
ctx.storage.ephemeral.set(
    'job_progress', {'pct': 42, 'status': 'running'}, EphemeralSetOptions(ttl=300)
)

# Retrieve
progress = ctx.storage.ephemeral.get('job_progress')

# Remove
ctx.storage.ephemeral.remove('job_progress')
```

### Shared State

For data that needs to be visible to all users:

```typescript
import { extensions } from '@apache-superset/core';

const ctx = extensions.getContext();

await ctx.storage.ephemeral.shared.set('shared_result', { data: [1, 2, 3] }, { ttl: 3600 });
const result = await ctx.storage.ephemeral.shared.get('shared_result');
```

```python
from superset_core.extensions.context import get_context
from superset_core.extensions.storage.ephemeral import EphemeralSetOptions

ctx = get_context()

ctx.storage.ephemeral.shared.set(
    'shared_result', {'data': [1, 2, 3]}, EphemeralSetOptions(ttl=3600)
)
result = ctx.storage.ephemeral.shared.get('shared_result')
```

### When to Use Tier 2

- Background job progress indicators
- Cross-request intermediate state
- Query result previews
- Temporary computation results
- Any data that can be recomputed if lost

### Limitations

- Not guaranteed to survive server restarts
- Subject to cache eviction under memory pressure
- TTL-based expiration (data disappears after timeout)
- TTL is required on every `set` call

## Tier 3: Persistent State

Database-backed storage that survives server restarts, cache evictions, and browser clears. Use for any data that must not be lost.

### Frontend Usage

```typescript
import { extensions } from '@apache-superset/core';

const ctx = extensions.getContext();

// Store a saved SQL snippet
await ctx.storage.persistent.set('snippet:top_customers', { sql: 'SELECT ...' });

// Retrieve
const snippet = await ctx.storage.persistent.get('snippet:top_customers');

// Remove
await ctx.storage.persistent.remove('snippet:top_customers');
```

### Backend Usage

```python
from superset_core.extensions.context import get_context

ctx = get_context()

# Store a saved SQL snippet
ctx.storage.persistent.set('snippet:top_customers', {'sql': 'SELECT ...'})

# Retrieve
snippet = ctx.storage.persistent.get('snippet:top_customers')

# Remove
ctx.storage.persistent.remove('snippet:top_customers')
```

### Shared State

For data that should be visible to all users of the extension:

```typescript
import { extensions } from '@apache-superset/core';

const ctx = extensions.getContext();

await ctx.storage.persistent.shared.set('global_config', { version: 2 });
const config = await ctx.storage.persistent.shared.get('global_config');
```

```python
from superset_core.extensions.context import get_context

ctx = get_context()

ctx.storage.persistent.shared.set('global_config', {'version': 2})
config = ctx.storage.persistent.shared.get('global_config')
```

### Enumerating and Managing Storage from the Backend

The `ctx.storage.persistent` accessor is for single-key reads and writes. Backend extension code that needs to enumerate its own rows in bulk — for example, a cleanup routine that removes storage linked to resources that no longer exist — can use `superset_core.extensions.storage.dao.ExtensionStorageDAO` instead:

```python
from superset_core.extensions.storage.dao import ExtensionStorageDAO

# All entries this extension has linked to a given resource type
entries = ExtensionStorageDAO.filter_by(resource_type="my-resource-type")

# Bulk-delete rows for resources that no longer exist
orphaned = [e for e in entries if e.resource_uuid not in my_extension_live_resource_ids()]
ExtensionStorageDAO.delete(orphaned)
```

`ExtensionStorageDAO` is automatically scoped to the calling extension's own rows — `extension_id` is never a parameter you pass, so there is no way to reach another extension's storage through this API. It supports the standard DAO operations (`find_all`, `find_one_or_none`, `filter_by`, `query`, `create`, `update`, `delete`), and, unlike `ctx.storage.persistent`, gives direct access to each row's scope columns (`resource_type`, `resource_uuid`, `category`, `description`) for entries created with those set.

### When to Use Tier 3

- Extension configuration that must survive restarts
- User-specific saved artifacts that need to roam across devices and browsers (e.g. saved SQL snippets, annotations)
- Any data where loss is unacceptable

### Limitations

- Higher latency than Tiers 1–2 (database round-trip per operation)
- Subject to the 16 MB value size limit
- Subject to the per-extension quota configured via `EXTENSIONS_PERSISTENT_STORAGE.QUOTA_PER_EXTENSION` (see [Quotas](#quotas))
- Requires a database migration when first deployed

## Key Patterns

All storage keys are automatically namespaced:

| Scope                  | Key Pattern                                        |
| ---------------------- | --------------------------------------------------- |
| User-scoped            | `superset-ext:{extension_id}:user:{user_id}:{key}` |
| Shared (Tiers 2 and 3) | `superset-ext:{extension_id}:shared:{key}`         |

This ensures:

- Extensions cannot accidentally access each other's data
- Users cannot see other users' data (by default)
- Clean prefix-based deletion on uninstall

## Configuration

### Tier 2: Ephemeral Storage

Administrators can configure the server-side cache backend in `superset_config.py`:

```python
EXTENSIONS_EPHEMERAL_STORAGE = {
    # Use Redis for better performance in production
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_URL": "redis://localhost:6379/2",
    "MAX_TTL": 604800,  # 7 days maximum TTL
}
```

For development, the default `SupersetMetastoreCache` stores data in the metadata database.

### Tier 3: Persistent Storage

Tier 3 values are stored in the `extension_storage` database table. Values are stored unencrypted by default; encryption is opt-in per write, available via a `PersistentSetOptions`-shaped `encrypt` option:

```typescript
import { extensions } from '@apache-superset/core';

const ctx = extensions.getContext();

await ctx.storage.persistent.set('api_token', 'sk-...', { encrypt: true });
const token = await ctx.storage.persistent.get('api_token');
```

```python
from superset_core.extensions.context import get_context
from superset_core.extensions.storage.persistent import PersistentSetOptions

ctx = get_context()

ctx.storage.persistent.set('api_token', 'sk-...', PersistentSetOptions(encrypt=True))
token = ctx.storage.persistent.get('api_token')
```

Encryption reuses Superset's existing `EncryptedType` (from `sqlalchemy-utils`) rather than a separate mechanism — the same infrastructure used for database connection credentials. The key is not configured directly: user-scoped values are encrypted with a key derived per-user via HMAC-SHA256 from the deployment's `SECRET_KEY`, so ciphertext for one user cannot be decrypted as another's; shared/global values (written via `.shared`) use `SECRET_KEY` directly. The encryption engine (AES-CBC by default) can be changed for the whole deployment via the existing `SQLALCHEMY_ENCRYPTED_FIELD_ENGINE` config, the same setting that controls encryption for database credentials elsewhere in Superset — there is no separate key list or rotation mechanism specific to extension storage. When `SECRET_KEY` is rotated, extension storage rows are re-encrypted by the existing `SecretsMigrator` tooling alongside database credentials, with no extension-specific steps required.

### Quotas

Persistent storage is subject to a per-extension quota, configured in `superset_config.py`:

```python
EXTENSIONS_PERSISTENT_STORAGE = {
    # Maximum total bytes an extension may store across all of its rows
    # (global, every user's, and shared). Defaults to 100 MB.
    "QUOTA_PER_EXTENSION": 100 * 1024 * 1024,
}
```

A write that would push the extension's total stored size over the configured quota is rejected — the frontend SDK's `set()` call rejects with an HTTP 413 response, and backend code calling `ctx.storage.persistent.set()` sees the corresponding exception raised. Overwriting an existing key nets out that key's own current size against usage first, so replacing a value with one of the same or smaller size never spuriously fails even when the extension is already near its quota.
