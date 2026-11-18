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
| [A saved widget's data without a canvas](#a-saved-widgets-data-without-a-canvas) | Implemented here |
| [Cross-filtering and data events for extension widgets](#cross-filtering-and-data-events-for-extension-widgets) | Documented only |
| [Hardened extension storage](#hardened-extension-storage) | Implemented here (compare-and-swap); scaffolded (the extension's storage backend); the rest documented |
| [A request-time extension context; MCP decorators without MCP](#a-request-time-extension-context-mcp-decorators-without-mcp) | Scaffolded (an import guard) |
| [Extensions declare the CSP they need](#extensions-declare-the-csp-they-need) | Not a core ask (operators configure `TALISMAN_CONFIG`) |
| [Routes that a link authenticates, exempt from CSRF](#routes-that-a-link-authenticates-exempt-from-csrf) | Not a core ask (each API's `csrf_exempt`) |
| [The "no code artifacts" MCP instruction, conditional](#the-no-code-artifacts-mcp-instruction-conditional) | Implemented here |
| [Artifact guest tokens and standalone embedding](#artifact-guest-tokens-and-standalone-embedding) | Not core asks |

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
    `superset_core.canvas.placements.load_placed_widget(canvas_id,
    placement_id, draft_token)`, which the host injects
    (`inject_canvas_implementations`,
    `superset/core/api/core_api_injection.py`). It answers the saved widget
    the placement shows, as the canvas branch's types have it: its UUID and
    its `StoredWidget`, as the canvas or the draft resolves it. It raises
    `PlacementNotFoundError` for a canvas, draft or placement the caller can't
    read, and for a placement that stores its own content. The extension's
    frame links (`frames/placement.py`) use it, so the extension imports
    nothing from the host.
  - `superset_core.canvas.placements.get_widget_resolver()`: the canvas
    branch's `WidgetResolver`, which the host injects too. An extension reads
    its widgets through `WidgetDAO`'s access filter, and asks the resolver
    who may change them (`editable`: admins and the widget's editors, through
    roles and groups, never guests).
- **Tests:** `CanvasGrid.test.tsx` (a renderer gets the draft's token, and
  `undefined` without a draft; added, not run here, as this checkout has no
  `node_modules`); `tests/unit_tests/canvas/placement_data_test.py` (a
  placement loads with its widget type and props; the injected lookup reads
  its saved widget too, and raises `PlacementNotFoundError` for what the
  caller can't read; the injected resolver answers `editable`);
  `test_ext_imports.py` (the extension imports nothing from `superset`).
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
    the canvas, the placement and its props, the name, the caller's draft
    token when the placement comes from their draft, and the UUID of the
    saved widget the placement holds (`widget_id`). The binding it answers
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

## A saved widget's data without a canvas

- **Implemented:** `POST /api/v1/widget/<uuid>/data` (`superset/widgets/api.py`,
  `GetWidgetDataCommand` in `superset/commands/widget/data.py`), SIP-231's
  data endpoint for a saved widget. It runs the widget's stored `dataBinding`,
  or a named binding from its widget type's resolver or its props, as the
  caller, narrowed by runtime filters on the binding's dataset: the placement
  endpoint's binding selection (`select_binding`), runner and checks, and one
  datasets answer (`superset/canvas/data.py`). Reading needs read access to
  the widget, through `WidgetDAO`'s filter, and to its dataset; a widget
  without the binding answers 422. A `BindingRequest` for a widget on its own
  names the widget and no canvas or placement.
- **Use here:** the artifact's page of its own runs its bindings through it,
  and the binding resolver reads them from the version that page's frame
  loads.
- **Tests:** `tests/unit_tests/widgets/data_test.py` (a reader runs the
  widget's own binding; a widget the caller can't read looks missing; a named
  binding comes from the type's resolver; an unbound widget answers 422; the
  route's envelope, failures and malformed requests);
  `tests/unit_tests/canvas/placement_data_test.py` (the shared selection).

## Cross-filtering and data events for extension widgets

- **Need:** cross-filters reach other widgets only while the canvas has them
  on (its `crossFilters` setting, which `CanvasGrid` reads).
- **Status:** documented only; whether cross-filters should be on for
  artifacts only or for every widget needs a decision with the Canvas
  maintainers.
- **Meanwhile:** cross-filters are the only event an artifact emits; the
  renderer maps a declared cross-filter onto the filter bus shape
  (`{datasetId, column, values}`).
- **Next:** cross-filters on for artifacts, and the filter bus in the
  `ExtraFormData` shape.

## Hardened extension storage

- **Implemented here:** a generic compare-and-swap write,
  `compare_and_set(key, expected, value)`, on both persistent accessors
  (`superset_core.extensions.storage.persistent`) and in
  `ExtensionStorageDAO` (`superset/extensions/storage/persistent_dao.py`). It
  compares the decoded value under the extension-wide lock that `set` takes,
  and commits inside it, so of two writers that read the same value only the
  first writes; `None` means the key must have no entry. It is validated and
  counted against the quota as `set` is.
- **Scaffolded:** `store/extension_storage_backend.py` keeps each ref and its
  history in one record, moved by one compare-and-swap, and rolls the older
  history into immutable chunks so that a record stays below the 1 MB value
  cap. It verifies content against its hash on read, and passes the SDK's
  backend conformance suite, also with small chunks. It still refuses to run
  (see the next gap), so the file store answers `NOT_ENABLED` unless the
  provider supplies a backend.
- **Need:** REST exposure scoped to a resource's rows (the storage REST API
  serves an extension's shared rows to any caller with the permission,
  `superset/extensions/storage/api.py`, `?shared=true`), so that a direct
  write can't move a ref past the user's confirmation; per-resource quotas;
  resource fields on the compare-and-swap write, so that a ref's record can be
  tagged with its artifact. The context's storage protocol
  (`ExtensionStorage.persistent` in `superset_core.extensions.context`) also
  doesn't declare the `shared` accessor the host provides.
- **Tests:** `tests/unit_tests/extensions/storage/test_persistent_dao.py` and
  `test_persistent.py` (the compare-and-swap's comparison, its lock and its
  validation); `backend/tests/test_ext_storage_backend.py`.

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
  default), so a frame on the sandbox domain is blocked until an operator adds
  it.
- **Status:** not a core ask. Operators add the provider's frame sources to
  `frame-src` in `TALISMAN_CONFIG` themselves, as the README's "Host pages'
  CSP" shows; a host that sets its own policy adds them there.

## Routes that a link authenticates, exempt from CSRF

- **Need:** the transfer routes take uploads from an agent's shell, which has
  no session and no CSRF token, so the upload route must be exempt from
  Flask-WTF's checks.
- **Status:** not a core ask. An extension's `RestApi` decides it per API:
  Flask-AppBuilder exempts an API's blueprint unless it sets
  `csrf_exempt = False`. The transfer API stays exempt, since the link is its
  only credential and it reads no cookie; the frame link and publish
  confirmation APIs, which take a browser session, set it to `False`.

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
      from superset_artifacts_sdk.registry import artifacts_available

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
  guest support.
- **Status:** not core asks. A host adds the page that shows one artifact on
  its own; the extension answers its frame link (`POST .../frames/`), and
  its data comes from the widget data endpoint (above). Guests
  would see artifacts through an embedded canvas that holds them, with canvas
  guest tokens, once Canvas has them.
