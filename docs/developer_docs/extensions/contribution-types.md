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

#### Where a view can go

A location is a string, and the nested shape of the `contributions.views`
block in `extension.json` mirrors it: `sqllab.panels` is declared under
`sqllab` → `panels`.

| Location | Where it renders |
| --- | --- |
| `sqllab.{leftSidebar,rightSidebar,panels,editor,statusBar,results,queryHistory}` | See [SQL Lab](./extension-points/sqllab.md) |

A contributed component is rendered with no props: whatever it needs, it
fetches for itself.

Every location renders nothing at all until an extension contributes to it, so
a Superset with no extensions installed is laid out exactly as before. Several
extensions may contribute to one location; they are rendered in the order they
registered.

Locations outside SQL Lab are added alongside the code that renders them, so
this table lists what a deployment can actually show today rather than what is
planned.

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
needed. The declaration is what the server reads to decide who may open the
page, so that loading the page's URL directly works; the registration supplies
the component to render there.

```json
{
  "contributions": {
    "pages": [
      {
        "id": "acme.tools.review-queue",
        "name": "Review queue",
        "nav": { "label": "Review queue" },
        "permission": "can_review"
      }
    ]
  }
}
```

A page is a view at a reserved location, so it is registered the way every
other view is:

```typescript
import { views } from '@apache-superset/core';
import ReviewQueue from './ReviewQueue';

views.registerView(
  { id: 'acme.tools.review-queue', name: 'Review queue' },
  views.PAGE_LOCATION,
  ReviewQueue,
);
```

#### Choosing an id

You name the page; Superset decides where it is served. The host serves it at
`/extensions/pages/<id>` — so `acme.tools.review-queue` above is at
`/extensions/pages/acme.tools.review-queue` — which is why a page can no
longer collide with one of Superset's own screens, with an operator's
blueprint, or with another extension's page.

The id must begin with your extension's own id (`publisher.name`), so that no
extension can claim or overwrite another's page. Ids are dot-separated
lowercase segments in the same shape as a technical name:
`acme.tools.review-queue`, `acme.tools.reports`. A page registered under an id
its manifest does not declare, or under an id belonging to another extension,
is ignored and the reason is logged.

#### Routing inside a page

A page owns everything beneath its address, so it can have more than one
screen. Two hooks read the host's router:

```typescript
// '/42/edit' at /extensions/pages/acme.tools.review-queue/42/edit
const subPath = pages.useSubPath();
const navigate = pages.useNavigate();

navigate('/42');  // a client-side transition, relative to the page
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

Omit `permission` and the page is open to any signed-in user — unless it
also declares a `featureFlag` that is off, which hides it from everyone.

A few names are reserved, because Superset's own role rules already give them
meaning: `database_access`, `catalog_access`, `schema_access`,
`datasource_access`, `can_userinfo` and `can_recent_activity`. A page naming
one has its permission refused at startup, with the reason logged, so the page
is not openable at all.

The permission gates the page itself. Anything the page then calls — Superset's
APIs, or your extension's own — is authorised separately, so a page is not a
way to widen what a user can reach.

#### Following a feature flag

Name a `featureFlag` and the page exists only while that flag is on:

```json
{
  "contributions": {
    "pages": [
      {
        "id": "acme.tools.review-queue",
        "name": "Review queue",
        "nav": { "label": "Review queue" },
        "featureFlag": "CHANGE_MANAGEMENT"
      }
    ]
  }
}
```

With the flag off the page is left out of the navigation and its URL answers
**404**, for every signed-in user including Admin. That is deliberate: a
permission answers *who*, a flag answers *whether the feature is running at
all*, and with the feature off there is no page to be refused access to.

The flag is the operator's, not yours. It is a key of the deployment's
`FEATURE_FLAGS` config, so a name that config does not define reads as off
everywhere — which makes a page opt-in for operators who have not switched
the feature on. The flag is read per request, so flipping it takes effect
without restarting Superset.

Omit `featureFlag` for a page that does not depend on one.

#### Using Superset's API from a page

Call Superset's API through the `http` namespace. It carries the host's
session and attaches a CSRF token to every write, so a page never fetches one
of its own:

```ts
import { http } from '@apache-superset/core';

const { json } = await http.get<{ result: Review[] }>({
  endpoint: '/api/v1/acme/reviews/',
});
const reviews = json?.result ?? [];

const { status } = await http.del({ endpoint: '/api/v1/acme/reviews/42' });
```

`get`, `post`, `put` and `del` all take an `endpoint` -- a path under this
Superset, beginning with `/`, to which the host applies the application root
-- and return the parsed `json`, the `status` and the response `headers`. An
absolute or protocol-relative URL is refused: the call carries your session,
so reaching another origin is `fetch`'s job, not this namespace's. The
delete verb is `del`, because `delete` is a reserved word.

`json` is `undefined` when the response had no body, which a 204 from a
successful `del` usually is, so narrow it before reading a field. For a call
whose answer is simply whether it worked, read `status` instead.

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

Extensions can register custom semantic layer implementations that allow Superset to connect to external data modeling frameworks. Each semantic layer defines how to authenticate, discover semantic views (tables/metrics/dimensions), and execute queries against the external system.

```python
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
    ...
```

See [Semantic Layers Extension Point](./extension-points/semantic-layers.md) for implementation details.
