---
title: "Example: Hello World"
sidebar_position: 14
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

# Example: Hello World

:::warning Work in Progress
This documentation is under active development. Some features described may not be fully implemented yet.
:::

This guide walks you through creating your first Superset extension - a simple "Hello World" panel for SQL Lab. You'll learn how to create, build, package, install, and test a basic extension.

## Prerequisites

Before starting, ensure you have:
- Node.js 18+ and npm installed
- Python 3.9+ installed
- A running Superset development environment with `ENABLE_EXTENSIONS = True` in your config
- Basic knowledge of React and TypeScript

## Step 1: Initialize Your Extension

First, install the Superset extension CLI and create a new extension project:

```bash
# Install the CLI globally
pip install apache-superset-extensions-cli

# Create a new extension
superset-extensions init hello-world
cd hello-world
```

This creates the following structure:
```
hello-world/
├── extension.json         # Extension metadata
├── frontend/             # Frontend code
│   ├── src/
│   │   └── index.tsx    # Main entry point
│   ├── package.json
│   └── webpack.config.js
├── backend/              # Backend code (optional)
│   └── src/
└── README.md
```

## Step 2: Configure Extension Metadata

Edit `extension.json` to define your extension's capabilities:

```json
{
  "name": "hello_world",
  "displayName": "Hello World Extension",
  "version": "1.0.0",
  "description": "A simple Hello World panel for SQL Lab",
  "author": "Your Name",
  "license": "Apache-2.0",
  "superset": {
    "minVersion": "4.0.0"
  },
  "frontend": {
    "contributions": {
      "views": {
        "sqllab.panels": [
          {
            "id": "hello_world.main",
            "name": "Hello World",
            "icon": "SmileOutlined"
          }
        ]
      },
      "commands": [
        {
          "command": "hello_world.greet",
          "title": "Say Hello",
          "description": "Display a greeting message"
        }
      ]
    }
  }
}
```

## Step 3: Create the Frontend Component

Create `frontend/src/HelloWorldPanel.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Card, Button, Alert } from '@apache-superset/core';

export const HelloWorldPanel: React.FC = () => {
  const [greeting, setGreeting] = useState('Hello, Superset!');
  const [queryCount, setQueryCount] = useState(0);

  // Listen for query executions
  useEffect(() => {
    const handleQueryRun = () => {
      setQueryCount(prev => prev + 1);
      setGreeting(`Hello! You've run ${queryCount + 1} queries.`);
    };

    // Subscribe to SQL Lab events
    const disposable = window.superset?.sqlLab?.onDidQueryRun?.(handleQueryRun);

    return () => disposable?.dispose?.();
  }, [queryCount]);

  return (
    <Card title="Hello World Extension">
      <Alert
        message={greeting}
        type="success"
        showIcon
      />
      <p style={{ marginTop: 16 }}>
        This is your first Superset extension! 🎉
      </p>
      <p>
        Queries executed this session: <strong>{queryCount}</strong>
      </p>
      <Button
        onClick={() => setGreeting('Hello from the button!')}
        style={{ marginTop: 16 }}
      >
        Click Me
      </Button>
    </Card>
  );
};
```

## Step 4: Set Up the Entry Point

Update `frontend/src/index.tsx`:

```tsx
import { ExtensionContext } from '@apache-superset/core';
import { HelloWorldPanel } from './HelloWorldPanel';

export function activate(context: ExtensionContext) {
  console.log('Hello World extension is activating!');

  // Register the panel
  const panel = context.registerView(
    'hello_world.main',
    <HelloWorldPanel />
  );

  // Register the command
  const command = context.registerCommand('hello_world.greet', {
    execute: () => {
      console.log('Hello from the command!');
      // You could trigger panel updates or show notifications here
    }
  });

  // Add disposables for cleanup
  context.subscriptions.push(panel, command);
}

export function deactivate() {
  console.log('Hello World extension is deactivating!');
}
```

## Step 5: Build the Extension

Build your extension assets:

```bash
# Install dependencies
cd frontend
npm install

# Build the extension
cd ..
superset-extensions build

# This creates a dist/ folder with your built assets
```

> **Note:** The `superset-extensions` CLI handles webpack configuration automatically. Superset already has Module Federation configured, so you don't need to set up webpack yourself unless you have specific advanced requirements.

## Step 6: Package the Extension

Create the distributable `.supx` file:

```bash
superset-extensions bundle

# This creates hello_world-1.0.0.supx
```

## Step 7: Install in Superset

Upload your extension to a running Superset instance:

### Option A: Via API
```bash
curl -X POST http://localhost:8088/api/v1/extensions/import/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "bundle=@hello_world-1.0.0.supx"
```

### Option B: Via UI
1. Navigate to Settings → Extensions
2. Click "Upload Extension"
3. Select your `hello_world-1.0.0.supx` file
4. Click "Install"

## Step 9: Test Your Extension

1. Open SQL Lab in Superset
2. Look for the "Hello World" panel in the panels dropdown or sidebar
3. The panel should display your greeting message
4. Run a SQL query and watch the query counter increment
5. Click the button to see the greeting change

## Step 10: Development Mode (Optional)

For faster development iteration, use local development mode:

1. Add to your `superset_config.py`:
```python
LOCAL_EXTENSIONS = [
    "/path/to/hello-world"
]
ENABLE_EXTENSIONS = True
```

2. Run the extension in watch mode:
```bash
superset-extensions dev
```

3. Changes will be reflected immediately without rebuilding

## Troubleshooting

### Extension Not Loading
- Check that `ENABLE_EXTENSIONS = True` in your Superset config
- Verify the extension is listed in Settings → Extensions
- Check browser console for errors
- Ensure all dependencies are installed

### Build Errors
- Make sure you have the correct Node.js version (18+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check that webpack.config.js is properly configured

### Panel Not Visible
- Verify the contribution point in extension.json matches `sqllab.panels`
- Check that the panel ID is unique
- Restart Superset after installing the extension

## Next Steps

Now that you have a working Hello World extension, you can:
- Add more complex UI components
- Integrate with Superset's API to fetch data
- Add backend functionality for data processing
- Create custom commands and menu items
- Listen to more SQL Lab events

For more advanced examples, explore the other pages in this documentation section.
