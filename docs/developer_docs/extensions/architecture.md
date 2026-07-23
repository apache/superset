---
title: Architecture
sidebar_position: 3
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

# Architecture

Apache Superset's extension system is designed to enable powerful customization while maintaining stability, security, and performance. This page explains the architectural principles, system design, and technical mechanisms that make the extension ecosystem possible.

## Architectural Principles

The extension architecture is built on six core principles that guide all technical decisions and ensure extensions can be developed safely and predictably:

### 1. Lean Core

Superset's core should remain minimal, with many features delegated to extensions. Built-in features use the same APIs and extension mechanisms available to external developers. This approach:

- Reduces maintenance burden and complexity
- Encourages modularity
- Allows the community to innovate independently of the main codebase

### 2. Explicit Contribution Points

All extension points are clearly defined and documented. Extension authors know exactly where and how they can interact with the host system. Both backend and frontend contributions are registered directly in code — backend contributions via classes decorated with `@api` (and other decorators) imported from the auto-discovered entrypoint, frontend contributions via calls like `views.registerView` and `commands.registerCommand` executed at module load time in `index.tsx`. This gives the host clear visibility into what each extension provides:

- Manage the extension lifecycle
- Provide a consistent user experience
- Validate extension compatibility

### 3. Versioned and Stable APIs

Public interfaces for extensions follow semantic versioning, allowing for:

- Safe evolution of the platform
- Backward compatibility
- Clear upgrade paths for extension authors

### 4. Lazy Loading and Activation

Extensions are loaded and activated only when needed, which:

- Minimizes performance overhead
- Reduces resource consumption
- Improves startup time

### 5. Composability and Reuse

The architecture encourages reusing extension points and patterns across different modules, promoting:

- Consistency across extensions
- Reduced duplication
- Shared best practices

### 6. Community-Driven Evolution

The system evolves based on real-world feedback and contributions. New extension points and capabilities are added as needs emerge, ensuring the platform remains relevant and flexible.

## System Overview

The extension architecture is built around three main components that work together to create a flexible, maintainable ecosystem:

### Core Packages

Two core packages provide the foundation for extension development:

**Frontend: `@apache-superset/core`**

This package provides essential building blocks for frontend extensions and the host application:

- Shared UI components
- Utility functions
- APIs and hooks
- Type definitions

By centralizing these resources, both extensions and built-in features use the same APIs, ensuring consistency, type safety, and a seamless user experience. The package is versioned to support safe platform evolution while maintaining compatibility.

**Backend: `apache-superset-core`**

This package exposes key classes and APIs for backend extensions:

- Database connectors
- API extensions
- Security manager customization
- Core utilities and models

It includes dependencies on critical libraries like Flask-AppBuilder and SQLAlchemy, and follows semantic versioning for compatibility and stability.

### Developer Tools

**`apache-superset-extensions-cli`**

The CLI provides comprehensive commands for extension development:

- Project scaffolding
- Code generation
- Building and bundling
- Packaging for distribution

By standardizing these processes, the CLI ensures extensions are built consistently, remain compatible with evolving versions of Superset, and follow best practices.

### Host Application

The Superset host application serves as the runtime environment for extensions:

**Extension Management**

- Exposes `/api/v1/extensions` endpoint for registration and management
- Provides a dedicated UI for managing extensions
- Stores extension metadata in the `extensions` database table

**Extension Storage**

The extensions table contains:

- Extension name, version, and author
- Metadata and configuration
- Built frontend and/or backend code

### Architecture Diagram

The following diagram illustrates how these components work together:

<img width="955" height="586" alt="Extension System Architecture" src="https://github.com/user-attachments/assets/cc2a41df-55a4-48c8-b056-35f7a1e567c6" />

The diagram shows:

1. **Extension projects** depend on core packages for development
2. **Core packages** provide APIs and type definitions
3. **The host application** implements the APIs and manages extensions
4. **Extensions** integrate seamlessly with the host through well-defined interfaces

## Dynamic Module Loading

One of the most sophisticated aspects of the extension architecture is how frontend code is dynamically loaded at runtime using Webpack's Module Federation.

### Module Federation

The architecture leverages Webpack's Module Federation to enable dynamic loading of frontend assets. This allows extensions to be built independently from Superset.

### How It Works

**Extension Configuration**

Extensions configure Webpack to expose their entry points:

```javascript
plugins: [
  new ModuleFederationPlugin({
    name: 'my_extension',
    filename: 'remoteEntry.[contenthash].js',
    exposes: {
      './index': './src/index.tsx',
    },
    shared: {
      react: { singleton: true, import: false },
      'react-dom': { singleton: true, import: false },
      antd: { singleton: true, import: false },
      '@apache-superset/core': { singleton: true, import: false },
    },
  }),
]
```

This configuration does several important things:

**`exposes`** - Declares which modules are available to the host application. Superset always loads extensions by requesting the `./index` module from the remote container — this is a fixed convention, not a configurable value. Extensions must expose exactly `'./index': './src/index.tsx'` and place all API registrations (views, commands, menus, editors, event listeners) in that file. The module is executed as a side effect when the extension loads, so any call to `views.registerView`, `commands.registerCommand`, etc. made at the top level of `index.tsx` will run automatically.

**`shared`** - Prevents duplication of common libraries like React and Ant Design, and, for `@apache-superset/core`, is the mechanism that gives each extension an isolated context (see below). The `singleton: true` setting ensures only one *logical* instance of each library exists — for `react`/`react-dom`/`antd` that means the host's actual instance is reused; for `@apache-superset/core` it means the extension's container defers to whatever module the host's loader supplies for it at init time, which is not the same object for every extension (see [Runtime Resolution](#runtime-resolution)).

### Runtime Resolution

The following diagram illustrates the module loading process:

<img width="913" height="558" alt="Module Federation Flow" src="https://github.com/user-attachments/assets/e5e4d2ae-e8b5-4d17-a2a1-3667c65f25ca" />

Here's what happens at runtime:

1. **Extension Registration**: When an extension is registered, Superset stores its remote entry URL
2. **Dynamic Loading**: When the extension is activated, the host fetches the remote entry file, then initializes Module Federation sharing (`__webpack_init_sharing__`) and looks up the extension's container on `window`
3. **Per-Extension Scope Injection**: Before calling `container.init()`, the loader builds a **per-container copy** of the webpack share scope in which the `@apache-superset/core` entry is replaced with a synthetic module — a copy of the host's own `window.superset` implementations with `extensions.getContext` bound to that one extension's isolated context object. Because Module Federation caches the resolved module per container, every import of `@apache-superset/core` inside that extension resolves to this pre-bound copy for the lifetime of the container, and because each container gets its own independent scope object, extensions loading in parallel cannot see each other's context.
4. **Execution**: The extension code runs with access to the host's APIs (via its per-extension `@apache-superset/core` instance) and shared dependencies (`react`, `react-dom`, `antd`)

### Host API Setup

On the Superset side, the real implementations backing `@apache-superset/core` (`commands`, `views`, `menus`, `extensions`, etc.) are assigned onto `window.superset` during application bootstrap, once the current user is known:

```typescript
// eslint-disable-next-line no-restricted-syntax
import * as supersetCore from '@apache-superset/core';
import { commands, views, menus, extensions /* ... */ } from 'src/core';

window.superset = {
  ...supersetCore,
  commands,
  views,
  menus,
  extensions,
  // ...
};
```

This runs before any extensions are loaded. `window.superset` is not itself what an extension's `@apache-superset/core` import resolves to — it is the source object the loader reads from when building each extension's per-container scoped instance (see [Runtime Resolution](#runtime-resolution)), so every extension ends up sharing the same underlying `commands`/`views`/`menus` singletons but with its own `extensions.getContext()`.

### Benefits

This architecture provides several key benefits:

- **Independent development**: Extensions can be built separately from Superset's codebase
- **Version isolation**: Each extension can be developed with its own release cycle
- **Shared dependencies**: Common libraries are shared, reducing memory usage and bundle size
- **Type safety**: TypeScript types flow from the core package to extensions

## Next Steps

Now that you understand the architecture, explore:

- **[Dependencies](./dependencies.md)** - Managing dependencies and understanding API stability
- **[Quick Start](./quick-start.md)** - Build your first extension
- **[Contribution Types](./contribution-types.md)** - What kinds of extensions you can build
- **[Development](./development.md)** - Project structure, APIs, and development workflow
