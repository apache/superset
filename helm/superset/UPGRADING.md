#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Upgrading the Superset Helm Chart

This document provides guidance for upgrading between major versions of the Superset Helm chart.

## Helm Version Compatibility

This chart is tested and compatible with:

| Helm Version | Status |
|--------------|--------|
| Helm 3.x | ✅ Fully Compatible |
| Helm 4.x | ✅ Fully Compatible |

### Helm 4 Notes

This chart is fully compatible with [Helm v4.0.0](https://helm.sh/docs/overview/). No changes are required when upgrading from Helm 3 to Helm 4.

**Helm 4 CLI Flag Changes:**
If you use these flags in your automation, note they have been renamed in Helm 4 (old flags still work but show deprecation warnings):
- `--atomic` → `--rollback-on-failure`
- `--force` → `--force-replace`

**OCI Registry Support:**
Chart dependencies use OCI registries (`oci://registry-1.docker.io/bitnamicharts`), which is the recommended approach in Helm 4.

---

## Upgrading from 0.15.x to 0.16.x

Version 0.16.0 introduced significant changes to improve security and simplify configuration. This upgrade includes **breaking changes** that require manual migration.

> **⚠️ IMPORTANT:** The chart will **fail to deploy** if deprecated configuration values are detected. This ensures a clean upgrade path and prevents hidden compatibility issues. See the migration guide below for each breaking change.

### ⚠️ Breaking Changes

#### 1. Configuration Structure Changes

The configuration structure has been reorganized for better clarity and security. The old `supersetNode.connections.*` paths have been replaced with dedicated `database.*` and `cache.*` sections.

**Migration Required:** Update your `values.yaml` or Helm command-line arguments to use the new configuration paths.

##### Database Configuration Migration

| Old Path (0.15.x) | New Path (0.16.x) |
|-------------------|-------------------|
| `supersetNode.connections.db_host` | `database.host` |
| `supersetNode.connections.db_port` | `database.port` |
| `supersetNode.connections.db_user` | `database.user` |
| `supersetNode.connections.db_pass` | `database.password` |
| `supersetNode.connections.db_name` | `database.name` |
| `supersetNode.connections.db_type` | `database.driver` |

**Example Migration:**

```yaml
# OLD (0.15.x)
supersetNode:
  connections:
    db_host: postgres.example.com
    db_port: 5432
    db_user: superset
    db_pass: mypassword
    db_name: superset
    db_type: postgresql+psycopg2

# NEW (0.16.x)
database:
  host: postgres.example.com
  port: 5432
  user: superset
  password: mypassword
  name: superset
  driver: postgresql+psycopg2
```

##### Redis/Cache Configuration Migration

| Old Path (0.15.x) | New Path (0.16.x) |
|-------------------|-------------------|
| `supersetNode.connections.redis_host` | `cache.host` |
| `supersetNode.connections.redis_port` | `cache.port` |
| `supersetNode.connections.redis_user` | `cache.user` |
| `supersetNode.connections.redis_password` | `cache.password` |
| `supersetNode.connections.redis_cache_db` | `cache.cacheDb` |
| `supersetNode.connections.redis_celery_db` | `cache.celeryDb` |
| `supersetNode.connections.redis_ssl.enabled` | `cache.ssl.enabled` |
| `supersetNode.connections.redis_ssl.ssl_cert_reqs` | `cache.ssl.ssl_cert_reqs` |

**Example Migration:**

```yaml
# OLD (0.15.x)
supersetNode:
  connections:
    redis_host: redis.example.com
    redis_port: 6379
    redis_user: ""
    redis_password: mypassword
    redis_cache_db: 1
    redis_celery_db: 0
    redis_ssl:
      enabled: false
      ssl_cert_reqs: none

# NEW (0.16.x)
cache:
  enabled: true
  host: redis.example.com
  port: 6379
  user: ""
  password: mypassword
  cacheDb: 1
  celeryDb: 0
  ssl:
    enabled: false
    ssl_cert_reqs: none
```

#### 2. SSL/TLS Enabled by Default

**Breaking Change:** SSL/TLS is now enabled by default for both database and Redis connections to improve security.

**Impact:** If your database or Redis instances do not support SSL/TLS, the connection will fail.

**Migration Options:**

1. **Enable SSL/TLS on your services** (Recommended for production)
   - Configure your PostgreSQL/Redis to use SSL/TLS
   - Update certificates if needed

2. **Disable SSL/TLS** (Only for development/testing)
   ```yaml
   database:
     ssl:
       enabled: false
   
   cache:
     ssl:
       enabled: false
   ```

**Security Warning:** Disabling SSL/TLS is not recommended for production deployments. Use this option only if you cannot enable SSL/TLS on your services immediately.

#### 3. Init Containers Auto-Generation

**Breaking Change:** Init containers are now automatically generated based on your configuration instead of requiring explicit definition.

**Impact:** If you had custom init containers defined, they may need to be reviewed.

**Migration:**

- The chart now automatically creates init containers for waiting on database and Redis services
- If you need custom init containers, you can still override them:
  ```yaml
  supersetNode:
    initContainers:
      - name: custom-init
        image: my-custom-image
        command: ["/bin/sh", "-c", "echo 'Custom init'"]
  ```

#### 4. ServiceAccount Configuration Changes

The ServiceAccount configuration has been restructured to follow [Helm RBAC best practices](https://helm.sh/docs/chart_best_practices/rbac).

**What Changed:**
- `serviceAccountName` moved from root level to `serviceAccount.name`
- `serviceAccount.create` now defaults to `true` (was `false`)

**Migration:**
```yaml
# OLD (0.15.x)
serviceAccountName: my-sa
serviceAccount:
  create: false

# NEW (0.16.x)
serviceAccount:
  create: true  # Now defaults to true
  name: my-sa   # Moved under serviceAccount
```

**Impact:**
- A ServiceAccount will now be created by default
- **The chart will fail** if `serviceAccountName` is found at root level - you must migrate to `serviceAccount.name`

#### 5. Init Job Separated from Upgrade Job

**Breaking Change:** Init and upgrade responsibilities are now split between two jobs for cleaner separation of concerns.

**What Changed:**
- **Upgrade job** (`upgrade-job.yaml`): Runs `superset db upgrade` and `superset init` on EVERY deployment (install and upgrade)
- **Init job** (`init-job.yaml`): Runs admin creation and examples loading on FIRST install only

**Execution Order (using hook weights):**
1. Upgrade job (weight 0) - DB migrations and role initialization
2. Init job (weight 1) - Admin creation and examples (install only)

**New Configuration:**
```yaml
init:
  enabled: true
  jobAnnotations:
    "helm.sh/hook": post-install
    "helm.sh/hook-weight": "1"      # Runs after upgrade job
  upgradeJob:
    enabled: true
    jobAnnotations:
      "helm.sh/hook": post-install,post-upgrade
      "helm.sh/hook-weight": "0"    # Runs first
```

**Impact:**
- Admin accounts are only created on initial install
- DB migrations run on every install and upgrade
- Code reuse: upgrade job logic is shared between install and upgrade

#### 6. Label Standardization

Labels have been standardized to follow [Kubernetes recommended labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/).

**What Changed:**
- All resources now use `app.kubernetes.io/*` prefixed labels
- Added `app.kubernetes.io/component` to identify each component (web, worker, celerybeat, flower, websocket)
- Added `app.kubernetes.io/part-of: superset` to all resources
- **Legacy labels (`app`, `chart`, `release`, `heritage`) have been removed**

**Impact:**
- **Service Meshes / Observability:** If you have label-based policies or dashboards using the old labels, update them to use `app.kubernetes.io/*` labels
- **Existing Deployments:** Deployments using old label selectors will need to be recreated. Consider using `helm uninstall` followed by `helm install` for a clean upgrade

**New Label Structure:**
```yaml
# All resources now include:
labels:
  app.kubernetes.io/name: superset
  app.kubernetes.io/instance: my-release
  app.kubernetes.io/version: "6.0.0"
  app.kubernetes.io/component: web      # or worker, celerybeat, flower, websocket
  app.kubernetes.io/part-of: superset
  app.kubernetes.io/managed-by: Helm
  helm.sh/chart: superset-0.16.0
```

### ✅ New Features in 0.16.0

- **Separated Init/Upgrade Jobs:** Init job only runs on install; separate upgrade job handles DB migrations
- **Label Standardization:** Consistent Kubernetes recommended labels across all resources
- **Enhanced Security:** Default security contexts, seccomp profiles, and capability restrictions
- **Pre-install Validation:** Automatic validation of database and Redis connectivity before deployment
- **Network Policy Support:** Built-in network policy templates for network segmentation
- **Improved Health Checks:** Python-based health checks for better reliability
- **Admin Password Validation:** Automatic validation of admin user password requirements

### Migration Steps

1. **Backup your current values:**
   ```bash
   helm get values my-superset > old-values.yaml
   ```

2. **Review the breaking changes** listed above and identify what needs to be migrated

3. **Update your values.yaml** with the new configuration structure:
   - Migrate database configuration from `supersetNode.connections.*` to `database.*`
   - Migrate Redis configuration from `supersetNode.connections.*` to `cache.*`
   - Review SSL/TLS settings and enable on your services if needed

4. **Test the migration:**
   ```bash
   helm template my-superset . -f values.yaml > rendered.yaml
   # Review rendered.yaml to ensure configuration is correct
   ```

5. **Upgrade the chart:**
   ```bash
   helm upgrade my-superset . -f values.yaml
   ```

6. **Verify the deployment:**
   ```bash
   kubectl get pods -l app.kubernetes.io/name=superset
   kubectl logs -l app.kubernetes.io/name=superset --tail=50
   ```

### Troubleshooting

#### Connection Failures After Upgrade

If you experience connection failures after upgrading:

1. **Check SSL/TLS settings:**
   - Verify that your database/Redis supports SSL if `ssl.enabled: true`
   - Or disable SSL if your services don't support it (development only)

2. **Verify configuration paths:**
   - Ensure all `supersetNode.connections.*` paths have been migrated
   - Check that service names and ports are correct

3. **Review init container logs:**
   ```bash
   kubectl logs <pod-name> -c wait-for-services
   ```

#### Validation Job Failures

The pre-install validation job may fail if:
- Database or Redis is not accessible
- Credentials are incorrect
- Network policies are blocking access

Check validation job logs:
```bash
kubectl logs job/<release-name>-pre-install-validation
```

### Need Help?

- Review the [README.md](README.md) for detailed configuration options
- Check the [Superset documentation](https://superset.apache.org/docs/)
- Open an issue on [GitHub](https://github.com/apache/superset/issues)

---

*Last updated: March 2026*
