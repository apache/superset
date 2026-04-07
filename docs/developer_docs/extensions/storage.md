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

| Tier | Storage Type | Module | Use Case |
|------|--------------|--------|----------|
| 1 | Browser storage | `localState`, `sessionState` | UI state, wizard progress, draft forms |
| 2 | Server-side cache | `ephemeralState` | Job progress, temporary results |
| 3 | Database | `persistentState` | User preferences, extension config (coming soon) |

## Tier 1: Local State

Browser-based storage that persists on the user's device. Use this for UI state and settings that don't need to sync across devices.

### Why Use the API Instead of localStorage Directly?

You might wonder why extensions should use `localState` instead of directly accessing `window.localStorage`. The managed API provides several benefits:

- **Automatic namespacing**: Each extension's data is isolated. Two extensions using the same key name won't collide.
- **User isolation**: By default, data is scoped to the current user, preventing data leakage between users on shared devices.
- **Clean uninstall**: When an extension is uninstalled, all its data can be cleanly removed using prefix-based deletion.
- **Future sandboxing**: The async API is designed for a future sandboxed execution model where extensions run in isolated contexts without direct DOM access.
- **Consistent patterns**: The same API shape works across all storage tiers, making it easy to switch between them.

### localState

Data persists across browser sessions until explicitly deleted or the user clears browser storage.

```typescript
import { localState } from '@apache-superset/core/storage';

// Save sidebar state
await localState.set('sidebar_collapsed', true);

// Retrieve it later
const isCollapsed = await localState.get('sidebar_collapsed');

// Remove it
await localState.remove('sidebar_collapsed');
```

### sessionState

Data is cleared when the browser tab is closed. Use for transient state within a single session.

```typescript
import { sessionState } from '@apache-superset/core/storage';

// Save wizard progress (lost when tab closes)
await sessionState.set('wizard_step', 3);
await sessionState.set('unsaved_form', { name: 'Draft' });

// Retrieve on page reload within same tab
const step = await sessionState.get('wizard_step');
```

### Shared State

By default, data is scoped to the current user. Use `shared()` for data that should be accessible to all users on the same device.

```typescript
import { localState } from '@apache-superset/core/storage';

// Shared across all users on this device
await localState.shared().set('device_id', 'abc-123');
const deviceId = await localState.shared().get('device_id');
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
import { ephemeralState } from '@apache-superset/core/storage';

// Store with default TTL (1 hour)
await ephemeralState.set('job_progress', { pct: 42, status: 'running' });

// Store with custom TTL (5 minutes)
await ephemeralState.set('quick_cache', { results: [1, 2, 3] }, { ttl: 300 });

// Retrieve
const progress = await ephemeralState.get('job_progress');

// Remove
await ephemeralState.remove('job_progress');
```

### Backend Usage

```python
from superset_core.extensions.storage import ephemeral_state

# Store job progress
ephemeral_state.set('job_progress', {'pct': 42, 'status': 'running'}, ttl=3600)

# Retrieve
progress = ephemeral_state.get('job_progress')

# Remove
ephemeral_state.remove('job_progress')
```

### Shared State

For data that needs to be visible to all users:

```typescript
import { ephemeralState } from '@apache-superset/core/storage';

await ephemeralState.shared().set('shared_result', { data: [1, 2, 3] });
const result = await ephemeralState.shared().get('shared_result');
```

```python
from superset_core.extensions.storage import ephemeral_state

ephemeral_state.shared().set('shared_result', {'data': [1, 2, 3]})
result = ephemeral_state.shared().get('shared_result')
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
| UI state (sidebar collapsed, panel sizes) | `localState` |
| Wizard/form progress within a session | `sessionState` |
| Background job progress | `ephemeralState` |
| Temporary computation cache | `ephemeralState` |

## Key Patterns

All storage keys are automatically namespaced:

| Scope | Key Pattern |
|-------|-------------|
| User-scoped | `superset-ext:{extension_id}:user:{user_id}:{key}` |
| Shared | `superset-ext:{extension_id}:{key}` |

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
