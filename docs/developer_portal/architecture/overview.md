---
title: Extension Architecture
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

# Superset Extension Architecture

Apache Superset's extension architecture enables developers to enhance and customize the platform without modifying the core codebase. Inspired by the successful VS Code Extensions model, this architecture provides well-defined, versioned APIs and clear contribution points that allow the community to build upon and extend Superset's functionality.

## Core Concepts

### Extensions vs Plugins

We use the term "extensions" rather than "plugins" to better convey the idea of enhancing and expanding Superset's core capabilities in a modular and integrated way. Extensions can add new features, modify existing behavior, and integrate deeply with the host application through well-defined APIs.

### Lean Core Philosophy

Superset's core remains minimal, with many features delegated to extensions. Built-in features are implemented using the same APIs available to external extension authors, ensuring consistency and validating the extension architecture through real-world usage.

## Architecture Overview

The extension architecture consists of several key components:

### Core Packages

#### @apache-superset/core (Frontend)
Provides essential building blocks for extensions:
- Shared UI components
- Utility functions
- Type definitions
- Frontend APIs for interacting with the host

#### apache-superset-core (Backend)
Exposes backend functionality:
- Database access APIs
- Security models
- REST API extensions
- SQLAlchemy models and utilities

### Extension CLI

The `apache-superset-extensions-cli` package provides commands for:
- Scaffolding new extension projects
- Building and bundling extensions
- Development workflows with hot-reload
- Packaging extensions for distribution

### Host Application

Superset acts as the host, providing:
- Extension registration and management
- Dynamic loading of extension assets
- API implementation for extensions
- Lifecycle management (activation/deactivation)

## Extension Points

Extensions can contribute to various parts of Superset:

### SQL Lab Extensions
- Custom panels (left, right, bottom)
- Editor enhancements
- Query processors
- Autocomplete providers
- Execution plan visualizers

### Dashboard Extensions (Future)
- Custom widget types
- Filter components
- Interaction handlers

### Chart Extensions (Future)
- New visualization types
- Data transformers
- Export formats

## Technical Foundation

### Module Federation

Frontend extensions leverage Webpack Module Federation for dynamic loading:
- Extensions are built independently
- Dependencies are shared with the host
- No rebuild of Superset required
- Runtime loading of extension assets

### API Versioning

All public APIs follow semantic versioning:
- Breaking changes require major version bumps
- Extensions declare compatibility requirements
- Backward compatibility maintained within major versions

### Security Model

- Extensions disabled by default (require `ENABLE_EXTENSIONS` flag)
- Built-in extensions follow same security standards as core
- External extensions run in same context as host (sandboxing planned)
- Administrators responsible for vetting third-party extensions

## Development Workflow

1. **Initialize**: Use CLI to scaffold new extension
2. **Develop**: Work with hot-reload in development mode
3. **Build**: Bundle frontend and backend assets
4. **Package**: Create `.supx` distribution file
5. **Deploy**: Upload through API or management UI

## Example: Dataset References Extension

A practical example demonstrating the architecture:

```typescript
// Frontend activation
export function activate(context) {
  // Register a new SQL Lab panel
  const panel = core.registerView('dataset_references.main',
    <DatasetReferencesPanel />
  );

  // Listen to query changes
  const listener = sqlLab.onDidQueryRun(editor => {
    // Analyze query and update panel
  });

  // Cleanup on deactivation
  context.subscriptions.push(panel, listener);
}
```

```python
# Backend API extension
from superset_core.api import rest_api
from .api import DatasetReferencesAPI

# Register custom REST endpoints
rest_api.add_extension_api(DatasetReferencesAPI)
```

## Best Practices

### Extension Design
- Keep extensions focused on specific functionality
- Use versioned APIs for stability
- Handle cleanup properly on deactivation
- Follow Superset's coding standards

### Performance
- Lazy load assets when possible
- Minimize bundle sizes
- Share dependencies with host
- Cache expensive operations

### Compatibility
- Declare API version requirements
- Test across Superset versions
- Provide migration guides for breaking changes
- Document compatibility clearly

## Future Roadmap

Planned enhancements include:
- JavaScript sandboxing for untrusted extensions
- Extension marketplace and registry
- Inter-extension communication
- Advanced theming capabilities
- Backend hot-reload without restart

## Getting Started

Ready to build your first extension? Check out:
- [Extension Project Structure](/developer_portal/extensions/extension-project-structure)
- [API Reference](/developer_portal/api/frontend)
- [CLI Documentation](/developer_portal/cli/overview)
- [Frontend Contribution Types](/developer_portal/extensions/frontend-contribution-types)
