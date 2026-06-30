---
title: pkg_resources Migration Guide
sidebar_position: 9
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

# pkg_resources Deprecation and Migration Guide

## Background

As of setuptools 81.0.0, the `pkg_resources` API is deprecated and will be removed. This affects several packages in the Python ecosystem.

## Current Status

### Superset Codebase

The Superset codebase has already migrated away from `pkg_resources` to the modern `importlib.metadata` API:

- `superset/db_engine_specs/__init__.py` - Uses `from importlib.metadata import entry_points`
- All entry point loading uses the modern API

### Production Dependencies

Some third-party dependencies may still use `pkg_resources`. Monitor your dependency tree for packages that haven't migrated yet.

## Migration Path

### Short-term Solution

Pin setuptools to version 80.x to prevent breaking changes:

```python
# requirements/base.in
setuptools<81
```

This prevents the removal of `pkg_resources` while dependent packages are updated.

### Long-term Solution

Update all dependencies to use `importlib.metadata` instead of `pkg_resources`:

#### Migration Example

**Old (deprecated):**
```python
import pkg_resources

version = pkg_resources.get_distribution("package_name").version
entry_points = pkg_resources.iter_entry_points("group_name")
```

**New (recommended):**
```python
from importlib.metadata import version, entry_points

pkg_version = version("package_name")
eps = entry_points(group="group_name")
```

## Action Items

### For Superset Maintainers
1. The Superset codebase already uses `importlib.metadata`
2. Monitor third-party dependencies for updates
3. Update setuptools pin once the ecosystem is ready

### For Extension Developers
1. **Update your packages** to use `importlib.metadata` instead of `pkg_resources`
2. **Test with setuptools >= 81.0.0** once all packages are migrated

## References

- [setuptools pkg_resources deprecation notice](https://setuptools.pypa.io/en/latest/pkg_resources.html)
- [importlib.metadata documentation](https://docs.python.org/3/library/importlib.metadata.html)
- [Migration guide](https://setuptools.pypa.io/en/latest/deprecated/pkg_resources.html)
