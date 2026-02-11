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

Frontend contribution types allow extensions to extend Superset's user interface with new views, commands, and menu items.

### Views

Extensions can add new views or panels to the host application, such as custom SQL Lab panels, dashboards, or other UI components. Each view is registered with a unique ID and can be activated or deactivated as needed. Contribution areas are uniquely identified (e.g., `sqllab.panels` for SQL Lab panels), enabling seamless integration into specific parts of the application.

```json
"frontend": {
  "contributions": {
    "views": {
      "sqllab": {
        "panels": [
          {
            "id": "my_extension.main",
            "name": "My Panel Name"
          }
        ]
      }
    }
  }
}
```

### Commands

Extensions can define custom commands that can be executed within the host application, such as context-aware actions or menu options. Each command can specify properties like a unique command identifier, an icon, a title, and a description. These commands can be invoked by users through menus, keyboard shortcuts, or other UI elements, enabling extensions to add rich, interactive functionality to Superset.

```json
"frontend": {
  "contributions": {
    "commands": [
      {
        "command": "my_extension.copy_query",
        "icon": "CopyOutlined",
        "title": "Copy Query",
        "description": "Copy the current query to clipboard"
      }
    ]
  }
}
```

### Menus

Extensions can contribute new menu items or context menus to the host application, providing users with additional actions and options. Each menu item can specify properties such as the target view, the command to execute, its placement (primary, secondary, or context), and conditions for when it should be displayed. Menu contribution areas are uniquely identified (e.g., `sqllab.editor` for the SQL Lab editor), allowing extensions to seamlessly integrate their functionality into specific menus and workflows within Superset.

```json
"frontend": {
  "contributions": {
    "menus": {
      "sqllab": {
        "editor": {
          "primary": [
            {
              "view": "builtin.editor",
              "command": "my_extension.copy_query"
            }
          ],
          "secondary": [
            {
              "view": "builtin.editor",
              "command": "my_extension.prettify"
            }
          ],
          "context": [
            {
              "view": "builtin.editor",
              "command": "my_extension.clear"
            }
          ]
        }
      }
    }
  }
}
```

### Editors

Extensions can replace Superset's default text editors with custom implementations. This enables enhanced editing experiences using alternative editor frameworks like Monaco, CodeMirror, or custom solutions. When an extension registers an editor for a language, it replaces the default Ace editor in all locations that use that language (SQL Lab, Dashboard Properties, CSS editors, etc.).

```json
"frontend": {
  "contributions": {
    "editors": [
      {
        "id": "my_extension.monaco_sql",
        "name": "Monaco SQL Editor",
        "languages": ["sql"],
        "description": "Monaco-based SQL editor with IntelliSense"
      }
    ]
  }
}
```

See [Editors Extension Point](./extension-points/editors) for implementation details.

## Backend

Backend contribution types allow extensions to extend Superset's server-side capabilities with new API endpoints, MCP tools, and MCP prompts.

### REST API Endpoints

Extensions can register custom REST API endpoints under the `/api/v1/extensions/` namespace. This dedicated namespace prevents conflicts with built-in endpoints and provides a clear separation between core and extension functionality.

```json
"backend": {
  "entryPoints": ["my_extension.entrypoint"],
  "files": ["backend/src/my_extension/**/*.py"]
}
```

The entry point module registers the API with Superset:

```python
from superset_core.api.rest_api import add_extension_api
from .api import MyExtensionAPI

add_extension_api(MyExtensionAPI)
```

### MCP Tools and Prompts

Extensions can contribute Model Context Protocol (MCP) tools and prompts that AI agents can discover and use. See [MCP Integration](./mcp) for detailed documentation.
