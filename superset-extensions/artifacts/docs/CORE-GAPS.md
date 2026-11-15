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

# Core gaps: what Superset core still needs (S1 to S14)

The extension builds on the Canvas widget framework (branch
`msyavuz/feat/canvas`) and the Superset Artifacts SDK. This page lists every
Superset core work item of the proposal (§5), with its status on this branch:

- **Implemented here:** a small change on this branch, in its own commit, that
  leaves the default behaviour unchanged.
- **Scaffolded:** the extension carries a stand-in until core has the piece.
- **Documented only:** no core change here; the pointers and next steps below.

Line numbers refer to this branch. Superset's own test suite wasn't run for
the implemented items (it needs a full environment); instead, each one was
checked against the code it replaces (see "Verified" under each), and the
tests to add or update are listed.

| ID | Piece | What | Status |
|---|---|---|---|
| S1 | 5.2 | Canvas and the widget framework merged into master | Documented only |
| S2 | 5.2 | Draft context and a public data hook for extension renderers | Implemented here (draft token); the rest documented |
| S3 | 5.1 | `DataBinding` public in `superset_core` | Documented only |
| S4 | 5.2 | Namespaced renderer ids, checked for collisions | Implemented here (a warning on replacement); the rest documented |
| S5 | 5.2 | Props validated on every write path; no data for unregistered types | Documented only |
| S6 | 5.2 | A switch per widget type | Implemented here (listing and add operations); the rest documented |
| S7 | 5.2 | Large props kept out of the canvas read tools | Documented only |
| S8 | 5.3 | Several named data bindings per widget | Implemented here (choosing `bindings[name]`); the rest documented |
| S9 | 5.3 | Cross-filtering and data events for extension widgets | Documented only |
| S10 | 5.4 | Hardened extension storage | Scaffolded (the extension's storage backend) |
| S11 | 5.1 | A request-time extension context; MCP decorators that survive without MCP | Scaffolded (an import guard) |
| S12 | 5.5 | Extensions declare the CSP they need | Documented only |
| S13 | 5.9 | The "no code artifacts" MCP instruction, conditional | Implemented here |
| S14 | 5.8 | Artifact guest tokens, `embedArtifact()`, guests on Canvas | Documented only |

## S1: Canvas and the widget framework on master

- **Need:** everything here depends on SIP-231 (#44875) and SIP-232 (#44989).
- **Status:** documented only. The code is on `msyavuz/feat/canvas`, which
  this branch stacks on: `superset/canvas/`, `superset/widgets/`,
  `superset-core/src/superset_core/widgets/` and
  `superset-frontend/src/features/canvas/`.
- **Next:** land the Canvas branch; then rebase the SDK and this extension.

## S2: draft context and a public data hook for extension renderers

- **Implemented:** `CanvasWidgetProps.draftToken`, optional
  (`superset-frontend/packages/superset-core/src/canvas/index.ts:107`), passed
  by the grid from the value it provides as the draft context
  (`superset-frontend/src/features/canvas/CanvasGrid.tsx:492`). The artifact
  renderer sends it as `X-Canvas-Draft` to the frames and placement data
  endpoints.
- **Verified:** no built-in renderer spreads its props onto the DOM, and the
  prop is `undefined` when no draft is open. A type-check of the extension's
  frontend against this file passes, and fails on a misspelled prop.
- **Pending:**
  - the previewed version (`CanvasVersionContext`, `useWidgetRows.ts:33`) as a
    prop too;
  - SIP-231 §9's public `useWidgetData` hook, so that extension renderers don't
    call the placement endpoint themselves;
  - a public way to resolve a placement's stored props on the server. The
    extension's `frames/placement.py` mirrors
    `GetPlacementDataCommand.validate`
    (`superset/commands/canvas/placement_data.py`) through host internals.
- **Tests to add:** `CanvasGrid.test.tsx`: a renderer receives `draftToken`
  when the grid has one, and `undefined` otherwise.

## S3: `DataBinding` in `superset_core`

- **Need:** extensions re-declare the binding shape, or import the host's
  `superset/widgets/controls.py:49` (`DataBinding`), which isn't a public API.
- **Status:** documented only. The extension maps manifest bindings to plain
  `dataBinding` dicts (`backend/src/superset_oss/artifacts/data/bindings.py`,
  `resolve_binding`).
- **Next:** move `DataBinding` and `SortKey` into `superset_core.widgets`, next
  to `MetricControl` (`superset-core/src/superset_core/widgets/composites.py`),
  and re-export them from the host module.

## S4: namespaced renderer ids, checked for collisions

- **Implemented:** `registerWidgetRenderer` logs a warning when a type that has
  a different renderer gets a new one
  (`superset-frontend/src/core/canvas/index.ts:42`). The newer renderer still
  wins, as before; registering the same component again stays silent.
- **Pending:** prefix frontend renderer ids per extension, as the backend does
  (`superset/core/api/core_api_injection.py`), and refuse to replace built-in
  renderers. Until then the extension registers under its full id.
- **Tests to update:** `src/core/canvas/canvas.test.ts`: "disposing a replaced
  renderer keeps the newer one" now logs the warning; assert it there, and add
  that re-registering the same component doesn't warn.

## S5: props validated on every write path

- **Need:** `POST` and `PUT /api/v1/widget/` validate neither props nor type
  (`superset/widgets/api.py:245`, `:295`); committing a draft saves widget props
  without validating them again (`superset/commands/canvas/draft.py:491`); the
  data route runs a stored binding for an unregistered type.
- **Artifacts in particular:** nothing checks, when a placement is written,
  that its author may read the artifact it names. Viewers then reach the
  artifact's published versions through that placement
  (`frames/access.py`). Extension widgets need a write-time hook to check
  their props semantically.
- **Status:** documented only; it touches several write paths.

## S6: a switch per widget type

- **Implemented:** `CANVAS_DISABLED_WIDGET_TYPES` (`superset/config.py:1390`),
  empty by default, read through `disabled_widget_types()`
  (`superset/canvas/definition/registry.py:40`), which answers an empty set
  outside an app context. Disabled types are left out of
  `GET /api/v1/widgets/types` (`superset/widgets/types_api.py:75`) and of the
  `list_widget_types` MCP tool
  (`superset/mcp_service/widgets/tool/list_widget_types.py:62`), and
  `placement_issues` (`superset/commands/canvas/apply_ops.py:91`) refuses an
  add operation that uses one, by type or by placing a widget of that type by
  UUID.
- **Why there:** `placement_issues` runs on new operations only, for REST and
  MCP writes to drafts and to canvases. A check inside `apply_operations`
  would also run on undo, redo and commit, which replay a draft's history, and
  break drafts that added a type before it was turned off.
- **Verified:** the old and new `placement_issues` give identical results on
  518 operation lists with the set empty; with a type disabled, both kinds of
  add are refused and an inaccessible widget is still reported once.
- **Pending:** enforcement at render time, on full-definition writes (creating
  or updating a canvas with a whole definition), and on the control-schema and
  validate endpoints; a per-workspace switch and a kill switch (P8).
- **Tests to add:** `placement_issues` with the config set (by type, by UUID);
  the types API and `list_widget_types` leaving a disabled type out.

## S7: large props kept out of the canvas read tools

- **Need:** `get_canvas`, `get_canvas_draft`, `get_widget_info` and
  `list_widgets` return every widget's full props and fail above 50 KB
  (`superset/mcp_service/constants.py:31`).
- **Status:** documented only. Artifact props hold only a reference (DR-02), so
  artifacts stay small; other large widgets still hit the limit.
- **Next:** summarize or omit props above a size in the read tools
  (`superset/mcp_service/canvas/tool/get_canvas.py` and its siblings).

## S8: several named data bindings per widget

- **Implemented:** the placement data request takes an optional `binding`
  (`superset/canvas/data.py:53`). When the placement's props declare
  `bindings[name]`, `GetPlacementDataCommand` runs it
  (`superset/commands/canvas/placement_data.py:88`), as the caller and
  narrowed by the runtime filters on its dataset; the answer's dataset carries
  the name (`superset/canvas/api.py:1013`). Without a name, `dataBinding` runs
  as before. A name the props don't declare answers 422, "no data binding":
  falling back to `dataBinding` would answer with other data than was asked
  for.
- **Verified:** the old and new command choose the same binding, or refuse the
  same way, for 16 shapes of props without a name; the request model rejects
  an empty or non-string name and still forbids unknown fields.
- **Pending:**
  - **a widget-level binding hook.** An artifact's props hold only its id and
    version (DR-02), so `props.bindings` never holds its bindings. The endpoint
    needs to ask the widget type for `bindings[name]`, for example a
    `Widget.data_binding(props, name)` class method, which the artifact widget
    implements with `data/bindings.py` (`resolve_binding`) on the manifest of
    the placed version. Until then an artifact's frame gets no data on a
    canvas.
  - saved-chart and semantic-view sources, typed parameters (so that `query`
    can send values), and results with metric definitions and formats;
  - the MCP `get_canvas_data` and `preview_widget` tools, which still read
    `dataBinding` only.
- **Tests to add:** the command with a declared name, an undeclared name (422)
  and no name; the API passing `binding` and naming the dataset.

## S9: cross-filtering and data events for extension widgets

- **Need:** cross-filters reach other widgets only while the canvas turns them
  on (`superset-frontend/src/features/canvas/CanvasGrid.tsx:499`), which the Q4
  MVP left off; there are no standard event kinds.
- **Status:** documented only; it needs a product decision with the Canvas
  owners (open question 2).
- **Meanwhile:** the renderer maps a declared cross-filter onto the filter bus
  shape (`{datasetId, column, values}`) and publishes other events as
  `superset-oss.artifacts.<kind>`.
- **Next:** standard kinds (cross-filter, selection, highlight, drill) for
  every widget, and cross-filters on for artifacts; review finding T1 adds
  accepting only values the host delivered.

## S10: hardened extension storage

- **Need:** compare-and-swap writes (`superset/extensions/storage/persistent_dao.py:543`
  only sets); REST exposure scoped to a resource's rows (the storage REST API
  serves an extension's shared rows to any caller with the permission,
  `superset/extensions/storage/api.py`, `?shared=true`); per-resource quotas;
  resource fields in `PersistentSetOptions`
  (`superset-core/src/superset_core/extensions/storage/persistent.py`).
- **Status:** scaffolded. `store/extension_storage_backend.py` implements the
  store on extension storage, verifies content against its hash on read, and
  tags refs with the artifact as their resource. It refuses to run unless the
  storage has an atomic `compare_and_set` (its `AtomicStorageAccessor` is the
  shape S10 would add), so `file_store_for` answers `NOT_ENABLED` unless the
  provider supplies a backend. Until the REST exposure is fixed, a direct write
  could move a ref past the user's confirmation, which is why it must not run.
- **Next:** add compare-and-swap with resource tags to the DAO and the
  accessor, scope the REST API, add quotas.

## S11: a request-time extension context; MCP decorators without MCP

- **Need:** the extension context is set only while the host imports the entry
  point (`superset/initialization/__init__.py:704`), so storage calls made while
  REST, MCP or task requests run can't find their extension. The `@tool`
  decorator imports the MCP app (`superset/core/mcp/core_mcp_injection.py:186`),
  so without the MCP extras it raises and would take the whole backend down.
- **Status:** scaffolded. The storage backend reports S11 when no context is
  reachable; the entry point imports the MCP tools and prompts inside an import
  guard, so a process without MCP still registers the widget and the REST APIs.
- **Next:** restore the context around each request, MCP call and task; make
  the decorators no-ops when MCP isn't installed.

## S12: extensions declare the CSP they need

- **Need:** the host page has to allow exactly the provider's sandbox origin in
  `frame-src`. Superset's default CSP has `default-src 'self'` and no
  `frame-src` (`superset/config.py`, `TALISMAN_CONFIG`; Talisman is on by
  default), so a frame on the sandbox domain is blocked until an operator adds
  it.
- **Status:** documented only; until then operators add the sandbox origin to
  `frame-src` in `TALISMAN_CONFIG` themselves (Preset's is P9).
- **Next:** a manifest field or provider method that declares CSP sources, which
  the host merges into its policy (PR, or part of SIP C).

## S13: the "no code artifacts" MCP instruction, conditional

- **Implemented:** `ARTIFACTS_ENABLED` (`superset/config.py:1396`), False by
  default. `get_default_instructions` takes `artifacts_enabled`
  (`superset/mcp_service/app.py:102`), and `init_fastmcp_server` passes it from
  the config when it is a literal `True` (`app.py:1239`). While on, the first
  tool-only rule (`_snippet_artifacts_allowed`, `app.py:92`, instead of
  `_SNIPPET_NO_CODE_ARTIFACTS`, `app.py:85`) lets agents write artifacts with
  the artifact tools after reading their prompt, and still forbids code for
  the user to run outside Superset.
- **Verified:** the instructions are byte-for-byte the same as before for 15
  combinations of branding and disabled tools with the flag off, and only the
  first rule changes with it on. Existing tests mock `config.get` to return the
  default for unknown keys, so `init_fastmcp_server` tests keep the old text.
- **Pending:** the proposal turns artifacts on only after SIP A. Review the
  other tool-only rules ("Do NOT generate HTML dashboards, embed scripts, or
  custom frontend code") for when the flag is on, and consider requiring a
  registered provider (`superset_core.artifacts.provider.artifacts_available`)
  as well.
- **Tests to add:** `tests/unit_tests/mcp_service/test_mcp_config.py`: with
  `artifacts_enabled=True` the "Do NOT generate code artifacts" rule is gone;
  `init_fastmcp_server` passes `ARTIFACTS_ENABLED`.

## S14: artifact guest tokens and standalone embedding

- **Need:** guest tokens know only dashboards
  (`superset/security/guest_token.py:253`, `GuestTokenResourceType`); the
  embedded SDK has `embedDashboard` only
  (`superset-embedded-sdk/src/index.ts:204`); the embedded routes serve
  dashboards (`superset/embedded/view.py`, `/embedded/<uuid>`); Canvas has no
  guest support.
- **Status:** documented only. The extension's standalone host endpoint is a
  scaffold for logged-in owners at
  `/extensions/superset-oss/artifacts/embedded/artifact/<uuid>`: extensions
  mount only under `/extensions/<publisher>/<name>/` and can't add pages, so
  `/embedded/artifact/<uuid>` and the route that renders `HostPage` need core.
- **Next:** an `artifact` resource type, `embedArtifact()`, a core route for
  the standalone host page, and a data endpoint that runs an artifact's
  bindings without a canvas placement (with S8).
