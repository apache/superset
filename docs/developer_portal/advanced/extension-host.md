---
title: Extension Host Architecture
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

# Extension Host Architecture

Deep dive into how Superset acts as a host for extensions, managing their lifecycle, loading, and execution.

## Architecture Overview

Superset's extension host architecture is inspired by VS Code's successful extension model, providing a robust foundation for modular functionality.

### Core Components

```
┌─────────────────────────────────────────────┐
│           Superset Host Application         │
├─────────────────────────────────────────────┤
│  Extension Manager                          │
│  ├── Registration                          │
│  ├── Lifecycle Management                  │
│  └── API Implementation                    │
├─────────────────────────────────────────────┤
│  Module Federation (Frontend)               │
│  ├── Dynamic Loading                       │
│  ├── Dependency Sharing                   │
│  └── Runtime Integration                   │
├─────────────────────────────────────────────┤
│  Extension Storage                          │
│  ├── Metadata Database                     │
│  └── Asset Storage                        │
└─────────────────────────────────────────────┘
```

## Extension Loading Process

### 1. Registration Phase

When an extension is uploaded via the `/api/v1/extensions/import/` endpoint:

```python
# Extension registration flow
def register_extension(supx_file):
    # 1. Extract and validate bundle
    manifest = extract_manifest(supx_file)
    validate_extension(manifest)

    # 2. Store in metadata database
    extension = Extension(
        name=manifest['name'],
        version=manifest['version'],
        frontend_entry=manifest['frontend']['remoteEntry'],
        backend_modules=manifest['backend']['modules'],
        capabilities=manifest['contributions']
    )
    db.session.add(extension)

    # 3. Store assets
    store_frontend_assets(manifest['frontend']['files'])
    store_backend_modules(manifest['backend']['files'])

    # 4. Register capabilities
    register_views(manifest['contributions']['views'])
    register_commands(manifest['contributions']['commands'])

    return extension.id
```

### 2. Frontend Loading (Module Federation)

Extensions are loaded dynamically using Webpack Module Federation:

```typescript
// Dynamic extension loading
async function loadExtension(extensionId: string) {
  const manifest = await fetchManifest(extensionId);

  // Load remote entry script
  await loadRemoteEntry(manifest.remoteEntry);

  // Get the extension module
  const container = window[extensionId];
  await container.init(__webpack_share_scopes__.default);

  // Get the exposed module
  const factory = await container.get('./index');
  const Module = factory();

  // Activate the extension
  const context = createExtensionContext(extensionId);
  await Module.activate(context);

  return Module;
}
```

### 3. Backend Loading

Backend extensions are loaded during Superset startup:

```python
# Backend extension loading
def load_backend_extensions():
    extensions = db.session.query(Extension).filter_by(enabled=True).all()

    for ext in extensions:
        # Import extension modules
        for entry_point in ext.entry_points:
            module = import_module(entry_point)

            # Register API endpoints if present
            if hasattr(module, 'api'):
                rest_api.add_extension_api(module.api)

            # Execute initialization code
            if hasattr(module, 'initialize'):
                module.initialize()
```

## Lifecycle Management

### Extension States

```typescript
enum ExtensionState {
  INSTALLED = 'installed',
  ACTIVATING = 'activating',
  ACTIVATED = 'activated',
  DEACTIVATING = 'deactivating',
  DEACTIVATED = 'deactivated',
  FAILED = 'failed'
}
```

### Activation Lifecycle

```typescript
class ExtensionHost {
  async activateExtension(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);

    try {
      // Update state
      extension.state = ExtensionState.ACTIVATING;

      // Create activation context
      const context = this.createContext(extensionId);

      // Call activate function
      await extension.module.activate(context);

      // Store subscriptions for cleanup
      this.subscriptions.set(extensionId, context.subscriptions);

      // Update state
      extension.state = ExtensionState.ACTIVATED;

      // Emit activation event
      this.events.emit('extensionActivated', extensionId);

    } catch (error) {
      extension.state = ExtensionState.FAILED;
      this.handleActivationError(extensionId, error);
    }
  }

  async deactivateExtension(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);

    // Update state
    extension.state = ExtensionState.DEACTIVATING;

    // Call deactivate if provided
    if (extension.module.deactivate) {
      await extension.module.deactivate();
    }

    // Dispose all subscriptions
    const subscriptions = this.subscriptions.get(extensionId);
    subscriptions?.forEach(sub => sub.dispose());

    // Clear references
    this.subscriptions.delete(extensionId);

    // Update state
    extension.state = ExtensionState.DEACTIVATED;
  }
}
```

## API Bridge

The host provides API implementations that extensions consume:

```typescript
// Host-side API setup
function setupExtensionsAPI() {
  window.superset = {
    // Core APIs
    core: {
      registerView: (id, component) => viewRegistry.register(id, component),
      registerCommand: (id, handler) => commandRegistry.register(id, handler),
    },

    // SQL Lab APIs
    sqlLab: {
      getCurrentQuery: () => store.getState().sqlLab.currentQuery,
      onDidQueryRun: (listener) => eventBus.on('query:run', listener),
      // ... more APIs
    },

    // Authentication
    authentication: {
      getCurrentUser: () => store.getState().user.current,
      getCSRFToken: () => csrf.getToken(),
    },
  };
}
```

## Security Boundaries

### Frontend Security

```typescript
// Extension sandbox (future implementation)
class ExtensionSandbox {
  constructor(private extensionId: string) {}

  createContext(): SandboxedContext {
    return {
      // Limited API surface
      api: this.createSandboxedAPI(),

      // Restricted DOM access
      document: this.createSandboxedDOM(),

      // Controlled fetch
      fetch: this.createSandboxedFetch(),
    };
  }

  private createSandboxedAPI() {
    // TODO: Implement API restrictions
    // Only expose allowed APIs
    // Add permission checks
    // Log API usage
  }
}
```

### Backend Security

```python
# Extension API security
class ExtensionSecurityManager:
    def check_permission(self, extension_id, resource, action):
        """Verify extension has permission for action"""
        extension = get_extension(extension_id)

        # Check declared permissions
        if not self.has_declared_permission(extension, resource, action):
            raise PermissionError(f"Extension {extension_id} lacks {action} permission for {resource}")

        # Apply RBAC
        if not security_manager.can_access(resource, action):
            raise PermissionError(f"User lacks permission for {action} on {resource}")

        return True
```

## Performance Optimization

### Lazy Loading

Extensions are loaded only when needed:

```typescript
// Lazy loading strategy
class LazyExtensionLoader {
  private loadPromises = new Map<string, Promise<Extension>>();

  async getExtension(id: string): Promise<Extension> {
    // Return cached promise if loading
    if (this.loadPromises.has(id)) {
      return this.loadPromises.get(id);
    }

    // Start loading
    const loadPromise = this.loadExtension(id);
    this.loadPromises.set(id, loadPromise);

    // Load and cache
    const extension = await loadPromise;
    this.cache.set(id, extension);
    this.loadPromises.delete(id);

    return extension;
  }
}
```

### Resource Management

```typescript
// Resource limits for extensions
interface ExtensionResources {
  maxMemory: number;      // MB
  maxCPUTime: number;     // ms per second
  maxNetworkRequests: number;
  maxStorageSize: number; // MB
}

// TODO: Implement resource monitoring and enforcement
```

## Storage Architecture

### Extension Metadata Storage

```sql
-- Extension registry table
CREATE TABLE extensions (
  id UUID PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  version VARCHAR(50) NOT NULL,
  author VARCHAR(255),
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  frontend_assets JSONB,  -- Remote entry URLs
  backend_modules JSONB,  -- Python module paths
  capabilities JSONB,     -- Declared capabilities
  configuration JSONB,    -- User configuration
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Extension activation log
CREATE TABLE extension_activations (
  id UUID PRIMARY KEY,
  extension_id UUID REFERENCES extensions(id),
  activated_at TIMESTAMP,
  deactivated_at TIMESTAMP,
  activation_error TEXT
);
```

## Communication Patterns

### Inter-Extension Communication

```typescript
// TODO: Implement inter-extension messaging
interface ExtensionMessage {
  source: string;      // Source extension ID
  target: string;      // Target extension ID
  type: string;        // Message type
  payload: any;        // Message data
}

class ExtensionMessaging {
  send(message: ExtensionMessage): Promise<any> {
    // Verify permissions
    // Route message
    // Handle response
  }

  onMessage(listener: (message: ExtensionMessage) => any) {
    // Register message handler
  }
}
```

### Host-Extension Events

```typescript
// Bidirectional event system
class ExtensionEventBus {
  // Host to extension
  emitToExtension(extensionId: string, event: string, data: any) {
    const extension = this.getExtension(extensionId);
    extension?.handleEvent(event, data);
  }

  // Extension to host
  handleExtensionEvent(extensionId: string, event: string, data: any) {
    // Validate event
    // Apply security checks
    // Route to appropriate handler
  }
}
```

## Future Enhancements

### Planned Features

1. **JavaScript Sandboxing**: Isolate extension code execution
2. **Resource Quotas**: Enforce memory and CPU limits
3. **Hot Reload**: Update extensions without restart
4. **Extension Dependencies**: Inter-extension dependencies
5. **Remote Extensions**: Load from external URLs

### TODO Items

- [ ] Implement WebWorker-based sandboxing for frontend extensions
- [ ] Add resource monitoring and enforcement
- [ ] Create extension profiling tools
- [ ] Implement extension marketplace integration
- [ ] Add support for extension auto-updates
- [ ] Create extension debugging tools
- [ ] Implement extension telemetry and analytics

## Best Practices

### For Extension Authors

1. **Minimize startup time**: Defer heavy operations
2. **Clean up properly**: Dispose all resources on deactivation
3. **Handle errors gracefully**: Don't crash the host
4. **Use versioned APIs**: Ensure compatibility
5. **Respect resource limits**: Be a good citizen

### For Host Maintainers

1. **Maintain API stability**: Follow semver strictly
2. **Provide clear documentation**: Keep APIs well-documented
3. **Monitor extension health**: Track failures and performance
4. **Implement gradual rollout**: Test extensions safely
5. **Maintain security boundaries**: Isolate extension code

## Related Documentation

- [Extension Architecture Overview](/developer_portal/architecture/overview)
- [API Reference](/developer_portal/api/frontend)
- [Security Model](/developer_portal/advanced/security)
