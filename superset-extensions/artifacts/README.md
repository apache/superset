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

# Artifacts extension enabler

The open-source host side of artifacts: small apps that an agent writes and
places on a Superset Canvas. An artifact's code is untrusted, so it runs only
in a sandboxed frame from a runtime provider, with no login and no network,
and it reaches Superset data only through its host, as the viewer.

This extension is a scaffold. It builds on the Superset Artifacts SDK
(`superset_core.artifacts` and `@apache-superset/artifact-sdk`) and on the
Canvas widget framework. **With no provider registered, artifacts are off**:
every tool, prompt and endpoint answers `NOT_ENABLED` and changes nothing. The
provider (the sandbox host, builds, packages, checks and storage at scale) is
the host's to supply.

## Identity

| What | Value |
|---|---|
| Publisher, name | `superset-oss`, `artifacts` (extension id `superset-oss.artifacts`) |
| Backend module | `superset_oss.artifacts` (entry point `superset_oss.artifacts.entrypoint`) |
| Widget type | `extensions.superset-oss.artifacts.artifact` |
| MCP tools and prompts | `extensions.superset-oss.artifacts.<name>` |
| REST APIs | `/extensions/superset-oss/artifacts/<resource>/...` |
| Module Federation name | `supersetOss_artifacts` |

**The publisher is a placeholder to decide before the first release.** Every id
above derives from it, so changing it later orphans every placed artifact
widget. Its module form must not be a top-level Python package that exists
already, such as `superset`: the backend module would shadow it.

## Layout

| Folder | What it holds |
|---|---|
| `backend/src/superset_oss/artifacts/canvas/` | The `artifact` widget type, whose props hold only `artifact_id` and an optional pinned `version` |
| `backend/.../store/` | The git-shaped file store over an `ArtifactStoreBackend`, and the default backend on extension storage, which refuses to run until extension storage can back it |
| `backend/.../authoring/` | The MCP authoring tools, the `create_artifact` and `import_claude_artifact` prompts, and the endpoint where the user confirms publishing |
| `backend/.../data/` | The mapping of a manifest's named binding onto the canvas placement data request, and the bindings that don't map yet |
| `backend/.../frames/` | The host side of the sandbox: which version a viewer's frame loads, its grant and allowed parents, and the frame link endpoint |
| `backend/.../embedding/` | The standalone host page's endpoint |
| `backend/.../gate.py`, `errors.py`, `web.py` | The provider gate every call goes through, the one error type, and the Flask helpers the endpoints share |
| `frontend/src/canvas/` | The widget renderer, registered under the full widget id |
| `frontend/src/frames/` | The frame host (the sandboxed iframe and the host end of the bridge) and frame links |
| `frontend/src/data/` | Named bindings through the placement data endpoint, and the host-side checks of the frame's requests |
| `frontend/src/authoring/` | Where an owner confirms a pending publish request |
| `frontend/src/embedding/` | The standalone host page shell |
| `docs/CORE-GAPS.md` | What Superset core still needs, and the small core changes on this branch |

The store, the authoring handlers, the gate, the data mapping and the frame
rules are pure Python with no Flask imports, so they are tested without
Superset.

## How it fits together

- **Authoring.** An agent reads `create_artifact`, then writes files with the
  tools. Every write names `base_version` and moves the `draft` ref by
  compare-and-swap, so a stale write fails with `STALE_BASE_VERSION` and
  changes nothing. `manifest.json` is required and validated on every write.
- **Publishing.** `artifact_request_publish` only records a request and answers
  `CONFIRMATION_REQUIRED`. The `published` ref moves when an owner confirms it
  from the canvas, under their own browser session
  (`POST /extensions/superset-oss/artifacts/publish/<id>/confirm`).
- **Rendering.** The renderer asks `POST .../frames/` for a link to the
  placement it draws. The server reads the artifact id and version from the
  stored canvas (never from the request), through the same lookup as the
  placement data endpoint; picks the version the viewer may see (owners: any
  of its versions or the draft; others: published versions only); and has the
  provider mint a short-lived link whose allowed parents and grant come from
  the request's context and the manifest. When the provider no longer holds
  that version, as when a publish lands meanwhile, the endpoint answers
  `VERSION_NOT_FOUND`, as the build and check tools do. The frame is an
  `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer">`, without
  `allow-same-origin` or popups.
- **Data and events.** The renderer fetches each named binding through the
  placement data endpoint, naming the binding and sending the draft token, and
  checks every frame request against the manifest before acting:
  `setCrossFilter` through the canvas, `emit` through `publish`, `refresh` and
  `query` by fetching again.

## Permissions

The MCP tools reuse the Canvas permissions: can_read on Canvas to read, and
can_write to write. Each REST API has its own permission view, which roles
need to be granted:

| API | View | Permissions |
|---|---|---|
| Frame links | `ArtifactFrame` | can_read |
| Publish confirmation | `ArtifactPublish` | can_write |
| Standalone host | `ArtifactEmbed` | can_read |

They deliberately don't share the `Canvas` view: when an API registers,
Flask-AppBuilder removes from every role the permissions on its view that the
API doesn't declare.

## Develop

Backend tests (pure modules only; no Flask or Superset needed):

```bash
PYTHONPATH=superset-core/src:superset-extensions/artifacts/backend/src \
  python -m pytest superset-extensions/artifacts/backend/tests -q
```

Frontend:

```bash
# @apache-superset/core types come from its lib/; build that package first.
cd superset-frontend/packages/superset-core && npm run build && cd -
cd superset-extensions/artifacts/frontend && npm install && npm run typecheck
cd .. && superset-extensions build && superset-extensions bundle
```

The artifact SDK compiles from its sources through an alias, so it needs no
build of its own. Then add the extension to `LOCAL_EXTENSIONS`, turn on
`ENABLE_EXTENSIONS` and `CANVAS`, and register an `ArtifactRuntimeProvider`
(`superset_core.artifacts.provider.register_provider`) whose `store_backend()`
returns a backend, for example the SDK's `InMemoryArtifactStore` in
development.

## Known limits

- No provider ships here, so nothing renders or builds until a host registers
  one. Whether Superset should ship a development-only provider is an open
  question.
- Superset's default CSP (`default-src 'self'`, no `frame-src`) blocks the
  sandbox frame until an operator adds the provider's sandbox origin to
  `frame-src` in `TALISMAN_CONFIG`; extensions can't declare the CSP sources
  they need yet.
- The default store backend refuses to run: extension storage has no
  compare-and-swap write, its REST API exposes an extension's shared rows, and
  its context isn't set while requests run. A provider must supply the store
  backend.
- Artifact access is "owners" only, recorded by the store at creation. Other
  users see an artifact through a canvas placement they can read, and only its
  published versions. Artifacts as persisted widgets with editors and viewers
  are pending, and nothing checks, when a placement is written, that its
  author may read the artifact it names.
- An artifact's bindings don't reach its frame on a canvas yet: the placement
  data endpoint runs `props.bindings[name]`, while an artifact's props hold
  only its id and version. It needs a widget-level binding hook (see
  `docs/CORE-GAPS.md`).
- Only dataset sources map, metrics are saved metrics by name, filters are
  simple filters, and `query` can't send new parameter values yet.
- History is a log written after each draft move: a crash between the two
  drops one entry, and that version can't be restored.
- Blobs are shared by every artifact in a store backend's scope, which the
  host sets (one tenant, say), so `artifact_commit_files` reveals whether
  given content exists in that scope. On the default backend, the scope is
  the whole Superset.
- The standalone host page has no route, no guest tokens and no data; its
  endpoint lives at
  `/extensions/superset-oss/artifacts/embedded/artifact/<uuid>` and answers
  JSON, because extensions mount only under `/extensions/<publisher>/<name>/`
  and can't add pages.
- The publish confirmation is a notice by the artifact, not a screen with a
  diff, and refusing `Authorization` headers is a check on the channel, not
  proof that a person clicked.
- `artifact_upload_blobs` isn't in the SDK's tool contract; it stands in until
  the contract says how commit by hash uploads. Failures carry the SDK's
  `AuthoringErrorCode`s, except `PUBLISH_REQUEST_NOT_FOUND`, which only the
  confirmation endpoint answers.
- Request paths are absolute from the site root, so deployments under an
  application root aren't supported yet.
