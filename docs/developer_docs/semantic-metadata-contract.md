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
provider. It calls `adapter.bind(store)` once, before discovery. Rebinding raises
`MetadataRefreshError("configuration")`; an unbound refresh raises
`MetadataRefreshError("unsupported")`.

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

## Data exchanged

| Type | Fields / signature | Meaning |
| --- | --- | --- |
| `CatalogLoader` | `Callable[[float], str]` | Acquisition within a host-supplied absolute monotonic deadline returning provider-validated canonical JSON; valid empty data is allowed |
| `CatalogSnapshot` | `payload: str`, `cache_token: str`, `observed_at: str` | Immutable observation and its captured scope-qualified identity |
| `MetadataRefreshResult` | `status: Literal["changed", "unchanged"]`, `snapshot: CatalogSnapshot` | Confirmed publication, not just completed acquisition |
| `MetadataSnapshotStore.read` | `(fetch: CatalogLoader) -> CatalogSnapshot` | Valid observation or bounded coordinated acquisition |
| `MetadataSnapshotStore.refresh` | `(fetch: CatalogLoader) -> MetadataRefreshResult` | Bypass a hit and confirm a fresh publication |

The provider validates and interprets its payload. The host owns scope, expiry,
authorization and publication. These records do not validate vendor JSON or
implement coordination. `observed_at` is a UTC RFC3339 source-observation time,
not entry creation, expiry or an ordering authority.

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

The host passes `fetch(deadline)` one finite absolute deadline measured with
`time.monotonic()` in the calling process. It establishes that deadline before
waiting or acquisition and retains it through publication. The provider checks
the remaining time before each upstream operation and uses the tighter of that
budget and its own transport limit. Exhaustion raises
`MetadataRefreshError("deadline")` before further I/O; nested calls must not restart
the budget. Checking only after an unbounded request is insufficient. Actual
transport and publication budget enforcement require host/provider tests.

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
duplicate-label/raw-ID preservation, immutable records, error categories and
imports without host dependencies in a fresh isolated subprocess. The test file
is collected by the standard unit-test CI lane. The sequential example does not establish
multiworker or backend correctness.
