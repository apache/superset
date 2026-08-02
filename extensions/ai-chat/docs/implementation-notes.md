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

# AI Chat extension — implementation notes

Investigation notes for the AI assistant chat extension. This document records
the repository facts the implementation is built on, and the architectural
decisions derived from them. It lives inside the extension source tree rather
than under `docs/` because `docs/` is a Docusaurus site where unregistered
pages affect the build.

## Relevant existing components

### Chat contribution API (SIP-214, PR #41205)

- Public contract: `superset-frontend/packages/superset-core/src/chat/index.ts`.
  A chat registration is `chat.registerChat({ id, name, description? },
  TriggerComponent, PanelComponent): Disposable`. There are **no message
  types** in the public surface — the extension owns the entire conversational
  model. Display modes are `'floating' | 'panel'` (there is no `docked`
  literal; the docked sidebar mode is spelled `panel`).
- Host implementation: `superset-frontend/src/core/chat/` (`ChatProvider.ts`
  singleton state machine, `ChatHost.tsx` mount components, `index.ts` public
  namespace). The host owns open/close state, display mode, persistence
  (localStorage key `chat__state`), the fixed bottom-right container in
  floating mode, and the resizable `Splitter` sidebar in panel mode
  (`src/views/App.tsx`, default width 400, min 280). The host renders **no**
  trigger button, close button, or mode switcher — the extension provides all
  chrome inside its own components.
- Singleton semantics: a second `registerChat` replaces the first with a
  console warning; a takeover mounts the incoming chat closed.
- Error isolation: trigger and panel are wrapped in separate error boundaries;
  a crashing panel cannot take the trigger down.
- `onDidResizePanel` is exposed but never fires on this host — do not drive
  layout from it.
- Docs: `docs/developer_docs/extensions/extension-points/chat.md`.

### Navigation API

`superset-frontend/packages/superset-core/src/navigation/index.ts` exposes
exactly two members: `getPage(): Page` and `onDidChangePage: Event<Page>`,
where `Page` is a string union (`'dashboard' | 'dashboard_list' | 'explore' |
'chart_list' | 'sqllab' | 'query_history' | 'saved_queries' | 'dataset' |
'dataset_list' | 'home'`). Entity-level context (dashboard/chart IDs) is
intentionally excluded from the public API. Where the extension needs a
resource identity (dashboard id on a dashboard page) it parses
`window.location.pathname` — URL context, not DOM scraping — and treats the
result as a hint that the backend independently validates.

### Extension loading

- Extensions are webpack Module Federation remotes. The host shares exactly
  four singletons: `react`, `react-dom`, `antd`, `@apache-superset/core`
  (`superset-frontend/webpack.config.js`). Subpath imports such as
  `@apache-superset/core/theme` are **not** in the share config, so extension
  code imports only from the package root:
  `import { chat, navigation, translation, theme, authentication, extensions } from '@apache-superset/core'`.
- At load time the host resolves `@apache-superset/core` to
  `window.superset` (10 runtime namespaces: `authentication`, `core`, `chat`,
  `commands`, `editors`, `extensions`, `menus`, `navigation`, `sqlLab`,
  `views`) spread over the built stub package, whose `translation`, `theme`,
  `utils` and `components` namespaces carry real runtime code
  (`src/extensions/ExtensionsLoader.ts`, `ExtensionsStartup.tsx`).
- `authentication.getCSRFToken(): Promise<string | undefined>` is public API
  (host implementation delegates to `SupersetClient.getCSRFToken()`), which is
  what lets an extension make CSRF-protected POSTs with plain `fetch`.
- Activation is a module-level side effect: the host loads
  `container.get('./index')` and calls the factory. There is no
  `activate()`/`deactivate()` lifecycle.
- Backend serving: `superset/extensions/api.py` (`GET /api/v1/extensions/`
  and content-hashed chunk serving). Local dev loads unpacked extensions from
  `LOCAL_EXTENSIONS` (list of project dirs containing `dist/`); packaged
  `.supx` bundles come from `EXTENSIONS_PATH`. Everything is gated on the
  `ENABLE_EXTENSIONS` feature flag (default off) and authentication.
- Scaffolding conventions: `superset-extensions-cli` templates
  (`superset-extensions-cli/src/superset_extensions_cli/templates/`) define
  the canonical `extension.json`, webpack MF config
  (`publicPath /api/v1/extensions/<publisher>/<name>/`, shared singletons with
  `import: false`), and tsconfig. This extension follows those templates,
  with two deliberate deviations: test files are excluded from the build
  tsconfig (a stale-dist failure mode previously observed with the reference
  chatbot), and React peer versions match the host (18.x, not the template's
  stale 17.x).

### MCP service

- `superset/mcp_service/` — FastMCP app with ~70 tools, all with Pydantic
  request/response schemas and declarative
  `ToolAnnotations(readOnlyHint, destructiveHint, title)` plus
  `class_permission_name`/`method_permission_name` RBAC metadata
  (`superset/mcp_service/CLAUDE.md` documents conventions).
- Authorization is enforced in layers: per-tool FAB RBAC via `mcp_auth_hook`
  (`auth.py`), OAuth scope intersection, object-level checks inside tool
  bodies (`raise_for_access`, DAO base filters), and tool visibility
  filtering in `tools/list` (`RBACToolVisibilityMiddleware`). Master switch
  `MCP_RBAC_ENABLED` (default `True`).
- The `fastmcp` dependency is an optional extra (`pip install
  apache_superset[fastmcp]`); all gateway imports of `fastmcp` /
  `superset.mcp_service` are guarded so the feature degrades cleanly when the
  extra is absent.
- User-authored content in tool responses is wrapped in
  `<UNTRUSTED-CONTENT>` tags by the MCP response layer
  (`superset/mcp_service/utils/response_utils.py`) — reused as one layer of
  prompt-injection defense.
- The MCP `execute_sql` tool renders Jinja, parses with
  `superset.sql.parse.SQLScript`, fail-closes on unparseable SQL, blocks
  destructive DDL unconditionally, and leaves DML to the per-database
  `allow_dml` flag — i.e. SQL safety classification is enforced by existing
  code, not by the model.

## MCP transport and invocation path

The MCP service normally runs as a separate streamable-http process
(`superset mcp run`, default `127.0.0.1:5008`) or over stdio. There is no
first-class in-process client, but the in-memory FastMCP transport —
`fastmcp.Client(mcp)` where `mcp` is the `superset.mcp_service.app` instance —
is the pattern used by all 158 MCP unit-test files and exercises the full
middleware chain (RBAC visibility, auth hook, size guards, error handling).

The gateway uses that in-memory transport. A probe confirmed from a Flask
request context (with `MCP_DEV_USERNAME` cleared and `g.user` set):
`list_tools` returns 70 tools with annotations, and `call_tool` executes under
the `g.user` identity through the full authorization path.

## Authentication model

`superset/mcp_service/auth.py::get_user_from_request` resolves the MCP user
with strict priority: (1) JWT ContextVar from the FastMCP request, (2) API key
header, (3) `MCP_DEV_USERNAME` config, (4) `g.user` fallback. When invoked
in-process from an authenticated Superset web request, (1) and (2) are absent
and identity comes from (4) — the session user — **unless** the operator has
set `MCP_DEV_USERNAME`, which would take precedence and could resolve tools to
a different principal than the browser session. The gateway therefore fails
closed: before any tool execution it verifies that the identity the MCP layer
would resolve matches the authenticated web user, and refuses tool execution
with a configuration error otherwise.

## Permission enforcement

- Route level: the gateway API is a `BaseSupersetApi` (`csrf_exempt = False`)
  with `@protect()` on every route; browser sessions carry CSRF tokens
  automatically (`X-CSRFToken`, fetched via `authentication.getCSRFToken()`).
- Object level: performed by the MCP tools themselves (Superset
  `security_manager` checks, DAO base filters) under the current user.
- Tool level: server-side allowlist (`AI_CHAT_CONFIG["ALLOWED_MCP_TOOLS"]`)
  intersected with per-user tool visibility from `list_tools`; classification
  (read-only / mutating / destructive) derived from declared
  `ToolAnnotations`, with unknown or unannotated tools defaulting to the most
  restrictive class and never auto-executing.
- Mutation level: server-generated, single-use, expiring approval records
  bound to (user, conversation, tool name, canonicalized arguments hash),
  stored in the metadata database via `KeyValueDAO` (new
  `KeyValueResource.AI_CHAT_APPROVAL`). Changing arguments invalidates the
  approval; approvals are consumed atomically on use.

## Extension registration mechanism

The frontend registers through the public API only:

```tsx
import { chat } from '@apache-superset/core';
chat.registerChat(
  { id: 'apache-superset.ai-chat', name: '…' },
  ChatTrigger,
  ChatPanel,
);
```

No manifest contribution entry is needed for chat (the `Manifest` Pydantic
model has no `contributes` field; chat registration is pure runtime code).

## Selected implementation locations

| Piece | Location | Rationale |
|---|---|---|
| Frontend extension | `extensions/ai-chat/` | Follows the CLI project layout; loadable via `LOCAL_EXTENSIONS` for dev, bundleable with `superset-extensions-cli bundle`. |
| Backend AI gateway | `superset/ai_chat/` | Server-side secrets, approval enforcement and MCP orchestration must live behind Superset auth; follows the `api.py`/`schemas.py`/commands module conventions. |
| Backend tests | `tests/unit_tests/ai_chat/` | Standard unit-test layout (`api_test.py` naming, `client` + `full_api_access` fixtures). |
| Frontend tests | `extensions/ai-chat/frontend/src/**/*.test.tsx` | Extension is a standalone package; jest + Testing Library wired locally (no extension test template exists upstream). |

## Architectural decisions

1. **Non-streaming first.** The Flask backend has no SSE precedent (the only
   chunked responses are CSV exports). The gateway returns a typed, ordered
   list of protocol events per request (`message.completed`, `tool.running`,
   `tool.approval_required`, …) rather than a fragile pseudo-stream. The
   event protocol is the streaming contract; an SSE transport can later emit
   the same events incrementally without changing the frontend event model.
2. **Stateless server conversation.** The client sends trimmed, validated
   conversation history each turn; the server persists nothing about
   conversations except approval records. This avoids a new DB model and
   migration. Approval integrity does not depend on client honesty: approval
   records bind the exact server-canonicalized arguments.
3. **Provider abstraction over raw HTTP.** Neither the `openai` nor
   `anthropic` SDK is a repository dependency, and adding both for
   convenience is unjustified. Providers are implemented against a small
   internal interface using `httpx` (already present via the `fastmcp`
   extra), with a deterministic mock provider as the default and the test
   substrate. Provider secrets are read from server-side environment
   variables named in config; keys never transit the browser.
4. **MCP as the single operational surface.** The gateway does not
   reimplement Superset operations as bespoke REST calls; every read and
   mutation the assistant performs goes through the existing MCP tools with
   their existing authorization. The gateway's own additions are policy:
   allowlist, classification, approval, size limits, timeouts, redaction.
5. **Classification is code, not prompt.** Tool classes derive from declared
   `ToolAnnotations`; `readOnlyHint=True` → read-only, `destructiveHint=True`
   → destructive, otherwise mutating; missing annotations → destructive
   (safest). Approval enforcement happens server-side before execution;
   nothing the model or the page content says can bypass it.
6. **Extension UI built on antd + core namespaces only.** `@superset-ui/core`
   components are host-internal and not federation-shared. The panel uses
   antd (the shared singleton, so it inherits the host theme) plus
   `translation.t`, `theme.useTheme` from the core package. Markdown is
   rendered by a minimal safe renderer that emits React elements only (no
   `dangerouslySetInnerHTML`, no raw HTML pass-through, `javascript:`/`data:`
   URLs rejected) because `SafeMarkdown` is not reachable from extensions and
   vendoring `react-markdown` (ESM-only) would complicate the extension test
   toolchain for no security gain.

## Functionality that cannot safely be implemented with current APIs

- **Token-level streaming to the browser.** No SSE/websocket convention
  exists in the Flask app; delivered as documented non-streaming events (see
  decision 1).
- **Server-side cancellation of an in-flight model call.** The frontend
  aborts the fetch (`AbortController`) and the UI recovers; the server-side
  provider call runs to completion and its result is discarded. True
  cancellation needs async infrastructure out of scope here.
- **Entity-level page context from the public navigation API.** Only the
  page type is public; resource identity comes from URL parsing and is
  validated server-side before use.
- **`onDidResizePanel`-driven layout** — the event never fires on this host.
- **Atomic multi-step dashboard creation.** The MCP surface has no
  transaction concept; the assistant reports per-step status honestly and
  never claims atomicity (`generate_dashboard` and read-back verification
  mitigate).
- **Per-user rate limiting.** There is no per-endpoint limiter convention in
  the codebase (only global + auth limits); request-size and iteration limits
  are enforced instead.
