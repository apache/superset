# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""
The text of the authoring prompts, kept apart from the MCP decorators so it can
be read and tested without the host.
"""

# TODO: ship this contract as an Agent Skill as well.
# TODO: the import kit targets Claude's legacy artifact runtime; artifacts
# written for claude.use() need their own checks.
# TODO: teach binding parameters and `superset.query` with values once the
# design defines how a value changes a binding's query; until then the host
# refuses every value, so the contract teaches neither.

from __future__ import annotations

from superset_artifacts_sdk.authoring import (
    ARTIFACT_BUILD,
    ARTIFACT_CHECK,
    ARTIFACT_COMMIT_FILES,
    ARTIFACT_CREATE,
    ARTIFACT_CREATE_FILE,
    ARTIFACT_DELETE_FILE,
    ARTIFACT_HISTORY,
    ARTIFACT_INSERT,
    ARTIFACT_MANIFEST_GET,
    ARTIFACT_MANIFEST_UPDATE,
    ARTIFACT_MOVE_FILE,
    ARTIFACT_REQUEST_PUBLISH,
    ARTIFACT_RESTORE,
    ARTIFACT_SEARCH,
    ARTIFACT_STR_REPLACE,
    ARTIFACT_VIEW,
)
from superset_artifacts_sdk.policy import ArtifactPolicy
from superset_oss.artifacts.constants import (
    ARTIFACT_UPLOAD_BLOBS,
    ID_PREFIX,
    WIDGET_TYPE,
)

NOT_ENABLED_TEXT = (
    "Artifacts are off on this Superset (NOT_ENABLED): no artifact runtime "
    "provider is registered. Don't write artifact code; use the chart and "
    "canvas tools instead."
)


def _tool(name: str) -> str:
    return f"`{ID_PREFIX}{name}`"


def _packages_rule(policy: ArtifactPolicy) -> str:
    packages = policy.packages
    if packages.mode == "builtin":
        return (
            "- No npm packages here: write plain JavaScript, or React when the "
            "manifest's `runtime` is `react`. A manifest that lists any in "
            "`dependencies` is refused with POLICY_DENIED."
        )
    allowed = (
        f"Only these packages are allowed: {', '.join(sorted(packages.allow))}."
        if packages.mode == "allowlist" and packages.allow
        else "No package is on the allowlist yet, so use none."
        if packages.mode == "allowlist"
        else "Any package works, once its release is old enough."
    )
    return (
        '- Import npm packages by name (`import * as d3 from "d3"`) and pin each '
        'one in the manifest\'s `dependencies` to an exact version ("7.9.0", '
        'never "^7" or "latest"). The build resolves them. ' + allowed + " "
        "Packages that need the network or Node APIs don't work."
    )


def _compute_rule(policy: ArtifactPolicy) -> str:
    allowed = [
        name
        for name, on in (
            ("WebAssembly (declare `compute.wasm`)", policy.compute.wasm),
            (
                "workers from blob: URLs (declare `compute.workers`)",
                policy.compute.workers,
            ),
        )
        if on
    ]
    if not allowed:
        return "- No workers, no WebAssembly, no `eval` or `new Function`."
    named = " and ".join(allowed)
    return f"- {named[0].upper()}{named[1:]} work; `eval` and `new Function` never do."


def create_artifact_text(policy: ArtifactPolicy) -> str:
    """What an agent reads before it writes an artifact, under ``policy``."""
    upload = _tool(ARTIFACT_UPLOAD_BLOBS)
    return f"""# Writing a Superset artifact

An artifact is a small app (HTML, CSS and JavaScript, or React) that you write
into Superset and place on a canvas. Its code runs in a locked sandbox frame,
so write it for the rules below from the start. This Superset's policy is
{policy.profile.value}; a write it refuses answers POLICY_DENIED and names why.

## The sandbox

- The frame has an opaque origin on a separate site: no cookies, no
  localStorage or sessionStorage, no login.
- There is no network. fetch, XMLHttpRequest, WebSocket, EventSource and
  sendBeacon fail, and nothing loads from a URL. Data arrives only through
  `window.superset`.
- No popups or new windows, no forms, no nested iframes.
{_compute_rule(policy)}
{_packages_rule(policy)}
- At most {policy.limits.files} files of {policy.limits.file_bytes} bytes each,
  and {policy.data.max_bindings} bindings of {policy.data.max_rows} rows each.
- Size from the frame: `document.documentElement.clientWidth` and a `resize`
  listener. Put data values on the page with `textContent`, never
  `innerHTML`.

## Files and versions

An artifact is a tree of files. `manifest.json` is required; the entrypoint is
`index.html` unless the manifest's `entrypoint` names another file.

Every write names `base_version`: the version you last read, which every
answer returns. A write from an older version still lands when the files it
changes haven't changed since. When a write answers STALE_BASE_VERSION, one of
its files changed: read it again, then redo the edit from the new version.
Nothing you write is visible to viewers until the user confirms publishing.

- {_tool(ARTIFACT_CREATE)}(title, files): start an artifact; returns its
  `artifact_id` and first `version`.
- {_tool(ARTIFACT_VIEW)}(artifact_id, path, view_range?, page?): read a file
  with line numbers, or list a directory (`"."` is the root). Long results
  come in pages.
- {_tool(ARTIFACT_CREATE_FILE)}(path, file_text): add a new file.
- {_tool(ARTIFACT_STR_REPLACE)}(path, old_str, new_str): replace one exact
  string. It must appear exactly once: NO_MATCH or MULTIPLE_MATCHES otherwise;
  add surrounding lines to make it unique. Prefer this to rewriting files.
- {_tool(ARTIFACT_INSERT)}(path, insert_line, insert_text): insert after a
  line; 0 is the start of the file.
- {_tool(ARTIFACT_DELETE_FILE)}(path) and {_tool(ARTIFACT_MOVE_FILE)}(old_path,
  new_path).
- {_tool(ARTIFACT_SEARCH)}(query, path?): find plain, case-sensitive text.
- {_tool(ARTIFACT_HISTORY)}(ref?) and {_tool(ARTIFACT_RESTORE)}(version): list
  the draft's versions, newest first, and make an earlier one the draft again.
- {_tool(ARTIFACT_MANIFEST_GET)}() and {_tool(ARTIFACT_MANIFEST_UPDATE)}(manifest):
  read and replace `manifest.json`; it is validated on every write.
- {_tool(ARTIFACT_COMMIT_FILES)}(files): with a project on disk, send every
  path's SHA-256 as the whole new version; when it answers `missing`, upload
  those contents with {upload}, then commit again from the same base_version.

## manifest.json

```json
{{
  "artifact_version": "1",
  "title": "Revenue by region",
  "entrypoint": "index.html",
  "bindings": {{
    "revenue_by_region": {{
      "source": {{"kind": "dataset", "dataset_id": 42}},
      "metrics": ["revenue"],
      "dimensions": ["region"],
      "row_limit": 1000
    }}
  }},
  "events": [
    {{"kind": "cross_filter", "binding": "revenue_by_region", "dimension": "region"}}
  ],
  "capabilities": ["data", "cross_filter", "theme"]
}}
```

- A binding names a dataset, its saved metrics by name and the columns to group
  by. Superset runs it on the server as the viewer, with their permissions and
  the canvas filters that reach the artifact; the frame never sends a query.
  Find datasets and their saved metrics with the dataset tools.
- Leave out `parameters`: this Superset can't send parameter values yet, so a
  binding always runs as declared, narrowed only by the canvas filters.
- `events` declare the cross-filters the artifact emits, each on one dimension
  of one binding; the other widgets follow them. The host accepts only values
  it delivered to the artifact for that binding and dimension.
- `capabilities` must cover what the artifact uses: `data` for bindings,
  `cross_filter` for events, `theme`, and `compute.wasm` or `compute.workers`
  for WebAssembly or workers. A host may grant fewer in some contexts, and the
  policy may refuse some: code for a missing one.

## window.superset

```js
superset.onData(state => {{
  // state.status is "loading", "ok" or "error"; state.error says why.
  const result = superset.data("revenue_by_region"); // {{rows, columns?, definitions?}}
  if (state.status !== "ok" || !result) return;
  draw(result.rows);
}});
superset.filters();  // the canvas filters and cross-filters reaching the artifact
superset.theme();    // {{mode: "light" | "dark", tokens}}
superset.query("revenue_by_region"); // run one binding again
const emea = {{binding: "revenue_by_region", dimension: "region", values: ["EMEA"]}};
superset.setCrossFilter(emea);
superset.setCrossFilter(null); // clear it
superset.refresh(); // run the bindings again, fresh from the warehouse
superset.capabilities; // what this frame was granted
```

Results never come back from a call: every change, the result of `query`
included, arrives through `onData`. A method the grant doesn't cover throws a
CapabilityError. Numbers can arrive as strings: convert them before arithmetic.
Uncaught errors are reported to the author.

## Checking and publishing

1. {_tool(ARTIFACT_BUILD)}(version?) compiles the draft and reports errors, the
   imports it couldn't resolve, the APIs the sandbox blocks and binding
   problems. Fix every error.
2. {_tool(ARTIFACT_CHECK)}(version?) runs it in a headless browser and reports
   uncaught errors, console output, CSP violations and what it rendered.
3. {_tool(ARTIFACT_REQUEST_PUBLISH)}(base_version) asks the user to publish
   that version. It answers CONFIRMATION_REQUIRED: the user confirms in
   Superset, under their own login. Never report the artifact as published
   before they confirm, and never ask them to confirm in the conversation.

## Placing it on a canvas

The artifact is a saved widget: its `artifact_id` is the widget's id. Place it
with the canvas draft tools by that id (an `add` operation with `widgetId`),
never as a new widget of type `{WIDGET_TYPE}`, which would start an empty
artifact. It has no props. Every canvas that places it shows its published
version; to keep a frozen copy, start a new artifact from its files.
"""  # noqa: S608 -- prose for an agent, not SQL


def import_claude_artifact_text() -> str:
    """How to bring an artifact made in Claude to Superset."""
    return f"""# Bringing a Claude artifact to Superset

Claude artifacts run on Claude's own runtime. Here the same code runs in
Superset's sandbox, under the rules of the `create_artifact` prompt: read it
first. Then adapt the artifact as follows.

## Compatibility checks

- Claude-only APIs don't exist here: `window.claude.complete` (model calls),
  `window.storage` and `window.fs`. Remove them, or replace them with data from
  bindings. There is no stand-in for model calls.
- shadcn imports (`@/components/ui/*`) and lucide icons: keep the imports; the
  build resolves them. Pin `lucide-react` to an exact version in
  `dependencies`.
- CDN `<script>` and `<link>` tags: replace each with an npm import, pinned to
  the exact version the tag used.
- Hard-coded data: replace it with a named binding to Superset data, so that
  viewers see their own numbers with Superset's metric definitions.
- Data that needs preparing first (map shapes to GeoJSON, say) is prepared on
  your side and uploaded as a file; Superset doesn't run your scripts.

## Steps

1. {_tool(ARTIFACT_CREATE)} with the artifact's files: a single-file React
   artifact can stay one `App.jsx` named as the manifest's `entrypoint`.
2. Write `manifest.json`: bindings, events, capabilities and pinned
   dependencies.
3. {_tool(ARTIFACT_BUILD)}: it reports what still depends on Claude's runtime.
   Fix it, then {_tool(ARTIFACT_CHECK)}.
4. {_tool(ARTIFACT_REQUEST_PUBLISH)}, and tell the user to confirm in Superset.
5. Place it on a canvas by its `artifact_id`, which is its saved widget's id.
   Later edits go through the same tools.
"""
