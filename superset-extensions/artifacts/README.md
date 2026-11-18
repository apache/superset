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

This extension is a scaffold. It builds on the Superset Artifacts SDK, its
own packages under `sdk/` (`superset_artifacts_sdk` and
`@superset-oss/artifacts-sdk`), and on the Canvas widget framework. **With no provider registered, artifacts are off**:
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
| `sdk/` | The Superset Artifacts SDK: the contracts the extension and a host share, in a Python and a browser package (`sdk/README.md`) |
| `backend/src/superset_oss/artifacts/canvas/` | The `artifact` widget type, which has no props: each artifact is one saved widget of it; and the access rules on those widgets |
| `backend/.../store/` | The git-shaped file store over an `ArtifactStoreBackend`, and the default backend on extension storage, which refuses to run until extension storage can back it |
| `backend/.../authoring/` | The MCP authoring tools, the `create_artifact` and `import_claude_artifact` prompts, and the endpoint where the user confirms publishing |
| `backend/.../data/` | The mapping of a manifest's named binding onto the canvas placement data request, the bindings that don't map yet, and the widget type's binding resolver |
| `backend/.../frames/` | The host side of the sandbox: which version a viewer's frame loads, its grant and allowed parents, and the frame link endpoint |
| `backend/.../access.py`, `gate.py`, `errors.py`, `web.py` | Who may read or change an artifact, the provider gate every call goes through, the one error type, and the Flask helpers the endpoints share |
| `frontend/src/canvas/` | The widget renderer, registered under the full widget id |
| `frontend/src/frames/` | The frame host (the sandboxed iframe and the host end of the bridge) and frame links |
| `frontend/src/data/` | Named bindings through the placement data endpoint, and the host-side checks of the frame's requests |
| `frontend/src/authoring/` | Where an editor confirms a pending publish request |
| `frontend/src/embedding/` | The view that shows one artifact on a page of its own, and the page's frame host |
| `docs/CORE-GAPS.md` | What Superset core still needs, and the small core changes on this branch |

The store, the authoring handlers, the gate, the data mapping and the frame
rules are pure Python with no Flask imports, so they are tested without
Superset; they ask who may do what through `ArtifactAccess`, which the entry
point fills with the widgets' rules.

## An artifact is a saved widget

An artifact is one saved widget of the `artifact` type: the widget's UUID is
the artifact's id, and the widget row holds its name, its editors and its
viewers. `artifact_create` saves the widget through `WidgetDAO`, with its
author as editor; the store keeps only the content, keyed by that UUID.

- Reading an artifact (viewing or landing its files, opening it on a page of
  its own) follows the widget's access filter, and shows a reader who isn't an
  editor only the published version, as frames do: the draft and the history
  are its editors' own. Changing it (writing files, building, publishing)
  needs the user to be one of its editors (`is_editor`).
- A canvas places the artifact by its widget's id. A canvas reader sees the
  artifact's published version there, as for any widget a canvas places; its
  editors see its draft while the canvas shows a draft.
- The props hold nothing, so a generic widget write can't change the code or
  publish: the code and the `published` ref live in the store, which only the
  extension's tools move.

## How it fits together

- **Authoring.** An agent reads `create_artifact`, then writes files with the
  tools. Every write names `base_version` and moves the `draft` ref by
  compare-and-swap. A write from an older version is rebased onto the draft
  when none of its files changed since; otherwise it fails with
  `STALE_BASE_VERSION` and changes nothing. `manifest.json` is required and
  validated on every write.
- **Agents with a disk.** An agent that keeps the project in a folder of its
  own pulls it with `artifact_land` and pushes it with `artifact_commit_files`,
  which takes every path's SHA-256 and asks only for the blobs the store
  lacks. Where the deployment allows it (see "Transfer links"), the bytes
  move beside the model: `artifact_land` answers a short-lived URL for a tar
  of the version, and the commit a short-lived upload URL for each missing
  blob, which the agent's shell uses with `curl`. Otherwise they travel in
  tool calls: `artifact_land` with `inline`, and `artifact_upload_blobs`. A
  commit answers 64 missing blobs at a time, and every page of an answer is
  measured as the JSON answer escapes it, so answers stay under the MCP
  tools' limit of 50,000 bytes. Since files land in agents' folders, no path
  may name a hidden file or directory, which tools such as git run code from
  on their own.
- **Publishing.** `artifact_request_publish` only records a request and answers
  `CONFIRMATION_REQUIRED`. The `published` ref moves when an editor confirms it
  where the artifact is shown, under their own browser session
  (`POST /extensions/superset-oss/artifacts/publish/<id>/confirm`), and once
  the provider builds the version under the policy in force, which checks
  everything the version is made of, its locked packages included. Frame
  links carry that policy too (`FrameContext.policy`), so that a provider
  serves nothing it built that the policy refuses since.
- **Rendering.** The renderer asks `POST .../frames/` for a link to the
  artifact it draws, by its widget's UUID: with the canvas placement that
  shows it, or for a page of its own (`page`: `standalone` or `embedded`). On
  a canvas, the server reads the placement from the stored canvas (never from
  the request), through the same lookup as the placement data endpoint;
  elsewhere, the caller must be able to read the widget. It picks the version
  the viewer may see (the published one; the draft for editors while the
  canvas shows a draft, or before anything is published), and has the provider
  mint a short-lived link whose allowed parents and grant (manifest ∩ policy
  ∩ context) come from the request's context. When the provider no longer
  holds that version, as when a publish lands meanwhile, the endpoint answers
  `VERSION_NOT_FOUND`, as the build and check tools do; the renderer then
  asks once more, which reads the version again. The frame is an
  `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer">`, without
  `allow-same-origin` or popups.
- **Data and events.** The renderer fetches each named binding through the
  placement data endpoint, naming the binding and sending the draft token; on
  a page of its own, through the saved widget's data endpoint
  (`POST /api/v1/widget/<uuid>/data`). Either endpoint asks the artifact
  widget type for the binding (its `binding_resolver`), which reads it from
  the manifest of the version the frame loads, and runs it as the viewer, with
  their dataset access, as any other binding. The frame gets each binding's
  result in a message of its own, sent only when it changes. The bridge
  accepts a cross-filter only with values it delivered to that frame, in the
  binding's latest result, for that dimension; it caps the values in a
  cross-filter, the requests a second, and the queries that the frame's
  requests may run (the policy's `data.max_queries`, which comes with each
  frame link). The renderer then checks every request against the manifest
  before acting: `setCrossFilter` through the canvas, `refresh` and `query` by
  fetching again. A frame that never completes its handshake gets one new
  link, as when its link expired before it loaded.

## An artifact's own page

The extension registers a view, `superset-oss.artifacts.page`, at the location
of the same name. It shows the artifact whose id ends the page's address,
through a frame link with `page: standalone` and the saved widget's data
endpoint. Extensions can't add routes, so a host that wants the page adds a
route, such as `/artifact/<uuid>/`, that renders the location's views. The
views register when the extension loads, which can be after the route first
renders, so the route should follow the registry (`useViews` in
`src/core/views`) rather than read it once.

## Policy

What an artifact may do is a policy decision. Its manifest says what it
requests; the policy says what is allowed; the grant is what the extension
computes from both, in each context, at every write, publish, frame link and
query, and never stores (`superset_artifacts_sdk.policy`).

A policy starts from a profile, `locked`, `standard` or `open`, and can only be
narrowed from there. The deployment's layer is `ARTIFACTS_POLICY` in
`superset_config.py`, read when the extension loads; without it, or with an
invalid value, the policy is Locked. The provider's `policy_layer()` narrows
it for each request, for example to a workspace's:

```python
ARTIFACTS_POLICY = {
    "profile": "standard",
    # Narrow it knob by knob; a knob that widens the profile makes the layer
    # invalid, and an invalid layer is Locked.
    "packages": {"allow": ["d3", "three", "echarts"]},
    "data": {"max_rows": 10_000},
}
```

| Knob | Locked | Standard | Open |
|---|---|---|---|
| `packages.mode` | `builtin` (the runtime's own) | `allowlist` (`packages.allow`) | `any`, after `cooldown_h` |
| `compute` | none | `wasm` | `wasm`, `workers` |
| `data.snapshots` | `off` | `shared` | `shared` |
| `surfaces` | standalone | standalone, embedded | standalone, embedded, guest snapshots |
| `authoring` | synthetic rows | real rows, screenshots | the agent adds packages |
| `limits` | 200 files of 500 KB | 1,000 files of 1 MB | as Standard |

In every profile the frame has no network and no credentials, runs no SQL
and no `eval`, and public embeds are off. A call the policy refuses answers
`POLICY_DENIED`, naming the knob.

## Host pages' CSP

A Superset page shows an artifact's frame only if its Content Security Policy
allows the sandbox site in `frame-src`, and only the provider knows that site
(`FrameSources.frame_sources()`). Superset's default `TALISMAN_CONFIG` has no
`frame-src`, so frames fall back to `default-src 'self'` and the browser
refuses them. In `superset_config.py`, copy the default `TALISMAN_CONFIG`
and add exactly the provider's sources to its `content_security_policy`:

```python
TALISMAN_CONFIG = {
    "content_security_policy": {
        # ...the default policy's directives, unchanged, then:
        # what the provider's frame_sources() returns, its sandbox site only.
        "frame-src": ["'self'", "https://*.sandbox.example.com"],
    },
    # ...the default's other keys, unchanged.
}
```

Do the same in `TALISMAN_DEV_CONFIG`, which Superset uses instead in debug
mode, and wherever else the policy is sent, such as a proxy. Never allow a
wider source, such as `https:` or `*`: the sandbox's isolation depends on its
frames loading only from the provider's site.

## Transfer links

Agents with a shell can move an artifact's bytes beside the model, so that the
model neither writes every uploaded byte nor reads every landed one. The
links are signed with `SECRET_KEY`, bound to one artifact and one blob or
version, and expire after 10 minutes; an upload is checked against its blob's
SHA-256, within the policy's size limit for a file.

- They are built on `WEBDRIVER_BASEURL_USER_FRIENDLY`, the URL that the MCP
  tools put in every link they answer. Without it, the tools answer no links,
  and agents use the inline fallbacks.
- An upload carries no session and no CSRF token, so its route must be exempt
  from CSRF checks. The link is its only credential, and the route reads no
  cookie, so the exemption opens no cross-site path:

  ```python
  WTF_CSRF_EXEMPT_LIST = [
      # ...the default list, unchanged, then:
      "superset_oss.artifacts.authoring.transfer_api.upload",
  ]
  ```

  Until the route is exempt, commits answer no upload links. Downloads need
  no exemption.

## Tools

By default a deployment offers the tools every agent needs: `artifact_create`,
the text editor's commands (`artifact_view`, `artifact_create_file`,
`artifact_str_replace`, `artifact_insert`), the folder's pull and push
(`artifact_land`, `artifact_commit_files`, `artifact_upload_blobs`), and
`artifact_build`, `artifact_check` and `artifact_request_publish`. Every tool
offered costs every agent context, so the file tools that only agents without
a disk may want come only with `ARTIFACTS_ALL_FILE_TOOLS = True`:
`artifact_delete_file`, `artifact_move_file`, `artifact_search`,
`artifact_history`, `artifact_restore`, `artifact_manifest_get` and
`artifact_manifest_update`. `MCP_DISABLED_TOOLS` removes any of them.

## Permissions

The MCP tools reuse the Widget permissions: can_read on Widget to read, and
can_write to write; each then checks the artifact's own widget. Each REST API
has its own permission view, which roles need to be granted:

| API | View | Permissions |
|---|---|---|
| Frame links | `ArtifactFrame` | can_read |
| Publish confirmation | `ArtifactPublish` | can_write |
| Transfer links | none: each link is its own credential | none |

They deliberately don't share the `Canvas` or `Widget` views: when an API registers,
Flask-AppBuilder removes from every role the permissions on its view that the
API doesn't declare.

## Develop

Backend tests (pure modules only; no Flask or Superset needed):

```bash
PYTHONPATH=superset-core/src:superset-extensions/artifacts/sdk/python/src:superset-extensions/artifacts/backend/src \
  python -m pytest superset-extensions/artifacts/backend/tests -q
```

Frontend:

```bash
# @apache-superset/core types come from its lib/; build that package first.
cd superset-frontend/packages/superset-core && npm run build && cd -
cd superset-extensions/artifacts/frontend && npm install && npm run typecheck && npm test
cd .. && superset-extensions build && superset-extensions bundle
```

The browser SDK compiles from its sources through an alias, so it needs no
build of its own. The Python SDK must be installed where Superset runs
(`pip install superset-extensions/artifacts/sdk/python`), since the
extension's bundle holds only its own backend. Then add the extension to
`LOCAL_EXTENSIONS`, turn on `ENABLE_EXTENSIONS` and `CANVAS`, and register an
`ArtifactRuntimeProvider` (`superset_artifacts_sdk.registry.register_provider`)
whose `store_backend()` returns a backend, for example the SDK's
`InMemoryArtifactStore` in development. Point `MCP_CODE_ARTIFACTS_ENABLED` at
the same registry, so that the MCP instructions allow the artifact tools while
a provider is registered:

```python
def MCP_CODE_ARTIFACTS_ENABLED() -> bool:
    from superset_artifacts_sdk.registry import artifacts_available

    return artifacts_available()
```

## Known limits

- No provider ships here, so nothing renders or builds until a host registers
  one. Whether Superset should ship a development-only provider is an open
  question.
- Superset's default CSP (`default-src 'self'`, no `frame-src`) blocks the
  sandbox frame until the operator allows the provider's sandbox site in
  `frame-src` (see "Host pages' CSP" below).
- The default store backend refuses to run: extension storage's REST API
  exposes an extension's shared rows, and its context isn't set while requests
  run. A provider must supply the store backend.
- `artifact_create` names its author the widget's only editor, and gives it no
  viewers: add them on the widget. A widget of the artifact type made any
  other way, such as by a canvas operation that adds a new one, has no files,
  so it shows nothing.
- When a widget is deleted, its content stays in the store until a cleanup
  drops the content of artifacts whose widget no longer exists; there is no
  such cleanup yet.
- Only dataset sources map, metrics are saved metrics by name, filters are
  simple filters, and `query` can't send new parameter values yet.
- On the default backend, checking that a version is one of a ref's checks
  its record, then each of its older history chunks: a long history makes an
  old version slower to find.
- Blobs are shared by every artifact in a store backend's scope, which the
  host sets (one tenant, say), so `artifact_commit_files` reveals whether
  given content exists in that scope. On the default backend, the scope is
  the whole Superset.
- Extensions can't add routes, so the page that shows one artifact on its own
  needs a host route (see "An artifact's own page").
- The publish confirmation is a notice by the artifact, not a screen with a
  diff, and refusing `Authorization` headers is a check on the channel, not
  proof that a person clicked.
- `artifact_upload_blobs`, the inline fallback for uploads, is the extension's
  own tool: the SDK's contract leaves it to the host. Failures carry the SDK's
  `AuthoringErrorCode`s, except `PUBLISH_REQUEST_NOT_FOUND` and
  `TRANSFER_LINK_INVALID`, which only the confirmation endpoint and the
  transfer routes answer.
- A transfer link is a bearer credential that passes through the model's
  context, and its token travels in the URL, where access logs may keep it:
  its short life is the control. Landing a large project inline takes many
  pages, and a file too big for a page comes without its content; the
  download link has neither limit.
- Request paths are absolute from the site root, so deployments under an
  application root aren't supported yet.
