---
title: Plugin Manifest
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

# Plugin Manifest

=� **Coming Soon** =�

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
