---
title: Semantic Layers
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

# Semantic Layers

See [cache invalidation](../../semantic-layer-cache-clear.md) for the required
cache-token factory argument and provider cache requirements.

See the [execution context contract](../semantic-execution-context.md) for provider construction and connection-mode guarantees.

See [semantic filter expressions](../semantic-filters.md) for the filter contract that providers must honor.

Extensions can register custom semantic layer implementations that allow Superset to connect to external data modeling frameworks. Each semantic layer defines how to authenticate, discover semantic views (tables/metrics/dimensions), and execute queries against the external system.

```python
from typing import Any

from superset_core.semantic_layers.context import SemanticCredentials, SemanticExecutionContext
from superset_core.semantic_layers.decorators import semantic_layer
from superset_core.semantic_layers.layer import SemanticLayer

from my_extension.config import MyConfig
from my_extension.view import MySemanticView


@semantic_layer(
    id="my_platform",
    name="My Data Platform",
    description="Connect to My Data Platform's semantic layer",
)
class MySemanticLayer(SemanticLayer[MyConfig, MySemanticView]):
    configuration_class = MyConfig

    def __init__(
        self, configuration: MyConfig, *, cache_token: str,
        context: SemanticExecutionContext,
    ) -> None:
        self.configuration: MyConfig = configuration
        self.cache_token: str = cache_token
        self.context: SemanticExecutionContext = context

    @classmethod
    def from_configuration(
        cls, configuration: dict[str, Any], *, cache_token: str,
        context: SemanticExecutionContext, credentials: SemanticCredentials | None = None,
    ) -> "MySemanticLayer":
        config: MyConfig = MyConfig.model_validate(configuration)
        return cls(config, cache_token=cache_token, context=context)

    @classmethod
    def get_configuration_schema(cls, configuration=None) -> dict:
        return MyConfig.model_json_schema()

    @classmethod
    def get_runtime_schema(cls, configuration=None, runtime_data=None) -> dict:
        return {"type": "object", "properties": {}}

    def get_semantic_views(self, runtime_configuration: dict) -> set[MySemanticView]:
        # Return available views from the external platform
        ...

    def get_semantic_view(self, name: str, additional_configuration: dict) -> MySemanticView:
        # Return a specific view by name
        ...
```

**Note**: The `@semantic_layer` decorator automatically detects context and applies appropriate ID prefixing:

- **Extension context**: ID prefixed as `extensions.{publisher}.{name}.{id}`
- **Host context**: Original ID used as-is

The decorator registers the class in the semantic layers registry, making it available in the UI for users to create connections. The `configuration_class` should be a Pydantic model that defines the fields needed to connect (credentials, project, database, etc.). Superset uses the model's JSON schema to render the configuration form dynamically.

## Provider obligations and isolated tests

Store the parsed configuration instance on the writable `self.configuration`
attribute, using the provider's configuration type. Assigning a raw dictionary is
a type error by design; a read-only `@property` is not supported.
The host reads this attribute to request the runtime schema.
`get_configuration_schema()` and `get_configuration_schema(None)` must
return a static schema without I/O or a constructed provider: the host calls
this form before credentials exist and when identifying secret fields.

`get_values(dimension, filters)` returns its Arrow value column under
`dimension.name` for nonempty results. The private `id` and display `verbose_name`
are not result-column names. Legacy single-column and empty-result handling are
unchanged. Apply filters or refuse the request; never drop them
and retry. See the SDK `SemanticView` docstrings for member identity, grain
variants and ordering before limit, and the [query error guide](../../semantic-query-errors.md)
for typed refusals versus operational faults. The selection-version guard is a
separate boundary and raises `ValueError`; it does not classify provider faults.

Bind provider construction to the supplied execution context and cache token.
An uncached provider needs no shared cache. A provider that does cache must
partition **actual lookups**, before
discovery, by the token and the existing endpoint/credential/role/view scope.
Merely assigning `self.cache_token` is not invalidation. The
[cache guide](../../semantic-layer-cache-clear.md#provider-sdk-contract) describes
the required factory and provider cache behavior. Schema transport
evolution is separate from these obligations; use the signatures supplied by the
SDK version your provider supports.

For tests without a running Superset application, install
`apache-superset-core[testing]` and enable the SDK plugin in your root `conftest.py`:

```python
pytest_plugins = ["superset_core.semantic_layers.testing"]
```

Import decorated provider modules **inside** a test or fixture that requests
`semantic_layer_registration`, after it has been activated:

```python
def test_configuration(semantic_layer_registration: None) -> None:
    from my_extension.layer import MySemanticLayer

    schema: dict[str, object] = MySemanticLayer.get_configuration_schema()
    assert schema["type"] == "object"
```

The fixture substitutes only the SDK registration decorator and restores it after
the test. It keeps the provider class intact, without a registry or host startup.
It does not emulate ID prefixing, duplicate detection or extension lifecycle;
keep those checks in a host integration lane. Module-level imports happen too
soon, and previously imported decorator aliases are not replaced. Use isolated
provider test processes, not a live host. An executable, SDK-only example is in
[`superset-core/tests/semantic_layers/example_provider.py`](https://github.com/apache/superset/blob/master/superset-core/tests/semantic_layers/example_provider.py).
It demonstrates discovery and values only; unsupported table/count queries are
explicitly refused, not claimed as a full provider implementation.

## Declaring semantic view features

A `SemanticView` advertises what its backend supports through the `features`
frozenset. Declaration is opt-in: a view that declares nothing gets the most
conservative behavior, so a new provider is safe by default.

```python
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature


class MySemanticView(SemanticView):
    features = frozenset(
        {
            # The backend accepts simple/custom-SQL column expressions built
            # in Explore. Omit this member if it only accepts the view's own
            # dimensions.
            SemanticViewFeature.ADHOC_COLUMN_EXPRESSIONS,
            SemanticViewFeature.GROUP_LIMIT,
        }
    )
```

The declared members are serialized to the Explore datasource payload as
`semantic_view_features` (their stable string values). The provider's registry
key is deliberately **not** sent: because the `@semantic_layer` decorator
prefixes extension IDs, no stable bare key exists to publish, and behavior
keyed off provider identity would not survive that prefixing.

For column pickers, Explore translates `semantic_view_features` exactly once, in the
datasource-to-picker-capabilities adapter
(`superset-frontend/src/explore/components/controls/DndColumnSelectControl/utils/pickerCapabilities.ts`),
into a provider-neutral `ColumnPickerCapabilities` value. That adapter is the
anti-corruption boundary between provider metadata and generic UI: picker
components consume capabilities and must not read `semantic_view_features`, a
registry key, or a user-editable display name. New provider-specific behavior
belongs in a capability, not in a comparison inside a picker component.

A view that does not declare `ADHOC_COLUMN_EXPRESSIONS` gets a Saved-only
column picker: its dimensions are listed as Saved options and the Simple and
Custom SQL modes are visible but disabled, so users cannot build an expression
the backend would reject. Unknown feature strings and payloads with no
`semantic_view_features` field are ignored, preserving existing behavior.

## Server pagination

A view may declare `SemanticViewFeature.ROW_OFFSET` when it supports
non-negative row offsets together with a positive finite limit. This does not
promise offset-without-limit support, stable ordering without a sort, or snapshot
consistency across pages. Providers remain responsible for validating query
shapes and must honor offsets or return a clear error, never silently repeat
the first page.

The Table and AG Grid Table charts read this capability from
`semantic_view_features`. For a semantic view with missing, empty, or
unknown-only capabilities, **Server
pagination** remains visible but disabled with an explanation. Ordinary SQL
datasets keep their existing controls. Existing saved settings are preserved:
an unsupported query continues to return the provider's actionable error until
the author explicitly turns off server pagination and saves the chart. Opening
a chart or switching datasources does not rewrite pagination settings. A saved
enabled control offers a **Turn off server pagination** action beside the
explanation once datasource metadata is available. During a datasource-type
switch, controls follow the selected form-data datasource type rather than stale
metadata; capabilities from a different datasource type do not enable pagination.

This is an optional UI capability, not a new permission or a host-wide query
validator. Direct API callers continue to use provider-local enforcement.
Providers must deploy against a compatible core version before importing the
new enum member. Older providers remain valid with an empty feature set; their
Table pagination controls stay disabled until they explicitly opt in.

## Semantic result containment caching

Superset containment caching is experimental and off by default. A provider must
explicitly opt in; the safe defaults leave caching with the provider and scope
results to an execution context:

```python
from superset_core.semantic_layers.layer import (
    SemanticCacheCapabilities,
    SemanticCacheExecutionContext,
    SemanticCacheIdentityMaterial,
    SemanticCacheResponsibility,
    SemanticCacheScope,
)

class MySemanticLayer(SemanticLayer[MyConfig, MySemanticView]):
    semantic_cache_responsibility = SemanticCacheResponsibility.SUPERSET
    semantic_cache_scope = SemanticCacheScope.EXECUTION_CONTEXT
    semantic_cache_capabilities = SemanticCacheCapabilities(
        comparisons=True,
        membership=True,
        nulls=True,
        pattern_escape="\\",
    )

    def get_semantic_cache_provider_identity(self) -> SemanticCacheIdentityMaterial:
        return SemanticCacheIdentityMaterial(
            {"provider_version": "v1", "catalog": self.config.catalog}
        )

    def get_semantic_cache_context_identity(
        self,
        context: SemanticCacheExecutionContext,
    ) -> SemanticCacheIdentityMaterial:
        return SemanticCacheIdentityMaterial({"tenant": self.tenant_id(context)})
```

Identity material must be secret-free and include every provider setting that can
change results. For execution-context scope, Superset also hashes the principal,
roles, guest-token claims, and row-level-security cache key. Returning `None` from
either identity method bypasses containment. Use `GLOBAL` only when results are
provably identical across principals and tenants; containment is bypassed for a
`GLOBAL` view whenever Superset row-level security applies to the request, since
that variation is invisible to the provider. Declare only filter capabilities
whose provider semantics exactly match Superset's post-processing semantics.

`comparisons=True` assumes binary (codepoint) string ordering and equality;
`pattern_escape` assumes case-sensitive SQL LIKE. Providers using case-insensitive
collations must not opt into these capabilities. These declarations apply to
every string dimension exposed by the provider, not just the queried example.

Narrowing a time range on a grained axis always requires a provider round-trip:
leftover WHERE filters cannot be applied to cached bucket starts, including when
the filter names the raw column of that axis.

Operators enable both `SEMANTIC_LAYERS` and the development feature flag
`SEMANTIC_LAYER_CONTAINMENT_CACHE`, and configure two backends:

- `DATA_CACHE_CONFIG` holds the cached results and their descriptors. It must be
  a persistent cache shared by every web and worker process, such as `RedisCache`.
  The default `NullCache` discards every value, so containment would only ever
  miss; `RedisSentinelCache` reads from replicas that can lag the master. Both
  disable containment at startup rather than run it ineffectively.
- `DISTRIBUTED_COORDINATION_CONFIG` must select `RedisCache` or
  `RedisSentinelCache`; containment requires its atomic owner-token lease
  operations.

```python
DATA_CACHE_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_DEFAULT_TIMEOUT": 86400,
    "CACHE_KEY_PREFIX": "superset_results",
    "CACHE_REDIS_URL": "redis://redis:6379/1",
}
DISTRIBUTED_COORDINATION_CONFIG = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": "redis",
    "CACHE_REDIS_PORT": 6379,
    "CACHE_REDIS_DB": 2,
}
```

Containment follows the same cache timeout the ordinary result cache resolves for
a request (custom, then chart, then dataset), so a chart-level timeout of `-1`
bypasses containment entirely, and honors `DATA_CACHE_MAX_VALUE_SIZE`: a result
larger than that many bytes is served but not stored. The bounded defaults are
`SEMANTIC_CACHE_COORDINATION_WAIT_SECONDS = 1.0` and
`SEMANTIC_CACHE_COORDINATION_LEASE_SECONDS = 30`. A missing or unsuitable backend
and missing or invalid coordination each disable only containment, log a fixed
warning without configuration or query content, and leave provider execution
available.

Roll out to a canary worker cohort after recording provider latency, error rate,
and cache-backend health for a comparable baseline. Observe at least one normal
traffic cycle. Alert ownership should sit with the semantic-platform operator.
Track `semantic_cache.containment.enabled`, `semantic_cache.containment.hit`,
`semantic_cache.containment.miss`, `semantic_cache.containment.bypass`,
`semantic_cache.containment.store_skipped`, `semantic_cache.containment.store_failure`,
`semantic_cache.containment.lookup_failure`, `semantic_cache.containment.transform_failure`,
`semantic_cache.containment.prune_failure`, `semantic_cache.containment.fence_reject`,
`semantic_cache.containment.coordination_failure`,
`semantic_cache.containment.unsupported`, and `semantic_cache.containment.invalid_configuration`.
Alert on the `semantic_cache.containment.store_failure`,
`semantic_cache.containment.lookup_failure`, `semantic_cache.containment.transform_failure`,
`semantic_cache.containment.prune_failure`, and `semantic_cache.containment.coordination_failure`
counters, and unexpected `semantic_cache.containment.unsupported` or
`semantic_cache.containment.invalid_configuration` at startup.
Coordination socket/connect timeouts derive from `SEMANTIC_CACHE_COORDINATION_WAIT_SECONDS`
(with a 1 ms minimum for zero wait); these bound individual I/O calls, not the whole request.
Separate lease/value clients use a non-atomic immediate ownership recheck before writing.
The atomic Lua fence is a same-client optimisation for explicitly injected clients.
Default application initialization constructs a private coordination client, so
ordinary deployments do not exercise that optimisation even when both caches
point at the same Redis server. Reader-side fencing protects this split-store
path: each store writes a fresh nonce into both the descriptor and a result
envelope. Exact-key and containment lookups accept only matching nonempty nonces.
A stale SET after lease takeover can overwrite a payload, but a mismatched pair
is rejected rather than served. The lookup may use another valid candidate or
execute the provider. `semantic_cache.containment.fence_reject` counts lookups
that rejected at least one invalid publication (not ordinary expired values).

Maintenance rechecks the current descriptor and payload under the mutation lease
before pruning. A concurrently repaired matching pair is retained. Rejection
pruning never deletes payloads, which expire according to their own TTL. This
fence can trade cache hits for misses under a stalled writer; it is not a
cross-store transaction or a promise of linearizable refreshes. Store deduplication
also requires a matching pair, so an invalid payload cannot suppress its repair.
The cache identity format is `v4`; pre-fence `v3` entries are not reused.
Validate the split-store path under concurrent forced refreshes, whole-process
pauses exceeding the lease, and narrowed time ranges.
Define deployment-specific rollback thresholds before the
canary; recommended triggers are any provider-result mismatch, sustained provider
error regression, coordination failures above 1% of cache mutations, or lookup and
store failures above 5% of semantic requests.

Rollback by disabling `SEMANTIC_LAYER_CONTAINMENT_CACHE` and restarting every web
and worker process. Confirm worker convergence with an `enabled` gauge of zero for
each process and normal provider-query success. Cache data need not be deleted for
rollback because disabled processes do not read or write it.

## Choosing a default time dimension

A semantic view may set `preferred_temporal_dimension` to the name of a temporal
dimension it exposes. Superset publishes that name as `main_dttm_col`, which
Explore uses for the default time filter on new charts. The declaration is
ignored if the name is absent or does not identify a temporal dimension.

```python
class MySemanticView(SemanticView):
    preferred_temporal_dimension = "metric_time"
```

Providers that omit the declaration retain Explore's existing first temporal
column fallback. This preference does not change the time dimension already
selected on a saved chart.
