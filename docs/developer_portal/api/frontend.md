---
title: Frontend API Reference
sidebar_position: 1
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

# Frontend Extension API Reference

The `@apache-superset/core` package provides comprehensive APIs for frontend extensions to interact with Apache Superset. All APIs are versioned and follow semantic versioning principles.

## Core APIs

### Extension Context

Every extension receives a context object during activation that provides access to the extension system.

```typescript
interface ExtensionContext {
  // Unique extension identifier
  extensionId: string;

  // Extension metadata
  extensionPath: string;
  extensionUri: Uri;

  // Storage paths
  globalStorageUri: Uri;
  workspaceStorageUri: Uri;

  // Subscription management
  subscriptions: Disposable[];

  // State management
  globalState: Memento;
  workspaceState: Memento;

  // Extension-specific APIs
  registerView(viewId: string, component: React.Component): Disposable;
  registerCommand(commandId: string, handler: CommandHandler): Disposable;
}
```

### Lifecycle Methods

```typescript
// Required: Called when extension is activated
export function activate(context: ExtensionContext): void | Promise<void> {
  console.log('Extension activated');
}

// Optional: Called when extension is deactivated
export function deactivate(): void | Promise<void> {
  console.log('Extension deactivated');
}
```

## SQL Lab APIs

The `sqlLab` namespace provides APIs specific to SQL Lab functionality.

### Query Management

```typescript
// Get current query editor content
sqlLab.getCurrentQuery(): string | undefined

// Get active tab information
sqlLab.getCurrentTab(): Tab | undefined

// Get all open tabs
sqlLab.getTabs(): Tab[]

// Get available databases
sqlLab.getDatabases(): Database[]

// Get schemas for a database
sqlLab.getSchemas(databaseId: number): Promise<Schema[]>

// Get tables for a schema
sqlLab.getTables(databaseId: number, schema: string): Promise<Table[]>

// Insert text at cursor position
sqlLab.insertText(text: string): void

// Replace entire query
sqlLab.replaceQuery(query: string): void

// Execute current query
sqlLab.executeQuery(): Promise<QueryResult>

// Stop query execution
sqlLab.stopQuery(queryId: string): Promise<void>
```

### Event Subscriptions

```typescript
// Query execution events
sqlLab.onDidQueryRun(
  listener: (event: QueryRunEvent) => void
): Disposable

sqlLab.onDidQueryComplete(
  listener: (event: QueryCompleteEvent) => void
): Disposable

sqlLab.onDidQueryFail(
  listener: (event: QueryFailEvent) => void
): Disposable

// Editor events
sqlLab.onDidChangeEditorContent(
  listener: (content: string) => void
): Disposable

sqlLab.onDidChangeActiveTab(
  listener: (tab: Tab) => void
): Disposable

// Panel events
sqlLab.onDidOpenPanel(
  listener: (panel: Panel) => void
): Disposable

sqlLab.onDidClosePanel(
  listener: (panel: Panel) => void
): Disposable
```

### Types

```typescript
interface Tab {
  id: string;
  title: string;
  query: string;
  database: Database;
  schema?: string;
  isActive: boolean;
  queryId?: string;
  status?: 'pending' | 'running' | 'success' | 'error';
}

interface Database {
  id: number;
  name: string;
  backend: string;
  allows_subquery: boolean;
  allows_ctas: boolean;
  allows_cvas: boolean;
}

interface QueryResult {
  queryId: string;
  status: 'success' | 'error';
  data?: any[];
  columns?: Column[];
  error?: string;
  startTime: number;
  endTime: number;
  rows: number;
}
```

## Commands API

Register and execute commands within Superset.

### Registration

```typescript
interface CommandHandler {
  execute(...args: any[]): any | Promise<any>;
  isEnabled?(): boolean;
  isVisible?(): boolean;
}

// Register a command
commands.registerCommand(
  commandId: string,
  handler: CommandHandler
): Disposable

// Register with metadata
commands.registerCommand(
  commandId: string,
  metadata: CommandMetadata,
  handler: (...args: any[]) => any
): Disposable

interface CommandMetadata {
  title: string;
  category?: string;
  icon?: string;
  enablement?: string;
  when?: string;
}
```

### Execution

```typescript
// Execute a command
commands.executeCommand<T>(
  commandId: string,
  ...args: any[]
): Promise<T>

// Get all registered commands
commands.getCommands(): Promise<string[]>

// Check if command exists
commands.hasCommand(commandId: string): boolean
```

### Built-in Commands

```typescript
// SQL Lab commands
'sqllab.executeQuery'
'sqllab.formatQuery'
'sqllab.saveQuery'
'sqllab.shareQuery'
'sqllab.downloadResults'

// Editor commands
'editor.action.formatDocument'
'editor.action.commentLine'
'editor.action.findReferences'

// Extension commands
'extensions.installExtension'
'extensions.uninstallExtension'
'extensions.enableExtension'
'extensions.disableExtension'
```

## UI Components

Pre-built components from `@apache-superset/core` for consistent UI.

### Basic Components

```typescript
import {
  Button,
  Input,
  Select,
  Checkbox,
  Radio,
  Switch,
  Slider,
  DatePicker,
  TimePicker,
  Tooltip,
  Popover,
  Modal,
  Drawer,
  Alert,
  Message,
  Notification,
  Spin,
  Progress
} from '@apache-superset/core';
```

### Data Display

```typescript
import {
  Table,
  List,
  Card,
  Collapse,
  Tabs,
  Tag,
  Badge,
  Statistic,
  Timeline,
  Tree,
  Empty,
  Result
} from '@apache-superset/core';
```

### Form Components

```typescript
import {
  Form,
  FormItem,
  FormList,
  InputNumber,
  TextArea,
  Upload,
  Rate,
  Cascader,
  AutoComplete,
  Mentions
} from '@apache-superset/core';
```

## Authentication API

Access authentication and user information.

```typescript
// Get current user
authentication.getCurrentUser(): User | undefined

interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  isActive: boolean;
  isAnonymous: boolean;
}

// Get CSRF token for API requests
authentication.getCSRFToken(): Promise<string>

// Check permissions
authentication.hasPermission(
  permission: string,
  resource?: string
): boolean

// Get user preferences
authentication.getPreferences(): UserPreferences

// Update preferences
authentication.setPreference(
  key: string,
  value: any
): Promise<void>
```

## Storage API

Persist data across sessions.

### Global Storage

```typescript
// Shared across all workspaces
const globalState = context.globalState;

// Get value
const value = globalState.get<T>(key: string): T | undefined

// Set value
await globalState.update(key: string, value: any): Promise<void>

// Get all keys
globalState.keys(): readonly string[]
```

### Workspace Storage

```typescript
// Specific to current workspace
const workspaceState = context.workspaceState;

// Same API as globalState
workspaceState.get<T>(key: string): T | undefined
workspaceState.update(key: string, value: any): Promise<void>
workspaceState.keys(): readonly string[]
```

### Secrets Storage

```typescript
// Secure storage for sensitive data
secrets.store(key: string, value: string): Promise<void>
secrets.get(key: string): Promise<string | undefined>
secrets.delete(key: string): Promise<void>
```

## Events API

Subscribe to and emit custom events.

```typescript
// Create an event emitter
const onDidChange = new EventEmitter<ChangeEvent>();

// Expose as event
export const onChange = onDidChange.event;

// Fire event
onDidChange.fire({
  type: 'update',
  data: newData
});

// Subscribe to event
const disposable = onChange((event) => {
  console.log('Changed:', event);
});

// Cleanup
disposable.dispose();
```

## Window API

Interact with the UI window.

### Notifications

```typescript
// Show info message
window.showInformationMessage(
  message: string,
  ...items: string[]
): Promise<string | undefined>

// Show warning
window.showWarningMessage(
  message: string,
  ...items: string[]
): Promise<string | undefined>

// Show error
window.showErrorMessage(
  message: string,
  ...items: string[]
): Promise<string | undefined>

// Show with options
window.showInformationMessage(
  message: string,
  options: MessageOptions,
  ...items: MessageItem[]
): Promise<MessageItem | undefined>

interface MessageOptions {
  modal?: boolean;
  detail?: string;
}
```

### Input Dialogs

```typescript
// Show input box
window.showInputBox(
  options?: InputBoxOptions
): Promise<string | undefined>

interface InputBoxOptions {
  title?: string;
  prompt?: string;
  placeHolder?: string;
  value?: string;
  password?: boolean;
  validateInput?(value: string): string | null;
}

// Show quick pick
window.showQuickPick(
  items: string[] | QuickPickItem[],
  options?: QuickPickOptions
): Promise<string | QuickPickItem | undefined>

interface QuickPickOptions {
  title?: string;
  placeHolder?: string;
  canPickMany?: boolean;
  matchOnDescription?: boolean;
  matchOnDetail?: boolean;
}
```

### Progress

```typescript
// Show progress
window.withProgress<T>(
  options: ProgressOptions,
  task: (progress: Progress<{message?: string}>) => Promise<T>
): Promise<T>

interface ProgressOptions {
  location: ProgressLocation;
  title?: string;
  cancellable?: boolean;
}

// Example usage
await window.withProgress(
  {
    location: ProgressLocation.Notification,
    title: "Processing",
    cancellable: true
  },
  async (progress) => {
    progress.report({ message: 'Step 1...' });
    await step1();
    progress.report({ message: 'Step 2...' });
    await step2();
  }
);
```

## Workspace API

Access workspace information and configuration.

```typescript
// Get workspace folders
workspace.workspaceFolders: readonly WorkspaceFolder[]

// Get configuration
workspace.getConfiguration(
  section?: string
): WorkspaceConfiguration

// Update configuration
workspace.getConfiguration('myExtension')
  .update('setting', value, ConfigurationTarget.Workspace)

// Watch for configuration changes
workspace.onDidChangeConfiguration(
  listener: (e: ConfigurationChangeEvent) => void
): Disposable

// File system operations
workspace.fs.readFile(uri: Uri): Promise<Uint8Array>
workspace.fs.writeFile(uri: Uri, content: Uint8Array): Promise<void>
workspace.fs.delete(uri: Uri): Promise<void>
workspace.fs.rename(oldUri: Uri, newUri: Uri): Promise<void>
workspace.fs.copy(source: Uri, destination: Uri): Promise<void>
workspace.fs.createDirectory(uri: Uri): Promise<void>
workspace.fs.readDirectory(uri: Uri): Promise<[string, FileType][]>
workspace.fs.stat(uri: Uri): Promise<FileStat>
```

## HTTP Client API

Make HTTP requests from extensions.

```typescript
import { api } from '@apache-superset/core';

// GET request
const response = await api.get('/api/v1/chart/');

// POST request
const response = await api.post('/api/v1/chart/', {
  data: chartData
});

// PUT request
const response = await api.put('/api/v1/chart/123', {
  data: updatedData
});

// DELETE request
const response = await api.delete('/api/v1/chart/123');

// Custom headers
const response = await api.get('/api/v1/chart/', {
  headers: {
    'X-Custom-Header': 'value'
  }
});

// Query parameters
const response = await api.get('/api/v1/chart/', {
  params: {
    page: 1,
    page_size: 20
  }
});
```

## Theming API

Access and customize theme settings.

```typescript
// Get current theme
theme.getActiveTheme(): Theme

interface Theme {
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  typography: Typography;
  spacing: Spacing;
}

// Listen for theme changes
theme.onDidChangeTheme(
  listener: (theme: Theme) => void
): Disposable

// Get theme colors
const colors = theme.colors;
colors.primary
colors.success
colors.warning
colors.error
colors.info
colors.text
colors.background
colors.border
```

## Disposable Pattern

Manage resource cleanup consistently.

```typescript
interface Disposable {
  dispose(): void;
}

// Create a disposable
class MyDisposable implements Disposable {
  dispose() {
    // Cleanup logic
  }
}

// Combine disposables
const composite = Disposable.from(
  disposable1,
  disposable2,
  disposable3
);

// Dispose all at once
composite.dispose();

// Use in extension
export function activate(context: ExtensionContext) {
  // All disposables added here are cleaned up on deactivation
  context.subscriptions.push(
    registerCommand(...),
    registerView(...),
    onDidChange(...)
  );
}
```

## Type Definitions

Complete TypeScript definitions are available:

```typescript
import type {
  ExtensionContext,
  Disposable,
  Event,
  EventEmitter,
  Uri,
  Command,
  QuickPickItem,
  InputBoxOptions,
  Progress,
  CancellationToken
} from '@apache-superset/core';
```

## Version Compatibility

The API follows semantic versioning:

```typescript
// Check API version
const version = superset.version;

// Version components
version.major // Breaking changes
version.minor // New features
version.patch // Bug fixes

// Check minimum version
if (version.major < 1) {
  throw new Error('Requires Superset API v1.0.0 or higher');
}
```

## Migration Guide

### From v0.x to v1.0

```typescript
// Before (v0.x)
sqlLab.runQuery(query);

// After (v1.0)
sqlLab.executeQuery();

// Before (v0.x)
core.registerPanel(id, component);

// After (v1.0)
context.registerView(id, component);
```

## Best Practices

### Error Handling

```typescript
export async function activate(context: ExtensionContext) {
  try {
    await initializeExtension();
  } catch (error) {
    console.error('Failed to initialize:', error);
    window.showErrorMessage(
      `Extension failed to activate: ${error.message}`
    );
  }
}
```

### Resource Management

```typescript
// Always use disposables
const disposables: Disposable[] = [];

disposables.push(
  commands.registerCommand(...),
  sqlLab.onDidQueryRun(...),
  workspace.onDidChangeConfiguration(...)
);

// Cleanup in deactivate
export function deactivate() {
  disposables.forEach(d => d.dispose());
}
```

### Type Safety

```typescript
// Use type guards
function isDatabase(obj: any): obj is Database {
  return obj && typeof obj.id === 'number' && typeof obj.name === 'string';
}

// Use generics
function getValue<T>(key: string, defaultValue: T): T {
  return context.globalState.get(key) ?? defaultValue;
}
```
