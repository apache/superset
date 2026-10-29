<!--
 Licensed to the Apache Software Foundation (ASF) under one or more
 contributor license agreements.  See the NOTICE file distributed with this
 work for additional information regarding copyright ownership.  The ASF
 licenses this file to you under the Apache License, Version 2.0 (the
 "License"); you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
-->

# Embedded SDK test rig

A host app and a stand-in for Superset's embedded page, on two origins, so the
parts of the SDK that only exist between two documents can be exercised for
real: the MessageChannel handshake, what survives a navigation the dashboard
makes on its own, and how many times the host's guest-token endpoint is asked
for a token.

The unit tests mock `MessageChannel` and `Switchboard`. This rig mocks
neither — it loads the built UMD bundle in Chromium and talks to a page that
speaks the same handshake as `superset-frontend/src/embedded/index.tsx`, over
the real `@superset-ui/switchboard`.

## Run it

```bash
cd superset-embedded-sdk
node testrig/drive.mjs            # headless, builds the bundle if it is stale
node testrig/drive.mjs --headed   # watch it happen
node testrig/drive.mjs --verbose  # + the pages' console output
```

Needs a `chromium`, `chromium-browser` or `google-chrome` on `PATH`, or
`CHROMIUM_PATH` pointing at one. No npm dependencies: the driver speaks the
DevTools protocol over Node's built-in WebSocket.

Exit code is 0 only if every check passed.

## Poke at it by hand

```bash
node testrig/server.mjs   # then open http://localhost:8100
```

The host app has buttons for embedding, pushing a theme, calling
`getActiveTabs()` and unmounting; the dashboard page has links that navigate it
the way a tab or a link in a Markdown chart would. The right-hand pane logs
what the host saw, and the counter under the frame is how many guest tokens the
host's endpoint has minted.

`?ttl=15` on the host app shortens the guest token's life to 15 seconds, so the
refresh timer fires while you are watching. `?hang=1` makes the dashboard page
answer no `get` at all, which is how the rig produces a call that is still in
flight when the user clicks a link. `?slowfirst=1` holds the very first
`fetchGuestToken()` open until you settle it yourself with
`rigReleaseFirstToken()` or `rigFailFirstToken()` from the console, and
`?failnth=N` makes call N reject — together they are how the rig reaches the
race between the initial fetch and a navigation that happens during it.

## What the pieces are

| file | what it stands for |
| --- | --- |
| `server.mjs` | the host app's backend (`/guest-token`, which counts what it mints) on `:8100`, and the Superset instance on `:8200` |
| `host.html` | the host app: calls `embedDashboard`, drives the public API, records everything into `window.rig` |
| `embedded.html` | Superset's embedded page: the same port-transfer handshake, the same method names, plus links that navigate itself |
| `drive.mjs` | headless Chromium driver and the checks |

`embedded.html` reports what it experienced to the host through an ordinary
`postMessage` to `parent`. That side channel is the rig's own and has nothing
to do with the SDK's MessageChannel — it is how the driver can see what
happened inside a cross-origin frame.

## What it checks

- a first embed renders, on exactly one minted token
- a navigation internal to the dashboard re-authenticates the new document
- the host's theme is re-applied to that document, after its token
- a `get` still in flight when the user navigates is rejected as a
  `PortClosedError` rather than left hanging, and so is one caught by `unmount()`
- a navigation that does not land on the embedded page mints no token at all,
  and coming back to the dashboard afterwards works
- the refresh timer follows the current document, fires once, and leaves the
  document that is gone alone
- an initial token fetch that fails *after* a navigation already recovered the
  embed leaves that working dashboard alone, and `embedDashboard` resolves
- a token from a superseded cycle is handed straight to the document in front of
  the user when that document has none, rather than waiting out a retry

Run it against `git show HEAD~1:...` of `src/index.ts` to watch the checks fail.
