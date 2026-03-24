# Helm Chart Refactoring Action Items

This document tracks the action items for refactoring the Superset Helm chart following the evaluation of changes from commit `84279acd` to the current state (v0.16.0).

## Overview

| Category | Current Status | Target |
|----------|----------------|--------|
| Chart Version | 0.16.0 | 0.17.0+ |
| App Version | 6.0.0 | 6.0.0 |
| Security | ✅ Production-ready | Complete |
| Retrocompatibility | ✅ Documented | Complete |
| Testing | ✅ Unit tests added | Complete |

---

## ✅ All Action Items Completed!

All planned refactoring items have been completed. See details below.

---

## Completed Items

### ✅ High Priority - Completed

#### 1. [x] Add Migration Documentation
**Status:** ✅ Completed  
**Files created:**
- `UPGRADING.md` - Comprehensive migration guide from 0.15.x to 0.16.x

#### 2. [x] Add SecurityContext to Init Containers
**Status:** ✅ Completed  
**Files modified:**
- `templates/_helpers.tpl` - `superset.defaultInitContainers` definition

#### 3. [x] Add External Secrets Integration
**Status:** ❌ Removed (Simplified)  
**Reason:** Removed to simplify chart - standard Kubernetes secret references are more flexible
**Migration:** Use `secretEnv.create: false` with `envFromSecret` or `extraEnv` to reference existing secrets

### ✅ Medium Priority - Completed

#### 4. [x] Add Gateway API Support
**Status:** ✅ Completed  
**Files created:**
- `templates/httproute.yaml` - Gateway API v1 HTTPRoute

#### 5. [x] Add Prometheus ServiceMonitor
**Status:** ✅ Completed  
**Files created:**
- `templates/servicemonitor.yaml` - Prometheus Operator integration

#### 6. [x] Add VPA Support
**Status:** ✅ Completed  
**Files created:**
- `templates/vpa.yaml` - Vertical Pod Autoscaler

#### 7. [x] Add KEDA Support for Celery Workers
**Status:** ✅ Completed  
**Files created:**
- `templates/scaledobject-worker.yaml` - Event-driven autoscaling

#### 8. [x] Add Default TopologySpreadConstraints
**Status:** ✅ Completed  
**Files modified:**
- `values.yaml` - Documented HA topology examples

### ✅ Low Priority - Completed

#### 9. [x] Add Deprecation Warnings in Templates
**Status:** ✅ Completed  
**Files modified:**
- `templates/_helpers.tpl` - `superset.checkDeprecatedValues` helper

#### 10. [x] Add Global Pod Annotations
**Status:** ✅ Completed  
**Files modified:**
- `values.yaml` - Added `globalPodAnnotations` section
- All deployment templates - Support global annotations

#### 11. [x] Add Chart Testing
**Status:** ✅ Completed  
**Files created:**
- `tests/deployment_test.yaml`
- `tests/security_test.yaml`
- `tests/secrets_test.yaml`
- `tests/features_test.yaml`
- `tests/labels_test.yaml`

#### 12. [x] Standardize Label Naming
**Status:** ✅ Completed  
**Description:** Standardized all labels across the chart to follow [Kubernetes recommended labels](https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/).

**Labels now used consistently:**
- `app.kubernetes.io/name` - Application name
- `app.kubernetes.io/instance` - Release name  
- `app.kubernetes.io/version` - App version
- `app.kubernetes.io/component` - Component (web, worker, celerybeat, flower, websocket)
- `app.kubernetes.io/part-of` - Always "superset"
- `app.kubernetes.io/managed-by` - Always "Helm"
- `helm.sh/chart` - Chart name and version

**Backward Compatibility:**
- Legacy labels (`app`, `release`) are preserved in selector labels for existing deployments
- Legacy labels will be removed in the next major version

**Files modified:**
- `templates/_helpers.tpl` - Added `superset.componentLabels`, `superset.componentSelectorLabels` helpers, refactored all selector labels
- `templates/deployment.yaml` - Updated to use component labels
- `templates/deployment-worker.yaml` - Updated to use component labels
- `templates/deployment-beat.yaml` - Updated to use component labels
- `templates/deployment-flower.yaml` - Updated to use component labels
- `templates/deployment-ws.yaml` - Updated to use component labels
- `templates/service.yaml` - Updated labels and selectors
- `templates/service-ws.yaml` - Updated labels and selectors
- `templates/service-flower.yaml` - Updated labels and selectors
- `templates/init-job.yaml` - Updated to use component labels
- `templates/ingress.yaml` - Updated to use component labels
- `templates/networkpolicy.yaml` - Updated labels and pod selectors
- `templates/pre-install-validation-job.yaml` - Updated to use component labels

#### 13. [x] Pods and PodTemplates Best Practices
**Status:** ✅ Completed  
**Description:** Ensured compliance with [Helm Pods and PodTemplates best practices](https://helm.sh/docs/chart_best_practices/pods).

**Best Practices Verified:**
- ✅ Images defined in `values.yaml` (repository, tag, pullPolicy)
- ✅ ImagePullPolicy configurable via values.yaml
- ✅ PodTemplates declare selectors matching pod template labels
- ✅ Fixed tags used (warning added for `latest` in websocket)
- ✅ ImagePullSecrets support

**Files modified:**
- `values.yaml` - Added documentation for image best practices
- `templates/deployment-ws.yaml` - Added warning for `latest` tag usage

**Files created:**
- `tests/pods_test.yaml` - 24 tests for pods/templates best practices

#### 14. [x] Templates Best Practices
**Status:** ✅ Completed  
**Description:** Ensured compliance with [Helm Templates best practices](https://helm.sh/docs/chart_best_practices/templates).

**Best Practices Verified:**
- ✅ File naming uses dashed notation (e.g., `deployment-worker.yaml`)
- ✅ `.yaml` extension for YAML output, `.tpl` for helpers
- ✅ Each resource definition in its own template file
- ✅ All defined templates are namespaced (`superset.*`)
- ✅ Two-space indentation (no tabs)
- ✅ Proper whitespace in template directives

**Fixes Applied:**
- Fixed 10 instances of missing space before `}}` in template directives
- Renamed `superset-config` template to `superset.config` for consistent namespacing

**Files modified:**
- `templates/_helpers.tpl` - Renamed template definition
- `templates/deployment.yaml` - Fixed directive formatting
- `templates/deployment-worker.yaml` - Fixed directive formatting
- `templates/deployment-beat.yaml` - Fixed directive formatting
- `templates/deployment-flower.yaml` - Fixed directive formatting
- `templates/deployment-ws.yaml` - Fixed directive formatting
- `templates/secret-superset-config.yaml` - Updated template reference
- `templates/init-job.yaml` - Updated comment reference

#### 15. [x] RBAC Best Practices
**Status:** ✅ Completed  
**Description:** Ensured compliance with [Helm RBAC best practices](https://helm.sh/docs/chart_best_practices/rbac).

**Best Practices Verified:**
- ✅ ServiceAccount configuration under `serviceAccount.*` key (not root level)
- ✅ `serviceAccount.create` defaults to `true`
- ✅ `serviceAccount.name` used instead of root-level `serviceAccountName`
- ✅ Helper template follows recommended pattern

**Breaking Change:**
- `serviceAccountName` moved from root level to `serviceAccount.name`
- `serviceAccount.create` now defaults to `true` (was `false`)

**Files modified:**
- `values.yaml` - Restructured `serviceAccount` configuration
- `templates/_helpers.tpl` - Updated `superset.serviceAccountName` helper
- All deployment templates - Updated conditional for serviceAccount
- `tests/deployment_test.yaml` - Updated test to use new path

**Files created:**
- `tests/rbac_test.yaml` - 11 tests for RBAC best practices

#### 16. [x] Values Best Practices
**Status:** ✅ Completed  
**Description:** Ensured compliance with [Helm Values best practices](https://helm.sh/docs/chart_best_practices/values).

**Best Practices Verified:**
- ✅ Naming conventions (camelCase, no hyphens)
- ✅ Nested values used appropriately for related configurations
- ✅ Type clarity (integers vs strings)
- ✅ Easy to override with `--set` (maps instead of arrays)
- ✅ Documentation for all properties

**Fixes Applied:**
- Changed `database.port` from string `"5432"` to integer `5432`
- Changed `cache.port` from string `"6379"` to integer `6379`
- Added `# --` documentation comments to undocumented properties
- Added documentation for `ingress.*`, `service.*`, `database.*`, `cache.*` properties

**Files modified:**
- `values.yaml` - Type fixes and documentation improvements

#### 17. [x] Helm v4.0.0 Compatibility
**Status:** ✅ Verified  
**Description:** Verified full compatibility with [Helm v4.0.0](https://helm.sh/docs/overview/).

**Compatibility Verified:**
- ✅ Chart API version: `apiVersion: v2` (compatible with Helm 3 and 4)
- ✅ No deprecated CLI flags (`--atomic`, `--force`) in documentation
- ✅ No deprecated Kubernetes API versions (all use stable v1 APIs)
- ✅ OCI registry support for dependencies (uses `oci://registry-1.docker.io/bitnamicharts`)
- ✅ Templates lint without errors on Helm 4.0.4
- ✅ Templates render correctly with `helm template`
- ✅ Unit tests pass with `helm-unittest`

**Helm 4 New Features Ready:**
- ✅ OCI digest support for dependencies
- ✅ Multi-document values ready (flat structure)
- ✅ Server-Side Apply compatible (no ownership conflicts)
- ✅ Compatible with WebAssembly plugin runtime

**No Breaking Changes Required:**
- Chart works unchanged with Helm 4
- No post-renderer workflows affected
- No registry login changes needed

#### 18. [x] Remove Backward Compatibility - Fail Fast
**Status:** ✅ Completed  
**Description:** Replaced backward compatibility code with fail-fast validation errors.

**Changes:**
- `superset.checkDeprecatedValues` helper detects deprecated values and fails deployment
- Removed legacy labels (`app`, `release`) from selector helpers
- Added `tests/deprecation_test.yaml` with 4 tests

**Deprecated Values Detected:**
- `supersetNode.connections.*` → Use `database.*` and `cache.*`
- `serviceAccountName` (root level) → Use `serviceAccount.name`

---

## Progress: 18/18 items completed (100%)

## Running Tests

```bash
helm plugin install https://github.com/helm-unittest/helm-unittest
helm unittest .
```

---

*Last updated: January 8, 2026*
