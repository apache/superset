# Semantic provider query errors

Providers can distinguish deliberately rejected query input from operational failures
by raising `superset_core.semantic_layers.exceptions.SemanticQueryRejectedError`.
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
or unexpected failures into it. Existing providers remain import-compatible, but
must adopt the new core contract to receive actionable validation messages.
Deploy compatible core/host versions before adapters that import the new exception.
Discovery and compatibility methods are outside this execution contract.
