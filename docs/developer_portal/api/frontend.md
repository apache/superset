---
title: Frontend API Reference
sidebar_position: 1
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

# Frontend API Reference

The `@apache-superset/core` package provides comprehensive APIs for frontend extension development. All APIs are organized into logical namespaces for easy discovery and use.

## Core API

The core namespace provides fundamental extension functionality.

### registerView

Registers a new view or panel in the specified contribution point.

```typescript
core.registerView(
  id: string,
  component: React.ComponentType
): Disposable
```

**Example:**
```typescript
const panel = context.core.registerView('my-extension.panel', () => (
  <MyPanelComponent />
));
```

### getActiveView

Gets the currently active view in a contribution area.

```typescript
core.getActiveView(area: string): View | undefined
```

## Commands API

Manages command registration and execution.

### registerCommand

Registers a new command that can be triggered by menus, shortcuts, or programmatically.

```typescript
commands.registerCommand(
  id: string,
  handler: CommandHandler
): Disposable

interface CommandHandler {
  title: string;
  icon?: string;
  execute: (...args: any[]) => any;
  isEnabled?: (...args: any[]) => boolean;
}
```

**Example:**
```typescript
const cmd = context.commands.registerCommand('my-extension.analyze', {
  title: 'Analyze Query',
  icon: 'BarChartOutlined',
  execute: () => {
    const query = context.sqlLab.getCurrentQuery();
    // Perform analysis
  },
  isEnabled: () => {
    return context.sqlLab.hasActiveEditor();
  }
});
```

### executeCommand

Executes a registered command by ID.

```typescript
commands.executeCommand(id: string, ...args: any[]): Promise<any>
```

## SQL Lab API

Provides access to SQL Lab functionality and events.

### Query Access

```typescript
// Get current tab
sqlLab.getCurrentTab(): Tab | undefined

// Get all tabs
sqlLab.getTabs(): Tab[]

// Get current query
sqlLab.getCurrentQuery(): string

// Get selected text
sqlLab.getSelectedText(): string | undefined
```

### Database Access

```typescript
// Get available databases
sqlLab.getDatabases(): Database[]

// Get database by ID
sqlLab.getDatabase(id: number): Database | undefined

// Get schemas for database
sqlLab.getSchemas(databaseId: number): Promise<string[]>

// Get tables for schema
sqlLab.getTables(
  databaseId: number,
  schema: string
): Promise<Table[]>
```

### Events

```typescript
// Query execution events
sqlLab.onDidQueryRun: Event<QueryResult>
sqlLab.onDidQueryStop: Event<QueryResult>
sqlLab.onDidQueryFail: Event<QueryError>

// Editor events
sqlLab.onDidChangeEditorContent: Event<string>
sqlLab.onDidChangeSelection: Event<Selection>

// Tab events
sqlLab.onDidChangeActiveTab: Event<Tab>
sqlLab.onDidCloseTab: Event<Tab>
sqlLab.onDidChangeTabTitle: Event<{tab: Tab, title: string}>

// Panel events
sqlLab.onDidOpenPanel: Event<Panel>
sqlLab.onDidClosePanel: Event<Panel>
sqlLab.onDidChangeActivePanel: Event<Panel>
```

**Event Usage Example:**
```typescript
const disposable = context.sqlLab.onDidQueryRun((result) => {
  console.log('Query executed:', result.query);
  console.log('Rows returned:', result.rowCount);
  console.log('Execution time:', result.executionTime);
});

// Remember to dispose when done
context.subscriptions.push(disposable);
```

## Authentication API

Handles authentication and security tokens.

### getCSRFToken

Gets the current CSRF token for API requests.

```typescript
authentication.getCSRFToken(): Promise<string>
```

### getCurrentUser

Gets information about the current user.

```typescript
authentication.getCurrentUser(): User

interface User {
  id: number;
  username: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
}
```

### hasPermission

Checks if the current user has a specific permission.

```typescript
authentication.hasPermission(permission: string): boolean
```

## Extensions API

Manages extension lifecycle and inter-extension communication.

### getExtension

Gets information about an installed extension.

```typescript
extensions.getExtension(id: string): Extension | undefined

interface Extension {
  id: string;
  name: string;
  version: string;
  isActive: boolean;
  metadata: ExtensionMetadata;
}
```

### getActiveExtensions

Gets all currently active extensions.

```typescript
extensions.getActiveExtensions(): Extension[]
```

### Events

```typescript
// Extension lifecycle events
extensions.onDidActivateExtension: Event<Extension>
extensions.onDidDeactivateExtension: Event<Extension>
```

## UI Components

Import pre-built UI components from `@apache-superset/core`:

```typescript
import {
  Button,
  Select,
  Input,
  Table,
  Modal,
  Alert,
  Tabs,
  Card,
  Dropdown,
  Menu,
  Tooltip,
  Icon,
  // ... many more
} from '@apache-superset/core';
```

### Example Component Usage

```typescript
import { Button, Alert } from '@apache-superset/core';

function MyExtensionPanel() {
  return (
    <div>
      <Alert
        message="Extension Loaded"
        description="Your extension is ready to use"
        type="success"
      />
      <Button
        type="primary"
        onClick={() => console.log('Clicked!')}
      >
        Execute Action
      </Button>
    </div>
  );
}
```

## Storage API

Provides persistent storage for extension data.

### Local Storage

```typescript
// Store data
storage.local.set(key: string, value: any): Promise<void>

// Retrieve data
storage.local.get(key: string): Promise<any>

// Remove data
storage.local.remove(key: string): Promise<void>

// Clear all extension data
storage.local.clear(): Promise<void>
```

### Workspace Storage

Workspace storage is shared across all users for collaborative features.

```typescript
storage.workspace.set(key: string, value: any): Promise<void>
storage.workspace.get(key: string): Promise<any>
storage.workspace.remove(key: string): Promise<void>
```

## Network API

Utilities for making API calls to Superset.

### fetch

Enhanced fetch with CSRF token handling.

```typescript
network.fetch(url: string, options?: RequestInit): Promise<Response>
```

### API Client

Type-safe API client for Superset endpoints.

```typescript
// Get chart data
network.api.charts.get(id: number): Promise<Chart>

// Query database
network.api.sqlLab.execute(
  databaseId: number,
  query: string
): Promise<QueryResult>

// Get datasets
network.api.datasets.list(): Promise<Dataset[]>
```

## Utility Functions

### Formatting

```typescript
// Format numbers
utils.formatNumber(value: number, format?: string): string

// Format dates
utils.formatDate(date: Date, format?: string): string

// Format SQL
utils.formatSQL(sql: string): string
```

### Validation

```typescript
// Validate SQL syntax
utils.validateSQL(sql: string): ValidationResult

// Check if valid database ID
utils.isValidDatabaseId(id: any): boolean
```

## TypeScript Types

Import common types for type safety:

```typescript
import type {
  Database,
  Dataset,
  Chart,
  Dashboard,
  Query,
  QueryResult,
  Tab,
  Panel,
  User,
  Role,
  Permission,
  ExtensionContext,
  Disposable,
  Event,
  // ... more types
} from '@apache-superset/core';
```

## Extension Context

The context object passed to your extension's `activate` function:

```typescript
interface ExtensionContext {
  // Subscription management
  subscriptions: Disposable[];

  // Extension metadata
  extensionId: string;
  extensionPath: string;

  // API namespaces
  core: CoreAPI;
  commands: CommandsAPI;
  sqlLab: SqlLabAPI;
  authentication: AuthenticationAPI;
  extensions: ExtensionsAPI;
  storage: StorageAPI;
  network: NetworkAPI;
  utils: UtilsAPI;

  // Logging
  logger: Logger;
}
```

## Event Handling

Events follow the VS Code pattern with subscribe/dispose:

```typescript
// Subscribe to event
const disposable = sqlLab.onDidQueryRun((result) => {
  // Handle event
});

// Dispose when done
disposable.dispose();

// Or add to context for automatic cleanup
context.subscriptions.push(disposable);
```

## Best Practices

1. **Always dispose subscriptions** to prevent memory leaks
2. **Use TypeScript** for better IDE support and type safety
3. **Handle errors gracefully** with try-catch blocks
4. **Check permissions** before sensitive operations
5. **Use provided UI components** for consistency
6. **Cache API responses** when appropriate
7. **Validate user input** before processing

## Version Compatibility

The frontend API follows semantic versioning:

- **Major version**: Breaking changes
- **Minor version**: New features, backward compatible
- **Patch version**: Bug fixes

Check compatibility in your `extension.json`:

```json
{
  "engines": {
    "@apache-superset/core": "^1.0.0"
  }
}
```
