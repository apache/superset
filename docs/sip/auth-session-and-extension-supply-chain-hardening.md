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

# SIP: Session/token lifecycle and extension supply-chain hardening

## [DRAFT — proposal for discussion]

This document seeds a formal SIP. It collects a set of related security-hardening
items that surfaced during a security review and that are **not** safely
shippable as isolated, untested PRs because each needs a behavior-sensitive
change, a schema migration, or coordination across components. Each section
states the gap, a proposed design, the compatibility considerations, and the
rejected alternatives.

Several smaller findings from the same review were already addressed as
standalone PRs (e.g. async-query JWT expiration, force-password-change, the
`EXTENSION_BLOCKLIST` gate). This SIP covers only the items that warrant a
design discussion.

## Motivation

Superset's authentication is delegated to Flask-AppBuilder (FAB) and Flask-Login.
The defaults are reasonable, but a few session/token-lifecycle behaviors fall
short of ASVS L1 expectations, and the extension system loads third-party code
with no supply-chain gating beyond a static blocklist. Addressing these in a
coordinated way (rather than piecemeal) avoids half-measures that give a false
sense of security.

---

## Part A — Session and token lifecycle

### A1. Session fixation: regenerate the session on login (ASVS 7.2.4, CWE-384)

**Gap.** `on_user_login()` does audit logging only; neither it nor FAB's
`AuthDBView.login` rotates the session on a successful authentication.

**Nuance.** With Superset's **default** signed client-side cookie sessions
(`SESSION_SERVER_SIDE = False`), classic fixation is largely mitigated: the
cookie's signed *content* changes the moment `_user_id` is written at login, so
a pre-seeded cookie cannot be reused post-auth. The real exposure is for
deployments running **server-side sessions** (`flask-session`), where the cookie
holds a stable session id that survives the privilege transition.

**Proposed design.**
- On the `user_logged_in` signal, regenerate the session identity:
  - server-side sessions: rotate the session id (snapshot the session dict,
    clear, restore) so any pre-login id is invalidated;
  - client-side sessions: no-op (already safe).
- Optionally expose `SESSION_PROTECTION` (`"strong"`) as a documented opt-in,
  noting its UX tradeoff (logout on client-identifier change).

**Compatibility.** Must preserve the post-login redirect target and any keys the
auth flow stores pre-login (OAuth `state`, `next`). Needs end-to-end testing of
DB, OAuth, and LDAP login with both session backends.

### A2. Terminate active sessions when an account is disabled or deleted (ASVS 7.4.2, CWE-613)

**Gap.** `post_update`/`post_delete` on the user API audit-log only. A disabled
or deleted user keeps access until Flask-Login's passive `is_active` check fires
on their next request — and for client-side cookie sessions there is no
server-side session to delete at all.

**Proposed design — a per-user invalidation epoch (works for both session
backends).**
- Add `sessions_invalidated_at` (UTC timestamp) per user (on `UserAttribute`, or
  a dedicated column; migration required).
- Stamp the login time into the session at `on_user_login` (`session["_login_at"]`).
- A `before_request` hook compares `session["_login_at"]` to the user's
  `sessions_invalidated_at`; if the session predates it, force a logout.
- Set `sessions_invalidated_at = now()` from `post_update` (when `active`
  flips to `False`) and `post_delete`.

This invalidates outstanding sessions regardless of session backend, without
needing to enumerate or index server-side session stores by user.

**Compatibility.** Adds one indexed timestamp column and a cheap per-request
comparison (only when the user has a non-null epoch). Backwards compatible
(null epoch ⇒ no effect).

### A3. Guest-token revocation for embedded dashboards (ASVS 7.4.1, CWE-613)

**Gap.** Guest tokens are self-contained JWTs validated only for signature,
`exp`, and `aud` — there is no revocation. When an admin revokes a guest's
access, existing tokens remain valid until `exp`
(`GUEST_TOKEN_JWT_EXP_SECONDS`, default 5 min).

**Proposed design (per-embedded-dashboard `revoked_before`).**
- Add `guest_token_revoked_before` (timestamp) to the embedded-dashboard model
  (migration required).
- In `parse_jwt_guest_token` / `get_guest_user_from_request`, reject a token
  whose `iat` is earlier than the resource's `guest_token_revoked_before`.
- Surface a "revoke active guest sessions" admin action that sets the timestamp.

**Lower-effort alternative (already partly true).** The 5-minute default `exp`
is the de-facto mitigation; rotating `GUEST_TOKEN_JWT_SECRET` is the existing
all-tokens "break glass". Document both, and keep `exp` short.

**Compatibility.** Requires `iat` in guest tokens (add it to
`create_guest_access_token`); the `revoked_before` check is opt-in per dashboard.

---

## Part B — Extension supply chain (ASVS 15.2.1, CWE-1104)

**Context.** Extensions execute arbitrary Python. A static `EXTENSION_BLOCKLIST`
(block by id or `id@version`) has already shipped, letting operators refuse a
known-bad extension. This part covers the larger, ongoing controls.

**Gaps.**
- No check of an extension (or its declared `dependencies`) against a known
  vulnerability database.
- No maximum-age / minimum-version policy.

**Proposed design.**
- Pluggable advisory source (`EXTENSION_ADVISORY_PROVIDER`) queried at load time
  against OSV / the GitHub Advisory Database, with results cached.
- An allowlist/min-version policy (`EXTENSION_VERSION_POLICY`) checked alongside
  the existing blocklist in `get_extensions()`.
- A "fail open vs fail closed" config switch so offline/air-gapped deployments
  aren't broken by an unreachable advisory source.

**Compatibility.** Off by default (no provider configured ⇒ today's behavior).
Network egress and caching need design; this is the largest item here and likely
its own follow-up SIP.

---

## Phasing

1. **A2 (session invalidation epoch)** — highest value, self-contained mechanism;
   good first implementation.
2. **A1 (login session regeneration)** — needs cross-backend login testing.
3. **A3 (guest-token revocation)** — schema + admin UI.
4. **Part B** — advisory-source integration; likely a separate SIP.

## Already shipped (related, out of scope here)

- Async-query JWT `exp` + sliding refresh.
- Force-password-change-on-first-use (opt-in) + password complexity policy.
- `EXTENSION_BLOCKLIST` static gate.
- ZIP total-size cap / zero-division guard; SSH `server_address` validation;
  embedded `Sec-Fetch-Dest` check.

## Rejected alternatives

- **Rely solely on `SESSION_PROTECTION="strong"`** for A1/A2 — blunt (logs users
  out on benign network changes) and doesn't cover account disable/delete.
- **Enumerate server-side session stores by user** for A2 — backend-specific and
  impossible for client-side cookie sessions; the invalidation-epoch approach is
  backend-agnostic.
- **Shorten guest `exp` to seconds** instead of A3 — degrades embedded UX and
  still leaves a window.

## Open questions

- Where should `sessions_invalidated_at` live — `UserAttribute` or a new `ab_user`
  column (FAB-owned table)?
- Should A1 default to active for server-side-session deployments, or stay
  opt-in?
- Should Part B be split into its own SIP given its scope and network/egress
  implications?
