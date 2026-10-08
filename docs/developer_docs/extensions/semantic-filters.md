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

## Provider compatibility

`OR_FILTERS` is off by default. Declare it only after implementing groups for
main queries, row counts and group-limit subqueries. Existing leaf-only adapters
continue to work, but mixed positive NULL selections return a query validation
error (HTTP 400) until the adapter opts in. `get_values` retains
`set[Filter] | None`; its host caller supplies only a LIKE leaf or no filter.

Query and group-limit readers need `isinstance` narrowing before accessing leaf
attributes such as `operator` or `column`. Upgrading the SDK alone does not add
adapter support. Pin and test a compatible host/SDK with the adapter.

Adapters supporting older SDKs must guard both the type import and capability
lookup, including during rollback. Do not unconditionally import `OrFilter` or
access `SemanticViewFeature.OR_FILTERS` at module load on those hosts:

```python
from superset_core.semantic_layers import types as semantic_types
from superset_core.semantic_layers.view import SemanticViewFeature

or_filter_type: type | None = getattr(semantic_types, "OrFilter", None)
or_filters_feature: SemanticViewFeature | None = getattr(
    SemanticViewFeature, "OR_FILTERS", None
)
```

Use the guarded type in runtime dispatch (`or_filter_type is not None` followed
by `isinstance(expression, or_filter_type)`). Only advertise the capability when
both lookups succeed **and** grouped rendering is implemented. Keep annotations
that reference new union types behind `TYPE_CHECKING` or in a version-specific
adapter module so older SDKs can still load the legacy leaf path.

## Result caches

The host includes `semantic-null-filters-v1` in semantic result-cache keys. This
also versions outer chart caches containing semantic chart annotations. This
separates legacy answers during rolling deployment without flushing unrelated
caches. Keep this protocol marker alongside any metadata-generation cache keys.
