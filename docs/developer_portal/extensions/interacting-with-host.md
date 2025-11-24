---
title: Interacting with the Host
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

# Interacting with the Host

Extensions interact with Superset through well-defined, versioned APIs provided by the `@apache-superset/core` (frontend) and `apache-superset-core` (backend) packages. These APIs are designed to be stable, discoverable, and consistent for both built-in and external extensions.

**Note**: The `superset_core.api` module provides abstract classes that are replaced with concrete implementations via dependency injection when Superset initializes. This allows extensions to use the same interfaces as the host application.

**Frontend APIs** (via `@apache-superset/core)`:

The frontend extension APIs in Superset are organized into logical namespaces such as `authentication`, `commands`, `extensions`, `sqlLab`, and others. Each namespace groups related functionality, making it easy for extension authors to discover and use the APIs relevant to their needs. For example, the `sqlLab` namespace provides events and methods specific to SQL Lab, allowing extensions to react to user actions and interact with the SQL Lab environment:

``` typescript
export const getCurrentTab: () => Tab | undefined;

export const getDatabases: () => Database[];

export const getTabs: () => Tab[];

export const onDidChangeEditorContent: Event<string>;

export const onDidClosePanel: Event<Panel>;

export const onDidChangeActivePanel: Event<Panel>;

export const onDidChangeTabTitle: Event<string>;

export const onDidQueryRun: Event<Editor>;

export const onDidQueryStop: Event<Editor>;
```

The following code demonstrates more examples of the existing frontend APIs:

``` typescript
import { core, commands, sqlLab, authentication, Button } from '@apache-superset/core';
import MyPanel from './MyPanel';

export function activate(context) {
  // Register a new panel (view) in SQL Lab and use shared UI components in your extension's React code
  const panelDisposable = core.registerView('my_extension.panel', <MyPanel><Button/></MyPanel>);

  // Register a custom command
  const commandDisposable = commands.registerCommand('my_extension.copy_query', {
    title: 'Copy Query',
    execute: () => {
      // Command logic here
    },
  });

  // Listen for query run events in SQL Lab
  const eventDisposable = sqlLab.onDidQueryRun(editor => {
    // Handle query execution event
  });

  // Access a CSRF token for secure API requests
  authentication.getCSRFToken().then(token => {
    // Use token as needed
  });

  // Add all disposables for automatic cleanup on deactivation
  context.subscriptions.push(panelDisposable, commandDisposable, eventDisposable);
}
```

**Backend APIs** (via `apache-superset-core`):

Backend APIs follow a similar pattern, providing access to Superset's models, sessions, and query capabilities. Extensions can register REST API endpoints, access the metadata database, and interact with Superset's core functionality.

Extension endpoints are registered under a dedicated `/extensions` namespace to avoid conflicting with built-in endpoints and also because they don't share the same version constraints. By grouping all extension endpoints under `/extensions`, Superset establishes a clear boundary between core and extension functionality, making it easier to manage, document, and secure both types of APIs.

``` python
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

# Bypass security model for highly custom use cases
session = get_session()
all_databases_containing_abc = session.query(Database).filter(
    Database.database_name.ilike("%abc%")
).all()
```

In the future, we plan to expand the backend APIs to support configuring security models, database engines, SQL Alchemy dialects, etc.
