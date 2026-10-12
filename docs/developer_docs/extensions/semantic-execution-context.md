---
title: Semantic provider execution context
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

# Semantic provider execution context

The unreleased SDK uses one `SemanticLayer.from_configuration` factory with
required keyword-only `cache_token: str` and `context: SemanticExecutionContext`,
and an optional `credentials: SemanticCredentials | None = None` reserved channel.
Providers must migrate from the optional `from_configuration_with_cache_token`
hook; there is no legacy-factory fallback. Configuration validation uses the
provider's Pydantic `configuration_class`, without constructing a provider.

The frozen context contains the server-authenticated `principal_id`, sorted
`role_ids` (including group roles), `origin`, `is_guest`, `namespace`, and an
opaque `identity_digest`. It contains no tokens, passwords or Flask objects.
The digest excludes per-view RLS and origin. The host binds a layer and its views
in one session memo, with distinct bindings for different contexts. Providers
must retain the supplied context and metadata token with their bound instance.

`ExecutionMethod.CONNECTION` is the only enabled method. Providers declare
`supported_execution_methods` (default: connection only). Under this method,
results and catalogs must not vary with the context: discovery and execution use
the configured connection credentials. The host passes `credentials=None`.
Unsupported methods and explicit policy refusals fail before provider construction
or reuse. This contract does not replace route and object authorization.

Include `cache_token` in metadata-cache keys before any lookup or eager discovery;
never use secrets as cache keys. Views echo the captured token in
`metadata_cache_token`. The context namespace uses `SEMANTIC_LAYER_CACHE_NAMESPACE`
when set, otherwise an installation UUID read or created during app initialization
and held in app memory. Namespace resolution never queries the database during a
request; if bootstrap was skipped or failed, an unconfigured namespace fails closed.
Callable tenant namespaces are evaluated at binding time and override the startup
fallback. This is distinct from the
existing metadata-generation namespace; chart, column-values and compatible-member
cache keys are unchanged. Operator workspace namespaces must agree across processes.

The existing containment `semantic_cache_scope`, context-identity and
provider-identity hooks remain in effect. Providers must supply complete,
secret-free identity material or bypass containment. A dbt manifest or compiled
catalog is still provider metadata and follows the same token partitioning rule.
`get_configuration_schema` and `get_runtime_schema` remain class methods outside
this instance-binding contract.

Only request/background origin inference is installed in this delivery; explicit
MCP/export/async binders are deferred. Before enabling any non-connection method,
the host must add async resolution pinning, effective-identity keys and refusal
checks at every cache boundary, containment identity migration, namespace startup
validation, and TTL enforcement. The reserved credentials channel and origin enum
do not enable those methods by themselves.
