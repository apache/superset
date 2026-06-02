Chatbot extensions
Author: Enzo Martellucci
Team: Preset
Status: Draft | Under Review | Completed
Day: May, 2026

1. Introduction
   This document defines the extension point that allows an external chatbot to be embedded into the Superset UI.
   1.1 Motivation
   The goal is to let any community-built chatbot plug into Superset through the standard extension system using the same well-defined APIs already established for SQL Lab and the dashboard, without the chatbot reaching into Superset's internal Redux store or source modules.
   1.2 Items Not Included
   These are explicitly out of scope for this SIP and are either deferred to
   another SIP or left to the extension implementation:

- Frontend tool execution / agentic UI manipulation (the agent changing a
  chart's config, a dashboard's layout, or the SQL editor's contents live on
  screen) is out of scope and deferred to the _[SIP] Proposal for
  integrating Superset client actions for AI agent applications_ (Justin Park).
  This SIP defines how the chatbot is _mounted and given context_; that SIP
  defines how the chatbot \*acts on the UI”.
- The chatbot UI itself is out of scope. This SIP defines the host
  contract; the look, feel, conversation model, streaming, and persistence are
  entirely the extension's responsibility.
- The MCP/LLM backend (server, model communication, tool selection) is out
  of scope.

2. Functional requirements
   Registration & rendering
   Extensions must be able to register a chatbot provider
   Only one chatbot should be visible/active at a time (Singleton)
   The chatbot should be visible across all supported application surfaces
   Extensions must be able to render a fully custom chatbot UI
   Content sharing APIs/hooks
   The chatbot must receive contextual information about the current page:
   Page type: `home`, `dashboard`, `explore`, `sqllab`, `dataset`, `other`
   The current dashboard/chart data, the saved chart, the dashboard filters and
   the dashboard's charts (each flagged with its current visibility)
   The chatbot must be notified when the page context changes (navigation entity change, title change) without polling.
   The page context the chatbot receives must be host-derived and aligned with the current user's backend-authorized application view: the host computes it and exposes only what the current user is already authorized to see. The chatbot must not read the host's Redux store or other internal state to assemble context (the chatbot must not depend on internal frontend structure to assemble the context).
   The chatbot must support conversation state/history (owned by the extension, never the host) 3) Administration
   An admin can enable/disable the chatbot and when more than one chatbot extension is installed, choose which one is active.
   This administration is surfaced directly in the UI through the existing Extensions list page (`/extensions/`, `superset-frontend/src/extensions/ExtensionsList.tsx`). For each installed extension the page renders an enable/disable toggle, and for any extension that registers a `superset.chatbot` view it renders a "Set as default chatbot" / "Remove default" control (a star icon) that marks the single active chatbot. Selections are persisted server-side via the `/api/v1/extensions/settings` endpoint and propagated live to the host mount point (`notifyExtensionSettingsChanged`), so enabling, disabling, or switching the default chatbot takes effect without a reload. The candidate chatbots offered in the picker are resolved from the views registered at the `superset.chatbot` location (`getRegisteredViewIds(CHATBOT_LOCATION)`), so the singleton selection policy described in §3.2 is driven by this admin UI.

2.1 Non-functional requirements
Context sharing must respect Superset permission and security boundaries. The host must not expose entities, metadata, or datasource-derived context the current user is not authorized to access.
Namespace APIs must remain decoupled from frontend implementation details and internal state-management architecture.
The architecture must minimize impact on existing frontend performance. In particular, exposing page context must not force unnecessary host view re-renders.
Context change notifications must not require polling.
Third-party chatbot failures must not break the main application (fault isolation at the mount boundary).
The integration system must remain extensible for future AI capabilities and additional application surfaces.
The architecture should avoid hard dependency on any specific LLM vendor.
The system must support incremental adoption and migration from existing integrations. 3. Proposed Extension Point
3.1 Summary
One extension point is proposed.
Extension Point
Contribution Area ID
Registration API
Cardinality
Chatbot bubble
`superset.chatbot`
`views.registerView()`
Exclusive (singleton)

3.2 The Chatbot Bubble
Contribution area: `superset.chatbot`
The host renders a fixed mount point at the bottom-right corner of the Superset application shell. A chatbot extension registers a single React component into this slot, and the host renders it persistently across all routes (dashboard, SQL Lab, explore, datasets, etc.).
New contribution scope — manifest schema change required the static contribution schema in `@apache-superset/core` is currently SQL-Lab-only: `ViewContributions` only accepts a `sqllab` scope keyed by `SqlLabLocation`.
There is no app-shell-level scope, so `superset.chatbot` cannot be declared in `extension.json` today.

This SIP therefore requires extending the manifest contribution schema to add an app-root scope (e.g. `app` / `appShell`) that can carry the `superset.chatbot` location.
This is a schema change, not just a runtime `registerView()` call: both the
static manifest declaration and the runtime registration must understand the new
scope.
The extension owns the bubble's collapsed appearance (the icon), its expanded appearance (the conversation panel), all animations, all open/close state, and all internal chatbot behavior.

Singleton / exclusive behavior
Unlike most contribution areas (which accept multiple contributions and render them as a list or stack), `superset.chatbot` is exclusive; only one chatbot extension can be active at a time.
Two floating bubbles in the same corner would be confusing, and the conversation model is fundamentally singular.
If no chatbot extension is installed, the corner stays empty and no bubble appears.
If exactly one chatbot extension is installed, its component is mounted automatically.
If multiple chatbot extensions are installed, the host resolves the conflict via the admin setting (see §5, Singleton conflict resolution — resolved).

Note that the existing `registerView` / `getViews(location)` registry already supports "multiple contributions registered at a location, host chooses what to render".

Singleton behavior is therefore a host-side selection policy at the `superset.chatbot` location, not a new registration primitive: the host enumerates the candidates registered at `superset.chatbot` and picks one according to the admin setting (see §2, Administration).

`getViews` does not expose providers — by design there is a concrete limitation in the public API as it exists today. `getViews(location)` returns `View[] | undefined` — i.e. only the view descriptors (`id`, `name`, `description`, `icon`).
It does not return the `provider` functions that `registerView` was given.

This is important to state precisely, because it is not an oversight to "fix" by widening `getViews`:

- A `provider` is a function that constructs and returns a React element — calling it renders the view. The view descriptor (`id`/`name`/`description/icon`) is inert metadata the host can read without rendering e.g. to draw a launcher button or manifest entry; the provider is executable rendering logic.
- `getViews` is a **public, extension-facing** API. If it returned providers, any extension could obtain and invoke another extension's provider directly — rendering a view outside the host's mount point, lifecycle, and fault-isolation boundary.
  Keeping `getViews` descriptor-only is a deliberate boundary: the public surface lets extensions
  discover what is registered, but only the **host** can render what is registered (via the registration/mount path).
- Consequence for the singleton picker: with the public API alone, the host can enumerate the registered chatbots but cannot obtain the provider needed to render the selected one. The picker described here therefore cannot be built on `getViews` as-is — and `getViews` should **not** be changed to expose providers, because that would dissolve the boundary above.

Implemented solution: the SIP evaluated two acceptable forms and the implementation combines both.

`getViewProvider(location, id)` (host-internal, `src/core/views/index.ts`) is the low-level provider accessor. It is not re-exported through `window.superset.views`, so extensions cannot call it.

`getActiveChatbot(adminSelectedId, enabledMap)` (host-internal, `src/core/chatbot/index.ts`) owns the full selection policy and calls `getViewProvider` as its final step:

const candidates = getRegisteredViewIds('superset.chatbot')
.filter(id => enabledMap[id] !== false);

const selectedId =
adminSelectedId && candidates.includes(adminSelectedId)
? adminSelectedId
: candidates[0];

const provider = getViewProvider('superset.chatbot', selectedId);
return provider ? { id: selectedId, provider } : undefined;

`ChatbotMount` (`src/components/ChatbotMount/index.tsx`) fetches the admin setting from `/api/v1/extensions/settings`, passes `active_chatbot_id` and the enabled map to `getActiveChatbot`, and renders the result. It re-resolves reactively whenever settings change (via `subscribeToExtensionSettings`) or a new chatbot view registers (via `subscribeToLocation`). The chatbot is not rendered at all until the settings fetch completes, avoiding a flash of the wrong chatbot on load.

`getViews()` remains a descriptor-only public API. `resolveView(id)` (also in `src/core/views/index.ts`) is a rendering shortcut used by SQLLab panels and multi-view slots that takes a known id and returns a `ReactElement` directly. It is not used for chatbot resolution: the host needs to apply the enabled/admin policy before rendering anything, and `resolveView` skips all of that — it has no concept of enabled state, admin preference, or the settings-load gate in `ChatbotMount`. `getActiveChatbot` is the correct entry point regardless of how many chatbots are installed.

Positioning and lifecycle (host responsibilities)
The host provides:
Provide the APIs for the interactions
Provide the context
Mounting at the app root level, so the bubble persists across route changes.
Eager loading of the chatbot bundle as part of the app shell startup, so the bubble is available immediately rather than appearing late.
Disposable cleanup when the extension is deactivated, uninstalled, or replaced.
Fixed positioning at the bottom-right corner of the viewport (24px margin from the edges).
A managed z-index above dashboard content and the standard toast layer, below modal dialogs.

Component contract (extension responsibilities)
The registered component is the entire chatbot UI. It is responsible for:
The collapsed bubble state (icon, optional notification badge, hover/focus states).
The expanded panel state (header, conversation, composer, side panels).
All open/close transitions, keyboard shortcuts (e.g., Cmd+K to open), and accessibility (focus trap, ARIA labels, screen reader support).
All conversation state, message history, streaming, and persistence.
All LLM communication and tool execution.
Responsive behavior on narrow viewportsThe host does not inject styling or behavior into the registered component beyond what the standard namespaces provide.
Registration example

import { views, type ExtensionContext } from '@apache-superset/core';
import { ChatbotApp } from './ChatbotApp';

export function activate(context: ExtensionContext) {
const disposable = views.registerView(
{
id: 'acme.chatbot', // extension-namespaced, unique
name: 'Superset chatbot',
icon: 'Bubble',
},
'superset.chatbot',
() => <ChatbotApp />,
);

context.subscriptions.push(disposable);
}

The extension registers a single renderable provider into the
`superset.chatbot` contribution area.

The host resolves exactly one active chatbot provider and mounts it
at the application-shell level.

The chatbot needs an icon:
It identifies the chatbot in the admin "Default chatbot" picker (see §5) and in any contribution manifest listing, and it is the natural identity for the collapsed bubble.

The `View` interface in `@apache-superset/core` is `{ id, name, description?, icon? }`,
where `icon` is an optional host-resolved icon identifier (a `string`). The
registration example above already passes one (`icon: 'Bubble'`).

The remaining open concern is who owns the icon and whether it is mutable:

- (a) Static descriptor icon. `icon` is a fixed field on the `View` descriptor, set once at `registerView()` time and never changed.
  The host uses it for the admin picker / manifest listing.
  The collapsed bubble shown in the corner is still rendered by the extension component itself (see Component contract), so a static descriptor icon and a richer extension-rendered bubble can coexist:
  The descriptor icon identifies metadata, the bubble is a live UI.
- (b) Runtime-updatable icon.
  The chatbot owner can change its icon after registration — e.g. to reflect a notification/unread badge, a loading or "thinking" state, or dynamic rebranding.
  This requires more than a descriptor field: either a mutable handle returned from `registerView()` (e.g. `handle.setIcon(...)`) or a small chatbot-scoped API to update it.
  It also raises the question of where that icon is consumed — the admin picker would show a point-in-time value, while the bubble already updates freely because the extension renders it.

Recommendation: (a) for the descriptor `icon` — keep the registry field static and simple, since its only consumers are identity surfaces (picker, manifest) that do not need live updates.
Dynamic icon states (notification badge, thinking indicator) belong to the collapsed bubble, which the extension component already owns and re-renders on its own; they do not need to flow through the host descriptor.
If a concrete need emerges for the host to reflect a live chatbot icon outside the bubble, option (b) can be revisited in a follow-up rather than expanding `registerView` now.

State APIs the chatbot uses
The chatbot does not receive a dedicated host-managed state namespace.
It reads host state through the same public namespaces available to any other extension:
The table below distinguishes namespaces that **exist today** in `@apache-superset/core` from those this SIP **must add** as new work.

Namespace
Status
Purpose for the chatbot
sqlLab
Exists today
SQL Lab-specific APIs and state (`getCurrentTab()` and `onDidChange*` events)
authentication
Exists today
Current user Auth/session CSRF token for same-session requests the chatbot uses the user's existing browser session; no separate token is issued or sent
commands
Exists today
Host actions utilities
dashboard
NEW (added by this SIP)
Dashboard-specific APIs and state (current dashboard, filters, charts with visibility)

explore
NEW (added by this SIP)
Chart/explore-specific APIs and state (saved chart, current chart data)

dataset
NEW (added by this SIP)
Dataset-page identity (`getCurrentDataset()` + change event) — which dataset the user is viewing/editing; identity only, producer-backed via `setCurrentDataset`

navigation
NEW (added by this SIP)
Route/page surface, including the `onDidChangePage` change event

Namespaces this SIP must add — required core work, only `sqlLab`, `authentication`, `commands`, `menus` and `editors` currently exist in `@apache-superset/core` (`superset-frontend/packages/superset-core/src/`).

There was no `dashboard`, `explore`, `dataset`, or `navigation` namespace before
this SIP, and no `navigation.onDidChangePage` event — this SIP is what introduces
them. `dashboard`, `explore`, and `navigation` are now implemented; `dataset` is
specified here but not yet implemented (see Migration Plan).
Each new namespace must follow the established `sqlLab` shape: a
state getter plus an `Event<T>` change subscription. Concretely, this SIP requires
adding:

- `dashboard` namespace — `dashboard.getCurrentDashboard()` plus change events for
  the dashboard entity, its filters, and its charts.
- `explore` namespace — `explore.getCurrentChart()` (saved chart + current chart
  data) plus a change event.
- `navigation` namespace — a current-page getter (`pageType`) and
  the `navigation.onDidChangePage` event used for the without-polling notification
  in §2.
  Page context
  Per-surface namespaces
  The chatbot does not interact directly with the host application's internal state management implementation.
  Instead, each application surface exposes a dedicated namespace that provides a stable, host-managed API for that surface.
  These namespaces expose curated API types rather than internal implementation details such as Redux slices or component-local state.
  The purpose of the namespace layer is to:
  provide a stable extension contract
  normalize surface-specific context
  avoid coupling extensions to host implementation details
  preserve compatibility across future frontend architecture changes

For example, the host may evolve from Redux-based state management to another implementation in the future without requiring chatbot extensions to change, as long as the namespace contract remains stable.
Each namespace exposes normalized semantic context aligned with the current user's backend-authorized application view

Permission enforcement itself remains a backend concern — the namespace surfaces data that backend APIs have already scoped to the current user; it is not a security boundary of its own.

Page-type guarding
`explore.getCurrentChart()` and `dashboard.getCurrentDashboard()` both guard on
the current page type before reading Redux state. Each returns `undefined` when
the user is not on the corresponding surface, even though the Redux slices for
those surfaces remain initialized in the global store after navigation.

This guard is implemented via `navigation.getPageType()` at the top of each
`buildChartContext()` / `buildDashboardContext()` function:

if (navigation.getPageType() !== 'explore') return undefined;

Without this guard, `getCurrentChart()` would return a stale or empty chart
context on non-Explore pages because the `explore` Redux slice is always present
with an initial object. The guard enforces the documented API contract that each
getter returns `undefined` when not on the matching surface.

Namespace composition model

This SIP intentionally does not introduce a single aggregate context namespace.
Instead:
each surface exposes its own namespace
chatbot extensions compose those already-safe pieces into a higher-level PageContext

For example:

const pageContext = {
pageType: navigation.getPageType(),

dashboard: dashboard.getCurrentDashboard(),

sqlLab: sqlLab.getCurrentTab(),

chart: explore.getCurrentChart(),
};

The extension-side adapter assembles normalized semantic context fragments.
It does not derive or permission-filter entities itself.

Namespace API shape
Each namespace follows the established sqlLab API shape:
synchronous state getter(s)
Event<T>-style change subscriptions

This allows chatbot extensions to react to page-context changes without polling.

Example:

const dashboardContext = dashboard.getCurrentDashboard();

const disposable = dashboard.onDidChangeDashboard(nextDashboard => {
chatbot.updateContext({ dashboard: nextDashboard });
});

The new namespaces follow the sqlLab namespace shape, but not necessarily its implementation model.

Existing sqlLab namespace behavior
The existing sqlLab namespace (superset-frontend/src/core/sqlLab/index.ts) already implements the API shape that SIP generalizes. Internally it is a thin wrapper over Redux state (store.getState()), but that is an implementation detail — extensions consume the namespace contract, not the store, and must not rely on Redux being the backing source.
This SIP extends the same namespace-based model to additional surfaces (dashboard, explore, navigation), standardizing semantic context normalization behind a stable, extension-facing contract.
Permission enforcement is a backend concern
Authorization is enforced by the backend, not by these namespaces — this is the standard Superset data flow. Every frontend surface receives its state from backend APIs that already scope results to the current user's permissions, so the frontend application state only ever reflects backend-authorized responses. SQL Lab is the canonical example: DatabaseDAO declares base_filter = DatabaseFilter (superset/daos/database.py), which scopes database queries to the requesting user before any of that data reaches the frontend.
A context namespace therefore sits downstream of authorization. A getter such as dashboard.getCurrentDashboard() surfaces data the backend already permissioned for this user; it performs no derivation, joining, or filtering of its own, so it cannot widen access beyond what the API returned. The namespace is a stable read surface over an already-authorized state — not a security boundary, and it does not need to be one. The new namespaces follow this principle by construction.

Namespace normalization requirements

Each namespace getter must:
normalize application state into stable semantic extension-facing APIs
expose context aligned with backend authorization semantics
avoid exposing raw Redux structures or internal frontend implementation details
provide a stable abstraction layer independent of frontend state-management implementation details

For example, a native implementation such as:
// ❌ Avoid exposing internal host state directly

dashboard.getCurrentDashboard() {
return store.getState().dashboard;
}

would incorrectly expose internal dashboard state directly to extensions and would tightly couple extensions to the host implementation.
Instead, namespaces must expose normalized semantic context objects.

// ✅ Expose a stable semantic contract. Each field is normalized from a
//    distinct internal slice — the extension never sees raw Redux state:
//      dashboardId / title  ← dashboardInfo
//      filters              ← dataMask ∩ nativeFilters  (normalized FilterValue[])
//      charts               ← sliceEntities.slices      (normalized ChartSummary[],
//                             visibility resolved against dashboardLayout + activeTabs)
getCurrentDashboard(): DashboardContext | undefined {
  return { dashboardId, title, filters, charts };
}
// where each chart is reduced to a stable ChartSummary, mirroring ChartContext.
// All dashboard charts are returned; `isVisible` marks the ones on the active
// tab so extensions can find any chart by name yet still scope to what the user
// is currently viewing. Raw slices (nativeFilters, sliceEntities) are never
// exposed — only the normalized shapes above.
interface ChartSummary {
  chartId: number;
  chartName: string;
  vizType: string;
  datasourceId: number | null;
  datasourceName: string | null;
  isVisible: boolean;
}

Per-surface context contracts
Each namespace defines the semantic context contract exposed to extensions for that application surface.
Namespaces:
normalize frontend/application state into stable extension-facing APIs
expose only context relevant to that surface
avoid exposing unrelated implementation details or internal Redux structures
preserve the permission semantics already enforced by the backend APIs serving that surface
The namespace layer is therefore:
an abstraction boundary
a semantic normalization layer
a stable extension contract
It is not the primary authorization boundary; authorization remains enforced by backend APIs and Superset access-control mechanisms.
dashboard
dashboard.getCurrentDashboard() exposes:
dashboard identity
All dashboard charts, each flagged with its current visibility (active-tab) state
visible dashboard charts
dashboard filter state
semantic dashboard context relevant to chatbot integrations
The namespace should avoid exposing:
unrelated internal dashboard rendering structures
Redux-specific implementation details
internal entity graphs not intended as extension contracts
The dashboard context must remain aligned with the backend permission semantics of the dashboard APIs serving that surface.
explore
explore.getCurrentChart() exposes:
current chart identity
saved chart metadata
transient chart-editing context
semantic chart state relevant to the active Explore session
The namespace should avoid exposing:
unrelated chart entities
unrelated datasource metadata
frontend implementation-specific state structures

dataset
dataset.getCurrentDataset() exposes:
dataset identity for the dataset the user is
actively viewing or editing (e.g. on the dataset edit/creation pages):

interface DatasetContext {
datasetId: number;
datasetName: string; // table name or virtual dataset name
schema: string | null;
catalog: string | null;
databaseName: string | null;
isVirtual: boolean; // SQL-defined dataset vs physical table
}

This contract is intentionally identity-only — it does not embed the dataset's
columns. Column-level questions ("describe the columns of this dataset") are
resolved by the chatbot backend looking the dataset up by `datasetId`, not by
the frontend namespace. Likewise "which charts use this dataset" is a
backend/MCP lookup keyed by `datasetId`; the namespace's role is only to surface
which dataset is in focus.

Unlike the dashboard/explore namespaces — which read already-populated Redux
slices — this namespace is producer-backed: dataset page components publish the
current dataset via a host-internal `setCurrentDataset` as their entity loads,
and `getCurrentDataset()` returns `undefined` until they do. Wiring that producer
is required; a contract exposed without it would return nothing at runtime.

The namespace must remain aligned with backend-enforced dataset visibility and
column-access semantics.

navigation
navigation exposes lightweight routing and surface context:
page type
page-change events
It should not embed full entity payloads already exposed through other namespaces;
the focused entity itself is read from the per-surface namespace (e.g.
`dashboard.getCurrentDashboard()`), not from `navigation`.

Namespace compatibility
Namespace contracts are part of the public Superset extension API surface and follow the normal compatibility guarantees of @apache-superset/core.
Breaking changes to namespace contracts require standard deprecation and migration paths rather than silent behavioral changes.
Extensions should depend only on the documented namespace contracts and not on internal frontend implementation details.

Reusing existing permission logic
The backend scoping required above (notably the dashboard-context endpoint) must reuse the host's existing permission checks — the same ChartFilter / datasource-access and can_access logic already used by the API layer — rather than reimplementing parallel filtering logic. This ensures the context the chatbot receives cannot drift from the backend authorization model.

4. Design decision
   Host-derived context vs. chatbot-assembled context
   Multiple approaches were evaluated for how chatbot extensions receive page context.
   Option 1 — chatbot-assembled context
   The host exposes low-level primitives, routing information, and surface-specific state.
   Each chatbot extension independently derives:
   the current pageType
   the focused entity
   dashboard/chart/dataset context
   its own higher-level context object
   Option 2 — host-derived context (chosen)
   The host computes normalized, permission-safe per-surface context through stable extension namespaces.
   The chatbot consumes and composes those already-safe fragments into its own application-specific context.
   This SIP chooses Option 2.
   The primary reason is that context derivation, semantic normalization, and extension-facing context contracts should remain host-owned concerns rather than extension responsibilities.
   Under Option 1, each chatbot extension independently derives semantic context from low-level frontend state and routing information.
   While much of that state already originates from permission-checked backend APIs, the meaning and visibility semantics of that state vary by surface and are tightly coupled to internal frontend implementation details.
   This creates several problems:
   extensions become coupled to Redux structure and frontend internals
   semantic context derivation becomes inconsistent across chatbot implementations
   frontend architecture changes become breaking changes for extensions
   permission-aware normalization logic becomes duplicated across extensions
   Option 2 establishes a host-owned semantic normalization layer through stable extension namespaces.

The host computes and normalizes the exposed context — sourced from permission-scoped backend APIs before it reaches the extension, providing a stable semantic contract across application surfaces. Permission enforcement stays on the backend (where it already lives); the namespace layer provides normalization and a stable contract, not a security boundary.

Option 2 also provides:
stable, typed extension-facing contracts
semantic per-surface APIs
decoupling from frontend implementation details
compatibility with future frontend architecture changes
For example, the host may evolve away from Redux-based state management in the future without requiring chatbot extensions to change, as long as the namespace contracts remain stable.

Alternative evaluated: route-only / backend-derived context
A third approach was also evaluated.
Under this model:
the frontend exposes only routing information (URL + route params)
the chatbot backend or MCP server reconstructs context independently
all entity resolution happens server-side through APIs
This approach was rejected because it loses synchronization with unsaved frontend state and transient UI context.
For example:
unsaved chart edits in Explore
dashboard filter changes not yet persisted
temporary UI-control state
selected charts/tabs
local SQL editor changes
draft configuration changes
are all part of the user's active working context but may not yet exist in persisted backend state or be representable through the URL alone.
A route-only model would therefore cause the chatbot context to drift from what the user is actively seeing and editing in the frontend.
The chosen namespace-based model allows the chatbot to remain synchronized with live frontend state while still preserving stable, host-managed extension APIs.

Current namespace behavior
The existing sqlLab namespace already follows the general model introduced by this SIP:
backend APIs enforce authorization and visibility
frontend state reflects the user's authorized application state
the namespace layer exposes stable semantic extension-facing APIs over that state
This SIP extends that model to additional application surfaces such as:
dashboard
explore
dataset
navigation
The new namespaces introduced by this SIP are intended to provide:
stable semantic extension contracts
normalized page-context APIs
decoupling from frontend implementation details
compatibility across future frontend architecture changes
Some application surfaces may require dedicated context-oriented APIs to expose semantic chatbot context cleanly and consistently.
For example, dashboard chatbot context requires a stable representation of:
dashboard entities
dashboard filter state
the dashboard's charts (with visibility)
rather than direct exposure of internal frontend state structures.
The namespace layer therefore acts as:
a semantic normalization layer
a stable extension abstraction boundary
the public context-sharing API for chatbot extensions
Extensions consume namespace APIs rather than internal host state or frontend implementation details.

Tradeoffs accepted by this design
The cost of Option 2 is accepted intentionally.
The host must:
build and maintain the context derivation layer
expose new namespaces as additional application surfaces become extension-aware
evolve namespace contracts over time
Chatbot extensions are intentionally limited to the context exposed by those namespaces.
If additional context is required, the namespace contract must evolve explicitly rather than allowing extensions to depend on arbitrary host state directly.
That restriction is deliberate because it preserves:
stable extension contracts
implementation independence
centralized semantic normalization
consistent semantic context contracts aligned with backend authorization semantics

Extension-owned conversation state
All conversation state, message history, tool-call state, streaming buffers, and persistence remain entirely owned by the chatbot extension.
They are never reflected in:
the host Redux store
host-managed frontend state
shared application reducers
host persistence layers
The host owns page-context exposure only.
The chatbot owns all conversational runtime state.

Design considerations
The bubble must not occlude critical dashboard content. The host guarantees a safe zone in the corner, but the extension is responsible for not extending the expanded panel in a way that covers important UI on smaller viewports.
The host does not animate the bubble or panel — animation is the extension's responsibility, so each chatbot can have its own brand identity.
The chatbot extension is initialized as part of the application shell lifecycle so the bubble is available consistently across routes and can be invoked immediately by the user. Since extensions are delivered through Module Federation, chatbot implementations should still be mindful of remote bundle size and avoid expensive synchronous initialization work during activation or first render.
If the chatbot extension fails to load (Module Federation fetch error, runtime exception during activation), the host logs the error, shows a notification and leaves the corner empty rather than displaying a broken placeholder.

5. Open Questions

Per-page visibility. Should the chatbot extension declare which pages it's relevant for (e.g., "only show on dashboard and SQL Lab")?
Two options:
Extension hides itself via navigation.onDidChangePage events.
Extension declares page scopes in extension.json and the host enforces them.
The first is simpler and keeps the host policy-free; the second is more discoverable.

Generalizing the slot. Should superset.chatbot be a chatbot-specific area, or should it generalize to something like app.floating-action that could accept multiple stacked widgets (chatbot, tour guide, notification widget)?
My recommendation is to keep it chatbot-specific for now. If other floating-widget use cases emerge, introduce a separate contribution area rather than overloading this one.

6. Related Documents
   Contribution types
   Client actions

7. Migration Plan
   Base branch chat-prototype

Required core changes
Required core changes
The following are net-new additions to `@apache-superset/core` and the host that
this SIP depends on; they do not exist today and must land for the chatbot
extension point to be implementable:

- New `dashboard` namespace — current-dashboard getter plus change events for the
  dashboard entity, its filters, and its charts. Serves the `dashboard`
  page type. ✅ Implemented (`src/core/dashboard/index.ts`). ⚠️ The `charts` field
  on `DashboardContext` (with per-chart `isVisible`) is specified by this SIP but
  not yet implemented — the shipped contract is `{ dashboardId, title, filters }`.

- New `explore` namespace — current-chart getter (saved chart + chart data) plus a
  change event. Serves the `explore` page type (Explore view).
  ✅ Implemented (`src/core/explore/index.ts`).

- New `dataset` namespace — current-dataset getter plus a change event. Serves the
  `dataset` page type. ❌ Not implemented. An earlier draft of this namespace
  (SDK type + host `src/core/dataset/index.ts`) was removed because the SDK
  exported a typed contract with no runtime producer behind it. Re-introducing it
  requires three things together: (1) restore the SDK `DatasetContext` type and
  re-export it from `@apache-superset/core`, (2) restore the host impl with
  `setCurrentDataset`, and (3) wire a dataset page component to call
  `setCurrentDataset` as its entity loads. The contract is identity-only — see the
  `dataset` per-surface section.

- New `navigation` namespace — current-page getter and the `onDidChangePage` event.
  ✅ Implemented (`src/core/navigation/index.ts`).

- Semantic normalization and stable extension-facing contracts for the new
  `dashboard`, `explore`, and `navigation` namespaces. ✅ Implemented (`dataset`
  excluded — not yet implemented, see above). Both `explore` and `dashboard`
  getters are guarded by `navigation.getPageType()` to return `undefined` when the
  user is not on the matching surface, enforcing the documented API contract.
  ⚠️ The `charts` field on `DashboardContext` (with per-chart `isVisible`) is
  specified by this SIP but not yet implemented — the shipped contract is
  `{ dashboardId, title, filters }`.

  This work also includes the permission-scoped dashboard-context backend
  endpoint required to align dashboard chatbot context with existing
  Superset authorization semantics (§2.1). ⚠️ Pending.

- New app-root contribution scope in the manifest schema (`ViewContributions`) so
  `superset.chatbot` can be declared in `extension.json` (currently SQL-Lab-only).
  ⚠️ Pending.

- Host-side exclusive-location resolution — `getViewProvider(location, id)`
  (`src/core/views/index.ts`) plus `getActiveChatbot(adminSelectedId, enabledMap)`
  (`src/core/chatbot/index.ts`). ✅ Implemented. `getViews` returns descriptors only;
  the provider accessor and chatbot resolver are host-internal and not part of the
  extension-facing contract.

- Admin setting for singleton conflict resolution (the "Default chatbot" picker,
  §5 option (c)). ✅ Implemented — Extensions page (`/extensions`) with star icon
  per chatbot row; persisted via `GET/PUT /api/v1/extensions/settings`
  (`active_chatbot_id` field).

- New `icon` field on the `View` descriptor interface (§3.2) — required for the
  admin picker and manifest listing. ⚠️ Pending. The Extensions page currently
  identifies chatbots by name only.
  Open decision before implementation: whether the field is static (set at `registerView()`) or runtime-updatable by the chatbot owner; this SIP recommends static.

8. Phases
   The required core changes above are sequenced into the following phases. Tickets
   must reference these phase numbers (P1–P4) — there is no other phase numbering for
   this SIP.

- P1 — Mount point & registration. ✅ Complete. The `superset.chatbot` contribution
  area, host-side exclusive-location resolution (`getViewProvider` /
  `getActiveChatbot`), eager mount at the app shell, fault isolation at the mount
  boundary (via `ErrorBoundary` wrapping `ChatbotRenderer`), and the extension
  lifecycle/teardown contract (`Disposable` cleanup, all namespace registrations
  collected during activation and disposed on deactivation).
  ⚠️ Open item: whether teardown needs an async-aware hook (e.g.
  `deactivate(): Promise<void>`) in addition to the synchronous `Disposable`,
  since `Disposable.dispose()` is not awaited. Still unresolved.
  ⚠️ Open item: app-root contribution scope in `ViewContributions` manifest schema
  so `superset.chatbot` can be declared in `extension.json`. Still pending.

- P2 — Admin & singleton selection. ✅ Complete. The "Default chatbot" admin
  setting (star icon in Extensions page), admin enable/disable behavior, and
  live settings sync without page reload (`subscribeToExtensionSettings` pub/sub).
  ⚠️ Remaining: `icon` field on `View` descriptor — admin picker currently uses
  extension name only.

- P3 — Context namespaces. ⚠️ Partially complete. `dashboard`, `explore`, and
  `navigation` namespaces implemented with page-type guards on `explore` and
  `dashboard`. ⚠️ Remaining: the `dataset` namespace (not yet implemented — restore
  SDK type + host impl, then wire `setCurrentDataset` into a dataset page), the
  `charts` field on `DashboardContext`, and the permission-scoped dashboard-context
  backend endpoint (§2.1).

- P4 — Navigation/client-action commands. Out of this SIP's scope — owned by the
  client-actions SIP (Justin Park).
