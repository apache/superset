---
title: Contribution Points
sidebar_position: 3
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

# Contribution Points Reference

Contribution points define where and how extensions can add functionality to Apache Superset. Extensions declare their contributions in the `extension.json` manifest file.

## Views

Views are UI components that appear in designated areas of Superset.

### SQL Lab Panels

Extensions can contribute panels to SQL Lab:

```json
"contributions": {
  "views": {
    "sqllab.panels": [
      {
        "id": "myExtension.dataPanel",
        "name": "Data Explorer",
        "icon": "DatabaseOutlined",
        "when": "sqllab.connected"
      }
    ]
  }
}
```

**Properties**:
- `id` - Unique view identifier
- `name` - Display name in UI
- `icon` - Ant Design icon name
- `when` - Conditional visibility

**Available Locations**:
- `sqllab.panels` - Side panels in SQL Lab
- `sqllab.bottomPanels` - Bottom panels below editor

**TODO: Future Locations**:
- `dashboard.widgets` - Dashboard widget areas
- `chart.panels` - Chart editor panels
- `explore.sections` - Explore view sections

### View Registration

In your extension code:

```typescript
export function activate(context: ExtensionContext) {
  const view = context.registerView(
    'myExtension.dataPanel',
    <DataExplorerPanel />
  );

  context.subscriptions.push(view);
}
```

## Commands

Commands are actions that can be invoked by users or other extensions.

### Command Definition

```json
"commands": [
  {
    "command": "myExtension.runAnalysis",
    "title": "Run Analysis",
    "category": "Data Tools",
    "icon": "PlayCircleOutlined",
    "enablement": "sqllab.hasQuery && !sqllab.running"
  }
]
```

**Properties**:
- `command` - Unique command identifier
- `title` - Display name
- `category` - Command palette category
- `icon` - Optional icon
- `enablement` - Condition for enabling

### Command Registration

```typescript
commands.registerCommand('myExtension.runAnalysis', {
  execute: async (...args) => {
    const query = sqlLab.getCurrentQuery();
    const result = await analyzeQuery(query);
    return result;
  },

  isEnabled: () => {
    return sqlLab.hasQuery() && !sqlLab.isRunning();
  }
});
```

### Built-in Commands

Extensions can invoke these built-in commands:

```typescript
// SQL Lab commands
await commands.executeCommand('sqllab.executeQuery');
await commands.executeCommand('sqllab.formatQuery');
await commands.executeCommand('sqllab.saveQuery');
await commands.executeCommand('sqllab.exportResults');

// Editor commands  
await commands.executeCommand('editor.action.formatDocument');
await commands.executeCommand('editor.action.commentLine');

// System commands
await commands.executeCommand('workbench.action.openSettings');
await commands.executeCommand('workbench.action.showCommands');
```

## Menus

Add items to existing Superset menus.

### Menu Contributions

```json
"menus": {
  "sqllab.editor": {
    "primary": [
      {
        "command": "myExtension.analyze",
        "group": "navigation",
        "order": 1,
        "when": "editorFocus"
      }
    ],
    "secondary": [
      {
        "command": "myExtension.settings",
        "group": "settings"
      }
    ],
    "context": [
      {
        "command": "myExtension.explain",
        "group": "1_modification",
        "when": "editorTextFocus && editorHasSelection"
      }
    ]
  }
}
```

**Menu Locations**:
- `sqllab.editor.primary` - Main toolbar
- `sqllab.editor.secondary` - Secondary toolbar
- `sqllab.editor.context` - Right-click menu

**Groups** (for organization):
- `navigation` - Primary navigation items
- `1_modification` - Edit operations
- `2_workspace` - Workspace management
- `9_cutcopypaste` - Clipboard operations
- `z_commands` - Other commands

**TODO: Future Menu Locations**:
- `explorer.context` - Data explorer context menu
- `dashboard.toolbar` - Dashboard toolbar
- `chart.context` - Chart context menu

## Configuration

Define user-configurable settings.

### Configuration Schema

```json
"configuration": {
  "title": "My Extension Settings",
  "order": 10,
  "properties": {
    "myExtension.enableFeature": {
      "type": "boolean",
      "default": true,
      "description": "Enable the main feature",
      "order": 1
    },
    "myExtension.apiEndpoint": {
      "type": "string",
      "default": "https://api.example.com",
      "description": "API endpoint URL",
      "pattern": "^https?://",
      "order": 2
    },
    "myExtension.refreshInterval": {
      "type": "number",
      "default": 5000,
      "minimum": 1000,
      "maximum": 60000,
      "description": "Refresh interval in milliseconds",
      "order": 3
    },
    "myExtension.theme": {
      "type": "string",
      "enum": ["light", "dark", "auto"],
      "enumDescriptions": [
        "Light theme",
        "Dark theme",
        "Follow system"
      ],
      "default": "auto",
      "description": "Color theme",
      "order": 4
    },
    "myExtension.advanced": {
      "type": "object",
      "properties": {
        "cacheSize": {
          "type": "number",
          "default": 100
        },
        "debug": {
          "type": "boolean",
          "default": false
        }
      },
      "description": "Advanced settings",
      "order": 5
    }
  }
}
```

### Accessing Configuration

```typescript
// Get configuration value
const isEnabled = workspace.getConfiguration('myExtension')
  .get<boolean>('enableFeature');

// Update configuration
await workspace.getConfiguration('myExtension')
  .update('refreshInterval', 10000);

// Listen for changes
workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('myExtension.theme')) {
    updateTheme();
  }
});
```

## Keybindings

Register keyboard shortcuts for commands.

### TODO: Keybinding Definition (Future)

```json
"keybindings": [
  {
    "command": "myExtension.runQuery",
    "key": "ctrl+shift+r",
    "mac": "cmd+shift+r",
    "when": "editorTextFocus"
  }
]
```

## Language Support

### TODO: Language Contributions (Future)

```json
"languages": [
  {
    "id": "supersql",
    "extensions": [".ssql"],
    "aliases": ["SuperSQL", "ssql"],
    "configuration": "./language-configuration.json"
  }
]
```

## Themes

### TODO: Theme Contributions (Future)

```json
"themes": [
  {
    "label": "My Dark Theme",
    "uiTheme": "vs-dark",
    "path": "./themes/my-dark-theme.json"
  }
]
```

## Status Bar

Add items to the status bar.

### TODO: Status Bar Contributions (Future)

```json
"statusBar": [
  {
    "id": "myExtension.status",
    "alignment": "left",
    "priority": 100,
    "text": "$(database) Connected",
    "tooltip": "Database connection status",
    "command": "myExtension.showStatus"
  }
]
```

## Activity Bar

### TODO: Activity Bar Contributions (Future)

```json
"activityBar": [
  {
    "id": "myExtension.explorer",
    "title": "Data Explorer",
    "icon": "./icons/explorer.svg"
  }
]
```

## Context Variables

Extensions can use these context variables in `when` clauses:

### SQL Lab Context

- `sqllab.connected` - Database connection established
- `sqllab.hasQuery` - Query text present
- `sqllab.querySelected` - Query text selected
- `sqllab.running` - Query executing
- `sqllab.hasResults` - Results available
- `sqllab.queryExecuted` - Query has been run
- `sqllab.panelVisible` - Specific panel visible
- `sqllab.tabActive` - Specific tab active

### Editor Context

- `editorFocus` - Editor has focus
- `editorTextFocus` - Text area focused
- `editorHasSelection` - Text selected
- `editorHasMultipleSelections` - Multiple selections
- `editorReadonly` - Editor is read-only
- `editorLangId` - Language ID matches

### Workspace Context

- `workspaceFolderCount` - Number of workspace folders
- `workspaceState` - Workspace state value
- `config.*` - Configuration values

### Resource Context

- `resourceScheme` - URI scheme matches
- `resourceFilename` - Filename matches pattern
- `resourceExtname` - File extension matches
- `resourceLangId` - Resource language ID

## Activation Events

Control when your extension activates:

```json
"activationEvents": [
  "onCommand:myExtension.start",
  "onView:myExtension.explorer",
  "onLanguage:sql",
  "workspaceContains:**/*.ssql",
  "onStartupFinished"
]
```

See [Activation Events](/developer_portal/references/activation-events) for details.

## API Access Declaration

Declare which APIs your extension uses:

```json
"capabilities": {
  "apis": [
    "sqllab.*",
    "authentication.getUser",
    "workspace.getConfiguration",
    "commands.executeCommand"
  ]
}
```

## Contribution Validation

Contributions are validated:

1. **At build time** - Schema validation
2. **At registration** - Conflict detection
3. **At runtime** - Permission checks

Common validation errors:
- Duplicate command IDs
- Invalid menu locations
- Missing required properties
- Circular dependencies
- Invalid context expressions

## Best Practices

1. **Use namespaced IDs** - Prefix with extension name
2. **Declare minimal capabilities** - Only request needed APIs
3. **Provide meaningful descriptions** - Help users understand
4. **Use appropriate icons** - Follow Ant Design guidelines
5. **Group related items** - Organize menus logically
6. **Test context conditions** - Ensure `when` clauses work
7. **Handle missing permissions** - Graceful degradation
8. **Document commands** - Explain what they do
9. **Version your APIs** - Plan for changes
10. **Validate user input** - For configuration values

## Future Contribution Points

These contribution points are planned for future releases:

- **Debuggers** - Custom debugging adapters
- **Tasks** - Background task providers  
- **Snippets** - Code snippets
- **Color Themes** - Complete color themes
- **Icon Themes** - Icon set definitions
- **Product Icons** - Custom product icons
- **Walkthroughs** - Getting started guides
- **Authentication** - Auth providers
- **Views Containers** - Custom view containers
- **Terminal** - Terminal profiles
- **Comments** - Comment providers
- **Code Actions** - Quick fixes
- **Code Lens** - Inline commands
- **Semantic Tokens** - Syntax highlighting

## Related Documentation

- [Extension Manifest](/developer_portal/references/manifest)
- [Activation Events](/developer_portal/references/activation-events)
- [API Reference](/developer_portal/api/frontend)
- [Frontend Contribution Types](/developer_portal/extensions/frontend-contribution-types)
