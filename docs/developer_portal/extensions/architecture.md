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

All extension points are clearly defined and documented. Extension authors know exactly where and how they can interact with the host system. Each extension declares its capabilities in a metadata file, enabling the host to:
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
- Contributed features and exposed modules
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

``` typescript
new ModuleFederationPlugin({
  name: 'my_extension',
  filename: 'remoteEntry.[contenthash].js',
  exposes: {
    './index': './src/index.tsx',
  },
  externalsType: 'window',
  externals: {
    '@apache-superset/core': 'superset',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    'antd-v5': { singleton: true }
  }
})
```

This configuration does several important things:

**`exposes`** - Declares which modules are available to the host application. The extension makes `./index` available as its entry point.

**`externals` and `externalsType`** - Tell Webpack that when the extension imports `@apache-superset/core`, it should use `window.superset` at runtime instead of bundling its own copy. This ensures extensions use the host's implementation of shared packages.

**`shared`** - Prevents duplication of common libraries like React and Ant Design. The `singleton: true` setting ensures only one instance of each library exists, avoiding version conflicts and reducing bundle size.

### Runtime Resolution

The following diagram illustrates the module loading process:

<img width="913" height="558" alt="Module Federation Flow" src="https://github.com/user-attachments/assets/e5e4d2ae-e8b5-4d17-a2a1-3667c65f25ca" />

Here's what happens at runtime:

1. **Extension Registration**: When an extension is registered, Superset stores its remote entry URL
2. **Dynamic Loading**: When the extension is activated, the host fetches the remote entry file
3. **Module Resolution**: The extension imports `@apache-superset/core`, which resolves to `window.superset`
4. **Execution**: The extension code runs with access to the host's APIs and shared dependencies

### Host API Setup

On the Superset side, the APIs are mapped to `window.superset` during application bootstrap:

``` typescript
import * as supersetCore from '@apache-superset/core';
import {
  authentication,
  core,
  commands,
  extensions,
  sqlLab,
} from 'src/extensions';

export default function setupExtensionsAPI() {
  window.superset = {
    ...supersetCore,
    authentication,
    core,
    commands,
    extensions,
    sqlLab,
  };
}
```

This function runs before any extensions are loaded, ensuring the APIs are available when extensions import from `@apache-superset/core`.

### Benefits

This architecture provides several key benefits:

- **Independent development**: Extensions can be built separately from Superset's codebase
- **Version isolation**: Each extension can be developed with its own release cycle
- **Shared dependencies**: Common libraries are shared, reducing memory usage and bundle size
- **Type safety**: TypeScript types flow from the core package to extensions

## Next Steps

Now that you understand the architecture, explore:

- **[Dependencies](./dependencies)** - Managing dependencies and understanding API stability
- **[Quick Start](./quick-start)** - Build your first extension
- **[Contribution Types](./contribution-types)** - What kinds of extensions you can build
- **[Development](./development)** - Project structure, APIs, and development workflow
