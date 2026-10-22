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

# Semantic filter expressions

`SemanticQuery.filters` and `GroupLimit.filters` are AND sets of
`FilterExpression = Filter | OrFilter`. `OrFilter` is a frozen group of at least
two distinct `Filter` leaves from the same predicate stage (WHERE or HAVING).
Nested groups are unsupported. Preserve parentheses and parameterize every leaf.
Render leaves in a deterministic order, keeping bound values paired with their
predicates; frozenset iteration is not stable across processes.

The host normalizes UI `<NULL>` and `<empty string>` sentinels before coercing
values. NULL equality becomes `IS_NULL` (inequality becomes `IS_NOT_NULL`). Mixed
positive membership becomes `OrFilter(IN(non_null_values), IS_NULL)`; mixed
negative membership becomes two AND leaves, `NOT_IN` and `IS_NOT_NULL`. Empty
membership and NULL comparison/LIKE operands are rejected before provider calls.
Scalar comparisons use the first collection value, or NULL for an empty collection,
matching native datasources.

The host's `superset_typing.FilterValues` permits `None` inside list selections
and variable-length tuples. SDK `FilterValues` also includes `None`.

## Provider compatibility

Semantic views do not define a dataset-level SQL fetch-values predicate. Setting
`apply_fetch_values_predicate: true` on a chart-data query is therefore a no-op for
semantic views; explicit query filters still apply, including group-limit filters.

`OrFilter` is mandatory core vocabulary, not an optional capability. Every
provider must render groups for main queries, row counts and group-limit
subqueries. Upgrade adapters before, or atomically with, the host/SDK upgrade;
leaf-only adapters cannot consume mixed positive NULL selections. `get_values` retains
`set[Filter] | None`; its host caller supplies only a LIKE leaf or no filter.

Query and group-limit readers need `isinstance` narrowing before accessing leaf
attributes such as `operator` or `column`. Upgrading the SDK alone does not add
adapter support. Pin and test a compatible host/SDK with the adapter.
The host does not check a capability before sending groups. Never silently skip
an `OrFilter`: doing so drops a query constraint. An un-upgraded adapter can fail
during execution rather than return a host validation error.

Adapters supporting older SDKs must guard the type import, including during
rollback. Do not unconditionally import `OrFilter` at module load on those hosts:

```python
from superset_core.semantic_layers import types as semantic_types

or_filter_type: type | None = getattr(semantic_types, "OrFilter", None)
```

Use the guarded type in runtime dispatch (`or_filter_type is not None` followed
by `isinstance(expression, or_filter_type)`). Grouped rendering must be implemented
before deploying against an SDK that emits groups. Keep annotations
that reference new union types behind `TYPE_CHECKING` or in a version-specific
adapter module so older SDKs can still load the legacy leaf path.

## Result caches

The host includes `semantic-null-filters-v1` in semantic result-cache keys. This
separates legacy answers during rolling deployment without flushing unrelated
caches. Keep this protocol marker alongside any metadata-generation cache keys.

Containment-cache identities use format `v5`, separating grouped predicates from
older leaf-only entries during rolling upgrades. OR groups require identical
canonical group sets for reuse; they are not flattened or used in subset proofs
or leftover row filtering. Queries with grouped predicates do not use rollup reuse.
