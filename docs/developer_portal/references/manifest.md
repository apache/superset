---
title: Plugin Manifest
sidebar_position: 5
---

# Plugin Manifest

=§ **Coming Soon** =§

Complete reference for the plugin manifest file (plugin.json) that defines plugin metadata, capabilities, and configuration.

## Topics to be covered:

- Plugin manifest schema and structure
- Required and optional manifest fields
- Plugin metadata and identification
- Contribution point declarations
- Dependency management and versioning
- Activation event configuration
- Security and permission declarations
- Internationalization and localization
- Plugin configuration schema
- Manifest validation and best practices

## Manifest Structure

### Basic Plugin Information

```json
{
  "name": "my-superset-plugin",
  "displayName": "My Superset Plugin",
  "description": "A custom plugin for Apache Superset",
  "version": "1.0.0",
  "publisher": "my-organization",
  "author": {
    "name": "Plugin Developer",
    "email": "developer@example.com",
    "url": "https://example.com"
  },
  "license": "Apache-2.0",
  "homepage": "https://github.com/my-org/my-superset-plugin",
  "repository": {
    "type": "git",
    "url": "https://github.com/my-org/my-superset-plugin.git"
  },
  "bugs": {
    "url": "https://github.com/my-org/my-superset-plugin/issues"
  }
}
```

### Plugin Capabilities

```json
{
  "engines": {
    "superset": "^2.0.0"
  },
  "categories": ["Visualization", "Data Analysis"],
  "keywords": ["chart", "visualization", "analytics"],
  "activationEvents": [
    "onStartupFinished",
    "onCommand:my-plugin.activate"
  ],
  "main": "./dist/index.js",
  "contributes": {
    "charts": [...],
    "commands": [...],
    "menus": {...},
    "configuration": {...}
  }
}
```

### Dependencies and Requirements

```json
{
  "dependencies": {
    "@superset-ui/core": "^0.18.0",
    "react": "^17.0.0"
  },
  "peerDependencies": {
    "@superset-ui/chart-controls": "^0.18.0"
  },
  "extensionDependencies": [
    "superset.core-charts"
  ]
}
```

## Configuration Schema

### Plugin Settings
```json
{
  "contributes": {
    "configuration": {
      "title": "My Plugin Configuration",
      "properties": {
        "myPlugin.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable my plugin functionality"
        },
        "myPlugin.apiKey": {
          "type": "string",
          "description": "API key for external service"
        }
      }
    }
  }
}
```

### Internationalization
```json
{
  "contributes": {
    "languages": [
      {
        "id": "my-plugin-locale",
        "extensions": [".mpl"]
      }
    ],
    "grammars": [
      {
        "language": "my-plugin-locale",
        "scopeName": "source.mpl",
        "path": "./syntaxes/mpl.tmLanguage.json"
      }
    ]
  }
}
```

---

*This documentation is under active development. Check back soon for updates!*
