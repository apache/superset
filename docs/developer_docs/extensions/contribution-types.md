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
| `navbar.right` | The right-hand end of the navigation bar, on every page |
| `home.section` | A section of the Home page, after Superset's own |
| `dashboard.header` | Beside the dashboard title |
| `dashboard.headerActions` | In the dashboard's overflow (`...`) menu |
| `dashboard.sidebar` | A column down the right of the chart grid |
| `dashboard.chartActions` | In an individual chart's overflow (`...`) menu |
| `explore.header` | Beside the chart title in Explore |
| `explore.panel` | Between the Explore header and the chart, full width |
| `listView.{chart,dashboard,dataset}.nameCell` | Beside an item's name, in that type's list and in the archive |
| `listView.{chart,dashboard,dataset}.actions` | In a list row's action buttons |
| `sqllab.{leftSidebar,rightSidebar,panels,editor,statusBar,results,queryHistory}` | See [SQL Lab](./extension-points/sqllab.md) |

A contributed component is rendered with no props: whatever it needs, it
fetches for itself. The exception is the list-view locations, described below,
which render the same component once per row.

Every location renders nothing at all until an extension contributes to it, so
a Superset with no extensions installed is laid out exactly as before. Several
extensions may contribute to one location; they are rendered in the order they
registered.

#### The navigation bar

`navbar.right` sits at the inner end of the navigation bar's right-hand group,
ahead of Superset's own controls, and is therefore on screen on every page.
That makes it the place for a single compact control — a status indicator, or a
trigger for a panel the extension owns — rather than for anything that needs
room:

```tsx
views.registerView(
  { id: 'acme.reviews.navbar', name: 'Reviews' },
  'navbar.right',
  ReviewsIndicator,
);
```

The left-hand side of the bar is the navigation itself, and there is no view
location for it. An extension that wants an entry there contributes a
[page](#pages) instead, so that the entry and the screen it opens are one
declaration rather than two that can disagree.

#### The Home page

`home.section` adds a full-width collapsible section to the Home page,
alongside Recents, Dashboards, Charts and Saved queries, and after them: the
page's own content stays where a reader expects to find it.

The section is laid out like one of Superset's own. The view's `name` is the
heading, so write it for someone who has not opened the section yet; the
component is rendered when they open it, which means nothing it fetches is
fetched for readers who never do.

```tsx
views.registerView(
  { id: 'acme.reviews.home', name: 'Pending approvals' },
  'home.section',
  ApprovalsSection,
);
```

#### List rows

The `listView` locations render once per row, so unlike every other location
they hand the component something: `views.ListViewItemProps`.

```tsx
const RowMarker = ({ assetId, archived }: views.ListViewItemProps) => ...;

views.registerView<views.ListViewItemProps>(
  { id: 'acme.reviews.chartRow', name: 'Review status' },
  'listView.chart.nameCell',
  RowMarker,
);
```

`assetId` is the primary key of the item in that row — the only thing the
component has to go on, since the same component renders in every row.

A location is named for the kind of asset the row holds, not for the page the
row is on, so each is rendered by **both** of the lists that show that kind of
asset: the type's own list view, and the archive (**Settings → Recently
Archived**), which lists archived charts, dashboards and datasets through one
page and renders the location its selected type implies. An extension that
marks up chart rows therefore registers once and gets both.

The two lists differ in what state the asset is in, and that the location
cannot say, so the row says it: `archived` is `true` on a row in the archive
and absent elsewhere. Read it before offering anything that acts on the asset
where it stands — an archived asset cannot be opened until someone recovers
it — or before describing the asset as though it were live.

Prefer `nameCell` over a column of your own for anything that is usually
absent. An always-empty column costs every reader width on every row, whereas
nothing beside a name takes no space at all.

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

### Deferred writes

An extension may stand between a save and the asset it would change -- a
four-eyes review, a scheduled publish, an external approval system -- and
answer `202 Accepted` with the write recorded rather than performed. The
`deferredWrites` namespace is how the host says so without knowing which
extension did it, or whether one is installed at all.

Reading one, at a save site:

```ts
import { deferredWrites } from '@apache-superset/core';

const deferred = deferredWrites.read(response);
if (deferred) {
  // `message` is written by whoever deferred the write, because only they
  // know what happens next. Show it; do not compose your own.
  toast(deferred.message);
  return;
}
```

Announcing one, so other surfaces hear about it:

```ts
deferredWrites.announce(deferred);

const stop = deferredWrites.onDeferred(write => {
  // a write was accepted and not applied
});
```

An extension that holds writes also answers questions about them in advance,
by registering an oracle. The host asks before a save whether a write would
be held (`wouldDefer`), whether it may go ahead (`mayProceed`), and what to
show instead of the live asset (`heldVersion`). With nothing registered every
answer is the permissive one, so a deployment without such an extension
behaves exactly as it does today.

Deliberately not called "review". Review is one reason a write is held; the
contract is about the outcome, not the motive. `superset.change_management`
is the Python counterpart.

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
