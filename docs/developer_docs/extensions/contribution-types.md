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

`@superset-ui/core` is shared with extensions, so `SupersetClient` works with
the host's configuration, including CSRF tokens on writes. Extensions
scaffolded by `superset-extensions init` declare the share already; an older
extension needs `@superset-ui/core` added to the `shared` block of its webpack
config to use the host's copy rather than bundling its own.

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
