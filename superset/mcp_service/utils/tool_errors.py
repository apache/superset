# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

"""Public error classification shared by MCP query tools."""

from sqlalchemy.exc import SQLAlchemyError
from superset_core.semantic_layers.errors import (
    SemanticBackendError,
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)

from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.db_engine_specs.exceptions import SupersetDBAPIError
from superset.errors import SupersetErrorType
from superset.exceptions import QueryObjectValidationError, SupersetErrorException
from superset.mcp_service.chart.response_preflight import bounded_exception_message
from superset.semantic_layers.exceptions import (
    is_provider_fault,
    rejection_message,
    SemanticLayerExecutionError,
    SemanticLayerQueryRejectedError,
)
from superset.utils.error_sanitization import (
    GENERIC_ERROR_MESSAGE,
    SAFE_ERROR_TYPES,
    sanitize_error_message,
)


def _causal_chain(exc: Exception) -> list[BaseException]:
    """Walk explicit causes without following implicit exception contexts."""
    chain: list[BaseException] = []
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        chain.append(current)
        current = current.__cause__
    return chain


def _superset_exception_error(
    error: SupersetErrorException, *, semantic: bool
) -> tuple[str, str, str]:
    """Classify a Superset exception without trusting unsafe provider text."""
    error_type: SupersetErrorType = error.error.error_type
    if error_type in SAFE_ERROR_TYPES:
        return error_type.value, bounded_exception_message(error), "QueryError"
    if not semantic:
        return (
            error_type.value,
            sanitize_error_message(bounded_exception_message(error)),
            "QueryError",
        )
    return (
        SupersetErrorType.GENERIC_BACKEND_ERROR.value,
        str(GENERIC_ERROR_MESSAGE),
        "QueryError",
    )


def public_query_error(
    exc: Exception, *, semantic: bool = False
) -> tuple[str, str, str]:
    """Return a safe error code, message, and MCP type for a failed query.

    A provider can raise a host exception class. Its provenance marker takes
    priority over that class, so its text cannot become a host-owned message.
    Dataset engine errors follow the same guest rule as the HTTP chart API.
    """
    chain: list[BaseException] = _causal_chain(exc)

    if semantic and any(is_provider_fault(error) for error in chain):
        return (
            SupersetErrorType.GENERIC_BACKEND_ERROR.value,
            str(GENERIC_ERROR_MESSAGE),
            "QueryError",
        )

    for error in chain:
        if isinstance(
            error, (SemanticLayerQueryRejectedError, SemanticQueryRejectedError)
        ):
            code: SemanticQueryErrorCode = error.code
            return code.value, rejection_message(code), "QueryRejected"
        if isinstance(error, (SemanticLayerExecutionError, SemanticBackendError)):
            return (
                SupersetErrorType.GENERIC_BACKEND_ERROR.value,
                str(GENERIC_ERROR_MESSAGE),
                "QueryError",
            )
        if isinstance(error, QueryObjectValidationError):
            return (
                SemanticQueryErrorCode.INVALID_QUERY.value,
                (
                    bounded_exception_message(error)
                    if semantic
                    else sanitize_error_message(bounded_exception_message(error))
                ),
                "QueryError",
            )
        if isinstance(error, SupersetErrorException):
            return _superset_exception_error(error, semantic=semantic)

    if semantic:
        return (
            SupersetErrorType.GENERIC_BACKEND_ERROR.value,
            str(GENERIC_ERROR_MESSAGE),
            "QueryError",
        )
    if any(
        isinstance(
            error, (ChartDataQueryFailedError, SupersetDBAPIError, SQLAlchemyError)
        )
        for error in chain
    ):
        return (
            SupersetErrorType.GENERIC_DB_ENGINE_ERROR.value,
            sanitize_error_message(bounded_exception_message(exc)),
            "QueryError",
        )
    return (
        SupersetErrorType.GENERIC_BACKEND_ERROR.value,
        str(GENERIC_ERROR_MESSAGE),
        "QueryError",
    )
