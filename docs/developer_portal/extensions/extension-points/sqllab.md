---
title: SQL Lab
sidebar_position: 1
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

# SQL Lab Extension Points

SQL Lab provides 5 extension points where extensions can contribute custom UI components. Each area serves a specific purpose and can be customized to add new functionality.

## Layout Overview

```
┌──────────┬─────────────────────────────────────────┬─────────────┐
│          │                                         │             │
│          │                                         │             │
│          │                Editor                   │             │
│          │                                         │             │
│   Left   │                                         │    Right    │
│  Sidebar ├─────────────────────────────────────────┤   Sidebar   │
│          │                                         │             │
│          │                Panels                   │             │
│          │                                         │             │
│          │                                         │             │
│          │                                         │             │
├──────────┴─────────────────────────────────────────┴─────────────┤
│                          Status Bar                              │
└──────────────────────────────────────────────────────────────────┘
```

| Extension Point   | ID                    | Description                                                |
| ----------------- | --------------------- | ---------------------------------------------------------- |
| **Left Sidebar**  | `sqllab.leftSidebar`  | Navigation and browsing (database explorer, saved queries) |
| **Editor**        | `sqllab.editor`       | SQL query editor workspace                                 |
| **Right Sidebar** | `sqllab.rightSidebar` | Contextual tools (AI assistants, query analysis)           |
| **Panels**        | `sqllab.panels`       | Results and related views (visualizations, data profiling) |
| **Status Bar**    | `sqllab.statusBar`    | Connection status and query metrics                        |

## Area Customizations

Each extension point area supports three types of action customizations:

```
┌───────────────────────────────────────────────────────────────┐
│  Area Title                         [Button] [Button]   [•••] │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                                                               │
│                          Area Content                         │
│                                                               │
│                  (right-click for context menu)               │
│                                                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

| Action Type           | Location          | Use Case                                              |
| --------------------- | ----------------- | ----------------------------------------------------- |
| **Primary Actions**   | Top-right buttons | Frequently used actions (e.g., run, refresh, add new) |
| **Secondary Actions** | 3-dot menu (•••)  | Less common actions (e.g., export, settings)          |
| **Context Actions**   | Right-click menu  | Context-sensitive actions on content                  |

## Examples

### Adding a Panel

This example adds a "Data Profiler" panel to SQL Lab:

```json
{
  "name": "data_profiler",
  "version": "1.0.0",
  "frontend": {
    "contributions": {
      "views": {
        "sqllab.panels": [
          {
            "id": "data_profiler.main",
            "name": "Data Profiler"
          }
        ]
      }
    }
  }
}
```

```typescript
import { core } from '@apache-superset/core';
import DataProfilerPanel from './DataProfilerPanel';

export function activate(context) {
  // Register the panel view with the ID declared in extension.json
  const disposable = core.registerView('data_profiler.main', <DataProfilerPanel />);
  context.subscriptions.push(disposable);
}
```

### Adding Actions to the Editor

This example adds primary, secondary, and context actions to the editor:

```json
{
  "name": "query_tools",
  "version": "1.0.0",
  "frontend": {
    "contributions": {
      "commands": [
        {
          "command": "query_tools.format",
          "title": "Format Query",
          "icon": "FormatPainterOutlined"
        },
        {
          "command": "query_tools.explain",
          "title": "Explain Query"
        },
        {
          "command": "query_tools.copy_as_cte",
          "title": "Copy as CTE"
        }
      ],
      "menus": {
        "sqllab.editor": {
          "primary": [
            {
              "view": "builtin.editor",
              "command": "query_tools.format"
            }
          ],
          "secondary": [
            {
              "view": "builtin.editor",
              "command": "query_tools.explain"
            }
          ],
          "context": [
            {
              "view": "builtin.editor",
              "command": "query_tools.copy_as_cte"
            }
          ]
        }
      }
    }
  }
}
```

```typescript
import { commands, sqlLab } from '@apache-superset/core';

export function activate(context) {
  // Register the commands declared in extension.json
  const formatCommand = commands.registerCommand('query_tools.format', {
    execute: () => {
      const tab = sqlLab.getCurrentTab();
      if (tab?.editor) {
        // Format the SQL query
      }
    },
  });

  const explainCommand = commands.registerCommand('query_tools.explain', {
    execute: () => {
      const tab = sqlLab.getCurrentTab();
      if (tab?.editor) {
        // Show query explanation
      }
    },
  });

  const copyAsCteCommand = commands.registerCommand('query_tools.copy_as_cte', {
    execute: () => {
      const tab = sqlLab.getCurrentTab();
      if (tab?.editor) {
        // Copy selected text as CTE
      }
    },
  });

  context.subscriptions.push(formatCommand, explainCommand, copyAsCteCommand);
}
```

## Next Steps

- **[Contribution Types](../contribution-types)** - Learn about other contribution types (commands, menus)
- **[Development](../development)** - Set up your development environment
- **[Quick Start](../quick-start)** - Build a complete extension
