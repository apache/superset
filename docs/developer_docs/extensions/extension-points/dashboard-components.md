---
title: Dashboard Components
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

# Dashboard Component Contributions

Extensions can add first-class **layout components** to the dashboard builder —
elements that sit in the grid alongside charts, Markdown, and tabs. The built-in
iframe component is itself implemented through this contribution point.

The host owns the surrounding **chrome** (the drag handle, the resize container,
and the delete affordance), so your component only renders its content and, in
edit mode, its own editor affordances. This keeps the contract small and stable.

> This supersedes the legacy `DashboardComponentsRegistry` / `DYNAMIC_TYPE`
> mechanism, which is deprecated.

## Overview

A dashboard component contribution is:

| Part | Role |
|------|------|
| **Definition** | A descriptor declaring the component's id, palette label, icon, and layout behavior (resizable, default size, nesting). |
| **Component** | A React component that renders the element's content and receives the [`DashboardComponentProps`](#component-contract) contract. |

## The Component Contract

Your component receives a small, stable set of props. It never deals with drag,
resize, or delete — the host renders it inside that chrome.

```ts
interface DashboardComponentProps {
  /** The layout item id of this instance. */
  id: string;
  /** This instance's persisted meta (round-trips in the saved layout). */
  meta: Record<string, unknown>;
  /** Whether the dashboard is in edit mode. */
  editMode: boolean;
  /** Shallow-merge a patch into this instance's persisted meta. */
  updateMeta: (patch: Record<string, unknown>) => void;
}
```

Persist any per-instance state in `meta` via `updateMeta`. It is saved with the
dashboard and rehydrated on load.

## Registering a Dashboard Component

Call `dashboardComponents.registerDashboardComponent` from your extension's entry
point with a definition and your component:

```tsx
import { dashboardComponents } from '@apache-superset/core';
import WeatherWidget from './WeatherWidget';

dashboardComponents.registerDashboardComponent(
  {
    id: 'my-org.weather',
    name: 'Weather widget',
    description: 'Shows the current weather for a city',
    icon: 'CloudOutlined',
    resizable: true,
    defaultMeta: { width: 4, height: 50, city: 'Lisbon' },
  },
  WeatherWidget,
);
```

```tsx
// WeatherWidget.tsx
import type { dashboardComponents } from '@apache-superset/core';

type Props = dashboardComponents.DashboardComponentProps;

export default function WeatherWidget({ meta, editMode, updateMeta }: Props) {
  const city = (meta.city as string) ?? '';
  return editMode ? (
    <input
      value={city}
      onChange={e => updateMeta({ city: e.target.value })}
      placeholder="City"
    />
  ) : (
    <Forecast city={city} />
  );
}
```

The component appears in the dashboard builder's **Layout elements** palette and
can be dragged onto the grid like any built-in element.

## Definition Reference

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Namespaced unique id, e.g. `my-org.weather`. Selects the component for each instance. |
| `name` | `string` | Label shown in the builder palette. |
| `description` | `string` | Optional longer description. |
| `icon` | `string` | A known Superset icon name (e.g. `CloudOutlined`). Falls back to a generic icon. |
| `resizable` | `boolean` | Whether instances can be resized. Defaults to `true`. |
| `defaultMeta` | `object` | `meta` seeded onto a new instance (e.g. `width`, `height`, and your own keys). |
| `isUserContent` | `boolean` | Whether an instance counts as content for "is this dashboard empty?" detection. Defaults to `true`. |
| `minWidth` | `number` | Minimum width in grid columns. Defaults to `1`. |
| `validParents` | `string[]` | Restrict which container types may hold the component (e.g. `['GRID', 'TAB']`). Defaults to standard content-leaf placement (grid, row, column, tab). |
| `wrapInRow` | `boolean` | Whether a drop into the grid or a tab auto-wraps the component in a row. Defaults to `true`. |

The layout-relevant behavior fields are seeded onto each instance's `meta` at
creation, so the dashboard honors them — and they round-trip in the saved layout
even if the extension later becomes unavailable.

## Graceful Degradation

If a saved dashboard references a component whose extension is disabled or not
yet loaded, the host renders a non-destructive placeholder in its place and
preserves the instance's `meta` on save. Re-enabling the extension restores the
component.

## Dashboard Components API Reference

All methods are available on the `dashboardComponents` namespace from
`@apache-superset/core`:

| Method / Event | Description |
|----------------|-------------|
| `registerDashboardComponent(definition, component)` | Register a component. Returns a `Disposable` to unregister. Registering the same id again replaces the previous registration. |
| `getDashboardComponent(id)` | Returns the registered component for `id`, or `undefined`. |
| `getDashboardComponents()` | Returns all registered components. |
| `onDidRegisterDashboardComponent(listener)` | Subscribe to registration events. Returns a `Disposable`. |
| `onDidUnregisterDashboardComponent(listener)` | Subscribe to unregistration events. Returns a `Disposable`. |

## Next Steps

- **[Contribution Types](../contribution-types.md)** — Explore other contribution types
- **[Development](../development.md)** — Set up your development environment
