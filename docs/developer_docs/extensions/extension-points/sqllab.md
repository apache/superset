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

SQL Lab provides 4 extension points where extensions can contribute custom UI components. Each area serves a specific purpose and supports different types of customizations. These areas will evolve over time as new features are added to SQL Lab.

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
└──────────┴─────────────────────────────────────────┴─────────────┘
```

| Extension Point   | ID                    | Views | Menus | Description                                    |
| ----------------- | --------------------- | ----- | ----- | ---------------------------------------------- |
| **Left Sidebar**  | `sqllab.leftSidebar`  | —     | ✓     | Menu actions for the database explorer         |
| **Editor**        | `sqllab.editor`       | ✓\*   | ✓     | Custom editors + toolbar actions               |
| **Right Sidebar** | `sqllab.rightSidebar` | ✓     | —     | Custom panels (AI assistants, query analysis)  |
| **Panels**        | `sqllab.panels`       | ✓     | ✓     | Custom tabs + toolbar actions (data profiling) |

\*Editor views are contributed via [Editor Contributions](./editors), not standard view contributions.

## Customization Types

### Views

Extensions can add custom views (React components) to **Right Sidebar** and **Panels**. Views appear as new panels or tabs in their respective areas.

### Menus

Extensions can add toolbar actions to **Left Sidebar**, **Editor**, and **Panels**. Menu contributions support:

```
┌───────────────────────────────────────────────────────────────┐
│  [Button] [Button]   [•••]                                    │
├───────────────────────────────────────────────────────────────┤
│                          Area Content                         │
└───────────────────────────────────────────────────────────────┘
```

| Action Type           | Location         | Use Case                                              |
| --------------------- | ---------------- | ----------------------------------------------------- |
| **Primary Actions**   | Toolbar buttons  | Frequently used actions (e.g., run, refresh, add new) |
| **Secondary Actions** | 3-dot menu (•••) | Less common actions (e.g., export, settings)          |

### Custom Editors

Extensions can replace the default SQL editor with custom implementations (Monaco, CodeMirror, etc.). See [Editor Contributions](./editors) for details.

## Examples

### Adding a Panel

This example adds a "Data Profiler" panel to SQL Lab:

```typescript
import React from 'react';
import { views } from '@apache-superset/core';
import DataProfilerPanel from './DataProfilerPanel';

views.registerView(
  { id: 'my-extension.data-profiler', name: 'Data Profiler' },
  'sqllab.panels',
  () => <DataProfilerPanel />,
);
```

### Adding Actions to the Editor

This example adds primary, secondary, and context actions to the editor:

```typescript
import { commands, menus, sqlLab } from '@apache-superset/core';

commands.registerCommand(
  { id: 'my-extension.format', title: 'Format Query', icon: 'FormatPainterOutlined' },
  async () => {
    const tab = sqlLab.getCurrentTab();
    if (tab) {
      const editor = await tab.getEditor();
      // Format the SQL query
    }
  },
);

commands.registerCommand(
  { id: 'my-extension.explain', title: 'Explain Query' },
  async () => {
    const tab = sqlLab.getCurrentTab();
    if (tab) {
      const editor = await tab.getEditor();
      // Show query explanation
    }
  },
);

commands.registerCommand(
  { id: 'my-extension.copy-as-cte', title: 'Copy as CTE' },
  async () => {
    const tab = sqlLab.getCurrentTab();
    if (tab) {
      const editor = await tab.getEditor();
      // Copy selected text as CTE
    }
  },
);

menus.registerMenuItem(
  { view: 'builtin.editor', command: 'my-extension.format' },
  'sqllab.editor',
  'primary',
);
menus.registerMenuItem(
  { view: 'builtin.editor', command: 'my-extension.explain' },
  'sqllab.editor',
  'secondary',
);
menus.registerMenuItem(
  { view: 'builtin.editor', command: 'my-extension.copy-as-cte' },
  'sqllab.editor',
  'context',
);
```

## Next Steps

- **[Contribution Types](../contribution-types)** - Learn about other contribution types (commands, menus)
- **[Development](../development)** - Set up your development environment
- **[Quick Start](../quick-start)** - Build a complete extension
