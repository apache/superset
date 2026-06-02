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

# [SIP] Guest Token Revocation for Embedded Dashboards

## Motivation

Superset's embedded SDK authenticates viewers with short-lived JWT **guest
tokens** minted by `SupersetSecurityManager.create_guest_access_token`. A guest
token carries the guest user, the resources (dashboards) it may view, and the
row-level-security (RLS) rules to apply to that viewer's queries.

Once minted, a guest token is valid until its `exp` claim. There is **no way to
invalidate an outstanding token** before it naturally expires. The host
application is the issuer, so it can stop minting new tokens, but tokens already
handed to browsers keep working. This is a gap whenever access needs to change
faster than the token lifetime:

- A token (or the signing secret material in the host) is suspected leaked.
- A viewer's entitlements or RLS rules change and the old, broader rules must
  stop being honored immediately.
- An operator wants a "panic button" to invalidate every embedded session.

The default token lifetime (`GUEST_TOKEN_JWT_EXP_SECONDS`) is 5 minutes, which
bounds exposure, but operators frequently raise it for UX reasons, widening the
window. Even at 5 minutes, there is no deterministic "revoke now" primitive.

The standard, lowest-risk first step for JWT revocation is a **coarse-grained
"revoke all" epoch**: a version number stamped into every token and compared at
validation time. Bumping the expected version invalidates all tokens minted
before the bump. This SIP proposes adding that primitive in a fully backward
compatible, opt-in way.

## Proposed Change

### Revocation version claim

Add a revocation version claim (`rev`) to newly minted guest tokens. The value
is the **current expected version**, an integer that starts at `0`.

At validation time (in `get_guest_user_from_request`, alongside the existing
structural claim checks), a token is rejected when its `rev` is **below** the
current expected version. A bump of the expected version therefore revokes every
outstanding token in one action.

### Where the expected version lives

The expected version is stored in the **metadata database** via the existing
`key_value` store (`KeyValueResource.APP`, a new `SharedKey`). This is the right
home because:

- It must be mutable **at runtime without a code deploy** so revocation can be
  an operational action (CLI command or, later, an admin API/UI).
- The `key_value` `APP` resource is already the established pattern for small,
  global, app-singleton values (e.g. permalink salts), so this adds no new
  infrastructure and works across multi-process / multi-host deployments through
  the shared metadata DB.

A config value was considered as the source of truth but rejected for the
primary mechanism because changing config requires editing files and restarting
every worker — the opposite of a fast revocation control. A config flag is still
used, but only as the **opt-in switch**, not as the version source.

### Backward compatibility (mandatory)

Two layers of safety keep this from breaking any existing embed:

1. **Opt-in feature flag** `GUEST_TOKEN_REVOCATION_ENABLED` (default `False`).
   When off, the validation path never consults the store and never rejects a
   token; minting stamps the default version `0` without touching the DB.
2. **Missing-claim = version 0.** Tokens minted before this feature carry no
   `rev` claim. They are treated as version `0`. Since the expected version also
   starts at `0`, `0 < 0` is false, so legacy tokens remain valid even with the
   feature enabled — right up until an admin explicitly bumps the version above
   `0`.

The net effect: enabling the feature is a no-op until an operator deliberately
revokes. This is the least-disruptive design — there is no flag-flip that
silently invalidates live sessions.

The store read is also fail-open: if the metadata lookup errors, validation
falls back to the default version rather than hard-failing token parsing.

### Triggering revocation

A CLI command bumps the version (read-increment-persist via a `key_value`
upsert):

```bash
superset revoke-guest-tokens
```

This mirrors existing `superset/cli/` command patterns and auto-registers
through the CLI loader. The command warns if the feature flag is disabled (the
version is still bumped but not yet enforced).

## New or Changed Public Interfaces

- **Config**: new `GUEST_TOKEN_REVOCATION_ENABLED: bool = False`.
- **CLI**: new `superset revoke-guest-tokens` command.
- **Token shape**: new optional `rev` claim in minted guest tokens. The
  `GuestToken` TypedDict gains an optional `rev: int`. Consumers that re-validate
  tokens out-of-band should ignore unknown claims (PyJWT does by default).
- **key_value**: new `SharedKey.GUEST_TOKEN_REVOCATION_VERSION` and an
  `upsert_shared_value` helper.

No REST API or React component changes in this phase.

## New dependencies

None.

## Migration Plan and Compatibility

No database schema migration is required — the version is stored as an ordinary
`key_value` `APP` entry, created lazily on first bump. No changes to existing
stored URLs or tokens. The feature is inert until explicitly enabled and
triggered.

## Phased rollout

- **Phase 1 (this SIP / implementation):** opt-in global epoch (`revoke all`),
  CLI trigger, metadata-store-backed version.
- **Phase 2 (future):** admin REST endpoint + UI button to revoke, with audit
  logging; optionally expose the current version for host-app health checks.
- **Phase 3 (future):** finer-grained revocation (e.g. per-embedded-dashboard or
  per-subject version namespaces) layered on the same claim/comparison
  mechanism, if demand exists.

## Rejected Alternatives

- **Per-token denylist / allowlist store.** Persist a `jti` per token and check
  membership on every request. Most precise, but adds write load on every mint,
  read load on every validation, an unbounded table to garbage-collect, and
  state that must be consistent across hosts. Disproportionate for the common
  "revoke all" need; can be added later as Phase 3 without changing the claim
  model.
- **Short expiry + refresh tokens.** Drive `exp` very low and force the host to
  re-mint frequently. Shrinks the exposure window but never gives a deterministic
  "revoke now," pushes complexity into every host integration, and increases
  mint traffic. Complementary to, not a replacement for, an epoch.
- **Rotating `GUEST_TOKEN_JWT_SECRET`.** Rotating the signing secret invalidates
  all tokens, but it is a deploy-time/config action, is all-or-nothing with no
  graceful story, and conflates signing-key management with access revocation.
- **Config-only version (no metadata store).** Simple, but changing it needs a
  redeploy/restart across all workers, defeating the goal of fast runtime
  revocation. Kept only as the opt-in flag, not the version source.
