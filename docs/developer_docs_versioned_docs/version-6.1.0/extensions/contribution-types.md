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

```tsx
import React from 'react';
import { views } from '@apache-superset/core';
import MyPanel from './MyPanel';

views.registerView(
  { id: 'my-extension.main', name: 'My Panel Name' },
  'sqllab.panels',
  () => <MyPanel />,
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

See [Editors Extension Point](./extension-points/editors) for implementation details.

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

**Note**: The [`@api`](superset-core/src/superset_core/rest_api/decorators.py) decorator automatically detects context and generates appropriate paths:

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

See [MCP Integration](./mcp) for implementation details.

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

See [MCP Integration](./mcp) for implementation details.

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

    @classmethod
    def from_configuration(cls, configuration: dict) -> "MySemanticLayer":
        config = MyConfig.model_validate(configuration)
        return cls(config)

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
