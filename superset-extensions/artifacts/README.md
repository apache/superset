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
| `backend/src/superset_oss/artifacts/canvas/` | The `artifact` widget type, whose props hold only `artifact_id` and an optional pinned `version` |
| `backend/.../store/` | The git-shaped file store over an `ArtifactStoreBackend`, and the default backend on extension storage, which refuses to run until extension storage can back it |
| `backend/.../authoring/` | The MCP authoring tools, the `create_artifact` and `import_claude_artifact` prompts, and the endpoint where the user confirms publishing |
| `backend/.../data/` | The mapping of a manifest's named binding onto the canvas placement data request, the bindings that don't map yet, and the widget type's binding resolver |
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
  compare-and-swap. A write from an older version is rebased onto the draft
  when none of its files changed since; otherwise it fails with
  `STALE_BASE_VERSION` and changes nothing. `manifest.json` is required and
  validated on every write.
- **Publishing.** `artifact_request_publish` only records a request and answers
  `CONFIRMATION_REQUIRED`. The `published` ref moves when an owner confirms it
  from the canvas, under their own browser session
  (`POST /extensions/superset-oss/artifacts/publish/<id>/confirm`).
- **Rendering.** The renderer asks `POST .../frames/` for a link to the
  placement it draws. The server reads the artifact id and version from the
  stored canvas (never from the request), through the same lookup as the
  placement data endpoint; picks the version the viewer may see (owners: any
  of its versions or the draft; others: published versions only), which is
  the draft for owners while the canvas shows a draft; and has the
  provider mint a short-lived link whose allowed parents and grant come from
  the request's context and the manifest. When the provider no longer holds
  that version, as when a publish lands meanwhile, the endpoint answers
  `VERSION_NOT_FOUND`, as the build and check tools do; the renderer and the
  standalone page then ask once more, which reads the version again. The
  frame is an
  `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer">`, without
  `allow-same-origin` or popups.
- **Data and events.** The renderer fetches each named binding through the
  placement data endpoint, naming the binding and sending the draft token, and
  checks every frame request against the manifest before acting:
  `setCrossFilter` through the canvas, `refresh` and
  `query` by fetching again. The endpoint asks the artifact widget type for
  the binding (its `binding_resolver`), which reads it from the manifest of
  the version the frame loads; the endpoint then runs it as the viewer, with
  their dataset access, as any other binding.

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
PYTHONPATH=superset-core/src:superset-extensions/artifacts/sdk/python/src:superset-extensions/artifacts/backend/src \
  python -m pytest superset-extensions/artifacts/backend/tests -q
```

Frontend:

```bash
# @apache-superset/core types come from its lib/; build that package first.
cd superset-frontend/packages/superset-core && npm run build && cd -
cd superset-extensions/artifacts/frontend && npm install && npm run typecheck
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
- Artifact access is "owners" only, recorded by the store at creation. Other
  users see an artifact through a canvas placement they can read, and only its
  published versions. Artifacts as persisted widgets with editors and viewers
  are pending, and nothing checks, when a placement is written, that its
  author may read the artifact it names.
- Only dataset sources map, metrics are saved metrics by name, filters are
  simple filters, and `query` can't send new parameter values yet.
- On the default backend, checking that a version is one of a ref's checks
  its record, then each of its older history chunks: a long history makes an
  old version slower to find.
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
