# Chatbot Extensions — Tickets

Lightweight, pre-implementation tickets. Each says what to build and where the
boundaries are; it does not prescribe the final code. Stack order (bottom → top):
contribution point → frontend API mount → eager loading → admin UI → backend
settings/permissions → context sharing → import/delete.

---

## 1. Define the contribution point

**Goal:** Introduce the `superset.chatbot` contribution area and the host plumbing
needed to mount a single chatbot at the application-shell level, persistent across
routes. This is the keystone everything else builds on.

**Build:**

- Register `superset.chatbot` as a recognized contribution location in the view
  registry.
- Add an app-shell / app-root contribution scope to the extension manifest schema
  so the location can be declared in `extension.json` (the current schema is
  SQL-Lab-only). Teach both manifest validation and runtime registration about it.
- Provide an exclusive-location resolver that selects exactly one renderable
  chatbot for the slot, with a deterministic first-to-register fallback and a seam
  for an externally supplied "active chatbot id" (so admin/runtime policy can plug
  in later without touching the resolver).
- Host-managed mount layout: fixed bottom-right, 24px margin, z-index above content
  and toasts, below modals.

**Out of scope:** fault isolation, admin selection UI, the lifecycle/teardown
contract, eager loading, streaming, context namespaces, authoring docs.

**Depends on:** nothing — this unblocks the rest.

**Done when:** an extension can register at `superset.chatbot` and render at the
app shell across routes; the resolver returns one provider (admin-id seam +
first-to-register fallback); unregistering removes the mount cleanly with no
duplicate bubbles.

Base branch: `enxdev/chat-prototype`

**External Links:** https://github.com/apache/superset/pull/40439

---

## 2. Host resolution & mount (frontend API entry point)

**Goal:** Turn a registered `superset.chatbot` view into a rendered, fault-isolated
bubble — the host-internal provider accessor, the selection policy, and the
fixed-position mount.

**Build:**

- Host-internal accessors on the views registry: `getViewProvider(location, id)`
  and `getRegisteredViewIds(location)`. Keep the public `getViews` descriptor-only —
  do not expose providers on the public surface.
- A registry change subscription so a mount can re-resolve without polling (fired
  on register/unregister).
- The `getActiveChatbot(adminSelectedId?, enabledMap?)` resolver implementing the
  selection policy: empty → none; drop disabled ids; admin-selected-and-enabled
  wins; else first enabled in registration order.
- A `ChatbotMount` component at the app shell that renders the active provider
  inside the host `ErrorBoundary`, re-resolves on registry change, and renders
  nothing when no chatbot is active.

**Out of scope:** the contribution location itself (#40439); eager-loading the
bundle (#40441); the settings endpoint (#40443, consumed here with silent
fallback); admin UI; the lifecycle/teardown contract.

**Depends on:** #40439 (imports `CHATBOT_LOCATION`). The settings endpoint is a soft
forward-dependency — the mount falls back to first-registered-enabled if it 404s.

**Done when:** the provider accessor and resolver behave per the policy; the mount
renders/clears correctly and survives a throwing provider via `ErrorBoundary`;
`getViews` stays descriptor-only.

Base branch: `enxdev/feat/chatbot-contribution-point` (on #40439)

**External Links:** https://github.com/apache/superset/pull/40440

---

## 3. Eager loading & extension lifecycle/teardown

> Merged: this ticket also covers the **lifecycle & teardown contract** — both are
> implemented in the same PR (#40441), so they are tracked together.

**Goal:** Boot extension bundles at app-shell startup so contributions register
before the first route, and define the host contract for tearing those
contributions down on uninstall.

**Build — eager loading:**

- An `ExtensionsStartup` component that, once the session is confirmed and behind
  `FeatureFlag.EnableExtensions`, kicks off `initializeExtensions()` in the
  background. The host renders immediately; the mount re-resolves reactively when
  registrations land.
- Wire `window.superset` so Module-Federation remotes can consume host namespaces.
- Mount `<ChatbotMount />` as a sibling of the route switch, inside
  `ExtensionsStartup`.
- On bundle-load failure: a danger toast, host stays interactive, corner stays
  empty. Add a global `unhandledrejection` logger (log only; do not suppress the
  browser default).

**Build — lifecycle/teardown contract (Model A1, per-contribution dispose):**

- During the `./index` factory call, intercept the public registrars and collect
  the returned `Disposable`s keyed by extension id.
- `deactivateExtension(id)` is the single teardown entrypoint: it fires every
  collected `Disposable` and removes the extension from the index. A throwing
  `Disposable` must not block the others (catch per-disposable). Idempotent;
  unknown id is a no-op.
- Trigger semantics to document: **uninstall** → `deactivateExtension(id)`;
  **disable** → mount filters by `enabledMap`, does NOT fire disposables, re-enable
  needs no reload; **replace** (singleton) → resolver re-selects, the losing
  extension is not deactivated. Disposal order is best-effort (registration order),
  not a contract — consumers must be order-independent.

**Out of scope:** selective per-type eager loading (not feasible without running the
factory); the mount-boundary `ErrorBoundary` (#40440); the settings endpoint and
its subscription primitive (#40443); context namespaces (#40444); an async-aware
`deactivate(): Promise<void>` — file separately only if a graceful-flush
requirement appears.

**Depends on:** #40440 (`ChatbotMount`, resolver, registry-subscription hook). Soft
build-time deps on #40443 (settings subscription) and #40444 (namespaces) — land
those first or stub the imports.

**Done when:** enabled extensions init once at startup behind the flag without
gating initial render; the bubble appears reactively on registration;
`deactivateExtension(id)` disposes all of an extension's contributions (per-disposable
catch, idempotent); load failure toasts without throwing; teardown is verified
end-to-end on the reference chatbot (including an abort-registry controller that must
still abort on deactivate).

Base branch: `enxdev/feat/chatbot-frontend-api` (on #40440)

**External Links:** https://github.com/apache/superset/pull/40441

---

## 4. Admin configuration UI

**Goal:** Let an admin enable/disable the chatbot and, when more than one chatbot is
installed, choose which is active.

**Resolve before building:**

- Is "disable the chatbot" the existing generic extension-disable, or a
  chatbot-specific toggle? (Determines the ticket's size — prefer reusing the
  existing flag.)
- Where does the UI live? Default: the existing extensions management surface, not a
  new page.
- How does the "default chatbot" selection persist? Reuse existing extension-state
  storage or a config value — do not invent a table.
- Which permission gates it? Default: the existing Extensions-API write permission.

**Build:**

- Enable/disable control that empties the `superset.chatbot` slot when off (no broken
  placeholder).
- (Gated on the singleton-policy decision) A selection control listing candidates via
  `getViews('superset.chatbot')`, activating the choice through the resolver, falling
  back to first-to-register when unset.
- Switching the active chatbot or disabling it at runtime must dispose the previously
  active chatbot via its `Disposable` and release its in-flight stream readers (via
  `AbortController`) — no two bubbles, no leaked readers.

**Out of scope:** the singleton-policy decision itself; per-page visibility; the
resolver implementation (consumed here).

**Depends on:** #40440 (resolver) for selection; enable/disable does not wait on the
policy decision.

**Done when:** admin can enable/disable (gated by the chosen permission) and the slot
empties when off; selection picks the active chatbot with first-to-register fallback;
the persistence-mechanism and permission decisions are recorded in the ticket.

Base branch: `enxdev/chat-prototype`

**External Links:** https://github.com/apache/superset/pull/40442

---

## 5. Permissions

**Goal:** Guarantee the new page-context surface cannot expose anything the current
user can't already access through Superset's standard security model. Chatbot
extensions fetch data as any other frontend surface and inherit only the current
user's privileges; this ticket covers only the new host → extension context-sharing
path.

**Build:**

- The page-context namespaces (#40444) must derive entity metadata from the same
  permission checks that gate the underlying page — not a raw Redux pass-through.
- Canonical threat (SIP §2.1): a dashboard the user can view that contains a chart
  whose dataset they cannot query — that chart's metadata (id, name, datasource,
  viz type, form_data) must be dropped from the context payload.
- Context carries only lightweight semantic data + identifiers that resolve through
  already-protected APIs; never inline dataset rows or query results.
- Filtering applies equally to the initial read and every change-notification
  payload. A chatbot an admin has disabled receives no context at all.

**Out of scope:** REST API authorization, RBAC, RLS (already enforced by Superset);
LLM/backend auth; the singleton selection policy. The chatbot authenticates via the
user's existing session (cookie + CSRF) — no separate credential is issued.

**Depends on:** the Spike sizing the new namespaces (the per-getter filtering lands
with those getters); the Context-sharing ticket consumes the filtered getters this
one specifies.

**Done when:** context never exposes entities/ids/metadata the user can't access
(even via a manually-entered URL); the dashboard payload omits charts whose dataset
the user can't query; no inline privileged payloads; filtering covers change events
as well as the initial read; a disabled chatbot gets nothing.

Base branch: `enxdev/chat-prototype`

**External Links:** https://github.com/apache/superset/pull/40443

---

## 6. Context sharing

**Goal:** Let the chatbot read semantic page context and subscribe to changes through
public per-surface core namespaces only — never the host Redux store.

**Approach:** Deliver context through per-surface namespaces — the existing `sqlLab`
namespace plus new `dashboard` / `explore` / `navigation` namespaces that mirror its
shape (a state getter + an `Event<T>` change subscription). No new aggregate context
API. The new namespaces copy `sqlLab`'s shape but must filter the Redux state they
read (the permission filtering itself is specified by #40443).

**Build:**

- Route all chatbot page-context reads through one narrow adapter module with a fixed
  interface — the adapter is the deliverable, not scattered call sites — so swapping
  to core namespaces is a one-line change.
- Back the adapter with `sqlLab` immediately; back the dashboard/explore/navigation
  portions and wire change notifications through `navigation`'s page-change event once
  those namespaces ship.

**Out of scope:** the permission-filtering logic (#40443 + upstream namespace work);
designing the namespace API surface (upstream OSS work, sized by the Spike).

**Depends on:** a Spike to size the new namespaces (state getters + events + the
per-getter permission filtering). The namespace _shape_ is settled by the `sqlLab`
precedent; the filtering is real design work.

**Done when:** all context reads go through the single adapter (zero direct Redux
imports, greppable); SQL Lab context works today; dashboard/explore context is either
delivered or explicitly tracked as OSS-blocked (not faked); change notifications need
no polling; no extra host re-renders.

Base branch: `enxdev/chat-prototype`

**External Links:** https://github.com/apache/superset/pull/40444

---

## 7. Import / delete UI

**Goal:** Add an actions column to the extensions list with buttons to delete an
extension, set-as-default (chatbot extensions only), and import a new extension.

**Build:**

- Import an extension bundle, refreshing the list on success.
- Delete an installed extension.
- A "set as default chatbot" control, shown only for chatbot extensions.

**Out of scope:** the settings endpoint itself (#40443); the resolver (#40440).

**Depends on:** #40442/#40443 for the settings + chatbot-selection plumbing.

**Done when:** an admin can import, delete, and set a default chatbot from the
actions column, with the list reflecting changes.

Base branch: `enxdev/chat-prototype`

**External Links:** https://github.com/apache/superset/pull/40450

---

## ~~8. Fault isolation & error boundaries~~ — CLOSED (no ticket needed)

The protective fault-isolation mechanisms are **already implemented** across the
mount and eager-loading PRs, so no standalone ticket is required:

- Render/lifecycle throw → host `ErrorBoundary` around the `superset.chatbot` slot
  (#40440, reinforced by the `ChatbotRenderer` wrapper in #40441).
- Bundle-load failure → `.catch()` + danger toast in `ExtensionsLoader` (#40441).
- `activate()` throw → host try/catch in `ExtensionsLoader` (#40441).
- Escaped async rejection → `unhandledrejection` hook in `ExtensionsStartup` (#40441).
- Failed-activation cleanup → driven by `deactivateExtension` (ticket 3 / #40441).

The host stays safe under every failure class today. The only unbuilt pieces were the
**optional** "chatbot failed — Reload page" notification and structured
failure-class/telemetry logging — both judged not worth a ticket (the original spec
itself marked the reload notification "optional"). File a fresh ticket only if that
UX is later wanted.

(Original link, for reference only: PR #40433 `feat(extensions): adds chatbot P1-P2` —
closed/superseded; never a dedicated fault-isolation PR.)

---

## Notes on consolidation

- **Lifecycle/teardown** was a separate ticket pointing at the same PR as **Eager
  loading** (#40441) — merged into ticket 3 above. (This is the only true duplicate.)
- The **Permissions** ticket (#40443) is kept as-is. Note its PR also contains
  backend settings-persistence code, but the original ticket only ever scoped the
  permission-safe context surface — so the ticket stays "Permissions" and no
  persistence ticket is invented.
- The **Permissions** ticket previously had a truncated base branch
  (`enxdev/chat-protot`) — corrected to `enxdev/chat-prototype`.
- **Fault isolation** was **closed without a ticket** (see the struck-through section
  above): its protective mechanisms already shipped in #40440/#40441, and the only
  unbuilt pieces (the optional "Reload page" notification + structured telemetry
  logging) were judged not worth a ticket.
