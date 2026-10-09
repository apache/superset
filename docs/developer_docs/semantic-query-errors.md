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
from provider execution remains HTTP 500 with generic text; a plain `ValueError`
is not evidence of invalid query input. Authentication, authorization, cancellation,
and worker timeout control exceptions keep their existing behavior.

Use this exception only for positively identified input validation failures in
`get_table` and `get_row_count`. Do not translate conversion, transport, configuration,
or unexpected failures into it. Unknown codes are logged at warning level before they
normalize, so adapter typos stay visible. Existing providers remain import-compatible, but
must adopt the new core contract to receive actionable validation messages.
Deploy compatible core/host versions before adapters that import the new exception.
Discovery and compatibility methods are outside this execution contract.

Host-classified client errors (`QueryObjectValidationError` and subclasses) keep
their status. The shared SDK module also defines `SemanticResultCompletenessError`
with `incomplete` and `unverified` reasons; the host translates these into its
completeness validation error with fixed guidance. These errors remain HTTP 400
and guest-sanitized regardless of whether the provider raises the core or host
completeness type. Unclassified provider exceptions remain server faults.

The rejection contract does not cover `get_values`. Value suggestions treat the
search filter as best-effort: when a filtered `get_values` call fails, the host logs
it and retries without the filter, so a rejection there is not shown to the user. A
failure of the unfiltered call is reported as an unclassified error. From
`get_values`, raise only `SemanticResultCompletenessError`.

Asynchronous chart-data execution keeps completeness reasons: the worker publishes
the closed reason and the client shows its fixed message. A typed rejection raised in
an async worker still fails the task, but the client shows the generic chart-data
failure message rather than the rejection's guidance.
