---
title: Pages and Settings Menu
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

# Pages and Settings Menu

An extension can own a full page of its own (an admin console, a catalog browser, a governance report) with a stable, deep-linkable URL, and list it in the **Settings** dropdown in the top navigation bar. Both are registered in code, at module load time in the extension's entry point, through the same `views` and `menus` registries the SQL Lab extension points use.

| Extension Point   | ID                    | Constant                       | Description                                             |
| ----------------- | --------------------- | ------------------------------ | ------------------------------------------------------- |
| **Page**          | `global.page`         | `views.Locations.page`         | Full-page views, each served at `/extensions/pages/<id>` |
| **Settings menu** | `global.settingsMenu` | `menus.Locations.settingsMenu` | Entries in the Settings dropdown (`primary` group only) |

These locations are not declared in `extension.json`. The loader only evaluates the module and does not call an exported `activate` function, so registrations inside one are never made unless the entry point calls it itself.

## Pages

A view registered at `global.page` is a page. The host serves it at `/extensions/pages/<id>`, with the view's `name` as the page heading:

```typescript
import { views } from '@apache-superset/core';
import CatalogPage from './CatalogPage';

views.registerView(
  { id: 'acme.catalog.main', name: 'Data catalog' },
  views.Locations.page,
  CatalogPage,
);
```

- **Ids are owned.** A page id must start with the registering extension's id (`acme.catalog.` for the `acme.catalog` extension), and `registerView` throws otherwise, so one extension can't register or take over another's page. Registering any view id twice also throws.
- **Ids are one path segment.** Page ids are dotted, not slashed: `/`, `?`, `#`, `%` and whitespace are rejected.
- **Everything below the id belongs to the page.** `/extensions/pages/acme.catalog.main/42/edit` renders the same page, which reads its own sub-path and query string from `navigation.getLocation()` and re-renders on `navigation.onDidChangeLocation`. The host doesn't interpret the sub-path.
- **Bookmarks and refreshes work.** A direct hit renders the app shell; the page shows a loading state until the extension finishes loading, and "Page not found" only once extensions have loaded without registering it.

The page is open to any signed-in user by default. It returns no data on its own: the data behind it comes from the extension's own `@api` endpoints, which enforce their own permissions.

### Restricting a page

To hide a page from users who shouldn't see it, name an existing permission on `registerView`, typically the one the extension's own API already checks:

```typescript
views.registerView(
  { id: 'acme.tools.approvals', name: 'Approvals' },
  views.Locations.page,
  Approvals,
  { classPermissionName: 'AcmeApprovalsApi', methodPermissionName: 'review' },
);
```

Users without `can_review` on `AcmeApprovalsApi` don't see the page's Settings entry, and get a "Not authorized" state if they open the URL directly. A host permission works too (`{ classPermissionName: 'Dashboard', methodPermissionName: 'read' }`). The check runs client-side against the user's bootstrap permissions, so it controls who sees the page, not who can reach its data: keep enforcing the same permission on the extension's endpoints with `@protect()`.

## Settings menu entries

A menu item at `global.settingsMenu` in the `primary` group appears under an **Extensions** group in the Settings dropdown. It sets exactly one of:

- `page`: the id of a page. The host renders a real link (middle-click and "open in new tab" work, and navigation stays client-side), labelled with the page's `name`. The entry is skipped while the page isn't registered, or when the user lacks the page's permission.
- `command`: a command to run, labelled with the command's `title`. If the command throws or rejects, the host shows the error as a toast.

`registerMenuItem` throws on an item that sets neither or both. Items can also carry an `icon` (a host icon name, e.g. `'BellOutlined'`) and an `order`; entries sort by `order`, then by registration order.

```typescript
import { menus } from '@apache-superset/core';

menus.registerMenuItem(
  { page: 'acme.catalog.main', icon: 'DatabaseOutlined', order: 10 },
  menus.Locations.settingsMenu,
  'primary',
);
```

Only the `primary` group is rendered; `secondary` and `context` items never appear in the Settings dropdown.

## Navigation

`navigation.navigateTo(path)` moves the user to a router-relative path, client-side when the host can route it (extension pages included) and with a regular navigation otherwise. It works from a command handler or any other non-component code. To open a page by id, the built-in `core.navigation.openPage` command does the same:

```typescript
import { commands, navigation } from '@apache-superset/core';

navigation.navigateTo('/extensions/pages/acme.catalog.main/42/edit');
commands.executeCommand('core.navigation.openPage', 'acme.catalog.main');
```

`navigation.getPage()` returns `'extension'` while an extension page is open.

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

An admin page for the `acme.notifications` extension, listed in the Settings dropdown for users who can manage notifications:

```typescript
import { menus, views, window as supersetWindow } from '@apache-superset/core';
import AdminPage from './AdminPage';

const PAGE_ID = 'acme.notifications.admin';

views.registerView(
  { id: PAGE_ID, name: 'Notifications' },
  views.Locations.page,
  AdminPage,
  { classPermissionName: 'NotificationsApi', methodPermissionName: 'write' },
);

menus.registerMenuItem(
  { page: PAGE_ID, icon: 'BellOutlined' },
  menus.Locations.settingsMenu,
  'primary',
);

// Later, for example after the page saves its form:
supersetWindow.showInformationMessage('Notification saved');
```

## Next Steps

- **[Contribution Types](../contribution-types.md)** - Learn about other contribution types (commands, menus)
- **[SQL Lab](./sqllab.md)** - Extension points inside SQL Lab
- **[Quick Start](../quick-start.md)** - Build a complete extension
