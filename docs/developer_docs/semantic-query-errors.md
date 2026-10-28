---
title: Semantic provider query errors
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

# Semantic provider query errors

Providers can distinguish deliberately rejected query input from operational failures
by raising `superset_core.semantic_layers.errors.SemanticQueryRejectedError`.
Its `SemanticQueryErrorCode` accepts `UNSUPPORTED_QUERY`, `UNSUPPORTED_OFFSET`,
`INVALID_FILTER`, and `INVALID_QUERY`. Unknown code strings normalize to
`INVALID_QUERY`. Do not pass provider diagnostics, SQL, or credentials as codes.

The host selects localized messages for these codes. Chart-data execution returns
HTTP 400 for typed rejections, including row-count and required comparison queries.
Embedded guests receive the existing generic error message. An unclassified failure
from provider execution returns HTTP 500 with generic text; a plain `ValueError`
is not evidence of invalid query input. Authentication, authorization, cancellation,
and worker timeout control exceptions keep their existing behavior.

`SemanticView.validate_selection_version` is a separate selection-boundary
check: it raises `ValueError` when a saved selection's version does not match.
Handle that specific call at the selection boundary. This does not make arbitrary
`ValueError` exceptions from provider execution deliberate query refusals.

During `get_table` and `get_row_count` execution, provider-raised
`SupersetTimeoutException` (previously HTTP 408),
`SupersetGenericDBErrorException` (previously HTTP 400), and
`SupersetTemplateParamsErrorException` (previously HTTP 400) now return generic
HTTP 500 responses. They are unclassified provider failures, not deliberate input
rejections. This does not change the passthrough for worker control timeouts
(`SoftTimeLimitExceeded`) or host `QueryObjectValidationError` subclasses.

Use this exception only for positively identified input validation failures in
`get_table`, `get_row_count`, and `get_values`. Do not translate conversion, transport, configuration,
or unexpected failures into it. Unknown codes are logged at warning level before they
normalize, so adapter typos stay visible. Existing providers remain import-compatible, but
must adopt the new core contract to receive actionable validation messages.
Deploy compatible core/host versions before adapters that import the new exception.
Discovery and compatibility methods are outside this execution contract.

The host mapper converts invalid query selections and filter values rejected during
its validation and translation steps into `QueryObjectValidationError`, so
chart-data requests receive HTTP 400 instead of HTTP 500. This conversion does
not surround provider metadata discovery or query execution. Malformed timezone
metadata remains a server error rather than a query validation refusal.
This mapper boundary does not govern earlier schema loading: dimension discovery
can fail there with HTTP 400, while metric discovery failures in the mapper remain
HTTP 500.

An asynchronous totals-prerequisite query whose payload is marked FAILED fails
its task with that payload's error. It does not publish a cache key for dependent
contribution queries to read as if totals had been successfully cached.
Typed query validation failures also fail ordinary asynchronous chart tasks,
without publishing a cache key or retrying the rejected query synchronously.
Ordinary SQL engine errors retain their structured-error readback behavior.

Host-classified client errors (`QueryObjectValidationError` and subclasses) keep
their status. The shared SDK module also defines `SemanticResultCompletenessError`
with `incomplete` and `unverified` reasons; the host translates these into its
completeness validation error with fixed guidance. These errors remain HTTP 400
and guest-sanitized regardless of whether the provider raises the core or host
completeness type. Unclassified provider exceptions remain server faults.

Value suggestions use the same translation and HTTP classification for `get_values`,
with the route's documented `{"message": string}` error envelope. The host applies
search `LIKE` filters to string, large-string, string-view, and dictionary-encoded
text dimensions; numeric and temporal
suggestions use the sorted bounded page without that filter. Typed rejections log
the view, dimension, and closed rejection code without logging search text.
A failed search does not retry without its filter: typed rejections return HTTP 400
with host-owned guidance, and unclassified faults return HTTP 500 with generic text.
The semantic picker displays the sanitized HTTP 400 guidance and still accepts manual
values. Non-text suggestions are limited to the bounded page.
No failed result is cached. Completeness failures retain their existing HTTP 400
and guest-sanitized guidance.

Asynchronous chart-data execution preserves the same rejection/fault classification
and host-owned messages in worker failures. The subscriber-authorized task status
route returns HTTP 200 for a status read and includes the sanitized failure message;
that polling status is not the provider error's HTTP classification. The client uses
that message for ordinary query failures without another rejection-code mapping.
Completeness failures retain their separate closed-reason handling and fixed guidance.
