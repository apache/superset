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
"""Canvas query transport classification using the shared error-message policy."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from marshmallow import ValidationError

from superset.commands.chart.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.daos.exceptions import DatasourceNotFound
from superset.errors import SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    QueryObjectValidationError,
    SupersetDisallowedSQLFunctionException,
    SupersetDisallowedSQLTableException,
    SupersetErrorException,
    SupersetErrorsException,
    SupersetSecurityException,
)
from superset.utils.error_sanitization import (
    GENERIC_ACCESS_MESSAGE,
    GENERIC_ERROR_MESSAGE,
    sanitize_error_message,
    sanitize_superset_error,
    sanitize_superset_errors,
)


@dataclass(frozen=True)
class CanvasQueryError:
    """One classification shared by REST placement data and MCP preview."""

    status: int
    error_type: str
    message: str
    errors: tuple[SupersetError, ...] = ()

    def rest_payload(self) -> dict[str, Any]:
        """Retain structured details needed by clients, including OAuth redirects."""
        payload: dict[str, Any] = {
            "message": self.message,
            "error_type": self.error_type,
        }
        if self.errors:
            payload["errors"] = [asdict(error) for error in self.errors]
        return payload


def canvas_query_error(error: Exception) -> CanvasQueryError:
    """Classify only the outer exception, without inspecting its cause or text.

    Object/draft/version ACL errors are handled by the calling transport before
    entering this adapter. Unknown query failures remain server errors, with a
    fixed public message rather than arbitrary exception details.
    """
    if isinstance(error, DatasourceNotFound):
        return CanvasQueryError(404, "QueryError", "Datasource does not exist")
    if isinstance(error, SupersetSecurityException):
        if error.error.error_type in {
            SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
            SupersetErrorType.DATABASE_SECURITY_ACCESS_ERROR,
        }:
            return CanvasQueryError(
                403, "DatasetNotAccessible", str(GENERIC_ACCESS_MESSAGE)
            )
        status = (
            400
            if error.error.error_type
            == SupersetErrorType.ADHOC_SUBQUERY_NOT_ALLOWED_ERROR
            else error.status
        )
    elif isinstance(
        error,
        (
            QueryObjectValidationError,
            ChartDataQueryFailedError,
            SupersetDisallowedSQLFunctionException,
            SupersetDisallowedSQLTableException,
            ValidationError,
        ),
    ):
        status = 400
    elif isinstance(error, ChartDataCacheLoadError):
        status = 422
    elif isinstance(error, (SupersetErrorException, SupersetErrorsException)):
        errors = sanitize_superset_errors(
            [error.error] if isinstance(error, SupersetErrorException) else error.errors
        )
        return CanvasQueryError(
            error.status,
            "OAuth2Redirect"
            if isinstance(error, OAuth2RedirectError)
            else "QueryError",
            errors[0].message if errors else str(GENERIC_ERROR_MESSAGE),
            tuple(errors),
        )
    else:
        return CanvasQueryError(500, "QueryError", str(GENERIC_ERROR_MESSAGE))

    message = (
        sanitize_superset_error(error.error).message
        if isinstance(error, SupersetErrorException)
        else sanitize_error_message(str(error), status)
    )
    return CanvasQueryError(status, "QueryError", message)
