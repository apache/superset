---
title: Development
sidebar_position: 6
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

# Development

This guide covers everything you need to know about developing extensions for Superset, from project structure to development workflow.

## Project Structure

The [apache-superset-extensions-cli](https://github.com/apache/superset/tree/master/superset-extensions-cli) package provides a command-line interface (CLI) that streamlines the extension development workflow. It offers the following commands:

```
superset-extensions init: Generates the initial folder structure and scaffolds a new extension project.

superset-extensions build: Builds extension assets.

superset-extensions bundle: Packages the extension into a .supx file.

superset-extensions dev: Automatically rebuilds the extension as files change.
```

When creating a new extension with `superset-extensions init`, the CLI generates a standardized folder structure:

```
dataset-references/
├── extension.json
├── frontend/
│   ├── src/
│   ├── webpack.config.js
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│   │    └── superset_extensions/
│   │         └── dataset_references/
│   ├── tests/
│   ├── pyproject.toml
│   └── requirements.txt
├── dist/
│   ├── manifest.json
│   ├── frontend
│   │    └── dist/
│   │         ├── remoteEntry.d7a9225d042e4ccb6354.js
│   │         └── 900.038b20cdff6d49cfa8d9.js
│   └── backend
│        └── superset_extensions/
│             └── dataset_references/
│                  ├── __init__.py
│                  ├── api.py
│                  └── entrypoint.py
├── dataset-references-1.0.0.supx
└── README.md
```

**Note**: The extension ID (`dataset-references`) serves as the basis for all technical names:
- Directory name: `dataset-references` (kebab-case)
- Backend Python package: `dataset_references` (snake_case)
- Frontend package name: `dataset-references` (kebab-case)
- Module Federation name: `datasetReferences` (camelCase)

The `extension.json` file serves as the declared metadata for the extension, containing the extension's name, version, author, description, and a list of capabilities. This file is essential for the host application to understand how to load and manage the extension.

The `frontend` directory contains the source code for the frontend components of the extension, including React components, styles, and assets. The `webpack.config.js` file is used to configure Webpack for building the frontend code, while the `tsconfig.json` file defines the TypeScript configuration for the project. The `package.json` file specifies the dependencies and scripts for building and testing the frontend code.

The `backend` directory contains the source code for the backend components of the extension, including Python modules, tests, and configuration files. The `pyproject.toml` file is used to define the Python package and its dependencies, while the `requirements.txt` file lists the required Python packages for the extension. The `src` folder contains the functional backend source files, `tests` directory contains unit tests for the backend code, ensuring that the extension behaves as expected and meets the defined requirements.

The `dist` directory is built when running the `build` or `dev` command, and contains the files that will be included in the bundle. The `manifest.json` file contains critical metadata about the extension, including the majority of the contents of the `extension.json` file, but also other build-time information, like the name of the built Webpack Module Federation remote entry file. The files in the `dist` directory will be zipped into the final `.supx` file. Although this file is technically a zip archive, the `.supx` extension makes it clear that it is a Superset extension package and follows a specific file layout. This packaged file can be distributed and installed in Superset instances.

The `README.md` file provides documentation and instructions for using the extension, including how to install, configure, and use its functionality.

## Extension Metadata

The `extension.json` file contains all metadata necessary for the host application to understand and manage the extension:

```json
{
  "id": "dataset-references",
  "name": "Dataset References",
  "version": "1.0.0",
  "frontend": {
    "contributions": {
      "views": {
        "sqllab": {
          "panels": [
            {
              "id": "dataset-references.main",
              "name": "Dataset References"
            }
          ]
        }
      }
    },
    "moduleFederation": {
      "exposes": ["./index"],
      "name": "datasetReferences"
    }
  },
  "backend": {
    "entryPoints": ["superset_extensions.dataset_references.entrypoint"],
    "files": ["backend/src/superset_extensions/dataset_references/**/*.py"]
  }
}
```

The `contributions` section declares how the extension extends Superset's functionality through views, commands, menus, and other contribution types. The `backend` section specifies entry points and files to include in the bundle.

## Interacting with the Host

Extensions interact with Superset through well-defined, versioned APIs provided by the `@apache-superset/core` (frontend) and `apache-superset-core` (backend) packages. These APIs are designed to be stable, discoverable, and consistent for both built-in and external extensions.

**Note**: The `superset_core.api` module provides abstract classes that are replaced with concrete implementations via dependency injection when Superset initializes. This allows extensions to use the same interfaces as the host application.

### Frontend APIs

The frontend extension APIs (via `@apache-superset/core`) are organized into logical namespaces such as `authentication`, `commands`, `extensions`, `sqlLab`, and others. Each namespace groups related functionality, making it easy for extension authors to discover and use the APIs relevant to their needs. For example, the `sqlLab` namespace provides events and methods specific to SQL Lab, allowing extensions to react to user actions and interact with the SQL Lab environment:

```typescript
export const getCurrentTab: () => Tab | undefined;

export const getDatabases: () => Database[];

export const getTabs: () => Tab[];

export const onDidChangeActivePanel: Event<Panel>;

export const onDidChangeTabTitle: Event<string>;

export const onDidQueryRun: Event<QueryContext>;

export const onDidQueryStop: Event<QueryContext>;
```

The following code demonstrates more examples of the existing frontend APIs:

```typescript
import { core, commands, sqlLab, authentication, Button } from '@apache-superset/core';
import MyPanel from './MyPanel';

export function activate(context) {
  // Register a new panel (view) in SQL Lab and use shared UI components in your extension's React code
  const panelDisposable = core.registerView('my_extension.panel', <MyPanel><Button/></MyPanel>);

  // Register a custom command
  const commandDisposable = commands.registerCommand(
    'my_extension.copy_query',
    () => {
      // Command logic here
    },
  );

  // Listen for query run events in SQL Lab
  const eventDisposable = sqlLab.onDidQueryRun(queryContext => {
    console.log('Query started on database:', queryContext.tab.databaseId);
  });

  // Access a CSRF token for secure API requests
  authentication.getCSRFToken().then(token => {
    // Use token as needed
  });

  // Add all disposables for automatic cleanup on deactivation
  context.subscriptions.push(panelDisposable, commandDisposable, eventDisposable);
}
```

### Backend APIs

Backend APIs (via `apache-superset-core`) follow a similar pattern, providing access to Superset's models, sessions, and query capabilities. Extensions can register REST API endpoints, access the metadata database, and interact with Superset's core functionality.

Extension endpoints are registered under a dedicated `/extensions` namespace to avoid conflicting with built-in endpoints and also because they don't share the same version constraints. By grouping all extension endpoints under `/extensions`, Superset establishes a clear boundary between core and extension functionality, making it easier to manage, document, and secure both types of APIs.

```python
from superset_core.api.models import Database, get_session
from superset_core.api.daos import DatabaseDAO
from superset_core.api.rest_api import add_extension_api
from .api import DatasetReferencesAPI

# Register a new extension REST API
add_extension_api(DatasetReferencesAPI)

# Fetch Superset entities via the DAO to apply base filters that filter out entities
# that the user doesn't have access to
databases = DatabaseDAO.find_all()

# ..or apply simple filters on top of base filters
databases = DatabaseDAO.filter_by(uuid=database.uuid)
if not databases:
    raise Exception("Database not found")

return databases[0]

# Perform complex queries using SQLAlchemy Query, also filtering out
# inaccessible entities
session = get_session()
databases_query = session.query(Database).filter(
    Database.database_name.ilike("%abc%")
)
return DatabaseDAO.query(databases_query)
```

In the future, we plan to expand the backend APIs to support configuring security models, database engines, SQL Alchemy dialects, etc.

## Development Mode

Development mode accelerates extension development by letting developers see changes in Superset quickly, without the need for repeated packaging and uploading. To enable development mode, set the `LOCAL_EXTENSIONS` configuration in your `superset_config.py`:

```python
LOCAL_EXTENSIONS = [
    "/path/to/your/extension1",
    "/path/to/your/extension2",
]
```

This instructs Superset to load and serve extensions directly from disk, so you can iterate quickly. Running `superset-extensions dev` watches for file changes and rebuilds assets automatically, while the Webpack development server (started separately with `npm run dev-server`) serves updated files as soon as they're modified. This enables immediate feedback for React components, styles, and other frontend code. Changes to backend files are also detected automatically and immediately synced, ensuring that both frontend and backend updates are reflected in your development environment.

Example output when running in development mode:

```
superset-extensions dev

⚙️  Building frontend assets…
✅ Frontend rebuilt
✅ Backend files synced
✅ Manifest updated
👀 Watching for changes in: /dataset_references/frontend, /dataset_references/backend
```

## Contributing Extension-Compatible Components

Components in `@apache-superset/core` are automatically documented in the Developer Portal. Simply add a component to the package and it will appear in the extension documentation.

### Requirements

1. **Location**: The component must be in `superset-frontend/packages/superset-core/src/ui/components/`
2. **Exported**: The component must be exported from the package's `index.ts`
3. **Story**: The component must have a Storybook story

### Creating a Story for Your Component

Create a story file with an `Interactive` export that defines args and argTypes:

```typescript
// MyComponent.stories.tsx
import { MyComponent } from '.';

export default {
  title: 'Extension Components/MyComponent',
  component: MyComponent,
  parameters: {
    docs: {
      description: {
        component: 'A brief description of what this component does.',
      },
    },
  },
};

// Define an interactive story with args
export const InteractiveMyComponent = (args) => <MyComponent {...args} />;

InteractiveMyComponent.args = {
  variant: 'primary',
  disabled: false,
};

InteractiveMyComponent.argTypes = {
  variant: {
    control: { type: 'select' },
    options: ['primary', 'secondary', 'danger'],
  },
  disabled: {
    control: { type: 'boolean' },
  },
};
```

### How Documentation is Generated

When the docs site is built (`yarn start` or `yarn build` in the `docs/` directory):

1. The `generate-extension-components` script scans all stories in `superset-core`
2. For each story, it generates an MDX page with:
   - Component description
   - **Live interactive example** with controls extracted from `argTypes`
   - **Editable code playground** for experimentation
   - Props table from story `args`
   - Usage code snippet
   - Links to source files
3. Pages appear automatically in **Developer Portal → Extensions → Components**

### Best Practices

- **Use descriptive titles**: The title path determines the component's location in docs (e.g., `Extension Components/Alert`)
- **Define argTypes**: These become interactive controls in the documentation
- **Provide default args**: These populate the initial state of the live example
- **Write clear descriptions**: Help extension developers understand when to use each component
