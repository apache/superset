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

# Semantic result completeness

Providers reject incomplete or unverifiable results from `get_table`,
`get_values` and `get_row_count` by raising the public
`superset_core.semantic_layers.errors.SemanticResultCompletenessError("incomplete")`
or `SemanticResultCompletenessError("unverified")`, available from
`apache-superset-core` 0.2.0. It is a plain exception that carries only the
closed reason code, so providers need no `superset` import. Import it from
`superset_core.semantic_layers.errors`, not from `superset.exceptions`.

The host converts it at the provider-call boundary into
`superset.exceptions.SemanticResultCompletenessError`, a host class with the same
name whose fixed translated messages provide retry guidance without accepting
upstream diagnostic text. For one release the host also accepts the host class
raised directly by a provider; new providers should raise the `superset_core`
error. The host error is a `QueryObjectValidationError`; chart and value APIs
return a client error, and
async execution fails before publishing a successful result cache key. Required
annotation queries propagate the same failure. Do not substitute an empty result
or retry a failed filtered query without its filter.

For async chart-data tasks, the worker also records the closed reason code in
`payload.semantic_result_error` (`incomplete` or `unverified`) and re-raises the
exception. It never publishes a success cache key for that failure. Explore
reads the reason through the existing authorized task-detail endpoint; realtime
and polling status notifications carry no error text. The client uses fixed
translated guidance only when every failed task has the same recognized reason.
Mixed completeness reasons or a completeness failure combined with another
failure keep the generic message. When no failed task has a recognized
completeness reason, the client may use the sanitized ordinary query error from
the authorized task-status endpoint; it never displays raw task-detail text.
Unavailable status details fall back to generic guidance. The status lookup and
subsequent completeness lookup are each bounded to five seconds. Cancellation
and client reinitialization discard late guidance. Old workers without the marker
use ordinary failure guidance, so coordinated host, worker and frontend rollout
is required for structured completeness guidance.

When changing a provider's result guarantee, declare a stable class-level
`result_cache_version: ClassVar[str | None]`. The default is `None`, preserving
existing behavior. The host reads this declaration from the registered provider
class without constructing it and namespaces chart DATA keys, value suggestions
and parent chart keys for chart-backed semantic annotations. A new nonempty
version must accompany a stronger guarantee; never advertise it before the guard
is enforced across table, count and value execution. Existing access and RLS
checks remain in effect before cached data is returned.

Deploy a compatible host and provider to every web and worker process. Drain
in-flight legacy deliveries and pointers before activation. Cache versioning
isolates late legacy writes; it cannot upgrade an old worker's execution or make
a mixed fleet safe. No global cache deletion is required. A rollback must retain
the validated guarantee or disable the affected provider while it is repaired.
