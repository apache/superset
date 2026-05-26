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

# Reference Chatbot Extension

Canonical environment-validation extension for the `superset.chatbot`
contribution area. **Not** a product chatbot — there is no LLM, no backend,
no persistence. Its purpose is to exercise the extension platform end-to-end:

- `views.registerView` at `superset.chatbot` (singleton resolution)
- Lifecycle activation + a master disposable that tears down everything
- `commands.registerCommand` for `core.chatbot__open|close|toggle`
- Mock streaming with `AbortController` cancellation on dispose
- Defense-in-depth React error boundary inside the panel
- A single P3 page-context seam that lights up automatically as the
  `dashboard` / `explore` / `dataset` / `navigation` namespaces become
  available at runtime on the host

It is intended as the reference implementation third-party chatbot extension
authors copy. Anything that ships as host-internal (the mount point, the
admin picker, the `getActiveChatbot` resolver) is **not** here — see the
host side at `superset-frontend/src/components/ChatbotMount/` and
`superset-frontend/src/core/chatbot/`.

## Layout

```
extensions/chat/
├── extension.json              Manifest (app.chatbot view + commands)
├── package.json
├── tsconfig.json
├── webpack.config.js           ModuleFederation → window.superset
├── jest.config.js              Self-contained unit tests
└── src/
    ├── index.tsx               MF entry — calls activate() once
    ├── activate.ts             Returns master disposable
    ├── commands.ts             core.chatbot__open|close|toggle
    ├── state.ts                Module-scoped open/closed + emitter
    ├── ReferenceChatbot.tsx    Root component (bubble ↔ panel)
    ├── components/
    │   ├── Bubble.tsx
    │   ├── Panel.tsx
    │   └── ErrorBoundary.tsx
    ├── streaming/
    │   ├── mockStream.ts       AsyncIterable<string> + AbortSignal
    │   └── registry.ts         Cross-component abort tracking
    ├── context/
    │   └── pageContext.ts      P3 namespace seam (defensive)
    └── __tests__/
        ├── sdkMock.ts          In-memory @apache-superset/core mock
        └── activate.test.tsx
```

## Run the unit tests

```bash
cd extensions/chat
npm install            # first time only
npx jest
```

The tests mock `@apache-superset/core` via `src/__tests__/sdkMock.ts` so they
do not depend on host runtime wiring.

## Build / bundle for deployment

```bash
# from the extension folder
npm install
npm run build

# packaging into a .supx is handled by the Superset extensions CLI
pip install apache-superset-extensions-cli
superset-extensions bundle    # produces apache-superset.reference-chatbot-0.1.0.supx
```

Drop the `.supx` into the `EXTENSIONS_PATH` of a Superset instance that has
`FEATURE_FLAGS = { "ENABLE_EXTENSIONS": True }`.

## Selecting it as the active chatbot

The host's singleton picker reads `active_chatbot_id` from the admin
settings endpoint (`/api/v1/extensions/settings`). Set it to:

```
apache-superset.reference-chatbot
```

If no admin selection exists, the host falls back to the first-to-register
chatbot — installing this extension alone is enough for the bubble to appear.

## P3 integration seams

All page-context derivation lives in [`src/context/pageContext.ts`](src/context/pageContext.ts).
Each namespace branch (`dashboard`, `explore`, `dataset`, `navigation`) is
called defensively — when the host implementation lands, the returned value
becomes non-undefined automatically with no other change in the extension.

The panel re-reads context on `popstate`. Once `navigation.onDidChangePage`
is live on the host, the panel's `useEffect` should subscribe to it instead;
that is the only file in the extension that needs to change for full P3
context sync.

## Known intentional non-features

- No conversation persistence — by design (extension scope per SIP §2).
- No real network. The mock stream is a `setTimeout` token emitter so the
  cancellation contract is exercised without external dependencies.
- No keyboard shortcut binding (Cmd+K). Extensions own that, but it adds
  surface area not needed for platform validation.
- No notification badge / icon mutation. SIP §3.2 recommends static icons;
  the bubble re-renders freely already.

## TODOs

- **P1**: if/when the host gains `deactivate(): Promise<void>`, wrap the
  master disposer in `activate.ts` to flush async work before returning.
- **P3**: replace the `popstate` listener in `Panel.tsx` with
  `navigation.onDidChangePage` once that event is wired up host-side.
- **P4**: if the host pre-registers `core.chatbot__*` as host-owned intents,
  swap `commands.registerCommand` for the implementation hook in
  `commands.ts`. Command IDs do not change.
