---
title: Persistent Storage
sidebar_position: 3
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

# Persistent Storage (Tier 3)

Extensions can store arbitrary key-value data in Superset's database without
contributing model code to the core codebase. The storage layer supports three
**scopes**, optional **category** filtering for cheap listing, optional
**at-rest encryption**, and **key rotation** with zero downtime.

## Storage Scopes

| Scope | When to use | `user_fk` | `resource_type` |
|---|---|---|---|
| **Global** | Configuration shared across all users of the extension | `null` | `null` |
| **User** | Per-user preferences or saved artefacts | set | `null` |
| **Resource** | State tied to a specific Superset resource (dashboard, chart, …) | any | set |

## REST API

All endpoints live under:

```
/api/v1/extensions/{publisher}/{name}/storage/persistent/
```

### Global scope

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `.../global/` | List entries (`?page=0&page_size=25&category=…`) |
| `GET` | `.../global/{key}` | Read a value (response body is the raw bytes) |
| `PUT` | `.../global/{key}` | Create or update |
| `DELETE` | `.../global/{key}` | Delete |

### User scope

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `.../user/` | List the authenticated user's entries |
| `GET` | `.../user/{key}` | Read a value |
| `PUT` | `.../user/{key}` | Create or update |
| `DELETE` | `.../user/{key}` | Delete |

### Resource scope

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `.../resources/{type}/{uuid}/` | List entries for the resource |
| `GET` | `.../resources/{type}/{uuid}/{key}` | Read a value |
| `PUT` | `.../resources/{type}/{uuid}/{key}` | Create or update |
| `DELETE` | `.../resources/{type}/{uuid}/{key}` | Delete |

## PUT request body

All write endpoints accept a JSON body:

```json
{
  "value": "<string or base64 bytes>",
  "value_type": "application/json",
  "category": "my-category",
  "description": "Human-readable label for cheap listing",
  "is_encrypted": false
}
```

| Field | Required | Default | Notes |
|---|---|---|---|
| `value` | yes | `""` | The payload to store |
| `value_type` | no | `application/json` | MIME type returned on GET |
| `category` | no | `null` | Used to filter list results |
| `description` | no | `null` | Returned in list results without fetching `value` |
| `is_encrypted` | no | `false` | Encrypts `value` at rest with Fernet |

## List response

```json
{
  "count": 42,
  "result": [
    {
      "key": "my-key",
      "uuid": "...",
      "value_type": "application/json",
      "category": "my-category",
      "description": "...",
      "is_encrypted": false
    }
  ]
}
```

The `value` blob is **not** included in list responses. Fetch individual keys
to retrieve values.

## Frontend usage

From a TypeScript extension frontend, use standard `fetch` with the Superset
CSRF token:

```typescript
const BASE = '/api/v1/extensions/acme/my-ext/storage/persistent/user';

// Save
await fetch(`${BASE}/my-key`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRFToken': await authentication.getCSRFToken(),
  },
  body: JSON.stringify({
    value: JSON.stringify({ foo: 'bar' }),
    value_type: 'application/json',
    category: 'preferences',
    description: 'My display name',  // shown in list without fetching value
  }),
});

// List
const { result } = await fetch(`${BASE}/?category=preferences`).then(r => r.json());

// Read
const raw = await fetch(`${BASE}/my-key`).then(r => r.text());
const data = JSON.parse(raw);

// Delete
await fetch(`${BASE}/my-key`, { method: 'DELETE', headers: { 'X-CSRFToken': ... } });
```

## Backend usage (Python)

Within extension backend code, use `ExtensionStorageDAO` directly:

```python
from superset_core.common.daos import ExtensionStorageDAO

EXT_ID = "acme.my-ext"

# Write
ExtensionStorageDAO.set(EXT_ID, "config", b'{"theme":"dark"}', category="global-config")

# Read
value: bytes | None = ExtensionStorageDAO.get_value(EXT_ID, "config")

# User-scoped
ExtensionStorageDAO.set(EXT_ID, "prefs", b'{"lang":"fr"}', user_fk=user_id)
value = ExtensionStorageDAO.get_value(EXT_ID, "prefs", user_fk=user_id)

# Resource-scoped
ExtensionStorageDAO.set(
    EXT_ID, "state", payload,
    resource_type="dashboard", resource_uuid=str(dashboard.uuid),
)
```

:::note
`ExtensionStorageDAO` methods call `db.session.flush()` but do **not** commit.
The caller (or the `@transaction()` decorator on the API endpoint) owns the
transaction.
:::

## Encryption at rest

Set `"is_encrypted": true` in the PUT body (frontend) or `is_encrypted=True`
in `ExtensionStorageDAO.set()` (backend). Values are encrypted with
[Fernet](https://cryptography.io/en/latest/fernet/) using a key derived from
`SECRET_KEY` (or the first entry of `EXTENSION_STORAGE_ENCRYPTION_KEYS` if
configured). Decryption is transparent on read.

### Key rotation

To rotate encryption keys without downtime:

1. **Prepend** the new key to `EXTENSION_STORAGE_ENCRYPTION_KEYS` in your
   Superset config and **restart**. Existing encrypted rows are still readable
   (old key is tried as a fallback); new writes use the new key.

   ```python
   # superset_config.py
   EXTENSION_STORAGE_ENCRYPTION_KEYS = [
       "new-strong-secret",   # used for new encryptions
       "old-secret",          # still tried for decryption
   ]
   ```

2. **Re-encrypt** all existing rows with the new key:

   ```bash
   superset rotate-extension-storage-keys
   ```

3. **Remove** the old key from the list and restart again.

## Data model

The `extension_storage` table schema:

| Column | Type | Notes |
|---|---|---|
| `id` | integer PK | |
| `uuid` | UUID | Unique, auto-generated |
| `extension_id` | varchar(255) | `{publisher}.{name}` |
| `user_fk` | integer FK | `null` = global or resource scope |
| `resource_type` | varchar(64) | e.g. `dashboard`, `chart` |
| `resource_uuid` | varchar(36) | UUID of the linked resource |
| `key` | varchar(255) | Identifier within a scope |
| `category` | varchar(64) | Optional grouping tag |
| `description` | text | Summary for list endpoints |
| `value` | binary (up to 16 MB) | The stored payload |
| `value_type` | varchar(255) | MIME type, default `application/json` |
| `is_encrypted` | boolean | Whether `value` is Fernet-encrypted |
| `created_on`, `changed_on` | datetime | Audit fields |
| `created_by_fk`, `changed_by_fk` | integer FK | Audit fields |
