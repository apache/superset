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

# Native Visualization Rendering from MCP Tools: Claude, ChatGPT, and the MCP Apps Standard

**Research date: 2026-07-22** · Prepared for the Superset MCP server team
**Rev 2** — corrected after an adversarial review (GPT-5.6 Sol, max effort): protocol details fixed, Claude claims upgraded to primary sources, and a new section on Superset's current-state constraints.

**Companion docs:**
- 📚 Agor knowledge doc (published copy of this report): https://agor.sandbox.preset.zone/ui/kb/global/research/mcp-native-viz-research.md
- 📊 Notion prototype plan draft: https://app.notion.com/p/3a58718b646581bf877cd6bf0c5dbcfc

## TL;DR

Yes — a real, shipped standard now exists. **MCP Apps (SEP-1865)** became the first official extension to the Model Context Protocol on **2026-01-26**, co-authored by Anthropic, OpenAI, and the mcp-ui creators. It lets an MCP tool declare (in its **tool definition**) a `ui://` HTML resource that the host renders in a **sandboxed iframe inline in the conversation**, with bidirectional JSON-RPC over `postMessage`. It is live today in **Claude (web + desktop), ChatGPT, VS Code Copilot, Cursor, Goose, Postman**, and others. The 2026-07-28 core-spec release candidate formalizes first-class extension negotiation and recognizes MCP Apps through it; Apps remains a separately versioned extension. This is the same mechanism behind Claude's January 2026 "interactive apps" launch and ChatGPT's Apps SDK.

No client auto-renders a bare Vega-Lite spec from tool output (see §5), and MCP defines no chart-spec content type. The interchange unit is an HTML widget you ship; you bundle whatever renderer you want inside it.

**Recommendation: worth prototyping now.** The reviewer suggested a vega-embed widget over Superset's existing Vega-Lite preview as the cheapest path; **team decision (2026-07-22, Amin): rejected on quality grounds — the PoC is a polished ECharts widget with a scoped chart-type adapter** (see §7). Two Superset-side blockers must be addressed first: our MCP service strips `structuredContent` by default, and tool-search mode hides most tool definitions behind a `call_tool` proxy (§6.5).

---

## 1. MCP protocol-level support for rich content

### 1.1 Core spec baseline (no extension)

The latest **final** MCP spec revision as of this writing is **2025-11-25** (2026-07-28 is still a release candidate). A tool result carries:

- `content[]` blocks: `text`, `image`, `audio`, `resource_link`, and embedded `resource` — none of which is a chart type; `image` (base64 PNG) is the most portable *visual* block, though inline display is host-dependent (terminal clients may show an attachment or nothing);
- `structuredContent` — a **sibling field** on the result (not a member of the `content` union), JSON validated against the tool's `outputSchema` (introduced in the 2025-06-18 revision).

References: https://modelcontextprotocol.io/specification/2025-11-25/server/tools · https://modelcontextprotocol.io/docs/learn/versioning · https://modelcontextprotocol.io/specification/2025-06-18/changelog

### 1.2 MCP Apps — the official UI extension (shipped, stable)

**This is the answer to the core question.** Key facts from primary sources:

- **SEP-1865** ("MCP Apps — Interactive User Interfaces for MCP") was proposed Nov 2025 by MCP core maintainers at **OpenAI and Anthropic together with the mcp-ui creators** (Ido Salomon, Liad Yosef), formalizing patterns pioneered by the community mcp-ui project and OpenAI's Apps SDK.
  - PR: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865
  - Announcement: https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/
- The spec is published in the **`modelcontextprotocol/ext-apps`** repo and is labeled **"Stable (2026-01-26)"**, extension identifier `io.modelcontextprotocol/ui`.
  - Spec: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
  - Official docs: https://modelcontextprotocol.io/extensions/apps/overview and https://apps.extensions.modelcontextprotocol.io
- Mechanism:
  - Server declares a **UI resource** with the **`ui://` URI scheme**, MIME type **`text/html;profile=mcp-app`** (HTML only in the MVP; "other content types are reserved for future extensions" — the spec discusses external URLs as a possible future form; remote-DOM and native widgets are community/mcp-ui approaches, not official roadmap commitments).
  - **The tool definition (descriptor)** links to its UI via **`_meta.ui.resourceUri`** — this lives on the tool, not on individual tool results. (A deprecated flat `_meta["ui/resourceUri"]` form exists; use the nested one.) `_meta.ui.visibility` (`["model", "app"]`) controls whether the model, the widget, or both may call a tool.
  - Host reads the descriptor, fetches the UI resource via standard `resources/read` (it can prefetch/cache before the tool is called), and renders it in a **sandboxed iframe** inline in the chat, associating it with that tool's calls.
  - The iframe acts as an MCP client: **JSON-RPC 2.0 over `postMessage`** (`ui/initialize`, plus proxied `tools/call` so the widget can fetch fresh data, send follow-up messages, and update the model's context).
  - **`structuredContent` visibility is host-dependent**: the MCP Apps spec treats it as optimized for the UI (not added to model context), while OpenAI's docs say ChatGPT *does* expose `structuredContent` to the model (result `_meta` is widget-only). Portable design rule: always include a meaningful `text` content block as the model-facing representation, and don't assume the model sees `structuredContent`.
  - Security: mandatory iframe sandboxing; hosts enforce CSP from **`_meta.ui.csp`** (`connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains`) — "Host MUST block connections to undeclared domains"; permissions policy for camera/mic/geolocation/clipboard.
- SDK: **`@modelcontextprotocol/ext-apps`** — the **`App`** class is what the widget (iframe side) uses; **`AppBridge`** is the host-side module. Examples in React/Vue/Svelte/Preact/Solid/vanilla, including chart-like widgets (cohort heatmap, customer segmentation, scenario modeler, budget allocator, map, PDF viewer): https://github.com/modelcontextprotocol/ext-apps/tree/main/examples
- **The 2026-07-28 core spec release candidate** gives extensions first-class capability negotiation (reverse-DNS IDs via an `extensions` map) and recognizes MCP Apps through that framework. MCP Apps remains separately versioned in `ext-apps`; the RC is not final as of 2026-07-22. The available draft retains `_meta.ui.resourceUri`; the more material RC risks for us are transport/session (stateless core), capability-negotiation, and authorization changes. https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/

### 1.3 mcp-ui (community project that seeded the standard)

- https://github.com/MCP-UI-Org/mcp-ui (~5k stars, actively released through May 2026). Supports three content shapes: raw HTML, **external URL** (iframe src), and **remote-DOM** — the latter two are mcp-ui extras beyond the official MVP spec.
- The `@mcp-ui/server` / `@mcp-ui/client` packages (plus Ruby and Python server SDKs) now **implement the official MCP Apps standard** and also provide adapters for legacy hosts and for ChatGPT's Apps SDK dialect.
- Adopted by Postman, Shopify, Hugging Face, Goose, ElevenLabs; rendered by Nanobot, MCPJam, LibreChat, Smithery, and others.

---

## 2. Claude Desktop / Claude.ai

**Shipped, with primary-source documentation.** On **2026-01-26** Anthropic launched interactive MCP Apps inside Claude (simultaneous with OpenAI — coordinated launch of the open standard). Historical launch partners per press coverage (secondary): Amplitude, Asana, Box, Canva, Clay, Figma, **Hex** (a BI product rendering charts in-chat), monday.com, Slack. Coverage: [The Register](https://theregister.com/2026/01/26/claude_mcp_apps_arrives), [Help Net Security](https://www.helpnetsecurity.com/2026/01/27/anthropic-claude-mcp-integration/), [Latent Space](https://www.latent.space/p/ainews-anthropic-launches-the-mcp). The current official interactive-connector list differs from that historical nine; check Anthropic's docs for the live list.

Anthropic's support docs now confirm (primary sources):

- **Interactive connectors** render app UI across Claude web, Desktop, Cowork, and mobile: https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude
- **Custom remote connectors** (point Claude at your own remote MCP server) are available across Free, Pro, Max, Team, and Enterprise, with plan/governance differences, and **may provide interactive UI**: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp
- Tool actions are user-approved by default, but users can grant persistent approval, and some workflows may invoke allowed tools automatically — "every action requires explicit approval" is *not* guaranteed.
- Known rough edges: open issues about UI resources not rendering in specific contexts ([ext-apps#671](https://github.com/modelcontextprotocol/ext-apps/issues/671), [anthropics/claude-ai-mcp#236](https://github.com/anthropics/claude-ai-mcp/issues/236) — Cowork `3p` deployment mode). These are implementation bugs, not evidence that custom-connector UI is unsupported. Test empirically.

**Artifacts ↔ MCP bridge** (separate mechanism, also relevant): Anthropic's Artifacts documentation confirms artifacts can use **MCP integrations on supported paid plans, with each viewer authenticating independently** (https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them). Distinction that matters for us: **Artifacts are model-authored UIs** (Claude writes the HTML each time, possibly calling our MCP tools for data), while **MCP Apps are server-authored UIs** (we ship a fixed, tested widget). Complementary: a clean chart-data tool feeds both.

## 3. ChatGPT (Web, with caveats)

**Shipped; the Apps SDK is still labeled preview.**

- The **Apps SDK** (launched Oct 2025) is explicitly **built on MCP**: your "app" *is* an MCP server; tools return `structuredContent` plus metadata pointing at an HTML widget template that ChatGPT renders in a sandboxed iframe inline in the conversation. Docs: https://developers.openai.com/apps-sdk, https://developers.openai.com/apps-sdk/build/mcp-server, examples: https://github.com/openai/openai-apps-sdk-examples
- **ChatGPT supports the open MCP Apps standard** — OpenAI's docs ([MCP Apps compatibility in ChatGPT](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt)) say to **"build with standards first"**: use `_meta.ui.resourceUri` + the standard `ui/*` bridge, treating `window.openai.*` APIs as optional ChatGPT-specific extensions behind feature detection. One **standards-first codebase** can target ChatGPT, Claude, and VS Code — subject to feature detection and per-host testing, not automatically.
- Distribution: third-party submissions opened December 2025 ([OpenAI announcement](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/)); the directory was renamed the **Plugin Directory** on 2026-07-09 per OpenAI's help center ([Apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt)).
- **Plan/surface restrictions matter**: developer mode with full MCP is documented for **ChatGPT web** on eligible Business/Enterprise/Edu workspaces; Pro support is more limited. Don't assume web/desktop parity. ([Developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt), [testing guide](https://developers.openai.com/apps-sdk/deploy/testing))

## 4. Other clients (quick pass)

The official [client support matrix](https://modelcontextprotocol.io/extensions/client-matrix) lists Apps-extension support — but note it is **community-maintained and opt-in**; it does not establish version, plan, surface, or feature parity. Grouped by evidence strength:

**Vendor-verified standard support:**
- Claude web + Claude Desktop (Anthropic support docs, §2)
- ChatGPT web (OpenAI docs, §3)
- VS Code GitHub Copilot ([official blog, 2026-01-26](https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support), releases 1.109/1.110)
- Cursor 2.6 ([official changelog](https://cursor.com/changelog/2-6))
- Goose ([Block's dev guidance](https://block.github.io/goose/blog/2026/01/30/5-tips-building-mcp-apps/))

**Matrix-listed / partial or scoped support:**
- Postman — renders in a response-preview surface, not necessarily conversational inline ([docs](https://learning.postman.com/v11/docs/use/send-requests/protocols/mcp-requests/interact/))
- Microsoft 365 Copilot — scoped to MCP-backed actions in declarative agents, not every Copilot surface
- MCPJam, Archestra.AI, PostHog Code

**Legacy mcp-ui compatibility (not the same as native stable-extension support):** LibreChat, Smithery, Nanobot, mcp-use

**No inline UI:** Claude Code CLI (terminal). Windsurf: not on the matrix as of 2026-07-22 — unknown.

## 5. Vega-Lite as an interchange format

**None of the official clients surveyed documents automatic rendering of a bare Vega-Lite tool result, and MCP defines no standard Vega-Lite content type.** What exists:

- Community MCP servers (e.g. [markomitranic/vegalite](https://www.pulsemcp.com/servers/markomitranic-vegalite)) accept data + a Vega-Lite spec and return either the spec **as text** (model-visible, not rendered) or a **rendered base64 PNG** (protocol-portable, though inline display varies by host). Server-side PNG rendering is the portable-but-static approach.
- The MCP Apps spec deliberately did **not** pick a chart-spec format; the unit of exchange is an HTML widget. If you want Vega-Lite rendered, you bundle vega-embed inside your widget HTML and feed it the spec via the tool result.
- **Directly relevant to us: Superset's MCP service already emits Vega-Lite.** `get_chart_preview(format="vega_lite")` queries chart data (row-limited to 1,000) and produces a Vega-Lite v5 spec (`superset/mcp_service/chart/tool/get_chart_preview.py:396-525`, documented in `docs/docs/using-superset/using-ai-with-superset.mdx`). This makes a vega-embed widget the lowest-cost prototype path (§7).

## 6. Shipped vs. experimental vs. vaporware

**Shipped and usable today:**
- MCP Apps extension spec (stable 2026-01-26) + `@modelcontextprotocol/ext-apps` SDK + `@mcp-ui/server` (TS/Ruby/Python)
- Rendering in Claude web/desktop (all plans, per Anthropic docs), ChatGPT web (plan-gated developer mode), VS Code Copilot, Cursor 2.6, Goose
- Base64 PNG images and `structuredContent` as fallbacks (with host-dependent display/visibility)

**Early/experimental (works, expect churn):**
- The 2026-07-28 core-spec RC (extension negotiation, stateless transport, auth changes) — not final yet
- Claude Artifacts + MCP integrations (paid plans; functionality confirmed by Anthropic docs, but rollout history only via secondary sources)
- Custom-connector UI rendering in Claude — supported per docs, but with open rendering bugs in specific contexts
- ChatGPT Apps SDK — still labeled preview; directory renamed (App → Plugin Directory) mid-2026, signaling ongoing churn

**Not shipped / roadmap only:**
- Non-HTML content types in official MCP Apps — the spec discusses external URLs as a possible future form; remote-DOM and native widgets are community (mcp-ui) approaches only
- A standard chart-spec (Vega-Lite or other) MCP content type that clients auto-render — the ecosystem converged on HTML widgets instead

### 6.5 Superset current-state constraints (verified in this repo)

Two defaults in our MCP service conflict with the MCP Apps pattern and must be addressed in any prototype:

1. **`StructuredContentStripperMiddleware` strips exactly what the widget pattern needs.** It removes `outputSchema` from tool definitions and `structured_content` from every tool result, working around FastMCP 3.x auto-generated output schemas breaking Claude's bridge (`superset/mcp_service/middleware.py:420-482`; enabled by default per `docs/admin_docs/configuration/mcp-server.mdx`). The prototype needs a capability-aware replacement (strip only for hosts that need it) or targeted exemption for viz tools.
2. **Tool-search mode hides tool descriptors.** By default clients see only synthetic `search_tools` + `call_tool` (plus pinned tools) — `MCP_TOOL_SEARCH_CONFIG` in `superset/mcp_service/mcp_config.py:352-410`. A `_meta.ui.resourceUri` annotation on a *hidden* tool won't reliably trigger widget association in hosts. The viz tool must be always-visible/pinned, or tool-search must become UI-aware.
3. Also note: **`get_chart_data`'s result is not an ECharts option payload** (it's chart type + columns + rows + summaries, `superset/mcp_service/chart/schemas.py:2604-2653`), and not all Superset viz types are ECharts (tables, deck.gl, plugins) — so "feed `get_chart_data` straight into ECharts" cannot reproduce arbitrary saved charts. A renderer-adapter layer or canonical server-produced viz spec is needed for full fidelity.

## 7. Recommendation for Superset MCP

**Prototype now.** The standard is co-owned by Anthropic and OpenAI, stable-versioned, and shipped in both flagship clients plus the major AI IDEs. The risk profile is "early but converging."

Revised architecture (post-review):

1. **Dedicated, read-only, always-visible viz tool** — e.g. `get_chart_preview` (or a thin `render_chart` wrapper) exempted from tool-search hiding. Put **`_meta.ui.resourceUri` on its tool descriptor**, pointing at a versioned URI like `ui://superset/chart-viewer/v2`.
2. **v1 widget = polished ECharts bundle** (Superset theme, tooltips, legends, formatting, loading/error states) with a scoped adapter mapping `get_chart_data` payloads → ECharts options for line/bar/area/big-number/table; styled-table fallback for unsupported types. *(Team decision 2026-07-22: the reviewer's cheaper vega-embed path was rejected — the quality bar is Superset-grade rendering.)* Never promise full saved-chart fidelity across all viz types; broaden the adapter later.
3. **Every result carries a concise `text` block** (title, summary, provenance, Explore link) as the portable model-facing representation; `structuredContent` carries the bounded, versioned viz payload (host-dependent model visibility); result `_meta` only for widget-only data. Requires fixing the stripper middleware (§6.5).
4. **Interactivity via dedicated app-visible tools** (drill-down, pagination, timeframe) with `_meta.ui.visibility`. **Never expose the generic `call_tool` proxy to the widget** — it would hand the iframe a path to every tool the user can reach.
5. **Security invariants**: every widget-initiated `tools/call` re-runs Superset authz (chart/dataset/query-context/RLS) under the authenticated principal — the iframe sandbox is defense-in-depth, not authorization. No tokens/cookies/secrets in widget HTML or results. UI resources stay static and tenant-neutral (per-user data only in tool results). Treat labels/formatters as untrusted; no stored-JS execution. Row limits + pagination on payloads. Note governance implications: chart data transits the host vendor's cloud (tenant policy, residency, audit).
6. **Fallback ladder** for non-Apps hosts: PNG (`image` content, where useful) + text/alt-text + markdown table — but don't ship full rows *and* a large PNG on every call; negotiate via the `extensions` capability.
7. **Test path**: ext-apps basic-host / MCPJam + MCP Inspector locally → ChatGPT web developer mode (Business/Enterprise workspace) and a **publicly-reachable** Claude custom connector (Claude's requests originate from Anthropic's cloud; localhost is insufficient). Include RBAC/RLS, cache isolation, CSP, accessibility, and bundle-size checks. Validate our pinned FastMCP/MCP SDK versions against the extension's resource-metadata requirements and the July 2026 protocol changes.
8. **Defer**: full dashboard embedding via `frameDomains` + embedded SDK (auth complexity; external-URL content isn't official yet) and directory submissions (Claude directory / ChatGPT Plugin Directory) until the prototype proves out.

Main risks to watch: 2026-07-28 RC finalization (transport/auth changes more than `_meta.ui.*` renames), Claude custom-connector rendering bugs, and the Superset-side middleware/tool-search changes in §6.5.

---

## Source index (primary sources bolded)

- **MCP Apps spec (stable 2026-01-26)**: https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
- **SEP-1865 PR**: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865
- **MCP blog — MCP Apps proposal (2025-11-21)**: https://blog.modelcontextprotocol.io/posts/2025-11-21-mcp-apps/
- **MCP blog — MCP Apps official (2026-01-26)**: https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/
- **MCP blog — 2026-07-28 spec RC**: https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- **Core spec (2025-11-25 tools)**: https://modelcontextprotocol.io/specification/2025-11-25/server/tools · **versioning**: https://modelcontextprotocol.io/docs/learn/versioning · **authorization**: https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- **Official MCP Apps docs**: https://modelcontextprotocol.io/extensions/apps/overview · https://apps.extensions.modelcontextprotocol.io
- **Client support matrix (community-maintained)**: https://modelcontextprotocol.io/extensions/client-matrix
- **ext-apps examples**: https://github.com/modelcontextprotocol/ext-apps/tree/main/examples
- **mcp-ui**: https://github.com/MCP-UI-Org/mcp-ui · https://mcpui.dev
- **OpenAI Apps SDK**: https://developers.openai.com/apps-sdk · **MCP Apps in ChatGPT**: https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt · **Developer mode**: https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt · **Apps/Plugin Directory**: https://help.openai.com/en/articles/11487775-apps-in-chatgpt · **App submissions**: https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/
- **Anthropic support docs**: interactive connectors https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude · custom remote connectors https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp · Artifacts https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- **VS Code MCP Apps blog**: https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support · **Cursor 2.6 changelog**: https://cursor.com/changelog/2-6
- **Postman MCP interact docs**: https://learning.postman.com/v11/docs/use/send-requests/protocols/mcp-requests/interact/
- Claude launch coverage (secondary/historical): https://theregister.com/2026/01/26/claude_mcp_apps_arrives · https://www.helpnetsecurity.com/2026/01/27/anthropic-claude-mcp-integration/ · https://www.latent.space/p/ainews-anthropic-launches-the-mcp
- Claude rendering caveats: https://github.com/modelcontextprotocol/ext-apps/issues/671 · https://github.com/anthropics/claude-ai-mcp/issues/236
- Vega-Lite MCP servers (community): https://www.pulsemcp.com/servers/markomitranic-vegalite
- Goose MCP Apps tips: https://block.github.io/goose/blog/2026/01/30/5-tips-building-mcp-apps/
- Superset repo (verified in worktree): `superset/mcp_service/middleware.py:420-482` · `superset/mcp_service/mcp_config.py:352-410` · `superset/mcp_service/chart/tool/get_chart_preview.py:396-525` · `superset/mcp_service/chart/schemas.py:2604-2653`
