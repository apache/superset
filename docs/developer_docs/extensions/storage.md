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

## Storage Tiers

| Tier | Storage Type | Context Property | Use Case |
|------|--------------|------------------|----------|
| 1 | Browser storage | `ctx.storage.local`, `ctx.storage.session` | UI state, wizard progress, draft forms |
| 2 | Server-side cache | `ctx.storage.ephemeral` | Job progress, temporary results |
| 3 | Database | `ctx.storage.persistent` | User preferences, extension config (coming soon) |

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
import { getContext } from '@apache-superset/core/extensions';

const ctx = getContext();

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
import { getContext } from '@apache-superset/core/extensions';

const ctx = getContext();

// Save wizard progress (lost when tab closes)
await ctx.storage.session.set('wizard_step', 3);
await ctx.storage.session.set('unsaved_form', { name: 'Draft' });

// Retrieve on page reload within same tab
const step = await ctx.storage.session.get('wizard_step');
```

### Shared State

By default, data is scoped to the current user. Use `shared` for data that should be accessible to all users on the same device.

```typescript
import { getContext } from '@apache-superset/core/extensions';

const ctx = getContext();

// Shared across all users on this device
await ctx.storage.local.shared.set('device_id', 'abc-123');
const deviceId = await ctx.storage.local.shared.get('device_id');
```

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

### Frontend Usage

```typescript
import { getContext } from '@apache-superset/core/extensions';

const ctx = getContext();

// Store with default TTL (1 hour)
await ctx.storage.ephemeral.set('job_progress', { pct: 42, status: 'running' });

// Store with custom TTL (5 minutes)
await ctx.storage.ephemeral.set('quick_cache', { results: [1, 2, 3] }, { ttl: 300 });

// Retrieve
const progress = await ctx.storage.ephemeral.get('job_progress');

// Remove
await ctx.storage.ephemeral.remove('job_progress');
```

### Backend Usage

```python
from superset_core.extensions.context import get_context

ctx = get_context()

# Store job progress
ctx.storage.ephemeral.set('job_progress', {'pct': 42, 'status': 'running'}, ttl=3600)

# Retrieve
progress = ctx.storage.ephemeral.get('job_progress')

# Remove
ctx.storage.ephemeral.remove('job_progress')
```

### Shared State

For data that needs to be visible to all users:

```typescript
import { getContext } from '@apache-superset/core/extensions';

const ctx = getContext();

await ctx.storage.ephemeral.shared.set('shared_result', { data: [1, 2, 3] });
const result = await ctx.storage.ephemeral.shared.get('shared_result');
```

```python
from superset_core.extensions.context import get_context

ctx = get_context()

ctx.storage.ephemeral.shared.set('shared_result', {'data': [1, 2, 3]})
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

## Tier 3: Persistent State

Coming soon.

## Choosing the Right Tier

| Need | Recommended Tier |
|------|------------------|
| UI state (sidebar collapsed, panel sizes) | `ctx.storage.local` |
| Wizard/form progress within a session | `ctx.storage.session` |
| Background job progress | `ctx.storage.ephemeral` |
| Temporary computation cache | `ctx.storage.ephemeral` |

## Key Patterns

All storage keys are automatically namespaced:

| Scope | Key Pattern |
|-------|-------------|
| User-scoped | `superset-ext:{extension_id}:user:{user_id}:{key}` |
| Shared | `superset-ext:{extension_id}:shared:{key}` |

This ensures:
- Extensions cannot accidentally access each other's data
- Users cannot see other users' data (by default)
- Clean prefix-based deletion on uninstall

## Configuration

Administrators can configure Tier 2 storage in `superset_config.py`:

```python
EXTENSIONS_STORAGE = {
    "EPHEMERAL": {
        # Use Redis for better performance in production
        "CACHE_TYPE": "RedisCache",
        "CACHE_REDIS_URL": "redis://localhost:6379/2",
        "CACHE_DEFAULT_TIMEOUT": 3600,  # 1 hour default TTL
    },
}
```

For development, the default `SupersetMetastoreCache` stores data in the metadata database.
