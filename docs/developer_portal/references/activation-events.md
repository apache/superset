---
title: Activation Events
sidebar_position: 4
---

# Activation Events

=§ **Coming Soon** =§

Reference documentation for plugin activation events and lifecycle triggers that control when plugins are loaded and activated.

## Topics to be covered:

- Plugin activation event types and triggers
- Lifecycle event handling and hooks
- Conditional activation strategies
- Performance optimization with lazy loading
- Event-driven plugin architecture
- User interaction-based activation
- Context-aware plugin loading
- Custom activation conditions
- Activation event debugging
- Best practices for activation timing

## Event Types

### Core Activation Events

#### Application Lifecycle
```json
{
  "activationEvents": [
    "onStartupFinished",
    "onWorkspaceOpened",
    "onConfigurationChanged",
    "onThemeChanged"
  ]
}
```

- **onStartupFinished** - Triggered when Superset completes initialization
- **onWorkspaceOpened** - Activated when a workspace or dashboard is opened
- **onConfigurationChanged** - Responds to configuration updates
- **onThemeChanged** - Activated when the theme is switched

#### User Interaction Events
```json
{
  "activationEvents": [
    "onCommand:my-plugin.activate",
    "onView:dashboard",
    "onLanguage:sql",
    "onScheme:my-custom-scheme"
  ]
}
```

- **onCommand** - Triggered by specific command execution
- **onView** - Activated when specific views are opened
- **onLanguage** - Language-specific activation (SQL, Python, etc.)
- **onScheme** - Custom URI scheme handling

### Data and Context Events

#### Data Source Events
```json
{
  "activationEvents": [
    "onDatabase:postgresql",
    "onDataset:sales_data",
    "onQuery:running",
    "onChart:bar_chart"
  ]
}
```

- **onDatabase** - Database type-specific activation
- **onDataset** - Dataset-specific functionality
- **onQuery** - Query execution state changes
- **onChart** - Chart type-specific features

### Custom Events

#### Plugin-Defined Events
```typescript
// Register custom activation event
const customEvent = vscode.workspace.onDidChangeConfiguration(
  (event) => {
    if (event.affectsConfiguration('myPlugin.setting')) {
      // Trigger plugin activation
      activatePlugin();
    }
  }
);
```

## Best Practices

### Performance Optimization
- Use lazy activation to reduce startup time
- Minimize resource usage during activation
- Implement proper cleanup on deactivation
- Cache activation state when appropriate

### User Experience
- Provide clear activation feedback
- Handle activation failures gracefully
- Support manual activation when needed
- Respect user preferences for plugin behavior

---

*This documentation is under active development. Check back soon for updates!*
