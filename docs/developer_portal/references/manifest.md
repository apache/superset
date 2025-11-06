---
title: Extension Manifest
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

# Extension Manifest Reference

The `extension.json` file defines metadata, capabilities, and configuration for a Superset extension. This file is required at the root of every extension project.

## Complete Example

```json
{
  "name": "dataset_references",
  "displayName": "Dataset References",
  "version": "1.0.0",
  "description": "Display metadata about tables referenced in SQL queries",
  "author": "Apache Superset Contributors",
  "license": "Apache-2.0",
  "homepage": "https://github.com/apache/superset",
  "repository": {
    "type": "git",
    "url": "https://github.com/apache/superset.git"
  },
  "bugs": {
    "url": "https://github.com/apache/superset/issues"
  },
  "engines": {
    "superset": ">=4.0.0"
  },
  "categories": ["SQL Lab", "Analytics"],
  "keywords": ["sql", "metadata", "tables", "references"],
  "icon": "database",
  "galleryBanner": {
    "color": "#1890ff",
    "theme": "dark"
  },
  "frontend": {
    "main": "./dist/index.js",
    "contributions": {
      "views": {
        "sqllab.panels": [
          {
            "id": "dataset_references.main",
            "name": "Dataset References",
            "icon": "TableOutlined",
            "when": "sqllab.queryExecuted"
          }
        ]
      },
      "commands": [
        {
          "command": "dataset_references.refresh",
          "title": "Refresh Dataset Metadata",
          "category": "Dataset References",
          "icon": "ReloadOutlined"
        }
      ],
      "menus": {
        "sqllab.editor": {
          "primary": [
            {
              "command": "dataset_references.refresh",
              "group": "navigation",
              "when": "dataset_references.panelVisible"
            }
          ]
        }
      },
      "configuration": {
        "title": "Dataset References",
        "properties": {
          "dataset_references.autoRefresh": {
            "type": "boolean",
            "default": true,
            "description": "Automatically refresh metadata on query execution"
          },
          "dataset_references.showPartitions": {
            "type": "boolean",
            "default": true,
            "description": "Display partition information"
          },
          "dataset_references.cacheTimeout": {
            "type": "number",
            "default": 300,
            "description": "Cache timeout in seconds"
          }
        }
      }
    },
    "moduleFederation": {
      "name": "dataset_references",
      "exposes": {
        "./index": "./src/index"
      },
      "shared": {
        "react": { "singleton": true },
        "react-dom": { "singleton": true }
      }
    }
  },
  "backend": {
    "main": "dataset_references.entrypoint",
    "entryPoints": ["dataset_references.entrypoint"],
    "files": ["backend/src/dataset_references/**/*.py"],
    "requirements": [
      "sqlparse>=0.4.0",
      "pandas>=1.3.0"
    ]
  },
  "activationEvents": [
    "onView:sqllab.panels",
    "onCommand:dataset_references.refresh",
    "workspaceContains:**/*.sql"
  ]
}
```

## Required Fields

### name
- **Type**: `string`
- **Pattern**: `^[a-z0-9_]+$`
- **Description**: Unique identifier for the extension. Must be lowercase with underscores.

```json
"name": "my_extension"
```

### version
- **Type**: `string`
- **Format**: [Semantic Versioning](https://semver.org/)
- **Description**: Extension version following semver format.

```json
"version": "1.2.3"
```

### engines
- **Type**: `object`
- **Description**: Specifies compatible Superset versions.

```json
"engines": {
  "superset": ">=4.0.0 <5.0.0"
}
```

## Metadata Fields

### displayName
- **Type**: `string`
- **Description**: Human-readable name shown in UI.

### description
- **Type**: `string`
- **Description**: Short description of extension functionality.

### author
- **Type**: `string` | `object`
- **Description**: Extension author information.

```json
"author": {
  "name": "Jane Doe",
  "email": "jane@example.com",
  "url": "https://example.com"
}
```

### license
- **Type**: `string`
- **Description**: SPDX license identifier.
- **Common values**: `Apache-2.0`, `MIT`, `BSD-3-Clause`

### categories
- **Type**: `string[]`
- **Description**: Extension categories for marketplace organization.
- **Valid values**:
  - `"SQL Lab"`
  - `"Dashboard"`
  - `"Charts"`
  - `"Data Sources"`
  - `"Analytics"`
  - `"Security"`
  - `"Theming"`
  - `"Developer Tools"`

### keywords
- **Type**: `string[]`
- **Description**: Search keywords for extension discovery.

### icon
- **Type**: `string`
- **Description**: Icon identifier or path to icon file.

## Frontend Configuration

### frontend.main
- **Type**: `string`
- **Description**: Entry point for frontend code.

### frontend.contributions

Defines how the extension extends Superset's UI.

#### views
Register custom views and panels:

```json
"views": {
  "sqllab.panels": [
    {
      "id": "extension.panel",
      "name": "My Panel",
      "icon": "icon-name",
      "when": "condition"
    }
  ]
}
```

**View Locations**:
- `sqllab.panels` - SQL Lab side panels
- `sqllab.bottomPanels` - SQL Lab bottom panels
- `dashboard.widgets` - Dashboard widgets (TODO: future)
- `chart.toolbar` - Chart toolbar items (TODO: future)

#### commands
Register executable commands:

```json
"commands": [
  {
    "command": "extension.doSomething",
    "title": "Do Something",
    "category": "My Extension",
    "icon": "PlayCircleOutlined",
    "enablement": "resourceIsSelected"
  }
]
```

#### menus
Add items to existing menus:

```json
"menus": {
  "sqllab.editor": {
    "primary": [
      {
        "command": "extension.command",
        "group": "navigation",
        "when": "editorFocus"
      }
    ],
    "context": [
      {
        "command": "extension.contextAction",
        "group": "1_modification"
      }
    ]
  }
}
```

**Menu Locations**:
- `sqllab.editor.primary` - Main SQL Lab toolbar
- `sqllab.editor.secondary` - Secondary actions
- `sqllab.editor.context` - Right-click context menu
- `explorer.context` - Data explorer context menu (TODO: future)

#### configuration
Define extension settings:

```json
"configuration": {
  "title": "My Extension",
  "properties": {
    "myExtension.setting1": {
      "type": "boolean",
      "default": true,
      "description": "Enable feature X"
    },
    "myExtension.setting2": {
      "type": "string",
      "enum": ["option1", "option2"],
      "default": "option1",
      "description": "Choose option"
    }
  }
}
```

**Property Types**:
- `boolean` - True/false toggle
- `string` - Text input
- `number` - Numeric input
- `array` - List of values
- `object` - Complex configuration

### frontend.moduleFederation

Webpack Module Federation configuration:

```json
"moduleFederation": {
  "name": "extension_name",
  "exposes": {
    "./index": "./src/index"
  },
  "shared": {
    "react": { "singleton": true },
    "react-dom": { "singleton": true },
    "@apache-superset/core": { "singleton": true }
  }
}
```

## Backend Configuration

### backend.main
- **Type**: `string`
- **Description**: Main Python module entry point.

### backend.entryPoints
- **Type**: `string[]`
- **Description**: Python modules to load on startup.

```json
"entryPoints": [
  "my_extension.api",
  "my_extension.security",
  "my_extension.models"
]
```

### backend.files
- **Type**: `string[]`
- **Description**: Glob patterns for backend files to include.

```json
"files": [
  "backend/src/**/*.py",
  "backend/config/*.yaml"
]
```

### backend.requirements
- **Type**: `string[]`
- **Description**: Python package dependencies.

```json
"requirements": [
  "requests>=2.28.0",
  "pandas>=1.3.0,<2.0.0"
]
```

## Activation Events

Controls when the extension is activated:

```json
"activationEvents": [
  "onView:sqllab.panels",
  "onCommand:myExtension.start",
  "onLanguage:sql",
  "workspaceContains:**/*.sql",
  "*"
]
```

**Event Types**:
- `onView:<viewId>` - When specific view is opened
- `onCommand:<commandId>` - When command is executed
- `onLanguage:<language>` - When file type is opened
- `workspaceContains:<pattern>` - When workspace contains matching files
- `onStartupFinished` - After Superset fully starts
- `*` - Always activate (not recommended)

## Conditional Activation ("when" clauses)

Control when UI elements are visible/enabled:

```json
"when": "sqllab.queryExecuted && config.myExtension.enabled"
```

**Context Keys**:
- `sqllab.queryExecuted` - Query has been run
- `sqllab.hasResults` - Query returned results
- `editorFocus` - Editor is focused
- `resourceIsSelected` - Resource selected in explorer
- `config.<setting>` - Configuration value check

**Operators**:
- `&&` - AND
- `||` - OR
- `!` - NOT
- `==` - Equals
- `!=` - Not equals
- `=~` - Regex match

## Capabilities Declaration

Declare required permissions and capabilities:

```json
"capabilities": {
  "permissions": [
    "database.read",
    "query.execute",
    "cache.write"
  ],
  "apis": [
    "sqllab.*",
    "authentication.getUser"
  ]
}
```

## Build Configuration

### TODO: Future Fields

These fields are planned for future implementation:

```json
{
  "publisher": "organization-name",
  "preview": false,
  "contributes": {
    "themes": [],
    "languages": [],
    "debuggers": [],
    "jsonValidation": []
  },
  "extensionDependencies": [
    "other-extension@^1.0.0"
  ],
  "extensionPack": [
    "extension1",
    "extension2"
  ],
  "scripts": {
    "compile": "webpack",
    "test": "jest",
    "lint": "eslint"
  }
}
```

## Validation

The manifest is validated against a JSON schema during:
- Development (`superset-extensions dev`)
- Build (`superset-extensions build`)
- Installation (API upload)

Common validation errors:
- Missing required fields
- Invalid version format
- Incompatible engine version
- Duplicate command IDs
- Invalid activation events

## Best Practices

1. **Use semantic versioning** for the version field
2. **Declare minimum Superset version** accurately
3. **Use specific activation events** to improve performance
4. **Provide clear descriptions** for configuration options
5. **Include all required Python dependencies** in requirements
6. **Use unique IDs** for commands and views
7. **Follow naming conventions** (snake_case for name, camelCase for settings)
8. **Include complete author information** for support
9. **Specify appropriate categories** for discovery
10. **Test manifest changes** before deployment

## Migration from Legacy Format

If migrating from older extension formats:

```javascript
// Legacy format (deprecated)
{
  "plugin_name": "MyPlugin",
  "plugin_version": "1.0"
}

// New format
{
  "name": "my_plugin",
  "version": "1.0.0",
  "engines": {
    "superset": ">=4.0.0"
  }
}
```

## Related Documentation

- [Extension Project Structure](/developer_portal/extensions/extension-project-structure)
- [Contribution Points](/developer_portal/references/contribution-points)
- [Activation Events](/developer_portal/references/activation-events)
- [API Reference](/developer_portal/api/frontend)
