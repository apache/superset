---
title: Chat
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

# Chat Contributions

Extensions can add a chat interface to Superset by registering a trigger and a panel. The host owns the layout, open/close state, and display mode — the extension only needs to provide the UI components.

## Overview

A chat registration consists of two React components:

| Component   | Role                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Trigger** | Always-visible entry point (e.g., a floating button). Rendered in the bottom-right corner in floating mode, or as a fixed overlay in panel mode. |
| **Panel**   | The chat UI itself (message list, input, etc.). Mounted by the host in the active display mode.                                                  |

## Display Modes

The host supports two display modes, switchable by the user or the extension at runtime:

| Mode       | Behavior                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| `floating` | Panel floats above page content, anchored to the bottom-right corner.                                         |
| `panel`    | Panel is docked to the right side of the application as a resizable sidebar, sitting beside the page content. |

The user's last selected mode and open/closed state are persisted across page reloads.

Switching display modes keeps the same panel mounted, preserving its conversation,
draft, expanded tool results, and in-flight UI state. Closing the chat still
unmounts the panel; extensions remain responsible for their cleanup on unmount.

## Registering a Chat

Call `chat.registerChat` from your extension's entry point with a descriptor, a trigger factory, and a panel factory:

```tsx
import { chat } from '@apache-superset/core';
import ChatTrigger from './ChatTrigger';
import ChatPanel from './ChatPanel';

chat.registerChat(
  { id: 'my-org.my-chat', name: 'My Chat' },
  ChatTrigger,
  ChatPanel,
);
```

Only one chat registration is active at a time. If a second extension calls `registerChat`, it replaces the first and a warning is logged.

## Opening and Closing the Chat

The trigger component is responsible for toggling the panel. Use `chat.isOpen()`, `chat.open()`, and `chat.close()` to control visibility:

```tsx
import { chat } from '@apache-superset/core';

export default function ChatTrigger() {
  return (
    <button onClick={() => (chat.isOpen() ? chat.close() : chat.open())}>
      💬
    </button>
  );
}
```

You can also subscribe to open/close events from any component:

```tsx
useEffect(() => {
  const { dispose } = chat.onDidOpen(() => console.log('chat opened'));
  return dispose;
}, []);
```

## Changing the Display Mode

Call `chat.setDisplayMode` to switch between `'floating'` and `'panel'` modes. In your panel component, subscribe to `onDidChangeDisplayMode` to react to changes (including those triggered by the user):

```tsx
import { useState, useEffect } from 'react';
import { chat } from '@apache-superset/core';

export default function ChatPanel() {
  const [mode, setMode] = useState(chat.getDisplayMode());

  useEffect(() => {
    const { dispose } = chat.onDidChangeDisplayMode(m => setMode(m));
    return dispose;
  }, []);

  return (
    <div style={{ height: mode === 'panel' ? '100%' : '80vh' }}>
      <button
        onClick={() =>
          chat.setDisplayMode(mode === 'panel' ? 'floating' : 'panel')
        }
      >
        {mode === 'panel' ? 'Float' : 'Dock'}
      </button>
      {/* message list and input */}
    </div>
  );
}
```

## Chat API Reference

All methods are available on the `chat` namespace from `@apache-superset/core`:

| Method / Event                             | Description                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `registerChat(descriptor, trigger, panel)` | Register a chat extension. Returns a `Disposable` to unregister.                                                                          |
| `open()`                                   | Open the chat panel. No-op if already open or no registration.                                                                            |
| `close()`                                  | Close the chat panel.                                                                                                                     |
| `isOpen()`                                 | Returns `true` if the panel is currently open.                                                                                            |
| `getDisplayMode()`                         | Returns the current display mode (`'floating'` or `'panel'`).                                                                             |
| `setDisplayMode(mode)`                     | Switch between `'floating'` and `'panel'` mode.                                                                                           |
| `onDidOpen(listener)`                      | Subscribe to panel open events. Returns a `Disposable`.                                                                                   |
| `onDidClose(listener)`                     | Subscribe to panel close events. Returns a `Disposable`.                                                                                  |
| `onDidChangeDisplayMode(listener)`         | Subscribe to display mode changes. Returns a `Disposable`.                                                                                |
| `onDidRegisterChat(listener)`              | Subscribe to registration events.                                                                                                         |
| `onDidUnregisterChat(listener)`            | Subscribe to unregistration events.                                                                                                       |
| `onDidResizePanel(listener)`               | Subscribe to panel resize events (panel mode only). Not all hosts provide a resizer — do not rely on this firing. Returns a `Disposable`. |

## Built-in SQL Lab Tools

Use `chat.getTools()` to discover these actions alongside other registered client tools.

Superset registers these tools at application startup, before loading extensions.
They remain discoverable on every page; invoking them outside SQL Lab returns
`{ success: false, message }`. Open SQL Lab before calling them. SQL Lab handlers
also return this error shape for invalid input, missing tabs, and errors raised
while handling a tool call. Query execution failures are reported separately.

| Tool | Input | Result / behavior |
| --- | --- | --- |
| `core.sqlLab__get_current_editor_id` | `{}` | Active `editor_id` |
| `core.sqlLab__get_editor_tabs` | `{}` | `editors`: IDs, titles, database IDs, catalogs, schemas |
| `core.sqlLab__get_databases` | `{}` | `databases`: IDs and names already loaded in SQL Lab |
| `core.sqlLab__get_editor_sql` | `{}` | Active `editor`: metadata, SQL, and selected text |
| `core.sqlLab__update_editor_sql` | `{ sql: string }` | Replace active editor SQL; empty SQL clears the buffer |
| `core.sqlLab__create_editor_tab` | `{ title: string, databaseId: number, sql?: string, catalog?: string, schema?: string }` | Open a tab and return its metadata; omitted options use SQL Lab defaults |
| `core.sqlLab__switch_editor_tab` | `{ editor_id: string }` | Activate an existing tab |
| `core.sqlLab__close_editor_tab` | `{ editor_id: string }` | Close a tab and discard its editor buffer |
| `core.sqlLab__run_current_query` | `{}` | Trigger the existing SQL Lab Run action; return `editor_id` and client `query_id` |

Successful results include `success: true`. Read and update tools use the active
editor; switch tabs explicitly before working with another editor. Listing tabs
reads metadata only, so it does not wait for inactive editors to mount.
Persisted tabs remain listed before they are visited; their `databaseId` is
`null` until their state is loaded. SQL reads and updates return an error if
their tab closes while waiting for its editor to mount. Creating a tab for a
different database clears omitted catalog and schema values; explicit values
are preserved, and tabs using the same database inherit omitted values.

`run_current_query` follows SQL Lab's existing selection, database, catalog,
schema, template parameter, and row limit behavior. It starts execution through
the SQL Lab API and returns a client query ID; it does not wait for results.
Its `success: true` confirms only that execution was initiated, not that the
query succeeded. Backend execution errors (including invalid SQL) are delivered
through SQL Lab's query lifecycle. Subscribe to `sqlLab.onDidQuerySuccess` and
`sqlLab.onDidQueryFail` before starting execution, and match the returned
`query_id` to the event's `clientId` to determine the outcome.
Queries can modify database contents, so this tool carries `destructiveHint: true`.
Updating SQL and closing tabs also carry this hint because they can discard text.
Query execution permissions remain enforced by the existing backend endpoints.
Saving SQL as a Saved Query belongs to backend tools and is not provided here.

## Next Steps

- **[Contribution Types](../contribution-types.md)** — Explore other contribution types
- **[Development](../development.md)** — Set up your development environment
