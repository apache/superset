---
title: Your First Extension
sidebar_position: 2
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

# Building Your First Superset Extension

This guide walks you through creating, developing, and deploying your first Apache Superset extension. We'll build a simple SQL Lab extension that adds a custom panel displaying query statistics.

## Prerequisites

Before starting, ensure you have:
- Node.js 16+ and npm installed
- Python 3.9+ installed
- A running Superset development environment
- Basic knowledge of React and TypeScript

## Step 1: Install the Extension CLI

First, install the Superset extension development CLI globally:

```bash
pip install apache-superset-extensions-cli
```

Verify the installation:

```bash
superset-extensions --version
```

## Step 2: Create Your Extension

Use the CLI to scaffold a new extension project:

```bash
superset-extensions init query-stats
cd query-stats
```

This creates the following structure:

```
query-stats/
├── extension.json          # Extension metadata
├── frontend/              # Frontend source code
│   ├── src/
│   │   └── index.tsx     # Main entry point
│   ├── package.json
│   └── webpack.config.js
├── backend/               # Backend source code
│   ├── src/
│   │   └── query_stats/
│   │       └── __init__.py
│   └── requirements.txt
└── README.md
```

## Step 3: Configure Extension Metadata

Edit `extension.json` to define your extension's capabilities:

```json
{
  "name": "query_stats",
  "displayName": "Query Statistics",
  "version": "1.0.0",
  "description": "Display query execution statistics in SQL Lab",
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
            "id": "query_stats.main",
            "name": "Query Stats",
            "icon": "BarChartOutlined",
            "when": "sqllab.queryExecuted"
          }
        ]
      },
      "commands": [
        {
          "command": "query_stats.refresh",
          "title": "Refresh Statistics",
          "icon": "ReloadOutlined"
        }
      ]
    }
  },
  "backend": {
    "entryPoints": ["query_stats.api"]
  }
}
```

## Step 4: Implement the Frontend

Create the main panel component in `frontend/src/QueryStatsPanel.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Spin } from '@apache-superset/core';
import { sqlLab, api } from '@apache-superset/core';

export const QueryStatsPanel: React.FC = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Listen for query execution
    const disposable = sqlLab.onDidQueryRun(async (editor) => {
      setLoading(true);
      try {
        const response = await api.get(`/extensions/query_stats/analyze`, {
          params: { query_id: editor.queryId }
        });
        setStats(response.data);
      } finally {
        setLoading(false);
      }
    });

    return () => disposable.dispose();
  }, []);

  if (loading) return <Spin size="large" />;
  if (!stats) return <div>Run a query to see statistics</div>;

  return (
    <Card title="Query Statistics">
      <Row gutter={16}>
        <Col span={8}>
          <Statistic
            title="Execution Time"
            value={stats.executionTime}
            suffix="ms"
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Rows Returned"
            value={stats.rowCount}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title="Tables Accessed"
            value={stats.tableCount}
          />
        </Col>
      </Row>
    </Card>
  );
};
```

Update `frontend/src/index.tsx` to activate the extension:

```tsx
import { ExtensionContext } from '@apache-superset/core';
import { QueryStatsPanel } from './QueryStatsPanel';

export function activate(context: ExtensionContext) {
  // Register the panel
  const panel = context.registerView(
    'query_stats.main',
    <QueryStatsPanel />
  );

  // Register the refresh command
  const command = context.registerCommand('query_stats.refresh', {
    execute: () => {
      // Trigger panel refresh
      context.events.emit('query_stats.refresh');
    }
  });

  // Add disposables for cleanup
  context.subscriptions.push(panel, command);
}

export function deactivate() {
  // Cleanup handled automatically via subscriptions
}
```

## Step 5: Implement the Backend

Create the API endpoint in `backend/src/query_stats/api.py`:

```python
from flask import request
from flask_appbuilder.api import BaseApi, expose
from superset_core import models, security_manager
from superset_core.api import rest_api

class QueryStatsAPI(BaseApi):
    route_base = "/extensions/query_stats"

    @expose("/analyze", methods=["GET"])
    @security_manager.protected()
    def analyze_query(self):
        """Analyze query execution statistics"""
        query_id = request.args.get("query_id")

        if not query_id:
            return self.response_400("query_id parameter required")

        # Get query from database
        query = models.get_query(query_id)
        if not query:
            return self.response_404()

        # Calculate statistics
        stats = {
            "executionTime": query.end_time - query.start_time,
            "rowCount": query.rows,
            "tableCount": len(query.tables),
            "status": query.status
        }

        return self.response(200, **stats)

# Register the API
rest_api.add_extension_api(QueryStatsAPI)
```

## Step 6: Development Mode

Enable development mode for rapid iteration:

1. Add your extension path to `superset_config.py`:

```python
LOCAL_EXTENSIONS = [
    "/path/to/query-stats"
]
ENABLE_EXTENSIONS = True
```

2. Start the development watcher:

```bash
# In the extension directory
superset-extensions dev

# In another terminal, start Superset
superset run -p 8088 --with-threads --reload
```

Your extension will automatically reload when you make changes.

## Step 7: Build and Package

When ready to distribute, build and package your extension:

```bash
# Build assets
superset-extensions build

# Create distribution package
superset-extensions bundle
```

This creates a `query_stats-1.0.0.supx` file ready for deployment.

## Step 8: Deploy Your Extension

Deploy the extension to a Superset instance:

### Via API

```bash
curl -X POST http://localhost:8088/api/v1/extensions/import/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "bundle=@query_stats-1.0.0.supx"
```

### Via Management UI

1. Navigate to Settings → Extensions
2. Click "Upload Extension"
3. Select your `.supx` file
4. Click "Install"

## Step 9: Test Your Extension

1. Open SQL Lab
2. Look for the "Query Stats" panel in the panels menu
3. Run a query
4. View the statistics in your custom panel

## Advanced Topics

### Adding Configuration

Extensions can accept configuration from administrators:

```json
{
  "configuration": {
    "schema": {
      "refreshInterval": {
        "type": "number",
        "default": 5000,
        "description": "Auto-refresh interval in milliseconds"
      }
    }
  }
}
```

### Using Shared State

Share data between extension components:

```tsx
import { extensionState } from '@apache-superset/core';

// Set state
extensionState.set('query_stats.lastQuery', queryData);

// Get state
const lastQuery = extensionState.get('query_stats.lastQuery');

// Subscribe to changes
extensionState.onChange('query_stats.lastQuery', (data) => {
  // Handle update
});
```

### Adding Menu Items

Contribute menu items to SQL Lab:

```json
{
  "menus": {
    "sqllab.editor": {
      "primary": [
        {
          "command": "query_stats.export",
          "title": "Export Statistics"
        }
      ]
    }
  }
}
```

## Troubleshooting

### Extension Not Loading

1. Check that `ENABLE_EXTENSIONS = True` in config
2. Verify the extension is properly registered
3. Check browser console for errors
4. Ensure all dependencies are installed

### API Endpoints Not Working

1. Verify backend entrypoint is correct
2. Check Flask logs for registration errors
3. Ensure authentication is properly handled
4. Test endpoint directly with curl

### Development Mode Issues

1. Ensure webpack dev server is running
2. Check that `LOCAL_EXTENSIONS` paths are absolute
3. Verify file watchers are working
4. Clear browser cache if needed

## Next Steps

- Explore [API Reference](/developer_portal/api/frontend) for available APIs
- Review [Example Extensions](/developer_portal/examples) for inspiration
- Learn about [Advanced Topics](/developer_portal/advanced/overview)
- Share your extension with the community!

## Resources

- [Extension Architecture](/developer_portal/architecture/overview)
- [CLI Documentation](/developer_portal/cli/overview)
- [Contribution Guidelines](/developer_portal/guides/contributing)
- [Community Forum](https://github.com/apache/superset/discussions)
