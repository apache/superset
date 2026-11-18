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

# @superset-oss/artifacts-sdk

The browser half of the Superset Artifacts SDK: the runtime that artifact code
calls inside its sandboxed frame (`window.superset`), and the host end of the
bridge that the Superset page runs around that frame. It has no runtime
dependencies.

The Python half, with the manifest validation, the file store, the provider
interface and the authoring tools, is `superset_artifacts_sdk`, in
`../python`. Both halves declare the capability names and the manifest's
shape; a test there (`test_artifact_typescript_sync.py`) fails when they drift
apart. The bridge protocol is defined here only.

## The bridge

The frame runs untrusted code on an opaque origin, with no network and no
login. It learns everything through `state` messages from the host, and asks
for everything through `request` messages to it.

```
host page                                          sandboxed frame
createFrameChannel ── name: {k, grant, origin} ──► installRuntime()
                   ◄── ready {protocol, version} ──
                   ── state {status, bindings, filters, theme?} ──►  onData
                   ◄── request: query | setCrossFilter | emit | refresh ──
                   ◄── error {kind, message, stack?} ──
```

- The host makes a channel key per frame and passes it, with the capability
  grant and its own origin, in the iframe's `name`. The runtime reads it once
  and clears it.
- Each side accepts a message only from the other's window (`event.source`)
  and with the channel key. The frame posts to the host's origin; the host
  posts to `*`, because the frame's origin is opaque and no target origin can
  name it.
- Both sides check the grant. The runtime throws a `CapabilityError` so that
  the artifact's author learns early; the host's check is the authoritative
  one, and it also leaves out of `state` what the grant doesn't cover.
- The frame never sends queries. `query` asks the host to rerun a declared
  binding with new values for its declared parameters; the host builds the
  query from the stored manifest and runs it as the viewer.

## Use

In the frame, before any artifact code:

```typescript
import { installRuntime } from '@superset-oss/artifacts-sdk';

installRuntime();
```

Artifact code then calls `window.superset`:

```javascript
superset.onData(state => render(superset.data('revenue_by_region')));
chart.on('click', region =>
  superset.setCrossFilter({
    binding: 'revenue_by_region',
    dimension: 'region',
    values: [region],
  }),
);
```

On the host:

```typescript
import { createFrameChannel } from '@superset-oss/artifacts-sdk';

const channel = createFrameChannel({
  frame,
  grant: ['data', 'cross_filter', 'theme'],
  onRequest: request => {
    // Check the request against the manifest, then act on it.
  },
  onError: error => reportToAuthor(error),
});
frame.name = channel.name; // before the frame loads
frame.src = frameLink; // a short-lived link from the provider
channel.postState(state);
```

## Develop

```bash
npm run build   # tsc -p tsconfig.json, into lib/
npm run type    # type-check only
npm test        # the tests in test/, with Vitest
```

The tests are written as Jest tests (`test()` and `expect`, no `describe()`),
so Vitest runs them with `--globals`.

## Open questions

These are noted in the code where they apply:

- The MCP Apps protocol and SDK.
- MCP Apps names for theme variables and CSP settings.
- A compute capability for WebAssembly, workers and `eval`.
- An Arrow envelope for binding data.
- Cross-filter values only from delivered data, and typed, rate-limited
  parameters.
- Which frame errors reach an agent.
