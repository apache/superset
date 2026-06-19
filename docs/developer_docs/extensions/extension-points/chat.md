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

| Component | Role |
|-----------|------|
| **Trigger** | Always-visible entry point (e.g., a floating button). Rendered in the bottom-right corner in floating mode, or as a fixed overlay in panel mode. |
| **Panel** | The chat UI itself (message list, input, etc.). Mounted by the host in the active display mode. |

## Display Modes

The host supports two display modes, switchable by the user or the extension at runtime:

| Mode | Behavior |
|------|----------|
| `floating` | Panel floats above page content, anchored to the bottom-right corner. |
| `panel` | Panel is docked to the right side of the application as a resizable sidebar, sitting beside the page content. |

The user's last selected mode and open/closed state are persisted across page reloads.

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
      <button onClick={() => chat.setDisplayMode(mode === 'panel' ? 'floating' : 'panel')}>
        {mode === 'panel' ? 'Float' : 'Dock'}
      </button>
      {/* message list and input */}
    </div>
  );
}
```

## Chat API Reference

All methods are available on the `chat` namespace from `@apache-superset/core`:

| Method / Event | Description |
|----------------|-------------|
| `registerChat(descriptor, trigger, panel)` | Register a chat extension. Returns a `Disposable` to unregister. |
| `open()` | Open the chat panel. No-op if already open or no registration. |
| `close()` | Close the chat panel. |
| `isOpen()` | Returns `true` if the panel is currently open. |
| `getDisplayMode()` | Returns the current display mode (`'floating'` or `'panel'`). |
| `setDisplayMode(mode)` | Switch between `'floating'` and `'panel'` mode. |
| `onDidOpen(listener)` | Subscribe to panel open events. Returns a `Disposable`. |
| `onDidClose(listener)` | Subscribe to panel close events. Returns a `Disposable`. |
| `onDidChangeDisplayMode(listener)` | Subscribe to display mode changes. Returns a `Disposable`. |
| `onDidRegisterChat(listener)` | Subscribe to registration events. |
| `onDidUnregisterChat(listener)` | Subscribe to unregistration events. |
| `onDidResizePanel(listener)` | Subscribe to panel resize events (panel mode only). Not all hosts provide a resizer — do not rely on this firing. Returns a `Disposable`. |

## Next Steps

- **[Contribution Types](../contribution-types.md)** — Explore other contribution types
- **[Development](../development.md)** — Set up your development environment
