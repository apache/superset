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

# Procedural escape hatch

Small, named, single-purpose Python scripts for the rare cases where declarative YAML in `../config/` can't cleanly express a fix.

## When to put a script here

Use this directory when **all** of the following are true:

- You've tried to express the fix in YAML and the resulting schema is awkward, ambiguous, or requires a one-off type to be added
- The fix is small (typically <50 lines of code, single conceptual operation)
- The fix is tied to a *specific feature* in the data (not a generalizable transform)

## When NOT to put a script here

If any of the following apply, the fix belongs in `../config/` instead:

- It's a typo, rename, or attribute correction → `name_overrides.yaml`
- It's a reposition or bbox drop of a known territory → `flying_islands.yaml`
- It's adding a feature from another country → `territory_assignments.yaml`
- It's dissolving Admin 1 into a coarser admin level → `regional_aggregations.yaml`
- It's a multi-country composite → `composite_maps.yaml`

If the same kind of operation surfaces here twice, that's a signal to extend a YAML schema rather than ship a third script.

## Script conventions

- **Filename:** `NN_<descriptive_snake_case>.py`. The numeric prefix sets execution order; the name documents intent.
- **Header comment:** required. Must explain *what* the script does AND *why* this couldn't be expressed in YAML. If the "why" is weak, push it back into YAML.
- **Interface:** each script defines `def apply(geo: dict) -> dict` taking a parsed GeoJSON FeatureCollection and returning the modified one. The build orchestrator handles I/O.
- **No side effects** other than the returned data — no network calls, no file writes, no `print` other than logging via `sys.stderr`.
- **Pure function over GeoJSON.** Don't import shapely/geopandas unless the operation truly needs polygon math; many fixes are just attribute mutations.

## Skeleton

```python
"""
NN_descriptive_name.py
======================

WHAT: One-sentence summary of what this script does to the data.

WHY:  One-paragraph explanation of why this couldn't be expressed in
      ../config/<some_yaml>.yaml. If you find yourself writing
      "because I didn't want to add a field to the schema", push the
      fix into the YAML schema instead.

UPSTREAM TRACKING: link to NE issue / community discussion / blog post
      explaining the underlying source of the problem, so future
      maintainers can re-evaluate when upstream catches up.
"""

import sys


def apply(geo: dict) -> dict:
    # ... mutate features ...
    return geo
```

## Currently empty

There are no procedural scripts yet. The audit suggested the France-with-Overseas Windward Islands sub-polygon drop *might* warrant one, but `composite_maps.yaml` already has a `drop_parts` field that covers it. We'll add scripts here only if/when a genuine edge case proves YAML can't express it.
