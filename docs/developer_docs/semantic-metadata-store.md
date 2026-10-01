---
title: Shared semantic metadata storage
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.
-->

## Enablement and scope

This host implementation supports the optional [SDK metadata contract](./semantic-metadata-contract.md).
It provides storage and cache identity; it does not add refresh endpoints or UI.
Both `SEMANTIC_LAYERS` and `SEMANTIC_LAYER_METADATA_REFRESH_ENABLED` remain off
by default. A provider must explicitly declare support and supply the adapter
and captured view token. Legacy providers retain their existing behavior.

For participating stored layers, the runtime-schema endpoint uses the bound
adapter's catalog, so its choices follow refreshed metadata just like view
discovery. Participation classification normalizes invalid stored provider types
and configurations to the stable metadata configuration error. The runtime-schema
endpoint retains its existing unknown-type response.

Before enabling, configure `DISTRIBUTED_COORDINATION_CONFIG` with Redis or Redis
Sentinel, and `SEMANTIC_LAYER_METADATA_NAMESPACE` with a trusted, nonempty
string or zero-argument callable returning the deployment and tenant namespace.
Never derive that namespace from unvalidated request fields. The host combines
it with the stored connection UUID, provider type, configuration and credentials
under an HMAC using `SECRET_KEY`; keys do not contain raw credentials.

Enable only on a homogeneous compatible host/provider fleet. Redis rollback or
restore can resurrect retired entries: change the namespace before re-enabling
a recovered fleet. This cache does not provide durable cross-failover ordering.

## Publication and separate invalidation

Each successful catalog publication receives a fresh opaque token, even if the
discovery JSON is unchanged. A discovery digest is not a complete upstream
semantic-model revision. Hits retain the token and expiry. Failures retain the
previous observation's original expiry, when it still exists.

A single lease admits one writer; publication atomically compares its owner,
installs the observation and releases the lease. Catalog invalidation atomically
deletes both the observation and the old writer's authority. An expired or
invalidated writer cannot publish over a newer observation.

Compatibility answers and query results include the token captured with their
view's metadata and the view configuration. Compatibility also has an independent
random generation: clearing compatibility retires all its selection variants
without fetching metadata or invalidating query results. Late fills retain their
old captured key. Existing query/RLS identity and selected-query force refresh
remain in the query-cache path. No global key scan or upstream cache purge occurs.
The compatibility endpoint captures its generation before resolving the provider
view. A clear during that resolution cannot relabel the endpoint's old answer with
the new generation. Callers must not pre-resolve the view before this capture.

Bounds are a 30-second metadata I/O budget, a non-renewing lease capped by the
owner’s remaining budget (and at most 60 seconds), a
300-second catalog lifetime measured from acquisition start, and a 10-MiB
serialized envelope limit. Cold readers wait and re-read within the same budget.
A busy explicit refresh returns `in_progress`; an unknown write outcome returns
`indeterminate`, not success or a blind retry.

## Operation lifetime and transport

HTTP requests establish the absolute monotonic deadline before authentication
hooks. Celery tasks establish it before task execution; eager/nested work shares
the active operation. Other synchronous host callers must enter
`metadata_operation()` before access checks. A later store call never replenishes
the budget; explicit worker budgets are capped at 30 seconds. The host passes
that deadline explicitly to `adapter.bind(store, deadline=...)`. The adapter
passes it to `store.read(fetch, deadline=...)` for discovery and to
`store.refresh(fetch, deadline=...)` for an explicit refresh. An earlier caller
deadline narrows both store work and Redis transport; a deadline beyond the
operation ceiling is rejected. A call never mutates the operation or another
call's budget. Invalid/exhausted call deadlines fail before even cache-hit I/O. Access to an
already-captured layer or view remains valid after that budget expires, so a
long-running chart query does not lose its observation. Further metadata I/O
still fails at the original deadline. Provider instances and views are scoped to that operation, so reusing
a SQLAlchemy model in a later request cannot reuse an old provider observation.

Private Redis clients use the installed redis-py asyncio transport and one
cancellation timeout per command, bounded by the operation's remaining time.
This covers connection setup, Sentinel discovery and response parsing; retries
are disabled. The synchronous bridge owns and closes each event loop/client,
without changing shared coordinator pools. An uncancellable system DNS lookup
may finish in its resolver thread after timeout; the cancelled command cannot
connect or publish when that lookup finishes. Calling it inside an already-running
asyncio loop fails explicitly; async host integrations need a synchronous worker.
Provider fetches receive the same absolute deadline and must enforce it in their
own transport. Monotonic values are never serialized or used to order publications.

## Enablement limits

Read authorization remains with the canonical caller policy, using its full
chart, dashboard, guest-token or datasource context. Model construction must not
replace those policies with a narrower datasource permission check.

The chart-context factory authorizes the full semantic context before column
discovery, and query validation checks the completed context before execution.
Maintenance commands require connection-management authority and revalidate the
persisted principal, subject membership and stored binding before mutation.
These prerequisites are implemented in the API/command layer; denied cold and
warm reads are covered by zero-acquisition tests.

Production rollout still requires the default-off flag, a trusted tenant
namespace, a compatible provider and fleet, bounded metadata database and Redis
transports, topology/load/failover checks, and UI/live-provider acceptance. See
[metadata operations](./semantic-metadata-operations.md) for the authority policy,
error contract and remaining rollout gates.

Do not enable this path for deployments using semantic MCP tools or other
unadapted async/CLI callers. Existing MCP handlers require a synchronous worker
bridge with an explicit metadata operation before they can participate. An
async caller or missing operation fails before Redis I/O. This change does not
adapt those entry points.

The fresh metadata-database revalidation read uses the operator's existing
connection/statement timeouts. It is synchronous and is not cancelled by the
metadata budget; a slow metadata DB can extend elapsed request time, although
publication is rejected once the budget has expired. Configure bounded DB
transport/statement limits before fleet enablement. The Redis/provider deadline
is not a universal HTTP or warehouse-query execution timeout.

Waiting readers poll at 50 ms and open private clients; Sentinel/TLS add
connection setup work. Concurrent cold-reader load testing is an enablement gate
for the intended fleet size. Live Sentinel failover is also a deployment check.

## Read-only timing

Host helpers expose `CacheEntryInfo`, containing entry kind/state, creation time,
source observation time when known, inspection time, and finite/no-expiry/unknown
expiry. Redis value and remaining TTL are read in one operation. Calculated
wall-clock expiry is labeled an estimate; backend TTL remains authoritative.

Legacy query-result creation time reuses the existing UTC `dttm`, whose precision
is one second. Missing timestamps remain unknown. Compatibility adds timing fields
to the existing dictionary encoding and strips them from the public answer.
Inspection does not fetch a provider catalog, initialize a generation or renew TTL.

For Redis data-cache inspection, the host caller must supply a deadline-bounded
reader for the **same cache server/database** and resolve the key server-side.
The helper retains that cache's prefix and serializer. Without such a reader it
reports `unsupported`; it never falls back to an unbounded shared client. Other
backends retain unknown expiry. A null cache reports `disabled`, and unavailable
or undecodable entries do not become successful observations.

Catalog and compatibility maintenance/inspection require connection-management
authority in the host command layer. Query-result inspection retains query/RLS
access. The helpers accept internal resolved identities, not raw user cache keys.
The protected commands and API transport are a separate change.

## Verification

The unit suite exercises the actual QueryContext result cache with identical
discovery/name and results changing from 17 to 23, plus the existing compatibility
endpoint. It also covers deadline propagation, failure categories, provider binding
and non-mutating inspection.

Set `SEMANTIC_METADATA_TEST_REDIS_URL` to an isolated Redis endpoint to run
`tests/unit_tests/semantic_layers/metadata_redis_test.py`. These tests use random
owned prefixes, two processes, owner/follower barriers, blocked Redis I/O and
concurrent entry replacement. They delete only their own keys. They do not prove
a live dbt deployment, browser workflow, or Sentinel failover topology.
