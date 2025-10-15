---
title: Activation Events
sidebar_position: 4
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

# Activation Events

Activation events control when your extension is loaded and activated. Extensions should specify activation events to ensure they're only loaded when needed, improving Superset's startup performance.

## Overview

Extensions are activated lazily - they're loaded only when certain conditions are met. This is controlled by the `activationEvents` field in your `extension.json`:

```json
{
  "activationEvents": [
    "onCommand:myExtension.start",
    "onView:sqllab.panels",
    "onLanguage:sql"
  ]
}
```

## Activation Event Types

### onCommand

Activated when a specific command is invoked:

```json
"activationEvents": [
  "onCommand:myExtension.analyze",
  "onCommand:myExtension.export"
]
```

The extension activates when any of its commands are executed, either through:
- Command palette
- Menu items
- Keyboard shortcuts
- API calls

### onView

Activated when a specific view becomes visible:

```json
"activationEvents": [
  "onView:sqllab.panels",
  "onView:dashboard.widgets"
]
```

**Available Views**:
- `sqllab.panels` - SQL Lab side panels
- `sqllab.bottomPanels` - SQL Lab bottom panels

**TODO: Future Views**:
- `dashboard.widgets` - Dashboard widget areas
- `chart.toolbar` - Chart toolbar views
- `explore.panels` - Explore view panels

### onLanguage

Activated when a file of a specific language is opened:

```json
"activationEvents": [
  "onLanguage:sql",
  "onLanguage:python"
]
```

Useful for extensions that provide:
- Language-specific features
- Syntax highlighting
- Code completion
- Linting

### workspaceContains

Activated when the workspace contains files matching a pattern:

```json
"activationEvents": [
  "workspaceContains:**/*.sql",
  "workspaceContains:**/.supersetrc",
  "workspaceContains:**/superset_config.py"
]
```

Uses glob patterns to detect:
- Configuration files
- Project types
- Specific file structures

### onStartupFinished

Activated after Superset has fully started:

```json
"activationEvents": [
  "onStartupFinished"
]
```

Use for extensions that:
- Don't need immediate activation
- Provide background services
- Monitor system events

### Star Activation (*)

Always activate (not recommended):

```json
"activationEvents": ["*"]
```

⚠️ **Warning**: This impacts startup performance. Only use when absolutely necessary.

## Extension Lifecycle

### 1. Registration

When Superset starts or an extension is installed:

```typescript
// Extension is registered but not loaded
{
  id: 'myExtension',
  state: 'unloaded',
  activationEvents: ['onCommand:myExtension.start']
}
```

### 2. Activation Trigger

When an activation event occurs:

```typescript
// Event triggered
eventBus.emit('command:myExtension.start');

// Extension manager checks activation events
if (extension.activationEvents.includes('onCommand:myExtension.start')) {
  activateExtension(extensionId);
}
```

### 3. Loading

Extension assets are loaded:

```typescript
async function loadExtension(extensionId: string) {
  // Load frontend assets
  await loadRemoteEntry(extension.remoteEntry);

  // Load backend modules (if applicable)
  await loadBackendModules(extension.backendModules);

  return extension;
}
```

### 4. Activation

The `activate` function is called:

```typescript
export async function activate(context: ExtensionContext) {
  console.log('Extension activating');

  // Register contributions
  const view = context.registerView(...);
  const command = context.registerCommand(...);

  // Store disposables for cleanup
  context.subscriptions.push(view, command);

  // Perform initialization
  await initialize();

  console.log('Extension activated');
}
```

### 5. Active State

Extension is fully operational:

```typescript
{
  id: 'myExtension',
  state: 'activated',
  exports: { /* exposed APIs */ }
}
```

### 6. Deactivation

When extension is disabled or Superset shuts down:

```typescript
export async function deactivate() {
  console.log('Extension deactivating');

  // Cleanup resources
  await cleanup();

  // Subscriptions are automatically disposed
  console.log('Extension deactivated');
}
```

## Activation Strategies

### Lazy Activation (Recommended)

Activate only when needed:

```json
{
  "activationEvents": [
    "onCommand:myExtension.start",
    "onView:myExtension.panel"
  ]
}
```

Benefits:
- ✅ Fast startup
- ✅ Lower memory usage
- ✅ Better performance

### Eager Activation

Activate on startup for critical features:

```json
{
  "activationEvents": [
    "onStartupFinished"
  ]
}
```

Use cases:
- Authentication providers
- Security extensions
- Core infrastructure

### Conditional Activation

Activate based on workspace:

```json
{
  "activationEvents": [
    "workspaceContains:**/superset_config.py",
    "workspaceContains:**/*.sql"
  ]
}
```

Benefits:
- Context-aware activation
- Project-specific features
- Automatic detection

## Multiple Activation Events

Extensions can specify multiple events (OR logic):

```json
{
  "activationEvents": [
    "onCommand:myExtension.start",
    "onCommand:myExtension.configure",
    "onView:sqllab.panels",
    "onLanguage:sql",
    "workspaceContains:**/*.myext"
  ]
}
```

The extension activates when **any** event occurs.

## Performance Considerations

### Do's ✅

1. **Use specific activation events**
```json
"activationEvents": ["onCommand:myExtension.specific"]
```

2. **Defer heavy initialization**
```typescript
export async function activate(context) {
  // Quick registration
  context.registerCommand('myExtension.heavy', async () => {
    // Heavy work only when command is used
    await doHeavyWork();
  });
}
```

3. **Load resources on demand**
```typescript
let heavyModule;

export async function activate(context) {
  context.registerCommand('myExtension.feature', async () => {
    // Lazy load when needed
    heavyModule = heavyModule || await import('./heavy');
    heavyModule.execute();
  });
}
```

### Don'ts ❌

1. **Avoid star activation**
```json
// Bad - activates always
"activationEvents": ["*"]
```

2. **Don't block activation**
```typescript
// Bad - blocks activation
export async function activate(context) {
  await longRunningOperation(); // Blocks
}

// Good - defer work
export async function activate(context) {
  setImmediate(() => longRunningOperation());
}
```

3. **Avoid unnecessary events**
```json
// Bad - too many events
"activationEvents": [
  "onStartupFinished",
  "onCommand:*",
  "onView:*"
]
```

## Testing Activation Events

### Manual Testing

1. **Check activation timing**:
```typescript
export async function activate(context) {
  console.time('activation');
  // ... activation code
  console.timeEnd('activation');
}
```

2. **Verify event triggers**:
```typescript
// In browser console
superset.extensions.getExtension('myExtension').state
// Should be 'unloaded' before event

// Trigger event
superset.commands.executeCommand('myExtension.start');

// Check again
superset.extensions.getExtension('myExtension').state
// Should be 'activated' after event
```

### Automated Testing

```typescript
describe('Extension Activation', () => {
  it('should activate on command', async () => {
    const extension = await loadExtension('myExtension');

    expect(extension.state).toBe('unloaded');

    await commands.executeCommand('myExtension.start');

    expect(extension.state).toBe('activated');
  });

  it('should not activate on unrelated event', async () => {
    const extension = await loadExtension('myExtension');

    await commands.executeCommand('unrelated.command');

    expect(extension.state).toBe('unloaded');
  });
});
```

## Debugging Activation

### Enable Debug Logging

```typescript
// In extension
const DEBUG = true;

export async function activate(context) {
  if (DEBUG) {
    console.log('[MyExtension] Activating', {
      extensionId: context.extensionId,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Monitor Activation Events

```typescript
// In browser console
superset.events.on('extension:activating', (e) => {
  console.log('Extension activating:', e.extensionId);
});

superset.events.on('extension:activated', (e) => {
  console.log('Extension activated:', e.extensionId);
});
```

### Common Issues

**Extension not activating:**
- Check activation events are correct
- Verify event is being triggered
- Check browser console for errors
- Ensure extension is enabled

**Extension activating too early:**
- Review activation events
- Consider using more specific events
- Check for star activation

**Extension activating multiple times:**
- Check for duplicate event registrations
- Verify deactivation cleanup
- Review activation logic

## Best Practices

1. **Choose minimal activation events** - Only what's necessary
2. **Defer expensive operations** - Don't block activation
3. **Use specific events** - Avoid broad patterns
4. **Test activation timing** - Ensure good performance
5. **Document activation requirements** - Help users understand
6. **Handle activation failures** - Graceful error handling
7. **Clean up on deactivation** - Prevent memory leaks
8. **Log activation in debug mode** - Aid troubleshooting
9. **Consider user experience** - Balance performance and features
10. **Version activation events** - Plan for changes

## Future Activation Events

These activation events are planned for future releases:

- `onUri` - Custom URI schemes
- `onWebviewPanel` - Webview visibility
- `onFileSystem` - File system providers
- `onDebug` - Debug sessions
- `onTaskType` - Task providers
- `onNotebook` - Notebook documents
- `onAuthentication` - Auth providers
- `onCustomEditor` - Custom editors
- `onTerminalProfile` - Terminal profiles

## Migration Guide

### From Always Active to Lazy

Before (always active):
```json
{
  "activationEvents": ["*"]
}
```

After (lazy activation):
```json
{
  "activationEvents": [
    "onCommand:myExtension.command1",
    "onCommand:myExtension.command2",
    "onView:myExtension.view"
  ]
}
```

### Adding New Activation Events

When adding features:
```json
{
  "version": "1.0.0",
  "activationEvents": [
    "onCommand:myExtension.oldCommand"
  ]
}

// Version 1.1.0 - Added new feature
{
  "version": "1.1.0",
  "activationEvents": [
    "onCommand:myExtension.oldCommand",
    "onCommand:myExtension.newCommand",  // New
    "onView:myExtension.panel"            // New
  ]
}
```

## Related Documentation

- [Extension Manifest](/developer_portal/references/manifest)
- [Lifecycle Management](/developer_portal/extensions/lifecycle-management)
- [Contribution Points](/developer_portal/references/contribution-points)
- [Architecture Overview](/developer_portal/architecture/overview)
