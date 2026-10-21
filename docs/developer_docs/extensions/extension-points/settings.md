---
title: Settings Menu
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

# Settings Menu Extension Points

The **Settings** dropdown in the top navigation bar can list entries contributed by extensions, each opening a full-page view the extension renders. This is the extension point for things like an extension's own admin or configuration screen.

Unlike the SQL Lab extension points, these locations are not declared in `extension.json`: the `contributions.views` and `contributions.menus` manifest fields only accept SQL Lab scopes. Extensions register against them in code instead, at module load time in the extension's entry point. The loader only evaluates the module and does not call an exported `activate` function, so registrations inside one are never made unless the entry point calls it itself.

| Extension Point    | ID                     | Views | Menus | Description                                              |
| ------------------ | ---------------------- | ----- | ----- | -------------------------------------------------------- |
| **Settings menu**  | `global.settingsMenu`  | —     | ✓     | Entries in the Settings dropdown (`primary` group only)  |
| **Settings panel** | `global.settingsPanel` | ✓     | —     | Full-page views opened from those entries                |

## How the pieces fit together

1. Register a view at `global.settingsPanel`. The host renders it at `/extensions/view/<view id>`, with the view's `name` as the page heading.
2. Register a command whose callback navigates to that route.
3. Register a menu item at `global.settingsMenu` in the `primary` group, pointing at that command. The host lists it under an **Extensions** group in the Settings dropdown, using the command's `title` as the label and its `description` as the tooltip.

Only the `primary` group is rendered; items registered as `secondary` or `context` never appear in the Settings dropdown. Clicking an entry runs its command, and if the command throws or rejects, the host shows the error as a toast.

The view page is available to every signed-in user while extensions are enabled, and the Settings entry appears for every user the extension loads for. The view's own backend calls enforce whatever permissions it needs.

## View ids in the URL

A view id may contain `/`. The route matches any number of path segments, so `/extensions/view/my-ext/settings` and `/extensions/view/my-ext%2Fsettings` both resolve `my-ext/settings`. Passing the id through `encodeURIComponent` is safe, including ids that contain `%`.

While the extension providing a view is still loading, the page shows a loading indicator; once extensions have finished loading, an id that nothing registered shows a "could not be loaded" placeholder instead.

## Toasts

The `window` namespace shows transient toasts to the current user. It is not tied to any view, so it works from a command callback as well as from a rendered component:

```typescript
import { window as supersetWindow } from '@apache-superset/core';

supersetWindow.showInformationMessage('Settings saved');
supersetWindow.showWarningMessage('Sync is running behind', { duration: 6000 });
supersetWindow.showErrorMessage('Could not reach the service');
```

Each method takes the message and an optional `{ duration }` in milliseconds; when omitted, the host's default for that severity applies. Importing the namespace under an alias keeps it from shadowing the browser's global `window`.

## Example

This example adds a "My Extension Settings" entry to the Settings dropdown that opens the extension's own settings page. The navigation assumes Superset is served from the root path; on a deployment under `SUPERSET_APP_ROOT`, prefix the URL with that app root, since a native `location.assign` does not get the router's basename:

```typescript
import {
  commands,
  menus,
  views,
  window as supersetWindow,
} from '@apache-superset/core';
import SettingsPanel from './SettingsPanel';

const VIEW_ID = 'my-extension.settings';

views.registerView(
  { id: VIEW_ID, name: 'My Extension Settings' },
  'global.settingsPanel',
  SettingsPanel,
);

commands.registerCommand(
  {
    id: 'my-extension.openSettings',
    title: 'My Extension Settings',
    description: 'Configure My Extension',
  },
  () => {
    globalThis.location.assign(
      `/extensions/view/${encodeURIComponent(VIEW_ID)}`,
    );
  },
);

menus.registerMenuItem(
  { view: VIEW_ID, command: 'my-extension.openSettings' },
  'global.settingsMenu',
  'primary',
);

// Later, for example after the panel saves its form:
supersetWindow.showInformationMessage('Settings saved');
```

## Next Steps

- **[Contribution Types](../contribution-types.md)** - Learn about other contribution types (commands, menus)
- **[SQL Lab](./sqllab.md)** - Extension points inside SQL Lab
- **[Quick Start](../quick-start.md)** - Build a complete extension
