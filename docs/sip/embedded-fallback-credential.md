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

Let a single connection carry a username and password used **only** when the requesting
principal is an embedded guest. Logged-in users continue to authenticate per-user via
OAuth2, with no route by which they can reach the stored credential.

The credential is stored per-connection in the existing `encrypted_extra` column
(`embedded_credentials: {username, password}`) and configured through the connection
dialog like any other connection secret. It is **not** configured in `superset_config.py`:
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
5. the connection actually uses OAuth2, keeping this a fallback for the per-user flow
   rather than a second identity on an ordinary connection.

Condition 4 checks the feature flag explicitly rather than relying on
`get_current_guest_user_if_guest()`, which is a bare `isinstance` check. A `GuestUser`
can only reach `g` through the guest-token request loader, which is itself gated — but a
security boundary should not rest on that implication.

### Why impersonation is skipped, not extended

On the fallback path `Database._get_sqla_engine` sets the credential on the SQLAlchemy
URL and does **not** call `impersonate_user`. That is deliberate and load-bearing twice
over:

1. An engine that opts in sets its OAuth2 authenticator during impersonation whether or
   not a token exists. Skipping impersonation is what lets the stored credential
   authenticate at all.
2. `get_effective_user` resolves to `g.user.username`, and a `GuestUser` carries
   whatever username the guest token claims. Whoever mints the token controls that
   claim, so routing the fallback through impersonation would let the token choose the
   connection identity. A test pins this specifically: a token minted with
   `ACCOUNTADMIN` does not reach the connection.

The credential goes on the URL rather than into `connect_args` so that the per-process
engine cache key — which has no user component — differs between a guest and a
logged-in user. A test asserts the two produce distinct cache entries.

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
- **The credential is never exposed.** `$.embedded_credentials.password` is in
  Snowflake's `encrypted_extra_sensitive_fields`, so it masks to `XXXXXXXXXX` on read
  and is restored from storage when the mask is re-saved. The username is deliberately
  left visible so an administrator can audit which database user embedded queries run
  as.

The honest summary: this is the same trust decision an operator makes today when they
point a connection at a service account, narrowed to apply only to embedded guests and
only where explicitly configured. It does not create a new class of credential, and it
does not let a token holder choose an identity.

## New or changed public interfaces

- **New feature flag** `EMBEDDED_CREDENTIAL_FALLBACK`, default `False`.
- **New engine-spec attribute** `BaseEngineSpec.supports_embedded_credential_fallback`,
  default `False`; `SnowflakeEngineSpec` overrides it to `True`.
- **New `Database` method** `get_embedded_fallback_credentials()`.
- **New `encrypted_extra` key** `embedded_credentials`, with
  `$.embedded_credentials.password` added to Snowflake's sensitive-field paths.
- **New connection-dialog field** for engines that opt in, rendered only when the
  feature flag is on.

No database migration: the credential lives in the existing `encrypted_extra` column.

## Migration plan and compatibility

Nothing changes for any existing deployment. The flag defaults to `False`; with it off,
`parameters_json_schema` does not offer the field and the gate never returns a
credential.

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
   is proven by test; whether Snowflake accepts the credential on a connection whose
   client is configured for OAuth2 needs an account with an OAuth2 security integration.
   Confirmation from anyone who has one would be welcome.
