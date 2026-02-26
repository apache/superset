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

Extensions provide functionality through **contributions** - well-defined extension points that integrate with the host application.

## Why Contributions?

The contribution system provides several key benefits:

- **Transparency**: Administrators can review exactly what functionality an extension provides before installation. The `manifest.json` documents all REST APIs, MCP tools, views, and other contributions in a single, readable location.

- **Security**: Only contributions explicitly declared in the manifest are registered during startup. Extensions cannot expose functionality they haven't declared, preventing hidden or undocumented code from executing.

- **Discoverability**: The manifest serves as a contract between extensions and the host application, making it easy to understand what an extension does without reading its source code.

## How Contributions Work

Contributions are automatically discovered from source code at build time. Simply use the `@extension_api`, `@tool`, `@prompt` decorators in Python or `define*()` functions in TypeScript - the build system finds them and generates a `manifest.json` with all discovered contributions.

No manual configuration needed!

## Backend Contributions

### REST API Endpoints

Register REST APIs under `/api/v1/extensions/`:

```python
from superset_core.api import RestApi, extension_api
from flask_appbuilder import expose

@extension_api(id="my_api", name="My Extension API")
class MyExtensionAPI(RestApi):
    @expose("/endpoint", methods=["GET"])
    def get_data(self):
        return self.response(200, result={"message": "Hello"})
```

### MCP Tools

Register MCP tools for AI agents:

```python
from superset_core.mcp import tool

@tool(tags=["database"])
def query_database(sql: str, database_id: int) -> dict:
    """Execute a SQL query against a database."""
    return execute_query(sql, database_id)
```

### MCP Prompts

Register MCP prompts:

```python
from superset_core.mcp import prompt

@prompt(tags={"analysis"})
async def analyze_data(ctx, dataset: str) -> str:
    """Generate analysis for a dataset."""
    return f"Analyze the {dataset} dataset..."
```

See [MCP Integration](./mcp) for more details.

## Frontend Contributions

### Views

Add panels or views to the UI using `defineView()`:

```tsx
import React from 'react';
import { defineView } from '@apache-superset/core';
import MyPanel from './MyPanel';

export const myView = defineView({
  id: 'main',
  title: 'My Panel',
  location: 'sqllab.panels', // or dashboard.tabs, explore.panels, etc.
  component: () => <MyPanel />,
});
```

### Commands

Define executable commands using `defineCommand()`:

```tsx
import { defineCommand } from '@apache-superset/core';

export const copyQuery = defineCommand({
  id: 'copy_query',
  title: 'Copy Query',
  icon: 'CopyOutlined',
  execute: async () => {
    // Copy the current query
    navigator.clipboard.writeText(getCurrentQuery());
  },
});
```

### Menus

Add items to menus using `defineMenu()`:

```tsx
import { defineMenu } from '@apache-superset/core';

export const contextMenu = defineMenu({
  id: 'clear_editor',
  title: 'Clear Editor',
  location: 'sqllab.editor.context',
  action: () => {
    clearEditor();
  },
});
```

### Editors

Replace the default text editor using `defineEditor()`:

```tsx
import React from 'react';
import { defineEditor } from '@apache-superset/core';
import MonacoEditor from './MonacoEditor';

export const monacoSqlEditor = defineEditor({
  id: 'monaco_sql',
  name: 'Monaco SQL Editor',
  mimeTypes: ['text/x-sql'],
  component: MonacoEditor,
});
```

All contributions are automatically discovered at build time and registered at runtime - no manual configuration needed!

## Configuration

### extension.json

Specify which files to scan for contributions:

```json
{
  "id": "my_extension",
  "name": "My Extension",
  "version": "1.0.0",
  "backend": {
    "entryPoints": ["my_extension.entrypoint"],
    "files": ["backend/src/**/*.py"]
  },
  "frontend": {
    "moduleFederation": {
      "exposes": ["./index"]
    }
  }
}
```

### Manual Contributions (Advanced)

Override auto-discovery by specifying contributions directly:

```json
{
  "backend": {
    "contributions": {
      "mcpTools": [
        { "id": "query_db", "name": "query_db", "module": "my_ext.tools.query_db" }
      ],
      "restApis": [
        { "id": "my_api", "name": "My API", "module": "my_ext.api.MyAPI", "basePath": "/my_api" }
      ]
    }
  }
}
```
