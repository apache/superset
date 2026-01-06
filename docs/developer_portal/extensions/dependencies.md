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

### Public APIs (Stable)

The core packages follow [semantic versioning](https://semver.org/) and provide stable, documented APIs:

| Package | Language | Description |
|---------|----------|-------------|
| `@apache-superset/core` | JavaScript/TypeScript | Frontend APIs, UI components, hooks, and utilities |
| `apache-superset-core` | Python | Backend APIs, models, DAOs, and utilities |

**Benefits of using core packages:**

- **Semantic versioning**: Breaking changes are communicated through version numbers
- **Documentation**: APIs are documented with clear usage examples
- **Stability commitment**: We strive to maintain backward compatibility
- **Type safety**: Full TypeScript and Python type definitions

### Internal Code (Unstable)

Any code that is not exported through the core packages is considered internal. This includes:

- Direct imports from `superset-frontend/src/` modules
- Direct imports from `superset/` Python modules (outside of `superset_core`)
- Undocumented functions, classes, or utilities

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
from superset_core.api.models import Database
from superset_core.api.daos import DatabaseDAO

# ❌ Internal code - may break without notice
from superset.views.core import SomeInternalClass
```

## API Evolution

The core packages are still evolving. While we follow semantic versioning, the APIs may change as we add new extension points and refine existing ones based on community feedback.

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
- [Ant Design](https://ant.design/) - UI component library (prefer Superset components from `@apache-superset/core/ui` when available to preserve visual consistency)
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

Once the extensions API reaches **v1**, we will maintain a dedicated `CHANGELOG.md` file to track all changes to the public APIs. This will include:

- New APIs and features
- Deprecation notices
- Breaking changes with migration guides
- Bug fixes affecting API behavior

Until then, monitor the Superset release notes and test your extensions with each new release.

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

- **[Architecture](./architecture)** - Understand the extension system design
- **[Development](./development)** - Learn about APIs and development workflow
- **[Quick Start](./quick-start)** - Build your first extension
