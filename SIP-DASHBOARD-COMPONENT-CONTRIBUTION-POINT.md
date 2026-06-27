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

# [SIP] Proposal for a dashboard component Extensions contribution point

> **Companion SIP:** Pairs with [`SIP.md`](SIP.md) (first-class iframe component +
> runtime CSP allowlist). That SIP is the **reference implementation** that proves
> this contribution point: the iframe's UI becomes an extension-contributed
> dashboard component, while its security-sensitive CSP backend stays in core.
>
> **Status:** Draft — POC tracked in `feat/csp-runtime-allowlist-iframe`.

## Motivation

Adding a new dashboard layout component to Superset today is a **core-only,
high-friction** operation. The iframe component in the companion SIP had to touch
~12 files: a type constant, the `componentLookup` map, the builder palette, and
**seven hardcoded behavior maps** keyed by component-type string
(`isValidChild`, `componentIsResizable`, `newComponentFactory`,
`shouldWrapChildInRow`, `getDetailedComponentWidth`, `isDashboardEmpty`, plus the
prop bundle injected by `DashboardComponent.tsx`). Component types are a **closed
enum** baked into core.

There is a legacy escape hatch — the `DashboardComponentsRegistry` /
`DYNAMIC_TYPE` path (`src/visualizations/dashboardComponents/`) — but it is an
**antique that should be deprecated**:

- It is disconnected from the modern VS Code-style Extensions framework
  (`@apache-superset/core`, `ENABLE_EXTENSIONS`), which already has contribution
  points for `commands`, `menus`, `views`, `editors`, and `chat`.
- Components registered through it are **second-class**: `DynamicComponent`
  renders them in a generic wrapper that only passes `dashboardData`. They do not
  receive the first-class layout lifecycle (edit mode, meta editing, resize, DnD)
  and cannot declare their own layout behavior.

We want a **single, modern way** to contribute a first-class dashboard layout
component — via the Extensions framework — and to deprecate the legacy registry.
The iframe component is the ideal pilot because it is self-contained.

## Proposed Change

### 1. A `dashboardComponents` contribution point

Add `dashboardComponents` to the Extensions `Contributions` interface
(`packages/superset-core/src/contributions/index.ts`), alongside `views`,
`commands`, etc., with a public registration API mirroring the existing ones
(`registerDashboardComponent` returning a `Disposable`), exposed on
`window.superset.dashboardComponents` and wired into `ExtensionsLoader`.

### 2. The Dashboard Component Contract (the heart of this SIP)

The contract has two halves. Getting this right is the real work — it becomes a
**public API Superset must support indefinitely**.

**(a) Declarative behavior metadata** — replaces the seven hardcoded util maps:

```ts
interface DashboardComponentContribution {
  id: string;                 // unique type key, namespaced, e.g. "my-org.iframe"
  name: string;               // palette label
  description?: string;
  icon: string;               // contributed icon id or known icon name
  resizable?: boolean;        // -> componentIsResizable
  defaultMeta?: {             // -> newComponentFactory
    width?: number;
    height?: number;
    [key: string]: unknown;
  };
  nesting?: {                 // -> isValidChild / shouldWrapChildInRow
    validParents?: string[];  // e.g. [GRID, ROW, COLUMN, TAB]
    wrapInRow?: boolean;
    minWidth?: number;        // -> getDetailedComponentWidth
  };
  isUserContent?: boolean;    // -> isDashboardEmpty
  loadComponent: () => Promise<{ default: ComponentType<DashboardComponentProps> }>;
}
```

**(b) Runtime props contract** — a small, stable surface. Crucially, **the host
owns the chrome** (the `Draggable` + `ResizableContainer` + `HoverMenu`/delete
wrapper that every current `componentLookup` component re-implements today). The
extension component renders only its *content* and, optionally, an *editor*:

```ts
interface DashboardComponentProps {
  id: string;
  meta: Record<string, unknown>;
  editMode: boolean;
  updateMeta: (patch: Record<string, unknown>) => void; // wraps updateComponents
  // resize/drag/delete handled by the host wrapper, NOT the component
}
```

This is a strict improvement over the status quo: the iframe component in the
companion PR hand-rolls the Draggable/Resizable/HoverMenu wrapper; under this
contract that boilerplate moves into the host once, and contributed components
shrink to "render content + edit meta."

### 3. Registry-driven core

Refactor `componentLookup` and the seven behavior maps to consult a registry,
with the **built-in leaf components seeded into it** at startup. Structural
container components (Chart, Tabs, Row, Column, Header) *are* the layout engine
and stay bespoke; the contribution point targets **leaf/content components**
(today: Markdown, Divider, Iframe; tomorrow: anything). `DashboardComponent.tsx`
resolves contributed types through the registry and renders them inside the
shared host chrome.

### 4. Deprecate `DashboardComponentsRegistry` / `DYNAMIC_TYPE`

Mark the legacy registry and `DYNAMIC_TYPE` deprecated. Provide a shim so existing
dynamic components keep working, with a migration note pointing at the new
contribution point. Removal happens in a later major per Superset's deprecation
policy.

### 5. Graceful fallback for unknown types

A saved dashboard layout stores component **type strings** in its position JSON.
If a dashboard references a type whose extension is disabled/uninstalled, the host
must render a non-destructive placeholder ("This component requires the *X*
extension") and **preserve the meta on save** so re-enabling the extension
restores it. The layout engine already tolerates unknown types defensively
(`componentLookup[type]` → null; `isValidChild` → false); this SIP makes that an
intentional, user-visible contract rather than silent breakage.

### 6. Backend: APIs yes, security policy no

The Extensions framework **already** lets a component contribute a backend REST
API: the `@api` decorator (`superset-core/.../rest_api/decorators.py`) detects
extension context and registers the route via `appbuilder.add_api()` at entrypoint
import, serving it under `/extensions/{publisher}/{name}/...` and auto-creating
the endpoint's FAB permission. **No new work is required for an extension to ship
an API.**

What an extension **cannot** do today, and what this SIP explicitly leaves to
core:

- **Role policy for a permission.** Endpoint permissions are auto-created, but
  whether a permission is *Admin-only* (e.g. via
  `SupersetSecurityManager.ADMIN_ONLY_VIEW_MENUS`) is decided in core at
  `sync_role_definitions` time. The manifest's `permissions: list[str]` field is
  currently **dormant** (never read), and the `ContributionProcessorRegistry` that
  would process it is scaffolding that is not wired into the load pipeline.
- **Security-sensitive request hooks** (e.g. rewriting CSP/Talisman headers).

This is exactly why the companion CSP feature keeps its backend in core: the
component *UI* is extension-shaped, but punching holes in the CSP and gating it
admin-only are core security responsibilities.

A **future, optional** extension of this SIP could finish wiring
`ContributionProcessorRegistry` + a manifest permission-policy schema so
extensions can declare role policy — but that is itself a security-review-worthy
change and is out of scope here.

## New or Changed Public Interfaces

- **New contribution point** `dashboardComponents` on the `Contributions`
  interface; new `registerDashboardComponent(...) -> Disposable` API; new
  `window.superset.dashboardComponents` namespace.
- **New public types** `DashboardComponentContribution` and
  `DashboardComponentProps` (the contract) — these become long-term public API.
- **Changed (internal → registry-driven)** `componentLookup` and the seven
  behavior util maps; `DashboardComponent.tsx` resolution path; the host gains a
  shared component-chrome wrapper.
- **Deprecated** `DashboardComponentsRegistry`, `DYNAMIC_TYPE`,
  `NewDynamicComponent`, `setupDashboardComponents`.

## New dependencies

None. Reuses the existing Extensions framework (module federation, manifest
schema, `@api` decorator) and the existing functional-registry utilities.

## Migration Plan and Compatibility

- **No DB migration.** This is a frontend/framework change plus the (already
  supported) extension API path.
- **Layout JSON is unchanged** — component types remain type strings. The new
  fallback behavior makes *unknown* types degrade gracefully instead of rendering
  nothing.
- **Backwards compatible:** built-in components are seeded into the registry, so
  existing dashboards render identically. Legacy `DYNAMIC_TYPE` components keep
  working via a deprecation shim.
- **Rollout:** the contribution point is only active under `ENABLE_EXTENSIONS`;
  with it off, behavior is identical to today.

## Rejected Alternatives

- **Keep / extend `DashboardComponentsRegistry`.** It is disconnected from the
  modern Extensions framework and produces second-class components. Deprecating it
  in favor of one contribution model is the goal, not a side effect.
- **Require all built-in components to become extensions.** Chart/Tabs/Row/Column
  are the layout engine; extracting them is high-risk and low-value. The
  contribution point *adds* leaf components; it does not mandate extraction.
- **Let the extension component own its own DnD/resize chrome** (as
  `componentLookup` components do today). Rejected: it bloats the contract,
  duplicates host logic, and makes the public API fragile. The host owns chrome.
- **One combined SIP with the CSP feature.** Rejected: the framework change and
  the security-sensitive feature are distinct discussions with different
  reviewers and risk profiles, even though they share a POC branch.
- **Move the CSP permission/role policy into the extension.** Not supported today
  (dormant manifest `permissions`, unwired contribution processor) and
  undesirable: admin-only gating and CSP-header rewriting are core security
  responsibilities.

## Implementation Status (POC)

Implemented on the POC branch (`@apache-superset/core` mirrors the `chat`
contribution-point pattern from #41000/#41205):

- [x] `DashboardComponentDefinition` + `DashboardComponentProps` contract types
      (`packages/superset-core/src/dashboardComponents`), added to the
      `Contributions` interface and the package's subpath exports
- [x] `dashboardComponents` contribution point: host `DashboardComponentsProvider`
      registry + public `registerDashboardComponent`/`getDashboardComponents` API
      (`src/core/dashboardComponents`), exposed on `window.superset` via
      `ExtensionsStartup` + `Namespaces`
- [x] Shared host component-chrome wrapper `DashboardExtensionComponent`
      (owns Draggable/Resizable/HoverMenu/Delete; reads `resizable` from the
      definition) behind the new `EXTENSION_TYPE`
- [x] `componentLookup` + builder palette resolve the registry; the seven
      behavior maps carry `EXTENSION_TYPE` leaf behavior
- [x] Unknown-type graceful fallback (placeholder + meta preserved on save)
- [x] Deprecation notices on `DashboardComponentsRegistry` / `DYNAMIC_TYPE`
      (legacy path still functions)
- [x] Reference component: the built-in iframe is now delivered **through** the
      contribution point (`src/dashboard/extensions/iframe`), registered at
      startup exactly as a third-party extension would; its CSP backend remains
      in core per the companion SIP
- [x] Tests: registry lifecycle (register/get/replace/dispose), host-wrapper
      resolution + fallback + `updateMeta`, iframe content + CSP UX

Remaining (follow-up, not POC-blocking):

- [ ] Per-component nesting policy in the global behavior maps (currently
      `EXTENSION_TYPE` uses uniform leaf behavior; `validParents`/`wrapInRow`/
      `minWidth` from the definition are not yet consulted by the global maps)
- [ ] Manifest `contributions.dashboardComponents` declarative validation in the
      Python/TS manifest schema (runtime side-effect registration works today)
- [ ] Remove the legacy `DashboardComponentsRegistry`/`DYNAMIC_TYPE` (major)
- [ ] Developer docs + example extension
