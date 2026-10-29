---
title: Testing semantic providers
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

# Testing semantic providers

The optional `superset_core.semantic_layers.testing` pytest plugin supplies
`semantic_layer_registration` and `SemanticProviderConformance`. Install pytest
alongside the SDK's dependencies; the normal SDK import does not load pytest.
Run the suite in an isolated provider test process without a Superset application.

Load the plugin before test collection so pytest can rewrite its assertions:

```bash
pytest -p superset_core.semantic_layers.testing path/to/provider_tests
```

Inherit the suite in your own test module:

```python
from superset_core.semantic_layers.testing import SemanticProviderConformance

class TestMyProvider(SemanticProviderConformance):
    pass
```

Provide these function-scoped pytest fixtures. Import decorated provider modules
inside fixtures that depend on `semantic_layer_registration`, not at collection
time. The fixture bypasses only decoration; host registration and lifecycle need
separate integration tests.

| Fixture | Value and responsibility |
| --- | --- |
| `semantic_view` | A real SDK view over a small deterministic backend dataset. |
| `semantic_reloaded_view` | A separately constructed view of the same catalog and identity. |
| `semantic_query_cases` | Mapping from each required case below to `(SemanticQuery, expected_arrow_table)`. Expected results must be independently calculated, not obtained from the provider under test. |
| `semantic_error_cases` | Mapping from `method:kind` to a no-argument callable that executes the actual provider method against a controlled backend outcome. Methods: `get_table`, `get_values`, `get_row_count`; kinds: `refusal`, `fault`, `incomplete`, `unverified`. Do not supply closures that simply raise the expected SDK exception. |
| `semantic_capability_cases` | One `(query, expected_table)` per advertised feature value, exercising the feature. Use a positive offset and limit for `ROW_OFFSET`; use an actual group limit for `GROUP_LIMIT`/`GROUP_OTHERS`, an `AdhocExpression` order key for `ADHOC_EXPRESSIONS_IN_ORDERBY`. Features run as separate parametrized cases; unadvertised features are skipped. `ADHOC_COLUMN_EXPRESSIONS` is always skipped with "no SDK query shape yet": `SemanticQuery.dimensions` accepts only `Dimension`, and the host rejects ad-hoc dimensions. No fixture entry is required for that feature; its skip is unverified coverage, not a passing capability check. |
| `semantic_make_view` | Callable taking an opaque string token, constructing/discovering a view through the provider's binding path. Adapt the factory of your supported SDK version here. An uncached test adapter may construct a view directly; cached providers must exercise the actual binding/discovery path. |
| `semantic_change_catalog` | No-argument callable changing the controlled source catalog: add a visible member on every call, without clearing provider caches. |
| `semantic_provider_class` | `(importable_module_name, class_name)` of the layer for an isolated import and static-schema check. Dependencies must already be installed. |

Required query cases are `identity`, `grain`, `null`, `not_null`, `or`, and
`order_limit`. Use member names distinct from private IDs and display labels.
For `grain`, use a grain-bearing dimension with data whose aggregation distinguishes the selected grain from raw values. Multiple grain variants for one name are allowed, not required. When the catalog declares no grain-bearing dimension, the case skips with an explicit reason before looking up its fixture entry; such providers may omit the `grain` entry. This reports unexercised grain coverage, not a passing grain check.
NULL and grouped-OR fixtures must select NULL and non-NULL branches observably;
the `or` case must use the host-normalized shape: one `OrFilter` containing
`IN frozenset({value_a, value_b, ...})` (at least two non-NULL values) and
`IS_NULL` for the same member, combined with an outer AND comparison in the same
predicate stage. Seed data so both IN values and the NULL branch contribute,
and removing the parentheses or dropping the outer comparison changes the result.
Also seed an excluded non-NULL category that satisfies the outer comparison,
so dropping the whole OR group changes the result.
The SQLite example uses a February lower bound, with A and NULL rows on both sides
of that bound: the correct totals are NULL=1, A=5, B=8. This distinguishes either
ordering of the outer AND and the OR group. A February C row with amount 6 must
be excluded; dropping the OR group incorrectly adds C=6 to the result.
Seed more result rows than the limit, in an order that differs from the requested
sort. The suite compares exact Arrow column names, types, values and row order,
without prescribing column order or field nullability.
Expected tables must be nonempty so a provider returning no data cannot pass.
Multi-row query and capability cases must supply explicit order keys that totally
order the expected rows, without ties. Do not rely on where NULLs sort unless the
provider defines that behavior; the example orders nullable groups by their
non-null, distinct metric values.

The catalog check detects duplicate metric names, duplicate dimension name/grain
pairs, metric/dimension name collisions, and unstable selection names across
reloads. It does not make private IDs or display labels into selection keys.
The metadata test changes the source between two string-token generations.
The change fixture must retain every existing metric and dimension name/grain
pair and add at least one member; an empty, shrunken or unchanged second catalog
fails. For views that echo a token, the test checks that the first view never
claims the later generation. Legacy views can report `None`; freshness is still
checked, but token relabeling cannot be verified for those views.

The error lane asserts closed SDK refusal/completeness categories, not HTTP
status codes, host exception types or presentation messages. Fault cases reject
common programming errors (`TypeError`, `AttributeError`, `NameError`,
`AssertionError`, `KeyError`) as well as refusal/completeness exceptions; provider
lanes should additionally assert their backend-specific fault type. If a backend cannot
produce a particular `method:kind` outcome, override `test_error_categories`,
explicitly skip only that case with the backend-specific reason, and delegate
all other cases to `super().test_error_categories(...)`. Repeat both base
`@pytest.mark.parametrize` decorators on the override, with the same method and
kind lists: pytest does not inherit those marks onto an overriding method.
Record such skips as
unverified release-gate coverage, not passing conformance; do not fabricate an
SDK exception just to fill the matrix. The count lane only
checks failure propagation; it does not settle pending count or value-shape
rules. Construction fixtures avoid copying a factory signature or context type.
The host supplies default chronological ordering before calling the provider.
This suite checks the provider obligation to honor explicit ordering before limit
and offset, including the ordered grain case.

The import/schema check starts a fresh Python interpreter with the test import
path. It rejects imports of `superset`, `flask` and `flask_appbuilder`, including
transitive imports through SDK modules that depend on those frameworks, and calls
both no-configuration schema forms with common file-opening, DNS and socket
connection operations blocked. Caught attempts fail too. This is a regression
tripwire, not a sandbox or proof against every possible I/O mechanism (for example,
a native driver). Provider lanes must also replace their own transport/credential
entry points with failures to prove schema generation cannot call them.

The SDK-only examples live in `superset-core/tests/semantic_layers/`: the minimal
`example_provider.py` demonstrates registration and discovery; `conformance_provider.py`
and `test_conformance.py` show an in-memory SQLite backend with controlled failures
and explicit expected answers. SQLite runs in-process, with no server or credentials.
The example does not define new count semantics or production caching machinery.

Run the examples from the repository root:

```bash
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=$PWD/superset-core/src python -m pytest -p superset_core.semantic_layers.testing -q -o addopts='' superset-core/tests/semantic_layers/test_conformance.py
```

Passing this suite is a provider-level check, not a claim that a deployed host,
MCP caller, authorization policy, or live warehouse works. Each provider must
supply honest discriminating fixtures and retain its host caller and live-provider
lanes. Provider-lane wiring must use the actual pinned SDK, never copied types.
