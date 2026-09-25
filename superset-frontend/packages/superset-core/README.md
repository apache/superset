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

# @apache-superset/core

[![npm version](https://badge.fury.io/js/%40apache-superset%2Fcore.svg)](https://badge.fury.io/js/%40apache-superset%2Fcore)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The official core package for building Apache Superset extensions and integrations. This package provides essential building blocks including shared UI components, utility functions, APIs, and type definitions for both the host application and extensions.

## 📦 Installation

```bash
npm install @apache-superset/core
```

## 🏗️ Package Structure

The source is organized into focused namespaces, each in its own directory:

```
src/
├── authentication/
├── commands/
├── common/
├── components/
├── contributions/
├── editors/
├── extensions/
├── menus/
├── sqlLab/
├── storage/
├── theme/
├── translation/
├── utils/
├── views/
└── index.ts
```

## 🚀 Quick Start

Frontend contributions are registered as module-level side effects from your extension's entry point.

### Views

Add custom panels or UI components at specific locations in the application:

```tsx
import { views } from '@apache-superset/core';
import MyPanel from './MyPanel';

views.registerView(
  { id: 'my-extension.main', name: 'My Panel Name' },
  'sqllab.panels',
  () => <MyPanel />,
);
```

### Commands

Define named actions that can be triggered from menus, keyboard shortcuts, or code:

```typescript
import { commands } from '@apache-superset/core';

commands.registerCommand(
  {
    id: 'my-extension.copy-query',
    title: 'Copy Query',
    icon: 'CopyOutlined',
    description: 'Copy the current query to clipboard',
  },
  () => {
    /* implementation */
  },
);
```

### Menus

Attach commands to primary, secondary, or context menus at a given location:

```typescript
import { menus } from '@apache-superset/core';

menus.registerMenuItem(
  { view: 'sqllab.editor', command: 'my-extension.copy-query' },
  'sqllab.editor',
  'primary',
);
```

### Editors

Replace the default text editor for one or more languages:

```typescript
import { editors } from '@apache-superset/core';
import MonacoSQLEditor from './MonacoSQLEditor';

editors.registerEditor(
  {
    id: 'my-extension.monaco-sql',
    name: 'Monaco SQL Editor',
    languages: ['sql'],
  },
  MonacoSQLEditor,
);
```

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](https://github.com/apache/superset/blob/master/LICENSE.txt) for details.

## 🔗 Links

- [Community](https://superset.apache.org/community/)
- [GitHub Repository](https://github.com/apache/superset)
- [Extensions Documentation](https://superset.apache.org/developer-docs/extensions/overview)
