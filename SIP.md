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

# [SIP] Proposal for a first-class iframe dashboard component with a runtime CSP allowlist

> **Companion SIP:** This proposal pairs with
> [`SIP-DASHBOARD-COMPONENT-CONTRIBUTION-POINT.md`](SIP-DASHBOARD-COMPONENT-CONTRIBUTION-POINT.md),
> which proposes the Extensions contribution point that would let this iframe
> component (and others) be shipped as an extension. The two are deliberately
> separate discussions: **this** SIP covers the security-sensitive feature
> (runtime CSP override + permissions); the companion covers the framework
> change. They share one POC branch so the end-to-end story is demonstrable.

> **Status:** Draft — tracking the implementation in `feat/csp-runtime-allowlist-iframe`.
> This document follows the SIP issue template and is kept in sync with the branch
> as the implementation evolves. See SIP-0
> (<https://github.com/apache/superset/issues/5602>) for the SIP process.

## Motivation

Superset ships a Talisman/Content-Security-Policy (CSP) configuration that, by
design, prevents users from embedding arbitrary external content in a dashboard.
The default policy declares `default-src 'self'` and **no** `frame-src`
directive, so an `<iframe>` pointing at any third-party origin is blocked by the
browser.

This is correct and secure default behavior, but it creates real friction:

- There is **no first-class "iframe" dashboard component**. Users historically
  smuggled iframes through Markdown, which is both a footgun and blocked by CSP.
- When an embed *is* legitimately needed (an internal tool, a status page, a
  partner widget), the only way to allow it is to **edit `TALISMAN_CONFIG` and
  restart every Superset process**. That is a deploy-time, ops-team operation —
  far too heavyweight for "let me embed this one dashboard from our other
  internal app."
- There is no in-product signal telling a user *why* their embed is blank, and
  no path to fix it.

We want to (a) make embedding a real, supported component, and (b) give trusted
Admins a controlled, audited way to widen the CSP at runtime — without
abandoning the secure-by-default posture that operators rely on.

## Proposed Change

The change has five parts.

### 1. A first-class `IFRAME` dashboard layout component

A new grid component (`IFRAME_TYPE`) modeled on the existing Markdown/Divider
components. In edit mode the user pastes a URL; in view mode the component
renders a sandboxed `<iframe>`. The component is registered through the same
surface as every other layout element (type constant, `componentLookup`, drag
palette, nesting/resize/width/wrap util maps).

The iframe is rendered with a restrictive `sandbox` attribute
(`allow-scripts allow-same-origin allow-popups allow-forms`).

### 2. Domain flagging

When the runtime-allowlist feature is enabled, the component compares the
embedded URL's **origin** against the current allowlist (fetched from the new
API). If the origin is not yet allowed, it shows an inline warning explaining
that the domain is blocked by the CSP.

### 3. "Enable domain in CSP" button

If the current user holds the new permission (Admins by default), the warning
includes an **Enable domain in CSP** button. Clicking it `POST`s the origin to
the allowlist API and re-checks. Users without the permission instead see "ask
an administrator."

### 4. Permission gating

Mutating the allowlist requires `can write on CSPAllowlist`. The `CSPAllowlist`
view-menu is registered in `SupersetSecurityManager.ADMIN_ONLY_VIEW_MENUS`, so
the capability is reserved for Admins (or a custom role explicitly granted it),
consistent with how other trusted, security-sensitive operations are scoped.

### 5. Runtime CSP override ("punched holes")

A new `csp_allowlist` metadata table stores allowlist entries. An `after_request`
hook — registered **before** flask-talisman so that, because Flask runs
`after_request` callbacks in reverse registration order, it runs **after**
Talisman has set the header — merges the operator-curated entries into the
response CSP header. Entries are cached in-process with a short TTL to avoid a DB
hit per response; a write through the API invalidates the cache in the handling
worker, and other workers converge when their cached copy expires.

The entire runtime-override path is inert unless the `CSP_RUNTIME_ALLOWLIST`
feature flag is enabled, so the static, deploy-time policy remains the default
and operators opt in explicitly.

```
Browser ──> Flask request
                 │
         Talisman after_request  (sets "Content-Security-Policy: default-src 'self'; …")
                 │
   merge_runtime_csp_allowlist   (if flag on: appends allowlist origins to frame-src, …)
                 │
            Response ──> Browser  ("…; frame-src 'self' https://embed.example")
```

#### Design decisions (resolved)

- **Scope: global.** Allowlist entries apply server-wide. CSP is a single
  per-response header; a global allowlist keeps the merge context-free and
  avoids per-dashboard request plumbing. (Per-dashboard scoping is a possible
  future extension.)
- **Operator control: feature-flagged kill-switch.** The runtime override only
  functions when `CSP_RUNTIME_ALLOWLIST` is on (default **off**). Operators who
  want a purely static policy simply leave it off and the table is never
  consulted.

## New or Changed Public Interfaces

### REST API

- `GET /api/v1/csp_allowlist/` — list entries
- `GET /api/v1/csp_allowlist/<id>` — get one
- `POST /api/v1/csp_allowlist/` — create (validates origin + directive)
- `PUT /api/v1/csp_allowlist/<id>` — update
- `DELETE /api/v1/csp_allowlist/<id>` — delete
- `DELETE /api/v1/csp_allowlist/?q=!(...)` — bulk delete

All write methods require `can write on CSPAllowlist` (Admin-only by default).
Origins are validated server-side: bare `scheme://host[:port]` only — no
wildcards, paths, query strings, fragments, or credentials. Only a fixed set of
directives may be widened (`frame-src`, `child-src`, `img-src`, `connect-src`,
`media-src`, `font-src`); notably **not** `script-src`.

### Model

- `CSPAllowlistEntry` (`superset/models/csp.py`, table `csp_allowlist`):
  `id`, `uuid`, `domain`, `directive` (default `frame-src`), `description`,
  audit columns. Unique on `(domain, directive)`.

### Feature flag

- `CSP_RUNTIME_ALLOWLIST` (default `False`) — gates the entire runtime-override
  path, backend and frontend.

### Config

- `CSP_RUNTIME_ALLOWLIST_CACHE_TTL` (default `30` seconds) — in-process cache TTL
  for the allowlist; also settable via env var.

### Frontend

- New `IFRAME` dashboard layout component and its registration across the
  dashboard util maps.
- New `FeatureFlag.CspRuntimeAllowlist` enum member.

### Security model

- New `CSPAllowlist` view-menu added to `ADMIN_ONLY_VIEW_MENUS`.

## New dependencies

None. The implementation uses existing libraries (flask-talisman,
Flask-AppBuilder, marshmallow, SQLAlchemy on the backend; existing
`@superset-ui/core` components on the frontend).

## Migration Plan and Compatibility

- One Alembic migration adds the `csp_allowlist` table
  (`a1b2c3d4e5f6`, down-revision `78a40c08b4be`). The table is empty on creation.
- Fully backward compatible: with the feature flag off (the default), behavior is
  identical to today — the static CSP is authoritative and the new table is never
  read. No existing dashboards, URLs, or policies change.
- Rollback: dropping the table and disabling the flag fully reverts the feature.

### Security review notes

This feature deliberately relocates a *capability* (widening the CSP) from a
purely deploy-time operator control into a runtime, permission-gated, audited
operation. The mitigations that keep it within Superset's trust model:

- **Off by default** behind a feature flag the operator owns.
- **Admin-only** write permission (a fully trusted principal per `SECURITY.md`).
- **Strict origin validation** server-side — no wildcards, no `script-src`.
- **Audit trail** via the audit mixin (`created_by` / `changed_by`).
- The iframe is **sandboxed** and the merge can only *widen* a directive to a
  specific origin, never relax nonce/`strict-dynamic` protections on
  `script-src`.

## Rejected Alternatives

- **Dynamically reconfiguring flask-talisman at runtime.** Talisman is configured
  once at app init. Rather than mutate its internals, we add our own
  `after_request` hook that post-processes the header it already sets. This is
  simpler, avoids depending on Talisman internals, and rides the same per-request
  header machinery Talisman already uses for its nonce.
- **Per-dashboard allowlist scoping.** More precise, but CSP is a per-response
  header; per-dashboard scoping adds request-context complexity for marginal
  benefit in the common case. Left as a possible future extension.
- **"Always on" runtime override (no kill-switch).** Simpler, but moves a
  security control fully into the app with no operator opt-out. Rejected in favor
  of the feature-flag kill-switch.
- **Shared/Redis-backed allowlist cache with cross-worker invalidation.**
  Correct but heavier. A short-TTL in-process cache is good enough: writes take
  effect immediately in the handling worker and within the TTL elsewhere, with no
  new infrastructure dependency.

## Implementation Status

- [x] Feature flag `CSP_RUNTIME_ALLOWLIST` + `CSP_RUNTIME_ALLOWLIST_CACHE_TTL`
- [x] `CSPAllowlistEntry` model + Alembic migration
- [x] DAO, marshmallow schemas (with origin/directive validation), REST API
- [x] Admin-only permission (`CSPAllowlist` view-menu)
- [x] `after_request` CSP merge hook + in-process TTL cache + invalidation
- [x] `IFRAME` dashboard component + registration across util maps
- [x] Domain flagging + permission-gated "Enable domain in CSP" button
- [x] Tests: backend unit (validation + merge + hook), backend integration (API),
      frontend unit (util + component)
- [ ] Docs (`docs/`) + `UPDATING.md` entry
- [ ] Community/security review feedback
