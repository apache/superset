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

A location is a dotted string naming where the view renders:
`sqllab.panels` is the panel area of SQL Lab, `global.page` a page of its
own. It is passed to `registerView`; nothing about it is declared in
`extension.json`, which carries no contributions at all.

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

### Charts

Draw a chart from its form data with `charts.AssetChart`. The host runs the
query and draws the result with the plugin the form data names, so what you
see is what that chart would be, and you never touch the Redux store, the
chart-data actions or `SuperChart`:

```tsx
import { useMemo } from 'react';
import { charts } from '@apache-superset/core';

function Preview() {
  const formData = useMemo(
    () => ({ viz_type: 'table', datasource: '12__table', row_limit: 50 }),
    [],
  );
  return <charts.AssetChart formData={formData} height={320} />;
}
```

`formData` is the same object Explore holds for a chart; `viz_type` and
`datasource` (`"<id>__<type>"`) are what it needs. `height` and `width`
default to `"100%"`, which needs a parent with a size of its own. The
component shows its own loading state, the query's own error message when
the query fails, and a plain message when the form data names no `viz_type`;
a plugin that throws while drawing is contained to the chart's area.

Pass a stable `formData`: the component queries again whenever its identity
changes. It queries as an unsaved chart and does not save, cache against a
saved chart, apply any surrounding page's filters, or return the rows.

### Pages

Extensions can add a page of their own: a whole screen at its own URL, as
opposed to a view that occupies a slot inside a screen Superset already ships.

A page is a view registered at a reserved location. There is nothing to
declare in `extension.json`: like every other contribution, a page is
registered in code.

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
`/extensions/pages/acme.tools.review-queue`. Every page lives under that one
host-owned prefix, so a page id cannot reach an address Superset already
answers.

Prefix the id with your extension's own id, as above. Ids are global across
every installed extension, and a duplicate replaces the earlier registration
with a warning, the same as a duplicate command.

The id becomes a single path segment, so it cannot contain `/`, `?`, `#` or
`%`. Registering one that does throws, because the route would never match it
and the page would never open.

#### Appearing in the navigation

A page has no entry until you register a menu item for it. The item names the
page it opens; its label is that page's `name`.

```typescript
import { menus } from '@apache-superset/core';

menus.registerMenuItem(
  { page: 'acme.tools.review-queue', icon: 'DatabaseOutlined' },
  menus.NAVBAR_LOCATION,
  'primary',
);
```

For an administrative screen, use the Settings dropdown and name the group it
belongs in:

```typescript
menus.registerMenuItem(
  { page: 'acme.tools.review-queue', section: 'Manage' },
  menus.SETTINGS_MENU_LOCATION,
  'primary',
);
```

A group Superset did not render is not invented — the item is simply absent,
the same as one whose page nothing registered. Use `order` to place an item
among its siblings; without it the order is whichever bundle finished loading
first, which is network timing rather than anything you chose.

#### Restricting who may open a page

Name a permission on the registration and the page is left out of the
navigation, and refuses to open, for anyone who does not hold it.

```typescript
views.registerView(
  { id: 'acme.tools.review-queue', name: 'Review queue' },
  views.PAGE_LOCATION,
  ReviewQueue,
  { classPermissionName: 'AcmeReview', methodPermissionName: 'read' },
);
```

The permission must be one that already exists. The usual choice is the one
your own `@api` class defines through `class_permission_name` and
`method_permission_name`, so the page is guarded by the same permission as the
data behind it and the two cannot come apart. A host permission works too, as
`{ classPermissionName: 'Dashboard', methodPermissionName: 'read' }`.

Nothing is created for the page. That has two consequences worth knowing:

- Set `class_permission_name` explicitly on your API class. It defaults to the
  Python class name, so renaming the class would quietly close the page.
- Nothing is granted to other roles at install. A permission your own `@api`
  class defines reaches Admin when the class registers — FAB grants a newly
  created permission to the administrator role — and a host permission is
  already Admin's. Anyone else needs it granted to a role of your own in the
  Roles screen; until then the page refuses them.

This gates reachability and advertisement, not data. The page's own endpoints
are the security boundary and check the same permission server-side; the shell
route is login-gated and serves the shell for every page id.

Omit the permission and the page is open to any signed-in user.

#### Hiding a page behind a feature flag

There is no feature-flag field. A page that should disappear with a flag is
one you do not register:

```typescript
if (isEnabled) {
  views.registerView(/* ... */);
  menus.registerMenuItem(/* ... */);
}
```

With nothing registered there is no navigation entry, and the page's URL shows
"not found" — the same screen a misspelled id gets. Registering late is fine:
the navigation and the page host both subscribe, so an entry appears the
moment it is registered.

#### Owning addresses beneath your own

Everything below a page's address belongs to that page. Read the current
address from the `navigation` namespace and take the part after your own id:

```typescript
import { navigation } from '@apache-superset/core';

const root = '/extensions/pages/acme.tools.review-queue';
const subPath = navigation.getLocation().pathname.slice(root.length);

navigation.navigateTo(`${root}/42`); // a client-side transition
```

`pathname` is relative to the application root, and so is the path you hand
`navigateTo`. On a Superset served under a prefix — `/analytics`, say — that
page still reports `/extensions/pages/acme.tools.review-queue`, not
`/analytics/extensions/...`, so the code above works unchanged wherever the
deployment is mounted. Where you need the prefix, as when calling the API with
`fetch`, ask for it:

```typescript
const root = navigation.getApplicationRoot(); // '/analytics', or '' at the domain root
const response = await fetch(`${root}/extensions/acme/tools/reviews/`);
```

`onDidChangeLocation` reports every move, including between two addresses
inside one page — which `getPage` cannot, since both are `'extension'`. These
are plain functions and an event rather than React hooks, so they work in a
command handler or anywhere else outside a component.

To open a page from elsewhere, run the host's own command:
`commands.executeCommand('core.navigation.openPage', 'acme.tools.review-queue')`.

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
