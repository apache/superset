---
title: Semantic provider HTTP transport
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

# Provider HTTP transport

Superset supplies a `ProviderTransport` to semantic-layer providers. This keeps
HTTP policy in the host and lets an extension use the same SDK on different hosts.
Providers import only `superset_core` for this capability, never host HTTP helpers.

## Accept the capability

The following `SemanticLayer` entry points require keyword-only `transport=`:

- `from_configuration(configuration, *, cache_token, context, transport, credentials=None)`
- `get_configuration_schema(configuration=None, *, transport)`
- `get_runtime_schema(configuration, runtime_data=None, *, transport)`

Keep it on the constructed layer and pass it to views and discovery helpers.
It is separate from `SemanticExecutionContext` and does not change memo or cache
identity. Static schema discovery still receives the capability; providers must
not perform remote discovery when no validated configuration was supplied.

## Set budgets for a logical operation

```python
import time

from superset_core.semantic_layers.transport import (
    ProviderResponse, ProviderTransport, RequestBudget,
)


def fetch_catalog(transport: ProviderTransport, endpoint: str) -> ProviderResponse:
    budget: RequestBudget = RequestBudget(
        deadline=time.monotonic() + 10.0, max_bytes=4 * 1024 * 1024,
    )
    return transport.request("Example", "GET", endpoint, budget=budget)
```

`deadline` is an absolute monotonic time on this process, not a wall-clock timestamp.
Reuse that deadline across pages, redirects and polling attempts. Each call's
`max_bytes` limits its response body. An optional `consume(size)` callback receives
chunk sizes before the per-call cap check, so a provider can account for a shared
operation budget. Use a provider-specific exception when that shared budget is
exhausted.

DNS, connect, TLS, headers and body reads all share the deadline. A timed-out or
truncated response is never returned as success. Resolution uses at most eight
shared workers; an OS resolver already running cannot be cancelled, but the caller
stops waiting at its deadline. Connected sockets are interrupted by one shared,
lazily started scheduler. Neither component starts at module import.

## Responses and errors

`ProviderResponse` owns complete bounded body bytes, case-insensitive immutable
headers, the status, and the final URL. Its `json()` uses the standard library;
JSON decoding errors remain provider errors, not transport errors.

The host returns only 2xx responses. `ProviderRequestError.failure` identifies
`INVALID_URL`, `REFUSED`, `UNREACHABLE`, `TIMEOUT`, `TOO_LARGE`,
`UNSUPPORTED_ENCODING`, or `HTTP_STATUS`. For `HTTP_STATUS`, `status` contains the
status code. These are transport faults, not deliberate query refusals. Never
log URLs, credentials, query values or response payloads when handling them.
Errors and logs include the provider display name. Pass a constant label such as
`MetricFlow` or `dbt Semantic Layer`, never endpoint or configuration values.
Labels must start with an ASCII letter or digit and contain only ASCII letters,
digits, spaces, underscores or hyphens, up to 64 characters. Other labels fall
back to `Provider`; valid labels have trailing spaces removed. Non-string labels
also use that fallback, without converting the supplied object to a string.

The transport sends `Accept-Encoding: identity` and refuses other response
encodings. Non-2xx bodies are not read. Logs contain only the sanitized provider name, status and failure
category. GET may follow at most three redirects within the same scheme, hostname
and effective port. Other redirects fail with `HTTP_STATUS` without reading their
bodies. Redirects do not reset the deadline. No automatic retries are made.

## Destination policy

By default, only HTTPS endpoints whose DNS answers are all public are allowed.
The host applies its shared `is_safe_ip` policy, including special IPv6 ranges.
It connects directly to a checked numeric address without resolving again, while
preserving the original hostname for TLS SNI and certificate verification.

Operators can set `SEMANTIC_LAYER_ALLOW_INTERNAL_HOSTS = True` in
`superset_config.py` to allow private addresses and HTTP for these providers.
This setting does not change OAuth or webhook policy. It never disables budgets,
TLS verification or redirect restrictions. Both settings ignore environment proxy
variables and never discover credentials from `.netrc`. Configure a reachable
provider endpoint rather than relying on a proxy.
In allow-internal mode, `REQUESTS_CA_BUNDLE` (or `CURL_CA_BUNDLE` as fallback)
can supply the trusted CA bundle for private TLS endpoints. Certificate and
hostname verification remain enabled. The default policy ignores both variables.
There is no per-user opt-out; trusted operators own the setting.

## Use a fake in provider tests

A fake must honor the same 2xx-or-error contract. A minimal fixed-response fake:

```python
import time
from collections.abc import Callable, Mapping
from typing import Any

from superset_core.semantic_layers.transport import (
    ProviderRequestError, ProviderRequestFailure, ProviderResponse,
    ProviderTransport, RequestBudget,
)


class FakeTransport(ProviderTransport):
    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []

    def request(
        self, provider: str, method: str, url: str, *, budget: RequestBudget,
        headers: Mapping[str, str] | None = None,
        params: Mapping[str, Any] | None = None, json: Any = None,
        consume: Callable[[int], None] | None = None,
    ) -> ProviderResponse:
        if time.monotonic() >= budget.deadline:
            raise ProviderRequestError(ProviderRequestFailure.TIMEOUT)
        self.calls.append((method, url))
        body: bytes = b'{"metrics": []}'
        if consume is not None:
            consume(len(body))
        if len(body) > budget.max_bytes:
            raise ProviderRequestError(ProviderRequestFailure.TOO_LARGE)
        if time.monotonic() >= budget.deadline:
            raise ProviderRequestError(ProviderRequestFailure.TIMEOUT)
        return ProviderResponse(200, {"Content-Type": "application/json"}, body, url)
```

Add fixture-specific failures by raising `ProviderRequestError`, rather than
returning a non-2xx `ProviderResponse`. Keep credentials out of recorded calls.
