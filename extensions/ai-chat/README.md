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

# Superset AI Assistant (chat extension)

An AI assistant inside the Superset chat host. The extension registers a
trigger and panel through the public `chat` contribution API (SIP-214) and
talks to a server-side gateway (`backend/`) that invokes a
configured model provider and orchestrates the Superset MCP tools under the
current user's own permissions. Mutating operations require an explicit,
server-enforced user approval.

## Architecture

```mermaid
flowchart LR
    subgraph Browser
        T[Chat trigger] --- P[Chat panel]
        P -->|"fetch + CSRF"| G
    end
    subgraph "Superset backend"
        G["AI gateway REST API<br/>/extensions/enx-dev/ai-chat"] --> O[Orchestrator]
        O --> PR["Provider abstraction<br/>mock / openai_compatible / anthropic"]
        O --> A["Approval store<br/>(key-value, single-use)"]
        O --> B["MCP bridge<br/>(allowlist + classification)"]
        B --> M["MCP service tools<br/>(RBAC under current user)"]
    end
    PR -->|HTTPS| LLM["Model provider API<br/>(server-side key)"]
```

- **Frontend** (`frontend/`): conversation UI, tool-activity cards, approval
  cards, page-context awareness (`navigation` API), file attachments, local
  persistence, retry and cancellation. It holds no secrets and performs no
  Superset operations itself.

- **Gateway** (`backend/`): authenticates the session user (CSRF
  enforced), validates payloads, calls the provider, executes allowlisted
  MCP tools in-process through the in-memory FastMCP client (full RBAC
  middleware chain), enforces approvals, caps sizes, sanitizes errors.

- **Protocol**: one POST per turn returning an ordered list of typed events
  (`message.completed`, `tool.running`, `tool.completed`, `tool.failed`,
  `tool.approval_required`, `tool.rejected`, `request.completed`,
  `request.failed`). The event vocabulary is transport-agnostic so a future
  SSE transport can stream the same events; see Limitations.

## Registration

The entry point (`frontend/src/index.tsx`) registers as a module-level side
effect:

```tsx
import { chat } from "@apache-superset/core";
chat.registerChat({ id: "enx-dev.ai-chat", name: "…" }, ChatTrigger, ChatPanel);
```

No manifest contribution entry is required for chat.

The backend registers the same way, by import side effect. The host imports
`backend/src/enx_dev/ai_chat/entrypoint.py` — the conventional path
derived from the publisher and name in `extension.json` — and the `@api`
decorator on `AiChatRestApi` mounts the routes under
`/extensions/enx-dev/ai-chat/` as the class is created.

```
extension.json           publisher, name, version, license
frontend/src/index.tsx   frontend entry point (registers the chat)
backend/pyproject.toml   Python package metadata and build includes
backend/src/enx_dev/ai_chat/entrypoint.py
                         backend entry point (registers the API)
backend/tests/           pytest suite, run against a Superset checkout
```

## Enabling the feature

Four independent switches, all server-side:

1. **Extension framework**: `FEATURE_FLAGS = {"ENABLE_EXTENSIONS": True}`.
2. **Extension loading**: add this directory to `LOCAL_EXTENSIONS` (after
   building) or install the packaged `.supx` via `EXTENSIONS_PATH`.
3. **AI chat gateway**: `AI_CHAT_CONFIG = {"ENABLED": True, ...}`.
4. **MCP tools**: install the `fastmcp` extra
   (`pip install apache_superset[fastmcp]`); without it the assistant is
   chat-only.

When configuration is incomplete the panel shows an administrator-friendly
disabled state; no secrets are ever included in any response.

## Provider configuration

Everything lives in `AI_CHAT_CONFIG` in `superset_config.py`. Superset
itself carries no default for it; whatever you set is merged over the
defaults the extension ships in
`backend/src/enx_dev/ai_chat/settings.py`, so naming only the keys
you care about leaves the curated tool allowlist and the size limits intact.
The provider API key is read at request time from the environment variable
named by `API_KEY_ENV_VAR` — it is never stored in config, never logged, and
never sent to the browser.

### Mock (development and tests — no credentials)

```python
AI_CHAT_CONFIG = {
    "ENABLED": True,
    "PROVIDER": "mock",
}
```

The mock provider is deterministic: `list dashboards` runs a read-only tool,
`delete dashboard <id>` proposes a destructive tool (approval flow),
`run sql: <query> on database <id>` proposes SQL execution, and anything
else returns a help message.

### OpenAI-compatible endpoint

```python
AI_CHAT_CONFIG = {
    "ENABLED": True,
    "PROVIDER": "openai_compatible",
    "MODEL": "gpt-4o-mini",
    "API_KEY_ENV_VAR": "OPENAI_API_KEY",   # export OPENAI_API_KEY=<your-key>
    # Optional: any /chat/completions-compatible server (vLLM, llama.cpp,
    # OpenRouter, an internal gateway). Operator-configured only.
    # "BASE_URL": "https://internal-llm.example.com/v1",
}
```

### Anthropic

```python
AI_CHAT_CONFIG = {
    "ENABLED": True,
    "PROVIDER": "anthropic",
    "MODEL": "claude-sonnet-4-5",
    "API_KEY_ENV_VAR": "ANTHROPIC_API_KEY",  # export ANTHROPIC_API_KEY=<your-key>
}
```

> **About subscriptions vs API access**: a ChatGPT Plus subscription does
> not include OpenAI API usage, and a Claude consumer subscription does not
> include Anthropic API usage. Production use requires a separately
> provisioned API credential (or a compatible internally hosted model
> endpoint). The deterministic mock provider requires no credential at all.

### Why keys must stay server-side

A key shipped to the browser is readable by every user of the page (and by
any injected content). The gateway therefore performs all provider calls
server-side; the browser only ever talks to Superset with its session
cookie and CSRF token. Do not proxy or embed provider keys client-side.

## MCP integration and tool classification

The gateway lists tools through the in-memory FastMCP client, so the MCP
service's own authentication, RBAC and visibility filtering all apply under
the requesting user. On top of that:

- `ALLOWED_MCP_TOOLS` is an explicit allowlist — the model never sees tools
  outside it. An empty list disables tool use.

- Every tool is classified from its declared `ToolAnnotations`:
  `readOnlyHint=True` → **read-only** (executes immediately);
  `destructiveHint=True` → **destructive** (always requires approval);
  `readOnlyHint=False` → **mutating** (requires approval unless the
  operator disables `REQUIRE_APPROVAL_FOR_MUTATIONS`); missing/unknown
  annotations → **unknown**, treated like destructive and never
  auto-executed.

- SQL execution goes through the MCP `execute_sql` tool, which fail-closes
  on unparseable SQL, blocks destructive DDL unconditionally and leaves DML
  to the per-database `allow_dml` flag — classification by code, not by the
  model.

**Adding a tool**: append its name to `ALLOWED_MCP_TOOLS`. Its class is
derived automatically from its annotations; if it has none it will require
approval every time until annotated. Optional presentation-only warnings can
be added in `backend/src/enx_dev/ai_chat/classification.py::TOOL_APPROVAL_WARNINGS`.

## Approval behavior

Before any mutating/destructive call, the gateway creates a single-use
approval record in the metadata database bound to the user id, conversation
id, tool name and a SHA-256 hash of the canonicalized arguments, with a TTL
(`APPROVAL_TTL_SECONDS`, default 5 minutes). The panel shows the exact
action, target arguments, classification, reversibility hint and warnings
with Approve/Reject buttons.

- Approving sends the approval id; the server re-validates every bound
  property and consumes the record atomically before executing. Changing
  the arguments, tool, user or conversation invalidates it; replay after
  use fails.

- Rejecting burns the approval and returns a structured rejection to the
  model, which responds without executing.

- Approval is enforced server-side; nothing the model, the page content or
  the client sends can bypass it.

## Security model

- Session authentication + CSRF on every route; a dedicated `can read on
AiChat` permission lets operators grant the assistant per role.

- All Superset operations run through MCP tools under the requesting user —
  the gateway adds no privileged path. If `MCP_DEV_USERNAME` is set to a
  different user than the session user, tool execution fails closed
  (identity alignment guard).

- Prompt-injection defense in depth: trusted system prompt kept separate
  from all retrieved data; MCP wraps user-authored strings in
  `<UNTRUSTED-CONTENT>` tags; tool output is size-capped and carried only
  as tool-role data; the tool allowlist, classification and approvals are
  code-enforced; no shell/filesystem/URL-fetch/code-execution tools exist.

- The frontend renders Markdown through a minimal React-element renderer:
  no raw HTML, no `dangerouslySetInnerHTML`, unsafe link schemes refused.

- Attached files are read in the browser and travel inside the user turn as
  delimited `<ATTACHED-FILE>` blocks, which the system prompt declares to be
  reference data and never instructions — including any text written inside
  an attached image. Block markers are stripped from the file text so a file
  cannot close its own block, file names are stripped of quotes and angle
  brackets, and each attachment is capped (see Limitations). Images are
  accepted only as base64 with an allowlisted media type, are attached to
  user turns only (the gateway drops any others), and are bounded per image
  and per request. Nothing is uploaded or stored server-side.

- Errors returned to the browser are sanitized (no tracebacks, no provider
  response bodies); secret-looking argument values are redacted in events
  and logs.

## Development

```bash
# Frontend: install, test, typecheck, build
cd extensions/ai-chat/frontend
npm install
npm test                 # jest
npm run type             # tsc --noEmit over src + tests
npm run build            # webpack production build into dist/

# Backend tests (from the repo root, in the Superset venv)
pytest extensions/ai-chat/backend/tests/
```

To load the extension locally, run `superset-extensions build` in this
directory (produces `dist/manifest.json` + `dist/frontend/dist/*`) and add
the directory to `LOCAL_EXTENSIONS`. `superset-extensions bundle` packages
it as a `.supx` for `EXTENSIONS_PATH`-based deployments.

### Manual testing steps

1. `FEATURE_FLAGS["ENABLE_EXTENSIONS"] = True`, `AI_CHAT_CONFIG["ENABLED"] =
True` with the mock provider, and this extension in `LOCAL_EXTENSIONS`.
2. Log in; the robot trigger appears bottom-right. Click it — the panel
   opens in floating mode; the header toggle docks it as a sidebar.
3. Send `list dashboards` — a read-only tool card runs and the mock
   summarizes the result.
4. Send `delete dashboard <id>` — an approval card appears; Reject and
   verify nothing was deleted; repeat and Approve to execute.
5. Navigate between pages — the header context tag updates and a note marks
   the transition; the conversation is retained.
6. Set `"PROVIDER": "openai_compatible"` without a key — the panel shows the
   misconfigured state and the input is disabled.

### Adding another provider

Implement `BaseChatProvider` (`backend/src/enx_dev/ai_chat/providers/base.py`) — one
async `complete(messages, tools) -> ProviderResult` translating the neutral
message format to your wire format — and register the class in
`PROVIDERS` (`backend/src/enx_dev/ai_chat/providers/__init__.py`). Raise
`AiChatProviderError` with browser-safe messages on failure. The UI is
provider-agnostic and needs no changes.

## Limitations

- **One host import**: the MCP bridge imports `superset.mcp_service.app` to
  reach the server the host already runs. `apache-superset-core` exposes
  decorators for contributing MCP tools but no client for calling them, and
  a second server would mean a second copy of the middleware chain the
  bridge exists to go through. The import is lazy and guarded, so a host
  that moves it costs tool use rather than the whole assistant. Everything
  else in `backend/` goes through `apache-superset-core`.

- **Unreleased frontend APIs**: `chat` and `navigation` are not in
  `@apache-superset/core` 0.1.0 on npm, so the frontend builds against a
  Superset checkout and needs a host recent enough to provide the chat
  contribution point.

- **No token streaming**: the backend has no SSE convention; each turn
  returns its events at once. The typed event protocol is
  transport-agnostic so streaming can be added without changing the UI
  event model.

- **Cancellation is client-side**: cancelling aborts the fetch and recovers
  the UI; the in-flight server work completes and is discarded.

- **Page context is a hint**: the public navigation API exposes only the
  page type; the dashboard id is parsed from the URL and verified via tools.

- **No multi-step atomicity**: dashboard/chart creation reports per-step
  results honestly; there is no transaction across MCP tools.

- **History replay**: the server is stateless; the client replays trimmed
  history, so very long conversations lose their oldest turns and tool
  results are replayed as bounded excerpts.

- **Conversation storage** is browser-local (namespaced localStorage via
  the extension storage API), capped in size, cleared by "New conversation".

- **Attachments**: up to 3 per message. Text files (`.csv`, `.json`, `.log`,
  `.md`, `.py`, `.sql`, `.tsv`, `.txt`, `.yaml`, `.yml`) are capped at 1 MB
  and 20 000 characters each, longer ones truncated with a note the model is
  told to surface; there is no PDF or spreadsheet parsing. Images (`.png`,
  `.jpg`, `.jpeg`, `.gif`, `.webp`) are capped at 8 MB and require a
  vision-capable configured model — a text-only model rejects the request
  and the error surfaces with a retry. An image whose encoded payload
  exceeds \~300 KB is re-encoded in the browser with its longest edge bounded
  to 1400 px; smaller ones are sent as they are, whatever their pixel
  dimensions, and re-encoding is best-effort (the original is kept if it
  fails or does not come out smaller).

- **Dropped objects**: dragging a chart title, dashboard card or dataset
  link into the composer attaches it as context (up to 5). Identity comes
  from the dropped URL, so no host-side drag source is needed, and only
  same-origin URLs are read. They stay attached until removed with the chip's
  X or until the conversation is cleared, and travel as page context on every
  turn — so they are hints the assistant verifies with a tool, exactly like
  the page's own resource. Each message records the objects it was sent with
  above the question, as links back to them: a snapshot of the context that
  turn carried, kept even after the object is detached.

- **Attachments live in the turn**: file text counts toward
  `MAX_INPUT_CHARS`, and both files and images leave context once history
  trimming reaches that message. Images are stripped before the conversation
  is written to browser storage (a screenshot dwarfs the persistence
  budget), so a reloaded conversation keeps the message and the attachment's
  name but not the image itself.
