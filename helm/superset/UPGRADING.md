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

# Upgrading the Superset Helm Chart

## Upgrading to chart 0.20.0

Chart 0.20.0 introduces a structured connection schema. The old keys listed below are **DEPRECATED** — they still work (auto-mapped to the new keys at render time) and a deprecation warning is printed in `helm install`/`helm upgrade` NOTES, but they will be removed in a future release. Migrate as soon as possible.

### 1. Connection schema: `supersetNode.connections.*` → `database.*` / `cache.*`

**Before (deprecated — still honored):**

```yaml
supersetNode:
  connections:
    db_host: "pg-host"
    db_port: "5432"
    db_user: "superset"
    db_pass: "superset"
    db_name: "superset"
    redis_host: "redis-host"
    redis_port: "6379"
    redis_cache_db: "1"
    redis_celery_db: "0"
    redis_driver: "rediss"
```

**After (new structured keys — recommended):**

```yaml
database:
  host: "pg-host"
  port: 5432
  user: "superset"
  password: "superset"
  name: "superset"

cache:
  host: "redis-host"
  port: 6379
  cacheDb: 1
  celeryDb: 0
  driver: "rediss"   # optional: custom Redis driver / TLS variant
```

Key-by-key mapping summary:

| Old key | New key |
|---|---|
| `supersetNode.connections.db_host` | `database.host` |
| `supersetNode.connections.db_port` | `database.port` |
| `supersetNode.connections.db_user` | `database.user` |
| `supersetNode.connections.db_pass` | `database.password` |
| `supersetNode.connections.db_name` | `database.name` |
| `supersetNode.connections.redis_host` | `cache.host` |
| `supersetNode.connections.redis_port` | `cache.port` |
| `supersetNode.connections.redis_cache_db` | `cache.cacheDb` |
| `supersetNode.connections.redis_celery_db` | `cache.celeryDb` |
| `supersetNode.connections.redis_driver` | `cache.driver` |

### 2. Service account: root `serviceAccountName` → `serviceAccount.name`

**Before (deprecated — still honored):**

```yaml
serviceAccountName: my-sa
```

**After (new key — recommended):**

```yaml
serviceAccount:
  name: my-sa
```

### 3. Init script: `init.initscript` is deprecated and replaced by the built-in template

> **This is a behavior change.** The chart no longer uses `init.initscript`. The init script is rendered
> entirely from an internal chart template (`superset.initScript`), which runs the full initialization
> sequence:
>
> 1. `superset db upgrade` — applies all pending database schema migrations
> 2. `superset init` — initializes roles and permissions
> 3. Admin user creation (when `init.createAdmin: true`)
> 4. Example data loading (when `init.loadExamples: true`)
> 5. Datasource import (when `import_datasources.yaml` is present)
>
> A future PR will optionally split the database migration step into a dedicated upgrade Job for
> zero-downtime deployments. Until that PR lands, migrations run as part of the init Job above.

If you customized `init.initscript` in your `values.yaml`, that customization is silently ignored.
Move any customizations to `config` or `configOverrides`:

```yaml
# Move custom Python config here:
config:
  MY_SETTING: "value"

configOverrides:
  my_custom_override: |
    # Python snippet appended to superset_config.py
    MY_SETTING = "value"
```

If your use case cannot be covered by `config` or `configOverrides`, please open an issue so the maintainers
can evaluate extending the template.

### 4. New top-level sections: `config.*` and `featureFlags.*`

Two new sections provide direct Superset configuration passthrough without needing raw `configOverrides`.

**`config.*` — direct Superset config properties:**

```yaml
config:
  SECRET_KEY: "$(SUPERSET_SECRET_KEY)"
  ROW_LIMIT: 50000
  WTF_CSRF_ENABLED: true
  SQLALCHEMY_POOL_SIZE: 10
```

Each key is injected verbatim into `superset_config.py`. String values are quoted; non-string values
(integers, booleans) are rendered as-is.

**`featureFlags.*` — feature flag overrides:**

```yaml
featureFlags:
  ALERT_REPORTS: true
  DASHBOARD_RBAC: true
  ENABLE_TEMPLATE_PROCESSING: false
```

This is equivalent to setting `FEATURE_FLAGS = {...}` in `superset_config.py`, but is more readable and
schema-validated.

### 5. `values.schema.json` — early validation

The chart now ships a `values.schema.json` that validates the values you provide. Wrong types (e.g., a string
where an integer is expected) or unknown keys in structured sections will cause `helm install`/`helm upgrade`
to fail immediately with a descriptive error instead of producing a broken deployment.

If you get a validation error after upgrading, check that your overridden values match the types documented in
`values.yaml` and the schema.
