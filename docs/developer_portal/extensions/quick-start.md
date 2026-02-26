---
title: Quick Start
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

# Quick Start

This guide walks you through creating your first Superset extension - a simple "Hello World" panel that displays a message fetched from a backend API endpoint. You'll learn the essential structure and patterns for building full-stack Superset extensions.

## Prerequisites

Before starting, ensure you have:

- Node.js and npm compatible with your Superset version
- Python compatible with your Superset version
- A running Superset development environment
- Basic knowledge of React, TypeScript, and Flask

## Step 1: Install the Extensions CLI

First, install the Apache Superset Extensions CLI:

```bash
pip install apache-superset-extensions-cli
```

## Step 2: Create a New Extension

Use the CLI to scaffold a new extension project. Extensions can include frontend functionality, backend functionality, or both, depending on your needs. This quickstart demonstrates a full-stack extension with both frontend UI components and backend API endpoints to show the complete integration pattern.

```bash
superset-extensions init
```

The CLI will prompt you for information using a three-step publisher workflow:

```
Extension display name: Hello World
Extension name (hello-world): hello-world
Publisher (e.g., my-org): my-org
Initial version [0.1.0]: 0.1.0
License [Apache-2.0]: Apache-2.0
Include frontend? [Y/n]: Y
Include backend? [Y/n]: Y
```

**Publisher Namespaces**: Extensions use organizational namespaces similar to VS Code extensions, providing collision-safe naming across organizations:
- **NPM package**: `@my-org/hello-world` (scoped package for frontend distribution)
- **Module Federation name**: `myOrg_helloWorld` (collision-safe JavaScript identifier)
- **Backend package**: `my_org-hello_world` (collision-safe Python distribution name)
- **Python namespace**: `superset_extensions.my_org.hello_world`

This approach ensures that extensions from different organizations cannot conflict, even if they use the same technical name (e.g., both `acme.dashboard-widgets` and `corp.dashboard-widgets` can coexist).

This creates a complete project structure:

```
my-org.hello-world/
├── extension.json           # Extension metadata and configuration
├── backend/                 # Backend Python code
│   ├── src/
│   │   └── superset_extensions/
│   │       └── my_org/
│   │           ├── __init__.py
│   │           └── hello_world/
│   │               ├── __init__.py
│   │               └── entrypoint.py  # Backend registration
│   └── pyproject.toml
└── frontend/                # Frontend TypeScript/React code
    ├── src/
    │   └── index.tsx        # Frontend entry point
    ├── package.json
    ├── tsconfig.json
    └── webpack.config.js
```

## Step 3: Configure Extension Metadata

The generated `extension.json` contains basic metadata. Update it to register your panel in SQL Lab:

```json
{
  "publisher": "my-org",
  "name": "hello-world",
  "displayName": "Hello World",
  "version": "0.1.0",
  "license": "Apache-2.0",
  "frontend": {
    "contributions": {
      "views": {
        "sqllab": {
          "panels": [
            {
              "id": "my-org.hello-world.main",
              "name": "Hello World"
            }
          ]
        }
      }
    },
    "moduleFederation": {
      "exposes": ["./index"],
      "name": "myOrg_helloWorld"
    }
  },
  "backend": {
    "entryPoints": ["superset_extensions.my_org.hello_world.entrypoint"],
    "files": ["backend/src/superset_extensions/my_org/hello_world/**/*.py"]
  },
  "permissions": ["can_read"]
}
```

**Note**: The `moduleFederation.name` uses collision-safe naming (`myOrg_helloWorld`), and backend entry points use the full nested Python namespace (`superset_extensions.my_org.hello_world`).

**Key fields:**

- `publisher`: Organizational namespace for the extension
- `name`: Technical identifier (kebab-case)
- `displayName`: Human-readable name shown to users
- `frontend.contributions.views.sqllab.panels`: Registers your panel in SQL Lab
- `backend.entryPoints`: Python modules to load eagerly when extension starts

## Step 4: Create Backend API

The CLI generated a basic `backend/src/superset_extensions/my_org/hello_world/entrypoint.py`. We'll create an API endpoint.

**Create `backend/src/superset_extensions/my_org/hello_world/api.py`**

```python
from flask import Response
from flask_appbuilder.api import expose, protect, safe
from superset_core.api.rest_api import RestApi


class HelloWorldAPI(RestApi):
    resource_name = "hello_world"
    openapi_spec_tag = "Hello World"
    class_permission_name = "hello_world"

    @expose("/message", methods=("GET",))
    @protect()
    @safe
    def get_message(self) -> Response:
        """Gets a hello world message
        ---
        get:
          description: >-
            Get a hello world message from the backend
          responses:
            200:
              description: Hello world message
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          message:
                            type: string
            401:
              $ref: '#/components/responses/401'
        """
        return self.response(
            200,
            result={"message": "Hello from the backend!"}
        )
```

**Key points:**

- Extends `RestApi` from `superset_core.api.types.rest_api`
- Uses Flask-AppBuilder decorators (`@expose`, `@protect`, `@safe`)
- Returns responses using `self.response(status_code, result=data)`
- The endpoint will be accessible at `/extensions/my-org/hello-world/message`
- OpenAPI docstrings are crucial - Flask-AppBuilder uses them to automatically generate interactive API documentation at `/swagger/v1`, allowing developers to explore endpoints, understand schemas, and test the API directly from the browser

**Update `backend/src/superset_extensions/my_org/hello_world/entrypoint.py`**

Replace the generated print statement with API registration:

```python
from superset_core.api import rest_api

from .api import HelloWorldAPI

rest_api.add_extension_api(HelloWorldAPI)
```

This registers your API with Superset when the extension loads.

## Step 5: Create Frontend Component

The CLI generates the frontend configuration files. Below are the key configurations that enable Module Federation integration with Superset.

**`frontend/package.json`**

The `@apache-superset/core` package must be listed in both `peerDependencies` (to declare runtime compatibility) and `devDependencies` (to provide TypeScript types during build):

```json
{
  "name": "@my-org/hello-world",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "scripts": {
    "start": "webpack serve --mode development",
    "build": "webpack --stats-error-details --mode production"
  },
  "peerDependencies": {
    "@apache-superset/core": "^x.x.x",
    "react": "^x.x.x",
    "react-dom": "^x.x.x"
  },
  "devDependencies": {
    "@apache-superset/core": "^x.x.x",
    "@types/react": "^x.x.x",
    "ts-loader": "^x.x.x",
    "typescript": "^x.x.x",
    "webpack": "^5.x.x",
    "webpack-cli": "^x.x.x",
    "webpack-dev-server": "^x.x.x"
  }
}
```

**`frontend/webpack.config.js`**

The webpack configuration requires specific settings for Module Federation. Key settings include `externalsType: "window"` and `externals` to map `@apache-superset/core` to `window.superset` at runtime, `import: false` for shared modules to use the host's React instead of bundling a separate copy, and `remoteEntry.[contenthash].js` for cache busting:

```javascript
const path = require("path");
const { ModuleFederationPlugin } = require("webpack").container;
const packageConfig = require("./package.json");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: isProd ? {} : "./src/index.tsx",
    mode: isProd ? "production" : "development",
    devServer: {
      port: 3001,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    output: {
      filename: isProd ? undefined : "[name].[contenthash].js",
      chunkFilename: "[name].[contenthash].js",
      clean: true,
      path: path.resolve(__dirname, "dist"),
      publicPath: `/api/v1/extensions/my-org/hello-world/`,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    // Map @apache-superset/core imports to window.superset at runtime
    externalsType: "window",
    externals: {
      "@apache-superset/core": "superset",
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: "myOrg_helloWorld",
        filename: "remoteEntry.[contenthash].js",
        exposes: {
          "./index": "./src/index.tsx",
        },
        shared: {
          react: {
            singleton: true,
            requiredVersion: packageConfig.peerDependencies.react,
            import: false, // Use host's React, don't bundle
          },
          "react-dom": {
            singleton: true,
            requiredVersion: packageConfig.peerDependencies["react-dom"],
            import: false,
          },
        },
      }),
    ],
  };
};
```

**`frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "moduleResolution": "node",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

**Create `frontend/src/HelloWorldPanel.tsx`**

Create a new file for the component implementation:

```tsx
import React, { useEffect, useState } from 'react';
import { authentication } from '@apache-superset/core';

const HelloWorldPanel: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const csrfToken = await authentication.getCSRFToken();
        const response = await fetch('/extensions/my-org/hello-world/message', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken!,
          },
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }

        const data = await response.json();
        setMessage(data.result.message);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchMessage();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>Hello World Extension</h3>
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: '4px',
          marginBottom: '16px',
        }}
      >
        <strong>{message}</strong>
      </div>
      <p>This message was fetched from the backend API! 🎉</p>
    </div>
  );
};

export default HelloWorldPanel;
```

**Update `frontend/src/index.tsx`**

Replace the generated code with the extension entry point:

```tsx
import React from 'react';
import { defineView } from '@apache-superset/core';
import HelloWorldPanel from './HelloWorldPanel';

// Define the view - automatically registered when extension loads
export const helloWorldView = defineView({
  id: 'main',
  title: 'Hello World',
  location: 'sqllab.panels',
  component: () => <HelloWorldPanel />,
});
```

That's it! For most extensions, this is all you need.

**Optional lifecycle callbacks:**

If you need to run code when your contribution activates or deactivates, add optional callbacks:

```tsx
export const helloWorldView = defineView({
  id: 'main',
  title: 'Hello World',
  location: 'sqllab.panels',
  component: () => <HelloWorldPanel />,
  onActivate: () => {
    // Optional: runs when panel is registered
    console.log('Hello World panel activated');
  },
  onDeactivate: () => {
    // Optional: runs when panel is unregistered
    console.log('Hello World panel deactivated');
  },
});
```

**Key patterns:**

- `defineView()` automatically handles discovery, registration, and cleanup
- `onActivate` and `onDeactivate` are completely optional
- `authentication.getCSRFToken()` retrieves the CSRF token for API calls
- Fetch calls to `/extensions/{extension_id}/{endpoint}` reach your backend API
- Everything happens automatically - no manual setup required

## Step 6: Install Dependencies

Install the frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

## Step 7: Package the Extension

Create a `.supx` bundle for deployment:

```bash
superset-extensions bundle
```

This command automatically:

- Builds frontend assets using Webpack with Module Federation
- Collects backend Python source files
- Creates a `dist/` directory with:
  - `manifest.json` - Build metadata and asset references
  - `frontend/dist/` - Built frontend assets (remoteEntry.js, chunks)
  - `backend/` - Python source files
- Packages everything into `my-org.hello-world-0.1.0.supx` - a zip archive with the specific structure required by Superset

## Step 8: Deploy to Superset

To deploy your extension, you need to enable extensions support and configure where Superset should load them from.

**Configure Superset**

Add the following to your `superset_config.py`:

```python
# Enable extensions feature
FEATURE_FLAGS = {
    "ENABLE_EXTENSIONS": True,
}

# Set the directory where extensions are stored
EXTENSIONS_PATH = "/path/to/extensions/folder"
```

**Copy Extension Bundle**

Copy your `.supx` file to the configured extensions path:

```bash
cp my-org.hello-world-0.1.0.supx /path/to/extensions/folder/
```

**Restart Superset**

Restart your Superset instance to load the extension:

```bash
# Restart your Superset server
superset run
```

Superset will extract and validate the extension metadata, load the assets, register the extension with its capabilities, and make it available for use.

## Step 9: Test Your Extension

1. **Open SQL Lab** in Superset
2. Look for the **"Hello World"** panel in the panels dropdown or sidebar
3. Open the panel - it should display "Hello from the backend!"
4. Check that the message was fetched from your API endpoint

## Understanding the Flow

Here's what happens when your extension loads:

1. **Superset starts**: Reads `extension.json` and loads backend entrypoint
2. **Backend registration**: `entrypoint.py` registers your API via `rest_api.add_extension_api()`
3. **Frontend loads**: When SQL Lab opens, Superset fetches the remote entry file
4. **Module Federation**: Webpack loads your extension code and resolves `@apache-superset/core` to `window.superset`
5. **Activation**: `activate()` is called, registering your view provider
6. **Rendering**: When the user opens your panel, React renders `<HelloWorldPanel />`
7. **API call**: Component fetches data from `/extensions/my-org/hello-world/message`
8. **Backend response**: Your Flask API returns the hello world message
9. **Display**: Component shows the message to the user

## Next Steps

Now that you have a working extension, explore:

- **[Development](./development)** - Project structure, APIs, and development workflow
- **[Contribution Types](./contribution-types)** - Other contribution points beyond panels
- **[Deployment](./deployment)** - Packaging and deploying your extension
- **[Security](./security)** - Security best practices for extensions

For a complete real-world example, examine the query insights extension in the Superset codebase.
