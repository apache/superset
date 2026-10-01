---
title: Semantic metadata operations
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with the License.
You may obtain a copy at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
-->

## Authority and scope

Metadata maintenance resolves a stored semantic-view UUID and its owning
connection. It requires the existing SemanticView read permission, SemanticLayer
read/write permissions, view/layer data access, and permission to modify the
connection. View editorship alone does not grant connection maintenance.
Anonymous and embedded guest principals cannot perform maintenance. Ordinary
chart access retains its canonical guest/dashboard/viewer/editor policy.

All controls require `SEMANTIC_LAYERS`, the default-off
`SEMANTIC_LAYER_METADATA_REFRESH_ENABLED`, trusted tenant namespace, and provider
support. Provider construction happens after authorization. Fresh metadata DB
sessions recheck the persisted principal, view binding and connection configuration
before publication; request transactions are neither committed nor discarded.
Metadata DB connection/statement timeouts remain operator requirements.

## Separate operations

Use POST with `{}` and the stored view UUID for:

- `/api/v1/semantic_view/<uuid>/refresh_metadata/`: acquire and publish the
  connection catalog. Response contains `status` (`changed` or `unchanged`) and
  `observed_at`. Even unchanged discovery gets a fresh cache token internally.
- `/api/v1/semantic_view/<uuid>/invalidate_catalog/`: retire the catalog and older
  writer authority without fetching. Later authorized reads refill it.
- `/api/v1/semantic_view/<uuid>/invalidate_compatibility/`: retire compatibility
  entries only. Catalog and query-result identities stay unchanged.

No endpoint accepts raw keys, tenant/configuration overrides or unsaved edits.
No operation runs a chart or saves its settings. These commands are independent
of any particular UI. Existing query force-refresh remains separately authorized.

POST `/api/v1/semantic_view/<uuid>/cache_metadata/` with `{"kind":"catalog"}`
or `{"kind":"compatibility","selected_metrics":[],"selected_dimensions":[]}`
returns the scoped `CacheEntryInfo`. Inspection never fills the catalog, creates
a generation or renews expiry. Backend limitations are reported explicitly.
Redis inspection requires the configured bounded reader for the same data cache;
unsupported custom URL/options configurations report unsupported expiry inspection.

## Result diagnostics: captured identities only

`InspectQueryResultCommand` accepts a host-prepared query context and query index.
The normal result-key path records the private identity in the HTTP request.
Inspection rechecks canonical context access and the subject/query/RLS fingerprint.
It never recomputes a provider UID or fetches metadata. A fresh request, changed
scope, annotation query or worker-only context returns `unsupported`. This is an
intentional limit; there is no standalone raw-key or reconstruction endpoint.
Internal callers can inspect during the same request after normal key construction.
Captured identities disappear with that request and are never returned to clients.

## Failures and rollout

Discovery and maintenance map typed service failures consistently: 409 for active
refresh/configuration changes, 502 for upstream/invalid catalogs, 503 for unavailable
storage/database or unconfirmed outcomes, 504 for deadline expiry, and 422 for
unsupported/incomplete configuration. Existing access/missing-resource errors stay
403/404. Errors never include provider payloads, credentials or database statements.

The chart-context factory authorizes the full semantic context before column
discovery. Later query validation/access checks remain in place. The default-off
store alone did not provide this earlier boundary; enablement requires this command
slice plus compatible provider/fleet configuration. MCP/async/CLI adaptation,
operator timeouts, topology/load checks and UI/live-provider acceptance remain
separate rollout gates. No database migration or role grant is added.
