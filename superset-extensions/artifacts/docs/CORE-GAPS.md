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
`msyavuz/feat/canvas`, [#45022](https://github.com/apache/superset/pull/45022))
and the Superset Artifacts SDK. This page lists what Superset core still needs
for artifacts, where each item stands on this branch, and where it is
decided:

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
| [Namespaced renderer ids, checked for collisions](#namespaced-renderer-ids-checked-for-collisions) | Implemented here (a second renderer refused); the rest documented |
| [Props validated on every write path](#props-validated-on-every-write-path) | Documented only |
| [A switch per widget type](#a-switch-per-widget-type) | Implemented here (listing and add operations); the rest documented |
| [Large props kept out of the canvas read tools](#large-props-kept-out-of-the-canvas-read-tools) | Documented only |
| [Several named data bindings per widget](#several-named-data-bindings-per-widget) | Implemented here (every named dataset in one response, the queries a widget type builds); the rest documented |
| [A saved widget's data without a canvas](#a-saved-widgets-data-without-a-canvas) | Implemented here |
| [Cross-filtering and data events for extension widgets](#cross-filtering-and-data-events-for-extension-widgets) | Documented only |
| [Hardened extension storage](#hardened-extension-storage) | Implemented here (compare-and-swap); scaffolded (the extension's storage backend); the rest documented |
| [A request-time extension context; MCP decorators without MCP](#a-request-time-extension-context-mcp-decorators-without-mcp) | Scaffolded (an import guard) |
| [Extensions declare the CSP they need](#extensions-declare-the-csp-they-need) | Not a core ask (operators configure `TALISMAN_CONFIG`) |
| [Routes that a link authenticates, exempt from CSRF](#routes-that-a-link-authenticates-exempt-from-csrf) | Not a core ask (each API's `csrf_exempt`) |
| [The "no code artifacts" MCP instruction, conditional](#the-no-code-artifacts-mcp-instruction-conditional) | Implemented here |
| [Artifact guest tokens and standalone embedding](#artifact-guest-tokens-and-standalone-embedding) | Not core asks |

## Canvas and the widget framework on master

- **Need:** everything here depends on
  [SIP-231](https://github.com/apache/superset/issues/44875) and
  [SIP-232](https://github.com/apache/superset/issues/44989).
- **Status:** documented only. The code is on `msyavuz/feat/canvas`
  ([#45022](https://github.com/apache/superset/pull/45022)), which this branch
  builds on: `superset/canvas/`, `superset/widgets/`,
  `superset-core/src/superset_core/canvas/`,
  `superset-core/src/superset_core/widgets/` and
  `superset-frontend/src/features/canvas/`.
- **Next:** land the Canvas branch
  ([#45022](https://github.com/apache/superset/pull/45022)); this extension,
  with its SDK, then builds on master.

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
- **Pending**, in the Canvas branch
  ([#45022](https://github.com/apache/superset/pull/45022)):
  - the previewed version (`CanvasVersionContext`, `useWidgetRows.ts`) as a
    prop too, and in the `superset_core` lookup, so that an extension
    renderer can read a version preview;
  - the public `useWidgetData` hook of
    [SIP-231](https://github.com/apache/superset/issues/44875) §10, so that
    extension renderers don't call the placement endpoint themselves.

## `DataBinding` in `superset_core`

- **Need:** extensions re-declare the binding shape, or import the host's
  `DataBinding` (`superset/widgets/controls.py`), which isn't a public API.
- **Status:** documented only. The extension maps manifest bindings to plain
  `dataBinding` dicts (`backend/src/superset_oss/artifacts/data/bindings.py`,
  `resolve_binding`).
- **Next:** move `DataBinding` and `SortKey` into `superset_core.widgets`, next
  to `MetricControl` (`superset-core/src/superset_core/widgets/composites.py`),
  and re-export them from the host module, in the Canvas branch
  ([#45022](https://github.com/apache/superset/pull/45022)).

## Namespaced renderer ids, checked for collisions

- **Implemented:** `registerWidgetRenderer` throws when a type that has a
  renderer gets a different one (`superset-frontend/src/core/canvas/index.ts`),
  as the server refuses a widget type that is taken and as
  [SIP-231](https://github.com/apache/superset/issues/44875) §2 has it; the
  type takes another renderer once its own is disposed, and registering the
  same component again is allowed.
- **Tests:** `src/core/canvas/canvas.test.ts` (a type that has a renderer
  refuses another; registering the same component again is allowed; added,
  not run here).
- **Limit:** frontend renderer ids aren't namespaced per extension, as the
  backend's are (`superset/core/api/core_api_injection.py`) and as [SIP-231](https://github.com/apache/superset/issues/44875) §2
  has them (`extensions.<publisher>.<name>.<widget id>`), so an extension can
  take a built-in type. Built-in renderers register only when the Canvas page
  loads (`registerBuiltinRenderers`, called by `src/pages/Canvas/index.tsx`),
  which can be after extensions have: the built-in's registration then
  throws, and the Canvas page fails to load. This extension registers under
  its full id, so it takes no built-in type.
- **Pending**, in the Canvas branch
  ([#45022](https://github.com/apache/superset/pull/45022)): prefix frontend
  renderer ids per extension, or register the built-in renderers before
  extensions load.

## Props validated on every write path

- **Need:** [SIP-231](https://github.com/apache/superset/issues/44875) §6
  validates every write. `POST` and `PUT /api/v1/widget/` check the type and
  the props (`entity_props`, `superset/canvas/definition/ops.py`), but
  committing a draft saves its widgets without validating their props again
  (`save_widgets`, `superset/commands/canvas/apply_ops.py`), and the data
  route runs a stored `dataBinding` for an unregistered type
  (`widget_queries`, `superset/commands/canvas/placement_data.py`). Extension
  widgets also need a write-time hook to check their props semantically.
- **Artifacts in particular:** placing an artifact's widget by its UUID needs
  its author to be able to read that widget (`placeable`, checked by
  `placement_issues` and by canvas creation). Viewers then reach the
  artifact's published version through that placement, as for any widget a
  canvas places (`frames/api.py`).
- **Status:** documented only; it touches several write paths of the Canvas
  branch ([#45022](https://github.com/apache/superset/pull/45022)).

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
- **Pending**, in the Canvas branch
  ([#45022](https://github.com/apache/superset/pull/45022)): enforcement at
  render time, on full-definition writes (creating or updating a canvas with a
  whole definition), and on the control-schema and validate endpoints; a
  per-workspace switch and a kill switch.

## Large props kept out of the canvas read tools

- **Need:** `get_canvas`, `get_canvas_draft`, `get_widget_info` and
  `list_widgets` return every widget's full props and fail above 50 KB
  (`DEFAULT_MAX_RESPONSE_BYTES`, `superset/mcp_service/constants.py`).
- **Status:** documented only. Artifact props are empty (the content is in
  the store), so artifacts stay small; other large widgets still hit the
  limit.
- **Next:** summarize or omit props above a size in the read tools
  (`superset/mcp_service/canvas/tool/get_canvas.py` and its siblings), in the
  Canvas branch ([#45022](https://github.com/apache/superset/pull/45022)).

## Several named data bindings per widget

- **Implemented:**
  - The placement data request takes only `runtime_filters`
    (`PlacementDataRequest`, `superset/canvas/data.py`), so the caller can't
    pick a query. `GetPlacementDataCommand` runs every query the widget type
    builds, as the caller and narrowed by the runtime filters, and answers
    each as the dataset of its name, all in one response
    (`superset/canvas/api.py`). A query that names no dataset is left out, a
    type that names a query twice fails, and one failing query fails the
    request.
  - The queries per widget type, `Widget.build_queries`
    (`superset_core.widgets.queries`), as
    [SIP-231](https://github.com/apache/superset/issues/44875) §2 has it: by
    default the props' `dataBinding`, as the dataset `main`. A type whose
    queries aren't in its props builds its own from a `QueryRequest`: the
    canvas, the placement and its props, the caller's draft token when the
    placement comes from their draft, and the UUID of the saved widget the
    placement holds (`widget_id`). What it builds gets the same checks and
    runs the same way, as the caller, through the chart data pipeline's
    access checks. The artifact widget builds a query for each live binding
    the policy admits, from the manifest of the version its frame loads
    (`data/queries.py`, which picks the version with `choose_version`).
- **Tests:** `tests/unit_tests/canvas/placement_data_test.py` (every query a
  type builds answers as a dataset of its name; a type the host doesn't know
  has its `dataBinding`; the caller can't pick a query; a built query is
  checked like one from the props, and runs as the caller, a denied dataset
  answering 403; a type that names a query twice fails; one failing query
  fails the request; a type learns the caller's draft); `test_ext_bindings.py`
  (an artifact's bindings come from the version its frame loads, each that
  would run is a query, the policy is checked on every query, and none runs
  from a version the caller may not see).
- **Pending:**
  - saved-chart and semantic-view sources, and results with metric
    definitions and formats, as
    [SIP-231](https://github.com/apache/superset/issues/44875) §7 and §8 have
    widgets query and receive data; typed parameters, so that `query` can
    send values;
  - the MCP `get_canvas_data` and `preview_widget` tools, which still read
    `dataBinding` only, in the Canvas branch
    ([#45022](https://github.com/apache/superset/pull/45022));
  - the data errors' mapping onto `canvas_query_error`, once
    [#46250](https://github.com/apache/superset/pull/46250) merges.

## A saved widget's data without a canvas

- **Implemented:** `POST /api/v1/widget/<uuid>/data` (`superset/widgets/api.py`,
  `GetWidgetDataCommand` in `superset/commands/widget/data.py`), the data
  endpoint for a saved widget of
  [SIP-231](https://github.com/apache/superset/issues/44875) §8. It takes only
  `runtime_filters`, and runs every query the widget's type builds (by
  default its stored `dataBinding`, as `main`), as the caller, narrowed by the
  runtime filters: the placement endpoint's queries (`widget_queries`),
  runner and checks, and one datasets answer (`superset/canvas/data.py`).
  Reading needs read access to the widget, through `WidgetDAO`'s filter, and
  to its datasets; a widget without a query answers 422. A `QueryRequest` for
  a widget on its own names the widget and no canvas or placement.
- **Use here:** the artifact's page of its own runs its bindings through it,
  and the widget type builds them from the version that page's frame
  loads.
- **Tests:** `tests/unit_tests/widgets/data_test.py` (a reader runs the
  widget's own binding; a widget the caller can't read looks missing; a
  type's queries come from its builder; an unbound widget answers 422; the
  route's envelope, failures and malformed requests);
  `tests/unit_tests/canvas/placement_data_test.py` (the shared queries).

## Cross-filtering and data events for extension widgets

- **Need:** cross-filters reach other widgets only while the canvas has them
  on (its `crossFilters` setting, which `CanvasGrid` reads).
- **Status:** documented only; whether cross-filters should be on for
  artifacts only or for every widget is for the Canvas listener bus to
  decide ([SIP-232](https://github.com/apache/superset/issues/44989) §5, and
  [SIP-231](https://github.com/apache/superset/issues/44875) §9 for what a
  widget emits).
- **Meanwhile:** cross-filters are the only event an artifact emits; the
  renderer maps a declared cross-filter onto the filter bus shape
  (`{datasetId, column, values}`).
- **Next:** cross-filters on for artifacts, and the filter bus in the
  `ExtraFormData` shape, in the Canvas branch
  ([#45022](https://github.com/apache/superset/pull/45022)).

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
  doesn't declare the `shared` accessor the host provides. Which rows the
  storage REST API serves, and backend-only storage, are under review in
  [#45894](https://github.com/apache/superset/pull/45894).
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
- **Next:** restore the context around each request, MCP call and task
  ([#45894](https://github.com/apache/superset/pull/45894) does it for
  extension REST APIs); make the decorators no-ops when MCP isn't installed.
  [#43842](https://github.com/apache/superset/pull/43842) makes them no-ops
  where the MCP service isn't loaded, but not where `fastmcp` is missing.

## Extensions declare the CSP they need

- **Need:** the host page has to allow exactly the provider's sandbox origin in
  `frame-src`. Superset's default CSP has `default-src 'self'` and no
  `frame-src` (`TALISMAN_CONFIG` in `superset/config.py`; Talisman is on by
  default), so a frame on the sandbox domain is blocked until an operator adds
  it.
- **Status:** not a core ask. Operators add the provider's frame sources to
  `frame-src` in `TALISMAN_CONFIG` themselves, as the README's "Host pages'
  CSP" shows; a host that sets its own policy adds them there. A runtime
  `frame-src` allowlist that admins edit without a restart is proposed in
  [#41468](https://github.com/apache/superset/pull/41468).

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
- **Limits:** while artifacts are on, the other tool-only rules that
  [#38391](https://github.com/apache/superset/pull/38391) added ("Do NOT
  generate HTML dashboards, embed scripts, or custom frontend code") stay as
  they are. A setting that answers `True` without this extension loaded still
  lifts the rule, which then names tools that aren't there.

## Artifact guest tokens and standalone embedding

- **Need:** guest tokens know only dashboards (`GuestTokenResourceType`,
  `superset/security/guest_token.py`); the embedded SDK has `embedDashboard`
  only (`superset-embedded-sdk/src/index.ts`); the embedded routes serve
  dashboards (`superset/embedded/view.py`, `/embedded/<uuid>`); Canvas has no
  guest support.
- **Status:** not core asks. A host adds the page that shows one artifact on
  its own, until extensions can contribute pages
  ([#45522](https://github.com/apache/superset/pull/45522)); the extension
  answers its frame link (`POST .../frames/`), and its data comes from the
  widget data endpoint (above). Guests would see artifacts through an
  embedded canvas that holds them, with the canvas guest tokens of
  [SIP-232](https://github.com/apache/superset/issues/44989) §12.
