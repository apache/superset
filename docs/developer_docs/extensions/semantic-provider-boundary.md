---
title: Semantic provider readiness and failures
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

# Semantic provider readiness and failures

## Schema discovery

Both schema methods require keyword-only `transport` and `readiness`. Import
`SemanticCredentialReadiness` from `superset_core.semantic_layers.config` (also
exported from `superset_core.semantic_layers`). It is a plain Enum, not a string.

```python
@classmethod
def get_configuration_schema(
    cls, configuration: MyConfig | None = None, *,
    transport: ProviderTransport, readiness: SemanticCredentialReadiness,
) -> dict[str, Any]:
    schema: dict[str, Any] = MyConfig.model_json_schema()
    if readiness is not SemanticCredentialReadiness.RESOLVED:
        return schema
    if configuration is None or not configuration.password:
        return schema
    # Discover only after provider-specific required-field checks.
    # Use the supplied transport for any HTTP request.
    return schema
```

Apply the same positive identity check in `get_runtime_schema(configuration,
runtime_data=None, *, transport, readiness)`. Strings such as `"resolved"`, booleans
and unrelated objects must not enable discovery. A static schema must perform no
network activity or credential lookup and must not echo secrets in defaults/options.
Readiness is neither complete configuration nor authenticated/authorized access.
Providers still validate required fields and allowlisted runtime overrides.
An empty configuration object has no unresolved secrets and is `RESOLVED`;
providers with required fields must still reject incomplete settings themselves.

The host checks submitted preview values before partial validation can discard an
unresolved field. A preview does not fetch or restore saved secrets. Runtime
schemas use the saved connection after the existing layer access check. The host
alone understands its masking convention; client payload fields never select the
trusted readiness keyword. Static masking and fallback calls explicitly pass
UNRESOLVED. Direct SDK hosts must supply an explicit state using their own secret
resolution rules, without adopting Superset's mask.

This is a coordinated schema API upgrade. Update all overrides and direct callers
with the host/core pin containing transport and readiness; there is no fallback
that retries without safety arguments. `SemanticLayer.from_configuration` also
gains the required keyword-only `transport: ProviderTransport` parameter; update
provider factories and direct callers alongside the host/core pin. The existing
`cache_token`, `context`, and `credentials` parameters retain their contracts.
No SQL parser limit or memo policy is added to the SDK.

## Error signals

| Situation | Signal | Host behavior |
| --- | --- | --- |
| Invalid or unsupported query intent | `SemanticQueryRejectedError` with a `SemanticQueryErrorCode` | Fixed actionable guidance, HTTP 400 |
| Transport failure | Original SDK `ProviderRequestError` | Its sanitized message, query HTTP 400 |
| Terminal execution failure or invalid result | `SemanticBackendError()` | Fixed generic backend guidance, HTTP 500 |
| Incomplete or unverifiable result coverage | `SemanticResultCompletenessError` | Existing completeness guidance; never partial success |

Use INVALID_QUERY for a rejected query payload, including query compilation errors.
Keep a result-page coverage failure separate from initial/poll query rejection.
If a retrieval budget prevents coverage proof, retain the provider's completeness
classification; other transport errors propagate unchanged. A failed remote status
is not Python cancellation. Preserve security, OAuth and cancellation control flow.
Never retry without a filter or return an empty/partial successful result on failure.
Transport failures during query preparation (including provider construction and
dimension/metric discovery), dispatch, and filter-value preparation use the same
safe normalization. MCP `get_table` preserves its QueryError envelope with
host-safe guidance. Semantic-layer structure and schema endpoints retain their
own response contracts.

Raise newly translated backend errors/refusals `from None`; never place backend
responses, credentials or SQL in their public text. The host validates transport
failure/status fields and reconstructs messages with a freshly sanitized provider
label. Mutated fields and subclass formatters cannot supply public text; malformed
transport fields become generic backend faults.

Typed SDK failures log fixed event categories without causes or tracebacks.
Unexpected exceptions log their type at ERROR and retain the full traceback and
exception chain at DEBUG, server-side only. Keep these diagnostic logs restricted
to trusted operators: they may contain provider details. Public responses remain
fixed generic guidance and do not include the exception chain. The same logging
policy applies to schema enrichment, runtime schemas and structure discovery.
