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

# SIP: Embedded-only fallback credential on OAuth2 database connections

## [DRAFT — proposal for discussion]

This document is a draft proposal accompanying the code in this PR. It is intended to
seed the formal SIP discussion. The code is complete and tested, gated behind a new
feature flag that defaults to `False`, and changes nothing for any existing deployment
until that flag is turned on.

## Motivation

Per-user database OAuth2 and embedded dashboards do not currently compose.

When a database connection authenticates users individually via OAuth2, Superset
resolves a per-user token for the requesting principal and uses it to connect. An
embedded viewer, however, signs in with a guest token rather than a Superset account.
There is no Superset user, so there is no per-user token to resolve — and an external
viewer (a customer, a partner, a member of the public) frequently has no identity on the
analytical database at all, so there is no token that *could* be minted for them.

The result today is that embedded dashboards simply cannot run queries against a
per-user OAuth2 connection. Until the companion fix in
`fix(oauth2): don't start the OAuth2 dance for embedded guests`, the failure was also
unhelpful: Superset tried to start an authorization flow the guest cannot complete,
read `g.user.id` on a principal that has none, and returned an HTTP 500 instead of the
driver's error.

This is not a hypothetical. It is the shape of every deployment that embeds dashboards
for external viewers while moving internal users onto per-user OAuth2 — a direction
several warehouses, Snowflake among them, actively push customers toward.

The workarounds available today are all worse:

- **Keep a second connection** with service-account credentials for embedded use. This
  duplicates every connection-level setting and relies on nothing ever pointing an
  internal dashboard at the service-account copy.
- **Drop per-user OAuth2** for any database that feeds an embedded dashboard, losing
  per-user attribution for internal users to serve external ones.
- **Mint a Superset account per external viewer**, which defeats the purpose of guest
  tokens.

## Proposed change

Let a single connection carry a username and either a password or a PEM private key used
**only** when the requesting principal is an embedded guest. Logged-in users continue to
authenticate per-user via OAuth2, with no route by which they can reach the stored
credential.

The credential is stored per-connection in the existing `encrypted_extra` column
(`embedded_credentials: {username, password}` or
`{username, auth_method: "keypair", privatekey_body, privatekey_pass}`) and configured
through the connection dialog like any other connection secret. The passphrase is
optional. It is **not** configured in `superset_config.py`:
operators manage connections in the UI, and a credential in config could not be scoped
to one connection.

### The gate

One function — `Database.get_embedded_fallback_credentials()` — returns the credential
only when all five conditions hold:

1. the deployment opted in via `EMBEDDED_CREDENTIAL_FALLBACK` (default `False`);
2. the engine opted in via `BaseEngineSpec.supports_embedded_credential_fallback`
   (Snowflake is the only `True`);
3. the connection stores a **complete** credential — a half-filled one is ignored
   rather than half-applied;
4. the current principal is an embedded guest **and** `EMBEDDED_SUPERSET` is enabled;
5. the connection has an OAuth2 client configured **and** `impersonate_user` enabled,
   keeping this a fallback for the per-user flow rather than a second identity on an
   ordinary connection. Deployment-wide client configuration is checked independently
   of request context so restored async guests use the same credential.

Condition 4 checks the feature flag explicitly rather than relying on
`get_current_guest_user_if_guest()`, which is a bare `isinstance` check. A `GuestUser`
can only reach `g` through the guest-token request loader, which is itself gated — but a
security boundary should not rest on that implication.

Conditions 1, 2, 4 and 5 — everything except the stored credential — are also exposed on
their own as `Database.embedded_fallback_applies()`. That split is what lets
`_get_sqla_engine` tell two cases apart that otherwise look identical: *this request has
nothing to do with the fallback*, and *this is an embedded guest on a connection that has
no credential for them*. See **Refusing rather than falling back** below.

### Refusing rather than falling back

`_get_sqla_engine` applies the fallback *instead of* impersonation. An embedded viewer
on a per-user OAuth2 connection with no (or a half-filled) credential must not query
as the connection's base account. Neither the viewer nor the dashboard author can see
that identity change. Connections with impersonation disabled retain their ordinary
service-account behavior and do not use the fallback.

With `EMBEDDED_CREDENTIAL_FALLBACK` on, that case is refused instead. So is a guest on
a connection with impersonation enabled but no OAuth2 client at all: on Snowflake,
impersonation without OAuth2 never changed the login, so such a connection served
guests under its base account, and with the flag on it stops serving them until an
administrator either turns impersonation off or configures an OAuth2 client and an
embedded credential. The refusal is scoped to the flag so that a deployment which has
not opted in keeps its existing behaviour.

The refusal reaches only guests, whose error responses are redacted to a generic
message unless Superset authored the error type. It is therefore raised as a
`DATABASE_SECURITY_ACCESS_ERROR` with a fixed message that names nothing about the
connection, so the viewer learns the chart's connection isn't set up for embedded
dashboards. The administrator's explanation, naming the connection and the fix, goes
to the server log.

The connection dialog removes the ways to reach that state in the first place: the
section is offered only when both flags are on *and* the connection uses OAuth2, a
malformed or incomplete effective credential is rejected on save while both flags are
enabled, and a credential saved with impersonation off raises an inline warning
explaining that it is inactive. Form edits replace the stored credential before
completeness is checked. The save/test schemas and parameter-validation command use the
engine's `validate_embedded_credentials` hook, matching query-time rules even for custom credential shapes. The default rule
rejects whitespace-only usernames without trimming valid credential values.
Disabling either flag leaves stored credentials intact and skips completeness checks,
allowing unrelated edits to imported connections. The backend refusal is the backstop
for the paths that do not go through the dialog.

### Cache identity

The fallback changes the connection identity without going through impersonation, and
the DATA cache key has no acting-user component of its own —
`add_impersonation_cache_key_if_needed` only contributes one under `CACHE_IMPERSONATION`,
`CACHE_QUERY_BY_USER` or `per_user_caching`. Left alone, an embedded guest and a
logged-in user would compute the same `query_cache_key` for a physical dataset with no
RLS and no Jinja, and read each other's rows. Because that key is also the `task_key` of
the SHARED async chart task, they would additionally dedup onto one task, letting
whichever arrived first choose the credential for both.

So a guest-run query contributes the engine-provided key (by default,
`embedded:<configured username>`) in a dedicated `embedded_credentials_key` field,
distinct from the logged-in `impersonation_key` even when their values match. This applies
unconditionally — this is correctness, not a caching preference. The key comes from the
stored credential rather than from `g.user.username`, which a guest token's minter
controls. All guests on the connection share one entry, which is correct: they run as one
database user, and guest-token RLS already separates them.

A guest with missing or incomplete credentials contributes a separate
`embedded_credentials_missing` marker. That partition cannot reuse logged-in or
configured-fallback cache entries or async tasks, so warming the cache does not bypass
the refusal at engine creation.

### Why impersonation is skipped, not extended

On the fallback path `Database._get_sqla_engine` sets the configured username on the
SQLAlchemy URL, adds its password there when password authentication is selected, and
does **not** call `impersonate_user`. For key-pair authentication, the Snowflake engine
spec converts the stored PEM key into `connect_args.private_key`. Skipping impersonation
is deliberate and load-bearing twice over:

1. An engine that opts in sets its OAuth2 authenticator during impersonation whether or
   not a token exists. Skipping impersonation is what lets the stored credential
   authenticate at all.
2. `get_effective_user` resolves to `g.user.username`, and a `GuestUser` carries
   whatever username the guest token claims. Whoever mints the token controls that
   claim, so routing the fallback through impersonation would let the token choose the
   connection identity. A test pins this specifically: a token minted with
   `ACCOUNTADMIN` does not reach the connection.

After applying fallback credentials, `DB_CONNECTION_MUTATOR` receives the selected
connection username, keeping a hook that forwards that argument from reintroducing the
guest token's username claim.

The engine cache key includes both the URL and the final engine kwargs. A password
changes the URL; a PEM key changes `connect_args`. Tests assert that a guest and a
logged-in user produce distinct cache entries.

## Security model

This is the part worth the most scrutiny, so it is stated plainly rather than left to be
discovered.

`SECURITY.md` treats the embedded guest token as a distinct principal with no Superset
account and no database identity. This proposal grants that principal the ability to run
queries **as one operator-configured database user**, on connections where an
administrator has explicitly configured it, in deployments that have explicitly enabled
it.

What that does and does not mean:

- **Per-viewer database-side authorization does not apply.** Every embedded viewer of
  that connection queries as the same database user, so warehouse-side row-level
  security or masking policies keyed to the connecting user cannot distinguish viewers.
  Per-viewer restrictions must come from Superset's own guest-token RLS rules, which
  continue to apply unchanged. The documentation says this in the help text next to the
  field, not only in prose.
- **It does not widen what a guest can reach in Superset.** Dashboard, chart and dataset
  access are still governed entirely by the guest token's `resources` and the embedded
  dashboard's configuration. This changes only which credential the query runs under.
- **It is not reachable by a logged-in user.** Conditions 1–5 are evaluated on every
  engine creation, and the engine cache cannot leak a guest engine to a logged-in user.
- **An embedded viewer on a per-user OAuth2 connection cannot reach the base credential
  either.** Previously a guest with no applicable credential connected with the URL's own
  username and password. With the flag on, that is refused. See *Refusing rather than
  falling back* above.
- **Guest results do not cross into logged-in results.** The fallback contributes its own
  cache identity, so a shared DATA-cache entry — or a shared async task — cannot serve a
  logged-in user rows fetched under the guest credential, or the reverse. Guests without
  credentials also receive a separate partition. See *Cache
  identity* above.
- **The credential is never exposed.** The password, PEM private key, and optional
  passphrase are in Snowflake's `encrypted_extra_sensitive_fields`, so they mask to
  `XXXXXXXXXX` on read and are restored from storage when the mask is re-saved. The
  username is deliberately left visible so an administrator can audit which database
  user embedded queries run as.

The honest summary: this is the same trust decision an operator makes today when they
point a connection at a service account, narrowed to apply only to embedded guests and
only where explicitly configured. It does not create a new class of credential, and it
does not let a token holder choose an identity.

## New or changed public interfaces

- **New feature flag** `EMBEDDED_CREDENTIAL_FALLBACK`, default `False`.
- **New engine-spec attribute** `BaseEngineSpec.supports_embedded_credential_fallback`,
  default `False`; `SnowflakeEngineSpec` overrides it to `True`.
- **New `Database` methods** `get_embedded_fallback_credentials()`,
  `embedded_fallback_applies()` and `validated_embedded_credentials()`.
- **New `encrypted_extra` key** `embedded_credentials`, supporting password and key-pair
  credentials, with their secrets added to Snowflake's sensitive-field paths.
- **New connection-dialog field** for engines that opt in, rendered only when both
  `EMBEDDED_CREDENTIAL_FALLBACK` and `EMBEDDED_SUPERSET` are on and the connection uses
  OAuth2.
- **New validation** rejecting malformed or incomplete `embedded_credentials` on
  `POST`/`PUT /api/v1/database/` and on `validate_parameters` while both embedding flags
  are enabled. Import is deliberately not tightened, so existing exports still load.

No database migration: the credential lives in the existing `encrypted_extra` column.

## Migration plan and compatibility

Nothing changes for any existing deployment. The flag defaults to `False`; with it off,
`parameters_json_schema` does not offer the field, the gate never returns a credential,
and the refusal above never fires.

Turning the flag off again is a kill switch rather than a deletion: a stored credential
stops being offered and stops being used, but is preserved, so the operation is
reversible and connection export/import round-trips unchanged.

## Rejected alternatives

- **A `superset_config.py` opt-in carrying the credential itself.** An earlier
  implementation took this shape. It cannot scope a credential to one connection, hides
  a security-relevant setting from the operators who manage connections, and makes
  rotation a deploy. The feature flag proposed here is an on/off switch only; the
  credential remains per-connection.
- **Reusing the `impersonate_user` machinery.** Rejected for the two reasons in *Why
  impersonation is skipped* above — it would both defeat the mechanism and let the guest
  token choose the connection identity.
- **A second connection for embedded use.** Available today and does not need a SIP, but
  duplicates all connection configuration and offers no guard against an internal
  dashboard being pointed at the service-account copy.
- **Minting real Superset users for embedded viewers.** Defeats the purpose of guest
  tokens and does not help viewers with no warehouse identity.

## Open questions

1. **Should the opt-in be per-engine at all?** The mechanism in
   `Database._get_sqla_engine` is generic; only the "skip impersonation so the
   authenticator is not forced" reasoning is engine-specific. Snowflake is the only
   `True` here because it is the only engine whose behaviour has been verified. Other
   OAuth2 engines — Databricks, Trino, GSheets — could opt in once someone checks their
   impersonation path.
2. **Should a guest-run query be marked as such in the query log**, so that an operator
   auditing warehouse activity can tell shared-credential queries from per-user ones
   from the Superset side?
3. **The Snowflake handshake itself is unverified.** Everything up to the connection URL
   and engine kwargs is proven by test. Whether Snowflake accepts the credential on a
   connection whose client is configured for OAuth2 needs an account with an OAuth2
   security integration.
   Confirmation from anyone who has one would be welcome.
