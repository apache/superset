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
It provides storage and cache identity. The [metadata operations API](./semantic-metadata-operations.md)
adds authorized refresh, invalidation, and cache-inspection endpoints; this backend
layer does not add UI controls.
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
previous observation's original expiry, when it still exists. Catalog normalization
preserves JSON numeric values, including decimals beyond binary floating-point
precision and large or small exponents. Fresh metadata-database read failures
report `unavailable` without driver or SQL details.

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
A SQL-backed chart's composite result key also captures participating semantic
annotation sources. Async contribution tasks resolve totals using the dependent
task's captured catalog: a matching entry is reused, while a different catalog
requires recomputation before caching percentages. Failed totals acquisition
(including a failed payload with an empty dataframe) stops the dependent query
before contribution calculation or result caching. Pending participating tasks
created without a serialized totals query fail closed; resubmit them after
upgrading the fleet. Deploy workers before web nodes, or expect participating
contribution tasks to fail until both are upgraded: an older worker cannot accept
the serialized totals query sent by a newer web node.

The compatibility endpoint captures its generation before resolving the provider
view. A clear during that resolution cannot relabel the endpoint's old answer with
the new generation. Callers must not pre-resolve the view before this capture.

Bounds are a 30-second metadata I/O budget, a non-renewing lease capped by the
owner’s remaining budget (and at most 60 seconds), a
configurable catalog lifetime measured from acquisition start (300 seconds by
default), and a 10-MiB
serialized envelope limit. Cold readers wait and re-read within the same budget.
A busy explicit refresh returns `in_progress`; an unknown write outcome returns
`indeterminate`, not success or a blind retry.

## Snapshot lifetime and chart-cache reuse

An async query that outlasts its captured snapshot's lifetime may execute again
when the browser reads back the completed task. The worker caches its result
under the captured token, while read-back resolves the live snapshot; natural
expiry rotates that token even when discovery returns identical fields. A
forced-query nonce does not reuse a result under a different catalog token.
This preserves the same freshness rule as an independent request: identical
fields do not prove unchanged upstream definitions. Operators with long-running
queries can raise `SEMANTIC_LAYER_METADATA_SNAPSHOT_TTL_SECONDS` to reduce this
re-execution risk, trading slower metadata rediscovery for longer cache reuse.


`SEMANTIC_LAYER_METADATA_SNAPSHOT_TTL_SECONDS` sets the catalog lifetime and the
independent compatibility-generation lifetime. It defaults to `300` seconds and
accepts integer values from `1` through `2147483647`; booleans, strings, zero,
negative and out-of-range values fail with a configuration error. Catalog
acquisition time counts against this lifetime. A discovery that consumes the
entire lifetime fails with `deadline` and does not publish an expired snapshot.
The setting does not extend the 30-second discovery budget or the writer lease.
Atomic publication also caps freshness using the Redis lease's age, so transport
wait cannot add time to a snapshot. This conservative anchor begins at lease
installation, before acquisition. An exhausted publication fence rejects the
write and preserves any previous snapshot.

Natural expiry still rotates the token, even when discovery returns identical
fields: those fields need not contain the full metric definition. A longer
lifetime lets chart results remain reachable longer but delays rediscovery of
metadata changes; a shorter lifetime favors freshness and increases discovery
and chart re-query work. This bounds reuse even when a chart has a longer
`cache_timeout`. Explicit refresh still rotates immediately after successful
publication. Hits and failures never renew snapshot expiry.

Configure the same value on all participating workers. Changes affect newly
published snapshots and newly created or invalidated compatibility generations;
existing entries retain their original TTL. Use the scoped invalidation controls
when existing entries must expire earlier. Provider-supplied definition revisions
may enable safe same-definition reuse in a future change; they are not supported
by this setting.

## Operation lifetime and transport

HTTP requests establish the absolute monotonic deadline before authentication
hooks. Each chart executed directly in a Celery worker gets its own 30-second
metadata acquisition budget. Background dashboard export and async chart queries
enter this scope before query construction; cache warm-up enters before each
chart data command. Annotations, contribution totals and other nested work within
that chart share its deadline and captured observations.
Earlier task work or a slow preceding chart does not consume the next chart's
budget. Exiting a chart restores the enclosing task state, including on failure.
Inline workbook exports also give each chart its own acquisition scope; nested
work shares that chart's budget. Other eager execution inside an HTTP request
retains the request deadline. Celery tasks
retain a fallback operation for non-chart work. Other synchronous host callers must enter
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
Parsed configurations are cached only within that operation and by their stored
JSON text; changing the stored configuration invalidates the parsed value.
Provider mutation cannot alter the cached parse. Flag-off provider construction
retains its existing cache behavior.

Private Redis clients use the installed redis-py asyncio transport and one
cancellation timeout per command, bounded by the operation's remaining time.
This covers connection setup, Sentinel discovery and response parsing; retries
are disabled. Configured `CACHE_REDIS_SOCKET_TIMEOUT` and
`CACHE_REDIS_SOCKET_CONNECT_TIMEOUT` values are retained when shorter than the
remaining budget, allowing Sentinel to try another node after a node timeout.
For Sentinel deployments, set finite positive per-node timeouts inside the
existing `DISTRIBUTED_COORDINATION_CONFIG` dictionary in `superset_config.py`:

```python
DISTRIBUTED_COORDINATION_CONFIG.update(
    CACHE_REDIS_SOCKET_TIMEOUT=1.0,
    CACHE_REDIS_SOCKET_CONNECT_TIMEOUT=1.0,
)
```

These values are seconds; tune them for network and discovery latency. Standalone
settings with those names are not read by the private metadata client. Unset or invalid values use the remaining
operation budget, which can leave no time to try a second node. Each command
creates a new Sentinel client and can pay the first node's timeout again.
Unit tests verify timeout configuration, not live second-node failover.
Cleanup supports both redis-py 5.0.0's `close()` and later `aclose()` clients,
and explicitly disconnects the private Sentinel master pool.
The synchronous bridge owns and closes each event loop/client,
without changing shared coordinator pools. An uncancellable system DNS lookup
may finish in its resolver thread after timeout. At most four system lookups
can be active per process; each retains its admission slot until the actual
lookup finishes, even when the command has timed out. Waiting for a slot consumes
the original deadline. The cancelled command cannot
connect or publish when that lookup finishes. Calling it inside an already-running
asyncio loop fails explicitly; async host integrations need a synchronous worker.
Provider fetches receive the same absolute deadline and must enforce it in their
own transport. Monotonic values are never serialized or used to order publications.

The legacy `/fetch_datasource_metadata` and `/datasource/get/semantic_view/<id>/`
HTTP routes return the same safe discovery errors as REST boundaries: storage
unavailability is HTTP 503 and deadline expiry is HTTP 504. Their existing access
checks still run before view discovery.

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
See [metadata operations](./semantic-metadata-operations.md) for the protected
commands, route permissions, and API request and response shapes.

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

### Chart-backed annotations

A host chart's cache key includes the annotation source's metadata identity without
constructing its provider or running discovery. It uses the view observation already
captured in the operation, or peeks at the stored catalog snapshot. A current snapshot
allows a warm host result to be served even if provider discovery is unavailable.
On a miss, the annotation query context is prepared and authorized before the
parent warehouse query, and its participating view is captured within the original
discovery budget. A slow parent does not require a first annotation bind after that
budget expires. Cache hits do not prepare or discover annotation providers.
On a miss, the write key is recomputed after annotation acquisition so a concurrent
refresh cannot store the result under a different observation. Refreshing the catalog
changes the identity for subsequent operations. If the snapshot
is missing, expired or unreadable, a unique key forces a miss; an unknown identity never
reuses cached annotation data. If acquisition still cannot capture the keyed view,
the host returns its data without persisting the unreachable result key. Flag-off and nonparticipating providers keep legacy keys.

Participating views must return a scope-qualified token issued through their
operation's store. Unknown, forged or previously expired tokens from a provider's
own cache are rejected as configuration errors; they cannot address derived hits.
A view already captured in the operation retains its known observation after the
discovery budget or shared entry expires. This does not authorize another store
read or extend the discovery deadline.

### Gevent request isolation

Synchronous request greenlets run each private Redis asyncio loop in a dedicated
four-thread metadata pool per native thread/hub, created lazily after first use;
metadata outages do not occupy the hub pool used by its default DNS resolver. Queueing consumes the same operation deadline;
expired queued work cannot begin a Redis command. Request cancellation signals
the private task with a thread-safe callback, so abandoning a request does not
leave an uncancelled command running. Other requests' loop state, clients, retry
policy and timeouts remain independent. Ordinary native-thread callers keep the private-loop path and reject an
already-running asyncio loop.

Size gevent workers for the expected concurrent metadata demand (four active
commands per worker hub; excess requests queue within their deadline), and set
shorter per-node socket/connect timeouts so an unhealthy Redis or Sentinel node
does not consume the whole operation budget. The pool is lazy and recreated when the process or owning hub changes.
