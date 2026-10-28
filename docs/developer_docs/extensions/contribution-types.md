---
title: Contribution Types
sidebar_position: 5
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

# Contribution Types

To facilitate the development of extensions, we define a set of well-defined contribution types that extensions can implement. These contribution types serve as the building blocks for extensions, allowing them to interact with the host application and provide new functionality.

## Frontend

Frontend contribution types allow extensions to extend Superset's user interface with new views, commands, and menu items. Frontend contributions are registered directly in code from your extension's `index.tsx` entry point.

### Views

Extensions can add new views or panels to the host application, such as custom SQL Lab panels, dashboards, or other UI components. Contribution areas are uniquely identified (e.g., `sqllab.panels` for SQL Lab panels), enabling seamless integration into specific parts of the application.

```typescript
import { views } from '@apache-superset/core';
import MyPanel from './MyPanel';

views.registerView(
  { id: 'my-extension.main', name: 'My Panel Name' },
  'sqllab.panels',
  MyPanel,
);
```

### Commands

Extensions can define custom commands that can be executed within the host application, such as context-aware actions or menu options. Each command specifies a unique identifier, a title, an optional icon, and a description. Commands can be invoked by users through menus, keyboard shortcuts, or other UI elements.

```typescript
import { commands } from '@apache-superset/core';

commands.registerCommand(
  {
    id: 'my-extension.copy-query',
    title: 'Copy Query',
    icon: 'CopyOutlined',
    description: 'Copy the current query to clipboard',
  },
  () => {
    // Command implementation
  },
);
```

### Menus

Extensions can contribute new menu items or context menus to the host application, providing users with additional actions and options. Each menu item specifies the view and command to execute, the target area, and the location (`primary`, `secondary`, or `context`). Menu contribution areas are uniquely identified (e.g., `sqllab.editor` for the SQL Lab editor).

```typescript
import { menus } from '@apache-superset/core';

menus.registerMenuItem(
  { view: 'sqllab.editor', command: 'my-extension.copy-query' },
  'sqllab.editor',
  'primary',
);

menus.registerMenuItem(
  { view: 'sqllab.editor', command: 'my-extension.prettify' },
  'sqllab.editor',
  'secondary',
);

menus.registerMenuItem(
  { view: 'sqllab.editor', command: 'my-extension.clear' },
  'sqllab.editor',
  'context',
);
```

### Editors

Extensions can replace Superset's default text editors with custom implementations. This enables enhanced editing experiences using alternative editor frameworks like Monaco, CodeMirror, or custom solutions. When an extension registers an editor for a language, it replaces the default editor in all locations that use that language (SQL Lab, Dashboard Properties, CSS editors, etc.).

```typescript
import { editors } from '@apache-superset/core';
import MonacoSQLEditor from './MonacoSQLEditor';

editors.registerEditor(
  {
    id: 'my-extension.monaco-sql',
    name: 'Monaco SQL Editor',
    languages: ['sql'],
  },
  MonacoSQLEditor,
);
```

See [Editors Extension Point](./extension-points/editors.md) for implementation details.

### Chat

Extensions can add a chat interface to Superset by registering a trigger component and a panel component. The host owns the layout, open/close state, and display mode — the extension only provides the UI. The panel can be displayed as a floating overlay or docked as a resizable sidebar beside the page content, and the user's preference is persisted across reloads.

```tsx
import { chat } from '@apache-superset/core';
import ChatTrigger from './ChatTrigger';
import ChatPanel from './ChatPanel';

chat.registerChat(
  { id: 'my-org.my-chat', name: 'My Chat' },
  ChatTrigger,
  ChatPanel,
);
```

See [Chat](./extension-points/chat.md) for implementation details.

### Pages

Extensions can add a page of their own: a whole screen at its own URL, as
opposed to a view that occupies a slot inside a screen Superset already ships.

A page is declared in `extension.json` and registered in code. Both halves are
needed. The declaration is what the server reads to register a URL rule, so
that loading the page's URL directly works; the registration supplies the
component to render there.

```json
{
  "contributions": {
    "pages": [
      {
        "path": "/review-queue",
        "name": "Review queue",
        "nav": { "label": "Review queue" },
        "permission": "can_review"
      }
    ]
  }
}
```

```typescript
import { pages } from '@apache-superset/core';
import ReviewQueue from './ReviewQueue';

pages.registerPage(
  { path: '/review-queue', name: 'Review queue' },
  ReviewQueue,
);
```

#### Choosing a path

The path is yours to choose, but it is not yours to take. On every start,
Superset checks each declared path against the routes that deployment actually
serves — its own screens and APIs, any blueprints the operator has registered,
and pages other extensions have already claimed. A path that is taken is
refused: the page is not registered, the server log names what holds the path,
and the rest of the extension loads normally.

Pick something specific. A page owns its path **and everything beneath it**, so
`/review-queue` also answers `/review-queue/42/edit`. Short, generic paths are
the ones most likely to collide with a future Superset release.

Paths are lowercase segments with a leading slash and no trailing slash:
`/review-queue`, `/acme/reports`. No parameters — a page routes within itself
on the client.

#### Routing inside a page

Because a page owns everything beneath its path, it can have more than one
screen. Two hooks read the host's router:

```typescript
const subPath = pages.useSubPath();   // '/42/edit' at /review-queue/42/edit
const navigate = pages.useNavigate();

navigate('/42');  // -> /review-queue/42, a client-side transition
navigate('/');    // back to the page root
```

`navigate` takes a path relative to the page, so a page never writes its own
URL. These exist because `react-router-dom` is not shared with extensions: an
extension importing it would get a second copy with its own React context, and
`useLocation()` would throw.

#### Appearing in the navigation bar

Add `nav` and the page gets a top-level entry, labelled `nav.label` or the
page's `name`. Omit `nav` for a page reached from somewhere the extension
renders itself — a button on one of its own screens — and the page stays
reachable by URL.

#### Restricting access

Name a `permission` and only users holding it may open the page; anyone else
gets 403 and sees no navigation entry. Superset creates the permission when
the extension loads and shows it in **Settings → List Roles** as, for example,
`can review on extension:acme.tools`, ready to grant to any role. The Admin
role receives it automatically, unless some role already holds it.

Omit `permission` and the page is open to any signed-in user.

A few names are reserved, because Superset's own role rules already give them
meaning: `database_access`, `catalog_access`, `schema_access`,
`datasource_access`, `can_userinfo` and `can_recent_activity`. A page naming
one is refused at startup.

The permission gates the page itself. Anything the page then calls — Superset's
APIs, or your extension's own — is authorised separately, so a page is not a
way to widen what a user can reach.

#### Using Superset's API from a page

Call Superset's API through the `http` namespace. It carries the host's
session and attaches a CSRF token to every write, so a page never fetches one
of its own:

```ts
import { http } from '@apache-superset/core';

const { json } = await http.get<{ result: Review[] }>({
  endpoint: '/api/v1/acme/reviews/',
});

await http.post({
  endpoint: '/api/v1/acme/reviews/',
  jsonPayload: { asset_id: 42 },
});
```

`get`, `post`, `put` and `del` all take an `endpoint` -- a path under this
Superset, beginning with `/`, to which the host applies the application root
-- and return the parsed `json`, the `status` and the response `headers`. An
absolute or protocol-relative URL is refused: the call carries your session,
so reaching another origin is `fetch`'s job, not this namespace's. The
delete verb is `del`, because `delete` is a reserved word.

`@superset-ui/core` is not shared with extensions, and `SupersetClient` is not
part of the extension API. An extension that imports it bundles its own copy,
which is never configured, so calls through it go out without a CSRF token.

## Backend

Backend contribution types allow extensions to extend Superset's server-side capabilities. Backend contributions are registered at startup via classes and functions imported from the auto-discovered `entrypoint.py` file.

### REST API Endpoints

Extensions can register custom REST API endpoints under the `/extensions/` namespace. This dedicated namespace prevents conflicts with built-in endpoints and provides a clear separation between core and extension functionality.

```python
from flask import Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from superset_core.rest_api.api import RestApi
from superset_core.rest_api.decorators import api

@api(
    id="my_extension_api",
    name="My Extension API",
    description="Custom API endpoints for my extension",
)
class MyExtensionAPI(RestApi):
    openapi_spec_tag = "My Extension"
    class_permission_name = "my_extension_api"

    @expose("/hello", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    def hello(self) -> Response:
        return self.response(200, result={"message": "Hello from extension!"})

# Import the class in entrypoint.py to register it
from .api import MyExtensionAPI
```

**Note**: The [`@api`](https://github.com/apache/superset/blob/master/superset-core/src/superset_core/rest_api/decorators.py) decorator automatically detects context and generates appropriate paths:

- **Extension context**: `/extensions/{publisher}/{name}/` with ID prefixed as `extensions.{publisher}.{name}.{id}`
- **Host context**: `/api/v1/` with original ID

For an extension with publisher `my-org` and name `dataset-tools`, the endpoint above would be accessible at:

```
/extensions/my-org/dataset-tools/hello
```

You can also specify a `resource_name` parameter to add an additional path segment:

```python
@api(
    id="analytics_api",
    name="Analytics API",
    resource_name="analytics",  # Adds /analytics to the path
)
class AnalyticsAPI(RestApi):

    @expose("/insights", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    def insights(self) -> Response:
        # This endpoint will be available at:
        # /extensions/my-org/dataset-tools/analytics/insights
        return self.response(200, result={"insights": []})
```

### MCP Tools

Extensions can register Python functions as MCP tools that AI agents can discover and call. Tools provide executable functionality such as data processing, custom analytics, or integration with external services. Each tool specifies a unique name and an optional description that helps AI agents decide when to use it.

```python
from superset_core.mcp.decorators import tool

@tool(
    name="my-extension.get_summary",
    description="Get a summary of recent query activity",
    tags=["analytics", "queries"],
)
def get_summary() -> dict:
    """Returns a summary of recent query activity."""
    return {"status": "success", "result": {"queries_today": 42}}
```

See [MCP Integration](./mcp.md) for implementation details.

### MCP Prompts

Extensions can register MCP prompts that provide interactive guidance and context to AI agents. Prompts help agents understand domain-specific workflows, best practices, or troubleshooting steps for your extension's use cases.

```python
from superset_core.mcp.decorators import prompt
from fastmcp import Context

@prompt(
    "my-extension.analysis_guide",
    title="Analysis Guide",
    description="Step-by-step guidance for data analysis workflows",
)
async def analysis_guide(ctx: Context) -> str:
    """Provides guidance for data analysis workflows."""
    return """
    # Data Analysis Guide

    Follow these steps for effective analysis:

    1. **Explore your data** - Review available datasets and schema
    2. **Build your query** - Use SQL Lab to craft and test queries
    3. **Visualize results** - Choose the right chart type for your data

    What would you like to analyze today?
    """
```

See [MCP Integration](./mcp.md) for implementation details.

### Semantic Layers

See [cache invalidation](../semantic-layer-cache-clear.md) for the required
cache-token factory argument and provider cache requirements.

See the [execution context contract](semantic-execution-context.md) for provider construction and connection-mode guarantees.

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

#### Provider obligations and isolated tests

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
variants and ordering before limit, and the [query error guide](../semantic-query-errors.md)
for typed refusals versus operational faults. The selection-version guard is a
separate boundary and raises `ValueError`; it does not classify provider faults.

Bind provider construction to the supplied execution context and cache token.
An uncached provider needs no shared cache. A provider that does cache must
partition **actual lookups**, before
discovery, by the token and the existing endpoint/credential/role/view scope.
Merely assigning `self.cache_token` is not invalidation. The
[cache guide](../semantic-layer-cache-clear.md#provider-sdk-contract) describes
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

#### Declaring semantic view features

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

#### Server pagination

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

#### Semantic result containment caching

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

#### Choosing a default time dimension

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
