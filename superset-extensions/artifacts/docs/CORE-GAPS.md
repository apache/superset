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

# Core gaps: what Superset core still needs

The extension builds on the Canvas widget framework (branch
`msyavuz/feat/canvas`) and the Superset Artifacts SDK. This page lists what
Superset core still needs for artifacts, and where each item stands on this
branch:

- **Implemented here:** a small change on this branch, in its own commit, that
  leaves the default behaviour unchanged, with unit tests next to its
  neighbours.
- **Scaffolded:** the extension carries a stand-in until core has the piece.
- **Documented only:** no core change here; the pointers and next steps below.

| Gap | Status |
|---|---|
| [Canvas and the widget framework on master](#canvas-and-the-widget-framework-on-master) | Documented only |
| [Draft context, a data hook and a placement lookup for extension renderers](#draft-context-a-data-hook-and-a-placement-lookup-for-extension-renderers) | Implemented here (draft token, a placement lookup in `superset_core`); the rest documented |
| [`DataBinding` in `superset_core`](#databinding-in-superset_core) | Documented only |
| [Namespaced renderer ids, checked for collisions](#namespaced-renderer-ids-checked-for-collisions) | Implemented here (a warning on replacement); the rest documented |
| [Props validated on every write path](#props-validated-on-every-write-path) | Documented only |
| [A switch per widget type](#a-switch-per-widget-type) | Implemented here (listing and add operations); the rest documented |
| [Large props kept out of the canvas read tools](#large-props-kept-out-of-the-canvas-read-tools) | Documented only |
| [Several named data bindings per widget](#several-named-data-bindings-per-widget) | Implemented here (choosing `bindings[name]`, a binding hook per widget type); the rest documented |
| [Cross-filtering and data events for extension widgets](#cross-filtering-and-data-events-for-extension-widgets) | Documented only |
| [Hardened extension storage](#hardened-extension-storage) | Scaffolded (the extension's storage backend) |
| [A request-time extension context; MCP decorators without MCP](#a-request-time-extension-context-mcp-decorators-without-mcp) | Scaffolded (an import guard) |
| [Extensions declare the CSP they need](#extensions-declare-the-csp-they-need) | Implemented here |
| [The "no code artifacts" MCP instruction, conditional](#the-no-code-artifacts-mcp-instruction-conditional) | Implemented here |
| [Artifact guest tokens and standalone embedding](#artifact-guest-tokens-and-standalone-embedding) | Implemented here (standalone pages for extensions); the rest documented |

## Canvas and the widget framework on master

- **Need:** everything here depends on SIP-231 (#44875) and SIP-232 (#44989).
- **Status:** documented only. The code is on `msyavuz/feat/canvas`, which
  this branch stacks on: `superset/canvas/`, `superset/widgets/`,
  `superset-core/src/superset_core/widgets/` and
  `superset-frontend/src/features/canvas/`.
- **Next:** land the Canvas branch; then rebase the SDK and this extension.

## Draft context, a data hook and a placement lookup for extension renderers

- **Implemented:**
  - `CanvasWidgetProps.draftToken`, optional
    (`superset-frontend/packages/superset-core/src/canvas/index.ts`), which the
    grid passes from the draft it shows (`CanvasGrid`). The artifact renderer
    sends it as `X-Canvas-Draft` to the frames and placement data endpoints.
    Built-in renderers read the draft from context and ignore the prop, and
    it is `undefined` while no draft is open.
  - `load_placement` (`superset/commands/canvas/placement_data.py`): a
    placement's stored widget type and props, read from the canvas, the
    caller's draft or a version, with the canvas's access rules.
    `GetPlacementDataCommand` uses it.
  - The same lookup for extensions:
    `superset_core.canvas.placements.load_placement(canvas_id, placement_id,
    draft_token)`, which the host injects (`inject_canvas_implementations`,
    `superset/core/api/core_api_injection.py`). It answers a
    `StoredPlacement`, and raises `PlacementNotFoundError` for a canvas, draft
    or placement the caller can't read. The extension's frame links
    (`frames/placement.py`) use it, so the extension imports nothing from the
    host.
- **Tests:** `CanvasGrid.test.tsx` (a renderer gets the draft's token, and
  `undefined` without a draft; added, not run here, as this checkout has no
  `node_modules`); `tests/unit_tests/canvas/placement_data_test.py` (a
  placement loads with its widget type and props; the injected lookup reads
  it too, and raises `PlacementNotFoundError` for what the caller can't
  read); `test_ext_imports.py` (the extension imports nothing from
  `superset`).
- **Pending:**
  - the previewed version (`CanvasVersionContext`, `useWidgetRows.ts`) as a
    prop too, and in the `superset_core` lookup, so that an extension
    renderer can read a version preview;
  - SIP-231 §9's public `useWidgetData` hook, so that extension renderers don't
    call the placement endpoint themselves.

## `DataBinding` in `superset_core`

- **Need:** extensions re-declare the binding shape, or import the host's
  `DataBinding` (`superset/widgets/controls.py`), which isn't a public API.
- **Status:** documented only. The extension maps manifest bindings to plain
  `dataBinding` dicts (`backend/src/superset_oss/artifacts/data/bindings.py`,
  `resolve_binding`).
- **Next:** move `DataBinding` and `SortKey` into `superset_core.widgets`, next
  to `MetricControl` (`superset-core/src/superset_core/widgets/composites.py`),
  and re-export them from the host module.

## Namespaced renderer ids, checked for collisions

- **Implemented:** `registerWidgetRenderer` logs a warning when a type that has
  a different renderer gets a new one (`superset-frontend/src/core/canvas/index.ts`).
  The newer renderer still wins, as before; registering the same component
  again stays silent.
- **Tests:** `src/core/canvas/canvas.test.ts` (replacing warns and keeps the
  newer renderer; registering the same component again doesn't warn; added,
  not run here).
- **Pending:** prefix frontend renderer ids per extension, as the backend does
  (`superset/core/api/core_api_injection.py`), and refuse to replace built-in
  renderers. Until then the extension registers under its full id.

## Props validated on every write path

- **Need:** `POST` and `PUT /api/v1/widget/` validate neither props nor type
  (`superset/widgets/api.py`); committing a draft saves widget props without
  validating them again (`superset/commands/canvas/draft.py`); the data route
  runs a stored binding for an unregistered type.
- **Artifacts in particular:** nothing checks, when a placement is written,
  that its author may read the artifact it names. Viewers then reach the
  artifact's published versions through that placement (`frames/access.py`).
  Extension widgets need a write-time hook to check their props semantically.
- **Status:** documented only; it touches several write paths.

## A switch per widget type

- **Implemented:** `CANVAS_DISABLED_WIDGET_TYPES` (`superset/config.py`), empty
  by default, read through `disabled_widget_types()`
  (`superset/canvas/definition/registry.py`), which answers an empty set
  outside an app context. Disabled types are left out of
  `GET /api/v1/widgets/types` (`superset/widgets/types_api.py`) and of the
  `list_widget_types` MCP tool, and `placement_issues`
  (`superset/commands/canvas/apply_ops.py`) refuses an add operation that uses
  one, by type or by placing a widget of that type by UUID.
- **Why there:** `placement_issues` runs on new operations only, for REST and
  MCP writes to drafts and to canvases. A check inside `apply_operations`
  would also run on undo, redo and commit, which replay a draft's history, and
  break drafts that added a type before it was turned off.
- **Tests:** `tests/unit_tests/canvas/api_test.py` (both kinds of add refused,
  an inaccessible widget still reported once), `tests/unit_tests/widgets/test_api.py`
  and `tests/unit_tests/mcp_service/widgets/tool/test_widget_tools.py` (a
  disabled type left out of the lists).
- **Pending:** enforcement at render time, on full-definition writes (creating
  or updating a canvas with a whole definition), and on the control-schema and
  validate endpoints; a per-workspace switch and a kill switch.

## Large props kept out of the canvas read tools

- **Need:** `get_canvas`, `get_canvas_draft`, `get_widget_info` and
  `list_widgets` return every widget's full props and fail above 50 KB
  (`DEFAULT_MAX_RESPONSE_BYTES`, `superset/mcp_service/constants.py`).
- **Status:** documented only. Artifact props hold only a reference, so
  artifacts stay small; other large widgets still hit the limit.
- **Next:** summarize or omit props above a size in the read tools
  (`superset/mcp_service/canvas/tool/get_canvas.py` and its siblings).

## Several named data bindings per widget

- **Implemented:**
  - The placement data request takes an optional `binding`
    (`PlacementDataRequest`, `superset/canvas/data.py`). When the placement's
    props declare `bindings[name]`, `GetPlacementDataCommand` runs it, as the
    caller and narrowed by the runtime filters on its dataset; the answer's
    dataset carries the name (`superset/canvas/api.py`). Without a name,
    `dataBinding` runs as before. A name the props don't declare answers 422,
    "no data binding": falling back to `dataBinding` would answer with other
    data than was asked for.
  - A binding hook per widget type, `Widget.binding_resolver`
    (`superset_core.widgets.bindings`), for a type whose props don't hold its
    named bindings. When the placement's type sets one, the command asks it
    for the name instead of reading `props.bindings`, with a `BindingRequest`:
    the canvas, the placement and its props, the name, and the caller's draft
    token when the placement comes from their draft. The binding it answers
    gets the same checks and runs the same way, as the caller, through the
    chart data pipeline's access checks; `None` answers 422, as an undeclared
    name does. `dataBinding` never goes through it. The artifact widget
    implements it from the manifest of the version its frame loads
    (`data/resolver.py`, which picks the version with `choose_version`).
- **Tests:** `tests/unit_tests/canvas/placement_data_test.py` (a declared name
  runs that binding and names the dataset; an undeclared one answers 422; an
  empty or non-string name answers 400; a null name runs `dataBinding`; a
  type's resolver answers its names instead of the props, learns the
  caller's draft and never answers for `dataBinding`; what it answers is
  checked like a binding from the props, and runs as the caller, a denied
  dataset answering 403); `test_ext_bindings.py` (an artifact's binding comes
  from the version its frame loads, and none runs from a version the caller
  may not see).
- **Pending:**
  - saved-chart and semantic-view sources, typed parameters (so that `query`
    can send values), and results with metric definitions and formats;
  - the MCP `get_canvas_data` and `preview_widget` tools, which still read
    `dataBinding` only.

## Cross-filtering and data events for extension widgets

- **Need:** cross-filters reach other widgets only while the canvas has them
  on (its `crossFilters` setting, which `CanvasGrid` reads), and there are no
  standard event kinds.
- **Status:** documented only; whether cross-filters should be on for
  artifacts only or for every widget needs a decision with the Canvas
  maintainers.
- **Meanwhile:** the renderer maps a declared cross-filter onto the filter bus
  shape (`{datasetId, column, values}`) and publishes other events as
  `superset-oss.artifacts.<kind>`.
- **Next:** standard kinds (cross-filter, selection, highlight, drill) for
  every widget, and cross-filters on for artifacts, accepting only values the
  host delivered.

## Hardened extension storage

- **Need:** compare-and-swap writes (`superset/extensions/storage/persistent_dao.py`
  only sets); REST exposure scoped to a resource's rows (the storage REST API
  serves an extension's shared rows to any caller with the permission,
  `superset/extensions/storage/api.py`, `?shared=true`); per-resource quotas;
  resource fields in `PersistentSetOptions`
  (`superset-core/src/superset_core/extensions/storage/persistent.py`). The
  context's storage protocol (`ExtensionStorage.persistent` in
  `superset_core.extensions.context`) also doesn't declare the `shared`
  accessor the host provides.
- **Status:** scaffolded. `store/extension_storage_backend.py` implements the
  store on extension storage, verifies content against its hash on read, and
  tags refs with the artifact as their resource; it passes the SDK's backend
  conformance suite against a fake of the storage it needs. It refuses to run
  unless the storage has an atomic `compare_and_set` (its
  `AtomicStorageAccessor` is the shape it expects), so the file store answers
  `NOT_ENABLED` unless the provider supplies a backend. Until the REST
  exposure is fixed, a direct write could move a ref past the user's
  confirmation, which is why it must not run.
- **Next:** add compare-and-swap with resource tags to the DAO and the
  accessor, scope the REST API, add quotas.

## A request-time extension context; MCP decorators without MCP

- **Need:** the extension context is set only while the host imports the entry
  point (`init_extensions`, `superset/initialization/__init__.py`), so storage
  calls made while REST, MCP or task requests run can't find their extension.
  Without the MCP extras, `initialize_core_mcp_dependencies`
  (`superset/core/mcp/core_mcp_injection.py`) leaves `superset_core`'s `@tool`
  and `@prompt` unimplemented, and they raise `NotImplementedError` when an
  extension applies them, which would take that extension's whole backend
  down.
- **Status:** scaffolded. The storage backend reports a missing context; the
  entry point imports the MCP tools and prompts behind a guard for
  `ImportError` and `NotImplementedError`, so a process without MCP still
  registers the widget and the REST APIs.
- **Next:** restore the context around each request, MCP call and task; make
  the decorators no-ops when MCP isn't installed.

## Extensions declare the CSP they need

- **Need:** the host page has to allow exactly the provider's sandbox origin in
  `frame-src`. Superset's default CSP has `default-src 'self'` and no
  `frame-src` (`TALISMAN_CONFIG` in `superset/config.py`; Talisman is on by
  default), so a frame on the sandbox domain is blocked.
- **Implemented:**
  - `add_csp_sources` (`superset-core/src/superset_core/extensions/csp.py`):
    an extension declares a function that returns source expressions by
    directive. The host calls it for each response that has a policy and
    merges the answer in (`superset/extensions/csp.py`).
  - It is a function, not a field in `extension.json`: the sandbox site is
    specific to a deployment and known only to the provider, which may be
    registered after startup.
  - Talisman sets its policy from the config before any extension loads, so
    the merge runs per response, in an `after_request` hook registered just
    before Talisman's (`configure_middlewares`): Flask runs those hooks in
    reverse, so it sees the policy Talisman set.
  - A source joins its directive without duplicates and replaces a `'none'`.
    A directive the policy leaves out starts from its fallback's sources
    (`frame-src` from `child-src`, then `default-src`), so nothing it allowed
    is lost; with no fallback, nothing restricts it, and it stays out.
  - Only `connect-src`, `font-src`, `frame-src`, `img-src`, `media-src` and
    `style-src` are open, and only sources that name a site:
    `scheme://host[:port]` with an `http`, `https`, `ws` or `wss` scheme, the
    host possibly `*.`-prefixed. `*`, bare schemes, keywords, nonces, hashes
    and paths are left out and logged once (`csp_source_problem`). These rules
    catch a declaration that would open the pages to every site; they aren't
    a boundary against an extension, whose code runs in the host.
  - With nothing declared, the header is never rewritten; with Talisman off,
    the hook isn't registered. The merge reads the header each response
    carries, so a view's own Talisman policy gets the sources too.
  - The extension declares the provider's `frame_sources()` (a provider role,
    `FrameSources` in `superset_core.artifacts.provider`) under `frame-src`
    while artifacts are on (`backend/.../frames/csp.py`).
- **Tests:** `tests/unit_tests/extensions/test_csp.py` (the merge rules; a bare
  Flask app with Talisman and Superset's default config, nothing declared or a
  frame source, report-only, and the hook's order; the app's own wiring);
  `superset-core/tests/extensions/test_extensions_csp.py` (which sources and
  directives pass); `backend/tests/test_ext_frame_csp.py`.
- **Pending:** a policy sent from outside Talisman, such as by a proxy, still
  needs the sources added by hand.

## The "no code artifacts" MCP instruction, conditional

- **Implemented:** `get_default_instructions` takes `artifacts_enabled`
  (`superset/mcp_service/app.py`), and a generic setting,
  `MCP_CODE_ARTIFACTS_ENABLED` (`superset/mcp_service/mcp_config.py`), turns
  it on. It is `False` by default, `True`, or a callable with no arguments
  that `CodeArtifactsInstructionsMiddleware` reads as each MCP session
  initializes. While it is on, the first tool-only rule
  (`_snippet_artifacts_allowed` instead of `_SNIPPET_NO_CODE_ARTIFACTS`) lets
  agents write artifacts with the artifact tools after reading their prompt,
  and still forbids code for the user to run outside Superset. Anything but
  `True`, and a callable that raises, keep the rule. Core imports nothing of
  this extension.
- **Turning it on:** the host points the setting at this extension's
  registry, so that the instructions and the tools follow the same switch:

  ```python
  def MCP_CODE_ARTIFACTS_ENABLED() -> bool:
      from superset_core.artifacts.provider import artifacts_available

      return artifacts_available()
  ```

- **Tests:** `tests/unit_tests/mcp_service/test_mcp_config.py` (only the first
  rule changes, and only while enabled; a static setting builds the server's
  instructions; a callable is read per session and fails closed;
  `DEFAULT_INSTRUCTIONS` keeps the rule against generating code).
- **Pending:** review the other tool-only rules ("Do NOT generate HTML
  dashboards, embed scripts, or custom frontend code") for when artifacts are
  on. A setting that answers `True` without this extension loaded still lifts
  the rule, which then names tools that aren't there.

## Artifact guest tokens and standalone embedding

- **Need:** guest tokens know only dashboards (`GuestTokenResourceType`,
  `superset/security/guest_token.py`); the embedded SDK has `embedDashboard`
  only (`superset-embedded-sdk/src/index.ts`); the embedded routes serve
  dashboards (`superset/embedded/view.py`, `/embedded/<uuid>`); Canvas has no
  guest support. Extensions can't add pages.
- **Implemented:** standalone pages for any extension, rather than an
  artifact route in core, which couldn't run the extension's own access
  checks.
  - `render_page` (`superset-core/src/superset_core/extensions/pages.py`,
    host side in `superset/extensions/pages.py`): one of the extension's REST
    endpoints answers Superset's app shell, without the menu, as the embedded
    dashboard view does with `spa.html`. The bootstrap data carries the
    page's id and string params under `extension_page`, nothing else.
  - `pages.registerPage` (`@apache-superset/core`, host side in
    `superset-frontend/src/core/pages/`): the extension's frontend registers
    the page's component. When the bootstrap data names a page, `App.tsx`
    renders it (`src/extensions/ExtensionPage.tsx`) in place of the routes,
    once the extensions load (`ExtensionsLoader.isInitialized`), and the
    extension placeholder if none registers it.
  - The extension serves its host page at
    `/extensions/superset-oss/artifacts/embedded/artifact/<uuid>/page`, with
    the same checks as the frame link it fetches (`embedding/access.py`).
- **Tests:** `tests/unit_tests/extensions/test_pages.py` (the shell renders
  `spa.html` naming the page; ids and params are checked);
  `superset-core/tests/extensions/test_extensions_pages.py`;
  `src/core/pages/pages.test.ts`, `src/extensions/ExtensionPage.test.tsx` and
  `ExtensionsLoader.test.ts` (added, not run here);
  `backend/tests/test_ext_embedding.py`.
- **Pending:**
  - an `artifact` resource type in guest tokens, and `embedArtifact()`; the
    page then takes a guest token as the embedded dashboard does, and the
    frame's allowed parents become the embedding's allowed domains;
  - a root route such as `/embedded/artifact/<uuid>`, which a core view could
    serve by delegating to the extension's endpoint;
  - a data endpoint that runs an artifact's bindings without a canvas
    placement, so the page can send data in;
  - the sign-in page, rather than the API's 401, for a visitor who isn't
    signed in.
