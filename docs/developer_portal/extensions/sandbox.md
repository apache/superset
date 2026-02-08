---
title: Extension Sandboxing
sidebar_position: 10
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

# Extension Sandboxing

Superset provides a tiered sandbox architecture for running extensions with varying levels of trust and isolation. This system balances security with functionality, allowing extensions to be safely executed based on their trust level and requirements.

## Overview

The sandbox system supports three tiers of trust:

| Tier | Trust Level | Isolation | Use Case |
|------|-------------|-----------|----------|
| **Tier 1** | `core` | None (main context) | Official/signed extensions |
| **Tier 2** | `iframe` | Browser sandbox | Community UI extensions |
| **Tier 3** | `wasm` | WASM sandbox | Logic-only extensions |

## Trust Levels

### Tier 1: Core (Trusted)

Core extensions run in the main JavaScript context with full access to Superset APIs, DOM, and browser capabilities. This is the same behavior as legacy extensions.

**Requirements:**
- Must be in the trusted extensions list, OR
- `allowUnsignedCore` configuration must be enabled

**Use cases:**
- Official Apache Superset extensions
- Enterprise-verified plugins
- Extensions from trusted sources

```json
{
  "id": "official-extension",
  "sandbox": {
    "trustLevel": "core",
    "requiresSignature": true
  }
}
```

### Tier 2: Iframe (Semi-Trusted)

Iframe-sandboxed extensions run in isolated browser sandboxes with controlled API access via postMessage. This provides strong browser-enforced isolation while still allowing full UI rendering.

**Security features:**
- Browser-enforced same-origin isolation
- Content Security Policy (CSP) restrictions
- Permission-based API access
- No access to parent window's cookies, localStorage, or DOM

**Use cases:**
- Community-contributed extensions
- Third-party plugins
- Extensions that render custom UI

```json
{
  "id": "community-extension",
  "sandbox": {
    "trustLevel": "iframe",
    "permissions": ["sqllab:read", "notification:show"],
    "csp": {
      "connectSrc": ["https://api.example.com"]
    }
  }
}
```

### Tier 3: WASM (Untrusted)

WASM-sandboxed extensions run in a QuickJS WebAssembly sandbox with no DOM access. Only explicitly injected APIs are available. This provides the highest level of isolation.

**Security features:**
- Complete isolation from browser APIs
- Memory limits to prevent DoS
- Execution time limits
- No network or DOM access

**Use cases:**
- Custom data transformations
- Calculated fields and formatters
- Data validation rules
- Custom aggregation functions

```json
{
  "id": "formatter-extension",
  "sandbox": {
    "trustLevel": "wasm",
    "resourceLimits": {
      "maxMemory": 10485760,
      "maxExecutionTime": 5000
    }
  }
}
```

## Permissions

Sandboxed extensions (Tier 2 and 3) must declare the permissions they need. Permissions follow a least-privilege model.

### Available Permissions

| Permission | Description |
|------------|-------------|
| `api:read` | Read-only access to Superset APIs |
| `api:write` | Write access to Superset APIs |
| `sqllab:read` | Read SQL Lab state (queries, results) |
| `sqllab:execute` | Execute SQL queries |
| `dashboard:read` | Read dashboard data |
| `dashboard:write` | Modify dashboards |
| `chart:read` | Read chart data |
| `chart:write` | Modify charts |
| `user:read` | Read current user info |
| `notification:show` | Show notifications to user |
| `modal:open` | Open modal dialogs |
| `navigation:redirect` | Navigate to other pages |
| `clipboard:write` | Write to clipboard |
| `download:file` | Trigger file downloads |

### Example Permission Declaration

```json
{
  "sandbox": {
    "trustLevel": "iframe",
    "permissions": [
      "sqllab:read",
      "notification:show",
      "download:file"
    ]
  }
}
```

## Sandboxed Extension API

Extensions running in iframe sandboxes have access to a controlled API through the `window.superset` object.

### SQL Lab API

```typescript
// Get the current SQL Lab tab (requires sqllab:read)
const tab = await window.superset.sqlLab.getCurrentTab();

// Get query results (requires sqllab:read)
const results = await window.superset.sqlLab.getQueryResults(queryId);
```

### Dashboard API

```typescript
// Get dashboard context (requires dashboard:read)
const context = await window.superset.dashboard.getContext();

// Get dashboard filters (requires dashboard:read)
const filters = await window.superset.dashboard.getFilters();
```

### Chart API

```typescript
// Get chart data (requires chart:read)
const chartData = await window.superset.chart.getData(chartId);
```

### User API

```typescript
// Get current user (requires user:read)
const user = await window.superset.user.getCurrentUser();
```

### UI API

```typescript
// Show notification (requires notification:show)
window.superset.ui.showNotification('Success!', 'success');

// Open modal (requires modal:open)
const result = await window.superset.ui.openModal({
  title: 'Confirm',
  content: 'Are you sure?',
  type: 'confirm'
});

// Navigate (requires navigation:redirect)
window.superset.ui.navigateTo('/dashboard/1');
```

### Utility API

```typescript
// Copy to clipboard (requires clipboard:write)
await window.superset.utils.copyToClipboard('text');

// Download file (requires download:file)
window.superset.utils.downloadFile(blob, 'filename.csv');

// Get CSRF token (no permission required)
const token = await window.superset.utils.getCSRFToken();
```

### Event Subscriptions

```typescript
// Subscribe to events
const unsubscribe = window.superset.on('dashboard:filterChange', (filters) => {
  console.log('Filters changed:', filters);
});

// Later, unsubscribe
unsubscribe();
```

## Content Security Policy

Iframe-sandboxed extensions can customize their Content Security Policy through the `csp` configuration:

```json
{
  "sandbox": {
    "trustLevel": "iframe",
    "csp": {
      "defaultSrc": ["'none'"],
      "scriptSrc": ["'unsafe-inline'"],
      "styleSrc": ["'unsafe-inline'"],
      "imgSrc": ["data:", "blob:", "https://cdn.example.com"],
      "connectSrc": ["https://api.example.com"],
      "fontSrc": ["data:"]
    }
  }
}
```

### Default CSP

By default, iframe sandboxes use a restrictive CSP:

```
default-src 'none';
script-src 'unsafe-inline';
style-src 'unsafe-inline';
img-src data: blob:;
font-src data:;
connect-src 'none';
frame-src 'none';
```

## WASM Resource Limits

WASM-sandboxed extensions can configure resource limits:

```json
{
  "sandbox": {
    "trustLevel": "wasm",
    "resourceLimits": {
      "maxMemory": 10485760,      // 10MB max memory
      "maxExecutionTime": 5000,   // 5 second timeout
      "maxStackSize": 1000        // Max call stack depth
    }
  }
}
```

### Defaults

- **maxMemory**: 10MB
- **maxExecutionTime**: 5000ms (5 seconds)
- **maxStackSize**: 1000 calls

## Migration Guide

### Migrating from Legacy Extensions

Existing extensions that don't specify a `sandbox` configuration will continue to run as `core` extensions for backward compatibility. To migrate to a sandboxed model:

1. **Assess your extension's requirements**:
   - Does it need to render UI? Use `iframe`
   - Is it logic-only (formatters, validators)? Use `wasm`
   - Does it need full access? Keep as `core` (requires trust)

2. **Add sandbox configuration to extension.json**:

```json
{
  "sandbox": {
    "trustLevel": "iframe",
    "permissions": ["sqllab:read"]
  }
}
```

3. **Update your code to use the sandboxed API**:

Before (core extension):
```typescript
import { sqlLab } from '@apache-superset/core';
const tab = sqlLab.getCurrentTab();
```

After (sandboxed extension):
```typescript
const tab = await window.superset.sqlLab.getCurrentTab();
```

4. **Test thoroughly** to ensure all functionality works within the sandbox

## Security Comparison

| Aspect | Core | Iframe | WASM |
|--------|------|--------|------|
| DOM Access | Full | Own iframe only | None |
| Network | Full | Restricted (CSP) | None |
| Cookies | Full | None | None |
| localStorage | Full | None | None |
| Superset APIs | Full | Controlled bridge | Injected only |
| Performance | Native | Near-native | ~40% slower |
| React rendering | Full | Own instance | Via descriptors |

## Administrator Configuration

Administrators can configure trust settings for their Superset deployment:

```python
# In superset_config.py
EXTENSIONS_TRUST_CONFIG = {
    # Extensions allowed to run as 'core'
    "trusted_extensions": [
        "official-extension-1",
        "enterprise-plugin",
    ],

    # Allow unsigned extensions to run as core (not recommended for production)
    "allow_unsigned_core": False,

    # Default trust level for extensions without sandbox config
    "default_trust_level": "iframe",
}
```

## Best Practices

1. **Request minimal permissions** - Only request the permissions your extension actually needs

2. **Prefer iframe over core** - Unless your extension requires deep integration, use iframe sandboxing

3. **Use WASM for pure logic** - If your extension doesn't need UI, WASM provides the best isolation

4. **Handle permission denials gracefully** - Your extension should degrade gracefully if a permission is not granted

5. **Don't store sensitive data** - Sandboxed extensions should not store sensitive user data

6. **Test in sandboxed mode** - Always test your extension in its intended sandbox environment

## Troubleshooting

### Permission Denied Errors

If you see "Permission denied" errors, verify that:
1. The permission is declared in your extension.json
2. The permission was granted by the administrator
3. You're calling the correct API method for that permission

### Timeout Errors (WASM)

If your WASM extension times out:
1. Optimize your code for faster execution
2. Request a higher `maxExecutionTime` limit
3. Break large operations into smaller chunks

### CSP Violations (Iframe)

If resources fail to load due to CSP:
1. Add the required domains to your CSP configuration
2. Ensure you're using HTTPS for external resources
3. Avoid inline scripts and styles where possible

### Core Trust Denied

If your extension is downgraded from `core` to another trust level:
1. Check if the extension ID is in the administrator's `trusted_extensions` list
2. If signature verification is required, ensure the extension is signed
3. Verify the signing key is in the administrator's `trusted_signers`

See [Extension Signing](./signing) for how to sign your extension.

## Related Documentation

- [Security Overview](./security) - Extension security fundamentals
- [Extension Signing](./signing) - How to sign extensions for core trust
- [Administrator Configuration](./admin-configuration) - Trust configuration for admins
