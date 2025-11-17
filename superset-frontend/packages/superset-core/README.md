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

## 🏗️ Architecture

The package is organized into logical namespaces, each providing specific functionality:

- **`authentication`** - User authentication and authorization APIs
- **`commands`** - Command registration and execution system
- **`contributions`** - UI contribution points and customization APIs
- **`core`** - Fundamental types, utilities, and lifecycle management
- **`environment`** - Environment detection and configuration APIs
- **`extensions`** - Extension management and metadata APIs
- **`sqlLab`** - SQL Lab integration and event handling

## 🚀 Quick Start

### Basic Extension Structure

```typescript
import {
  core,
  commands,
  sqlLab,
  authentication,
} from '@apache-superset/core';

export function activate(context: core.ExtensionContext) {
  // Register a command to save current query
  const commandDisposable = commands.registerCommand(
    'my_extension.save_query',
    async () => {
      const currentTab = sqlLab.getCurrentTab();
      if (currentTab?.editor.content) {
        const token = await authentication.getCSRFToken();
        // Use token for secure API calls
        console.log('Saving query with CSRF token:', token);
      }
    },
  );

  // Listen for query execution events
  const eventDisposable = sqlLab.onDidQueryRun(editor => {
    console.log('Query executed:', editor.content.substring(0, 50) + '...');
  });

  // Register a simple view
  const viewDisposable = core.registerViewProvider(
    'my_extension.panel',
    () => (
      <div>
        <h3>My Extension</h3>
        <button onClick={() => commands.executeCommand('my_extension.save_query')}>
          Save Query
        </button>
      </div>
    )
  );

  // Cleanup registration
  context.subscriptions.push(commandDisposable, eventDisposable, viewDisposable);
}

export function deactivate() {
  // Cleanup handled automatically via disposables
}
```

## 🤝 Contributing

We welcome contributions! Please see the [Contributing Guide](https://github.com/apache/superset/blob/master/CONTRIBUTING.md) for details.

## 📄 License

Licensed under the Apache License, Version 2.0. See [LICENSE](https://github.com/apache/superset/blob/master/LICENSE.txt) for details.

## 🔗 Links

- [Apache Superset](https://superset.apache.org/)
- [Documentation](https://superset.apache.org/docs/)
- [Community](https://superset.apache.org/community/)
- [GitHub Repository](https://github.com/apache/superset)
- [Extension Development Guide](https://superset.apache.org/docs/extensions/)

---

**Note**: This package is currently in release candidate status. APIs may change before the 1.0.0 release. Please check the [changelog](CHANGELOG.md) for breaking changes between versions.
