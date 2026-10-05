---
title: Semantic provider metadata contract
---

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

# Semantic provider metadata contract

The optional interfaces in `superset_core.semantic_layers.metadata` let a provider
use a host-owned catalog store. This SDK defines the boundary; it does not supply
storage, authorization, endpoints or a refresh UI. Existing providers need no new
overrides.

## Opting in

`SemanticLayer.supports_metadata_refresh(configuration)` defaults to `False`.
Overrides must determine support without construction, network requests or cache
writes. `SemanticLayer.metadata_refresh` defaults to `None`; an opted-in provider
returns a `MetadataRefreshAdapter`. The property must return the same instance
for the layer's lifetime; views and runtime-schema discovery use that bound
instance. If support is declared but the instance is absent, an enabled host must
reject the configuration rather than silently using legacy cache keys.

The host authorizes and resolves the stored connection before constructing the
provider. It calls `adapter.bind(store, deadline=deadline)` once, before discovery. Rebinding raises
`MetadataRefreshError("configuration")`; an unbound refresh raises
`MetadataRefreshError("unsupported")`. Invalid or exhausted bind deadlines raise
`MetadataRefreshError("deadline")` before binding and leave the adapter unbound.

Full and custom views use the bound store. The adapter's instance
`get_runtime_schema(runtime_data=None)` returns the existing schema shape using
that same store, avoiding the legacy classmethod's unbound construction path.
Unsaved configuration previews cannot publish into a stored connection namespace.
A bound store failure must not silently fall back to provider-local caching.
Existing unbound preview/classmethod discovery remains a provider responsibility;
it never publishes into the stored connection namespace. The in-memory example
below demonstrates the bound path, not a complete preview implementation.

One bound scope contains one catalog covering that connection's supported runtime
configurations. A provider needing different catalogs per runtime database/schema
must not opt in until its scope can satisfy that requirement.

Discovery must be identical for every user of that connection scope. Providers
whose discovery depends on per-user OAuth credentials, impersonation or another
user-specific identity must not declare `supports_metadata_refresh`; the shared
catalog has no per-user dimension. Query authorization and result-cache user/RLS
identity remain separate host responsibilities.

## Data exchanged

| Type | Fields / signature | Meaning |
| --- | --- | --- |
| `CatalogLoader` | `Callable[[float], str]` | Acquisition within a host-supplied absolute monotonic deadline returning provider-validated canonical JSON; valid empty data is allowed |
| `CatalogSnapshot` | `payload: str`, `cache_token: str`, `observed_at: str` | Immutable observation and its captured scope-qualified identity |
| `MetadataRefreshResult` | `status: Literal["changed", "unchanged"]`, `snapshot: CatalogSnapshot` | Confirmed publication, not just completed acquisition |
| `MetadataSnapshotStore.read` | `(fetch: CatalogLoader, *, deadline: float) -> CatalogSnapshot` | Valid observation or bounded coordinated acquisition |
| `MetadataRefreshAdapter.bind` | `(store: MetadataSnapshotStore, *, deadline: float) -> None` | Bind once and capture the host operation's discovery deadline |
| `MetadataRefreshAdapter.refresh` | `(*, deadline: float) -> MetadataRefreshResult` | Pass the caller's budget to the bound store |
| `MetadataSnapshotStore.refresh` | `(fetch: CatalogLoader, *, deadline: float) -> MetadataRefreshResult` | Bypass a hit and confirm a fresh publication |

The provider validates and interprets its payload. The host owns scope, expiry,
authorization and publication. These records do not validate vendor JSON or
implement coordination. `observed_at` is a UTC RFC3339 source-observation time,
not entry creation, expiry or an ordering authority. `CatalogSnapshot` rejects
non-string fields and empty tokens/timestamps with fixed messages that do not echo
input. Timestamp syntax remains the producer's responsibility; this SDK record
does not parse RFC3339 or validate canonical JSON.

Every successful publication gets a new nonempty opaque `cache_token`, including
unchanged discovery. Cache hits retain the captured token. Equal discovery data
cannot prove equal metric definitions if the upstream selector omits complete
query semantics. `changed` includes installation without a prior observation.

`SemanticView.metadata_cache_token` defaults to `None` for legacy views. A bound
opted-in view returns the token captured with its parsed members. Hosts reject
missing tokens in that mode and include the captured token in metadata-dependent
compatibility and result-cache keys, preserving view/query/access identities.
An old result must never be labelled with a token fetched later. Host/provider
implementations must enforce and test these obligations.

## Failures and concurrency

`MetadataRefreshErrorCategory` is the typed set accepted by `MetadataRefreshError`:
`unsupported`, `configuration`, `in_progress`, `configuration_changed`, `upstream`,
`invalid_payload`, `deadline`, `unavailable` and `indeterminate`. Producers pass
these categories, not raw vendor messages or credentials; the constructor rejects
unknown values with a fixed error that does not echo them. Hosts must not expose
exception cause chains. Providers translating sensitive vendor errors should use
`raise MetadataRefreshError("upstream") from None`. HTTP status codes and
localized text belong to the host.

- `configuration_changed`: the authorized connection scope/configuration changed during the operation; discard the candidate rather than publish under obsolete authority.
- `invalid_payload`: acquisition or a stored observation cannot satisfy the provider's catalog schema; never publish partial metadata or an error as an empty catalog.
- `unavailable`: host-owned metadata storage or coordination cannot be reached or used; `upstream` instead identifies failure to acquire metadata from the provider's remote service.

The host establishes one finite absolute `float` deadline using
`time.monotonic()` in the calling process before waiting or acquisition. It passes
that value explicitly to `adapter.bind(store, deadline=deadline)`,
`adapter.refresh(deadline=deadline)`,
`store.read(fetch, deadline=deadline)` and `store.refresh(fetch, deadline=deadline)`.
The adapter forwards it to the store, and the store passes it to `fetch(deadline)`
unchanged. Multiple calls within the same operation share this deadline through
publication; neither the store nor nested acquisition may mint a new budget.
Implementations use `remaining_budget` to reject non-finite, expired or
implausibly large deadlines before I/O, including cache reads. The protocol
signatures do not execute these checks on behalf of implementations.
The provider checks
the remaining time before each upstream operation and uses the tighter of that
budget and its own transport limit. Exhaustion raises
`MetadataRefreshError("deadline")` before further I/O; nested calls must not restart
the budget. Checking only after an unbounded request is insufficient. Actual
transport and publication budget enforcement require host/provider tests.

The existing layer/view and runtime-schema discovery signatures stay compatible.
Ordinary `from_configuration(configuration)` construction remains deadline-free.
The host hands the operation's deadline to `bind`; the adapter captures it for
full/custom-view and runtime-schema discovery, passing it unchanged to store
reads. A new operation requires a fresh provider/adapter instance and a new bind,
not rebinding or renewing an existing instance's discovery budget. The explicit
store/refresh parameters remain required. The example exercises normal provider
construction followed by this bind-time handoff.

Use `remaining_budget(deadline)` before I/O and publication. It returns the
positive remaining seconds and raises `MetadataRefreshError("deadline")` for
non-finite, expired or implausibly large budgets. The SDK ceiling
`MAX_METADATA_BUDGET_SECONDS = 300.0` permits slow metadata discovery while
catching common `time.time()`/monotonic clock confusion; it is not a default or a
reason to extend the caller's budget. Longer requests must be split into bounded
operations. Hosts/providers may use tighter limits. For a host with an injected
monotonic clock, `remaining_budget(deadline, now=clock())` uses that same clock
without introducing host types into the SDK.

This value is neither a duration nor a UTC timestamp. Do not serialize it across
processes, use it as cache expiry, or use it to order publications. A deadline
cannot cancel arbitrary synchronous code and never replaces a publication fence.

An active explicit refresh can report `in_progress`. Cold readers wait/re-read
within a finite deadline or fail safely. A delayed writer cannot replace a later
accepted observation. Failure never installs an error as an empty catalog or
renews freshness. Unconfirmed publication reports `indeterminate`; a timeout proves
neither success nor rollback. These guarantees require real host backend tests.

## Separate host cache controls and diagnostics

Catalog invalidation, independent compatibility invalidation, selected-query
result refresh and read-only cache inspection are host responsibilities. No extra
provider methods are required. Catalog invalidation retires both older writer
authority and derived-cache validity. Compatibility-only invalidation need not
fetch metadata; result refresh does not imply catalog refresh.

Inspection reports recorded entry creation and expiry separately from source
observation. It must not fetch, fill or renew entries. Missing legacy timestamps
remain unknown. Cache payloads, credentials and raw keys are not diagnostic
fields. Storage instrumentation, access enforcement and UI presentation are not
functionality supplied by these SDK records.

## Compatibility and verification

No new abstract methods are added to the existing layer or view bases. Providers
importing this API must require a released SDK containing it: a disabled feature
cannot make a missing import safe. Fleet-wide freshness requires a compatible
host/provider fleet and a coordinated store. Upstream query-version pinning and
vendor-cache clearing are not promised.

`tests/unit_tests/semantic_layers/metadata_contract_test.py` contains a minimal legacy
provider and an opted-in in-memory example. It checks captured observations,
duplicate-label/raw-ID preservation, immutable records, field validation, explicit shared deadlines, error categories and
imports without host dependencies in a fresh isolated subprocess. The test file
is collected by the standard unit-test CI lane. The sequential example does not establish
multiworker or backend correctness.
