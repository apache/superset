---
title: Dependencies
sidebar_position: 4
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

# Dependencies

This guide explains how to manage dependencies in your Superset extensions, including the difference between public APIs and internal code, and best practices for maintaining stable extensions.

## Core Packages vs Internal Code

Extensions run in the same context as Superset during runtime. This means extension developers can technically import any module from the Superset codebase, not just the public APIs. Understanding the distinction between public and internal code is critical for building maintainable extensions.

### Documented APIs

The core packages use [semantic versioning](https://semver.org/). A package name alone does not make every import in it a supported API. Use the documented imports for your audience:

| Package                 | Audience              | Supported use                                     |
| ----------------------- | --------------------- | ------------------------------------------------- |
| `@apache-superset/core` | Frontend extensions   | Documented frontend APIs, components, and hooks   |
| `apache-superset-core`  | Semantic providers    | Provider contracts listed below                   |
| `apache-superset-core`  | Backend host extensions | Documented host-bound APIs, including models and DAOs |

The `apache-superset-core` provider contract is imported from these explicit modules, not from the `superset_core.semantic_layers` package root:

| Module | Supported provider symbols |
| ------ | -------------------------- |
| `semantic_layers.decorators` | `semantic_layer` |
| `semantic_layers.layer` | `SemanticLayer`, `SemanticCacheResponsibility`, `SemanticCacheScope`, `SemanticCacheCapabilities`, `SemanticCacheExecutionContext`, `SemanticCacheIdentityMaterial` |
| `semantic_layers.view` | `SemanticView`, `SemanticViewFeature` |
| `semantic_layers.context` | `ExecutionOrigin`, `ExecutionMethod`, `SemanticExecutionContext`, `SemanticCredentials` |
| `semantic_layers.types` | `Grain`, `Grains`, `Dimension`, `Metric`, `AggregationType`, `Operator`, `PredicateType`, `FilterValues`, `Filter`, `OrFilter`, `FilterExpression`, `OrderDirection`, `GroupLimit`, `SemanticRequest`, `SemanticResult`, `SemanticQuery` |
| `semantic_layers.config` | `build_configuration_schema`, `check_dependencies` |
| `semantic_layers.errors` | `SemanticQueryErrorCode`, `SemanticQueryRejectedError`, `SemanticResultCompletenessError` |
| `semantic_layers.testing` | `SemanticProviderConformance` and the documented pytest fixtures |

Prefix each module with `superset_core.` in Python imports. The list covers provider-facing symbols; a type being supported does not imply every feature or enum value is supported by every host version. Check the [semantic-layer provider guide](./extension-points/semantic-layers.md) for usage and the [provider testing guide](../semantic-layer-provider-testing.md) for the test kit.

`SemanticCredentials` is a reserved channel for future non-connection credentials; providers must not treat it as cache identity. `ExecutionOrigin.CONFIG` and `ExecutionOrigin.BACKGROUND` are reserved for host entry points and are not a promise that those invocation paths are available. Providers should handle only origins the host actually supplies and reject unknown ones.

Host extensions are a separate audience. `superset_core.semantic_layers.models.SemanticLayerModel` and `SemanticViewModel`, and `superset_core.semantic_layers.daos.AbstractSemanticLayerDAO` and `AbstractSemanticViewDAO`, are host-bound persistence interfaces. They depend on the Superset host and its Flask-AppBuilder/SQLAlchemy environment; a standalone semantic provider does not need to import them. Other host-extension APIs are supported where their extension-point documentation names the import path.

### Internal Code (Unstable)

Code outside the documented API for the relevant audience is internal. This includes:

- Direct imports from `superset-frontend/src/` modules
- Direct imports from `superset/` Python modules (outside of `superset_core`)
- Undocumented functions, classes, or utilities inside a core package

:::warning Use at Your Own Risk
Internal code can change at any time without notice. If you depend on internal modules, your extension may break when Superset is upgraded. There is no guarantee of backward compatibility for internal code.
:::

**Example of internal vs public imports:**

```typescript
// ✅ Public API - stable
import { Button, sqlLab } from '@apache-superset/core';

// ❌ Internal code - may break without notice
import { someInternalFunction } from 'src/explore/components/SomeComponent';
```

```python
# ✅ Public API - stable
from superset_core.common.models import Database
from superset_core.common.daos import DatabaseDAO

# ❌ Internal code - may break without notice
from superset.views.core import SomeInternalClass
```

## API Evolution

The core packages are still evolving. For `apache-superset-core`, `0.x` minor releases may change documented contracts; patch releases should preserve them except for necessary correctness or security fixes. At `1.0` and later, incompatible documented API changes require a major release, compatible additions a minor release, and fixes a patch release. The package version is the contract version; there is no separate semantic-layer contract number.

Before removing or changing a documented Python API, we normally mark it deprecated in documentation and the [package changelog](https://github.com/apache/superset/blob/master/superset-core/CHANGELOG.md), provide a migration path, and emit `DeprecationWarning` where a runtime warning is practical. Keep the deprecated path for at least one minor release when feasible. A security or correctness fix may require a shorter transition; its release note must describe the impact. The changelog records additions, deprecations, removals, and behavior changes starting with the next package release. An unreleased entry is not an installable version.

**What this means for extension developers:**

- Check the release notes when upgrading Superset
- Test your extensions against new Superset versions before deploying
- Participate in discussions about API changes to influence the direction
- In some cases, using internal dependencies may be acceptable while the public API is being developed for your use case

### When Internal Dependencies May Be Acceptable

While public APIs are always preferred, there are situations where using internal code may be reasonable:

1. **Missing functionality**: The public API doesn't yet expose what you need
2. **Prototype/experimental extensions**: You're exploring capabilities before committing to a stable implementation
3. **Bridge period**: You need functionality that's planned for the public API but not yet released

In these cases, document your internal dependencies clearly and plan to migrate to public APIs when they become available.

## Core Library Dependencies

An important architectural principle of the Superset extension system is that **we do not provide abstractions on top of core dependencies** like React (frontend) or SQLAlchemy (backend).

### Why We Don't Abstract Core Libraries

Abstracting libraries like React or SQLAlchemy would:

- Create maintenance overhead keeping abstractions in sync with upstream
- Limit access to the full power of these libraries
- Add unnecessary abstraction layers
- Fragment the ecosystem with Superset-specific variants

### Depending on Core Libraries Directly

Extension developers should depend on and use core libraries directly:

**Frontend (examples):**

- [React](https://react.dev/) - UI framework
- [Ant Design](https://ant.design/) - UI component library (prefer Superset components from `@apache-superset/core/components` when available to preserve visual consistency)
- [Emotion](https://emotion.sh/) - CSS-in-JS styling
- ...

**Backend (examples):**

- [SQLAlchemy](https://www.sqlalchemy.org/) - Database toolkit
- [Flask](https://flask.palletsprojects.com/) - Web framework
- [Flask-AppBuilder](https://flask-appbuilder.readthedocs.io/) - Application framework
- ...

:::info Version Compatibility
When Superset upgrades its core dependencies (e.g., a new major version of Ant Design or SQLAlchemy), extension developers should upgrade their extensions accordingly. This ensures compatibility and access to the latest features and security fixes.
:::

## API Versioning and Changelog

The Python package has its own [changelog](https://github.com/apache/superset/blob/master/superset-core/CHANGELOG.md) before v1. Each published version records changes to documented APIs, including:

- New APIs and features
- Deprecation notices
- Breaking changes with migration guides
- Bug fixes affecting API behavior

For frontend APIs, monitor the Superset release notes. For either package, test your extension against each target Superset release before deploying it.

## Best Practices

### Do

- **Prefer public APIs**: Always check if functionality exists in `@apache-superset/core` or `apache-superset-core` before using internal code
- **Pin versions**: Specify compatible Superset versions in your extension metadata
- **Test upgrades**: Verify your extension works with new Superset releases before deploying
- **Report missing APIs**: If you need functionality not in the public API, open a GitHub issue to request it
- **Use core libraries directly**: Leverage Ant Design, SQLAlchemy, and other core libraries directly

### Don't

- **Assume stability of internal code**: Internal modules can change or be removed in any release
- **Depend on implementation details**: Even if something works, it may not be supported
- **Skip upgrade testing**: Always test your extension against new Superset versions
- **Expect abstractions**: Use core dependencies directly rather than expecting Superset-specific abstractions

## Next Steps

- **[Architecture](./architecture.md)** - Understand the extension system design
- **[Development](./development.md)** - Learn about APIs and development workflow
- **[Quick Start](./quick-start.md)** - Build your first extension
