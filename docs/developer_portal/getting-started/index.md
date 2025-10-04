---
title: Getting Started
sidebar_position: 2
hide_title: true
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

# Getting Started with Extensions

This guide will walk you through creating, developing, and deploying your first Superset extension.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 16+** and npm/yarn installed
- **Python 3.9+** and pip installed  
- **Superset** running locally or access to a Superset instance
- **Git** for version control
- Basic knowledge of React and TypeScript

## Quick Start

### 1. Install the CLI

First, install the Superset Extensions CLI globally:

```bash
pip install apache-superset-extensions-cli
```

### 2. Create Your First Extension

Use the CLI to scaffold a new extension project:

```bash
superset-extensions init my-first-extension
cd my-first-extension
```

This creates the following structure:

```
my-first-extension/
├── extension.json          # Extension metadata
├── frontend/              # Frontend code
│   ├── src/
│   │   └── index.tsx     # Main entry point
│   ├── package.json
│   └── webpack.config.js
├── backend/              # Backend code (optional)
│   ├── src/
│   └── requirements.txt
└── README.md
```

### 3. Configure Your Extension

Edit `extension.json` to define your extension's capabilities:

```json
{
  "name": "my-first-extension",
  "version": "1.0.0",
  "description": "My first Superset extension",
  "author": "Your Name",
  "frontend": {
    "contributions": {
      "views": {
        "sqllab.panels": [
          {
            "id": "my-extension.main",
            "name": "My Panel",
            "icon": "ToolOutlined"
          }
        ]
      }
    }
  }
}
```

### 4. Develop Your Extension

Edit `frontend/src/index.tsx` to implement your extension:

```typescript
import React from 'react';
import { ExtensionContext } from '@apache-superset/core';

export function activate(context: ExtensionContext) {
  // Register your panel component
  const panel = context.core.registerView('my-extension.main', () => (
    <div style={{ padding: 20 }}>
      <h2>Hello from My Extension!</h2>
      <p>This is my first Superset extension.</p>
    </div>
  ));

  // Clean up on deactivation
  context.subscriptions.push(panel);
}

export function deactivate() {
  // Cleanup code if needed
}
```

### 5. Test Locally

Enable development mode in your Superset configuration:

```python
# superset_config.py
ENABLE_EXTENSIONS = True
LOCAL_EXTENSIONS = [
    "/path/to/my-first-extension"
]
```

Run the development server:

```bash
# In your extension directory
superset-extensions dev

# In a separate terminal, start Superset
superset run -p 8088 --with-threads --reload
```

Your extension will now appear in SQL Lab!

### 6. Build and Package

When ready to distribute your extension:

```bash
superset-extensions build
superset-extensions bundle
```

This creates a `my-first-extension-1.0.0.supx` file that can be uploaded to any Superset instance.

### 7. Deploy

Upload your extension via the Superset UI or API:

```bash
curl -X POST http://localhost:8088/api/v1/extensions/import/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@my-first-extension-1.0.0.supx"
```

## What's Next?

Now that you have a basic extension working, explore:

- [Extension Architecture](../architecture/overview) - Understand how extensions work
- [API Reference](../api/frontend) - Learn about available APIs
- [Examples](../examples) - See more complex extension examples
- [Best Practices](./best-practices) - Learn extension development best practices

## Common Patterns

### Adding a SQL Lab Panel

```typescript
const panel = context.core.registerView('my-extension.panel', () => (
  <MyPanelComponent />
));
```

### Registering Commands

```typescript
const command = context.commands.registerCommand('my-extension.run', {
  title: 'Run My Command',
  execute: () => {
    // Command logic
  }
});
```

### Listening to Events

```typescript
const listener = context.sqlLab.onDidQueryRun((query) => {
  console.log('Query executed:', query);
});
```

### Adding Menu Items

```json
{
  "menus": {
    "sqllab.editor": {
      "primary": [{
        "command": "my-extension.run",
        "when": "editorHasSelection"
      }]
    }
  }
}
```

## Troubleshooting

### Extension Not Loading

- Ensure `ENABLE_EXTENSIONS = True` in your config
- Check the browser console for errors
- Verify the extension path in `LOCAL_EXTENSIONS`

### Module Not Found Errors

- Run `npm install` in the frontend directory
- Check that `@apache-superset/core` is properly externalized

### Build Failures

- Ensure all dependencies are installed
- Check webpack.config.js for proper Module Federation setup
- Verify extension.json is valid JSON

## Get Help

- Join the [Superset Slack](https://join.slack.com/t/apache-superset/shared_invite/zt-16jvzmoi8-sI1TY1Pm~y_RnSiUAN0jqQ)
- Ask questions on [GitHub Discussions](https://github.com/apache/superset/discussions)
- Report issues on [GitHub Issues](https://github.com/apache/superset/issues)
