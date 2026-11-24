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
from typing import Any, Literal

from marshmallow import ValidationError
from superset_core.widgets import WidgetDataRefusedError

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
    reason: Literal["query", "missing_datasource", "security_refusal"] = "query"
    security_error_type: SupersetErrorType | None = None
    oauth_redirect_url: str | None = None
    # A widget type's own code for refusing the request, for its renderer.
    code: str | None = None

    def rest_payload(self) -> dict[str, Any]:
        """Retain structured details needed by clients, including OAuth redirects."""
        payload: dict[str, Any] = {
            "message": self.message,
            "error_type": self.error_type,
        }
        if self.code is not None:
            payload["code"] = self.code
        if self.errors:
            payload["errors"] = [asdict(error) for error in self.errors]
        return payload


class CanvasQueryFailedError(Exception):
    """A classified failure from executing a validated Canvas data binding."""

    def __init__(self, error: CanvasQueryError) -> None:
        super().__init__(error.message)
        self.error = error


def canvas_query_error(error: Exception) -> CanvasQueryError:
    """Classify only the outer exception, without inspecting its cause or text.

    Object/draft/version ACL errors are handled by the calling transport before
    entering this adapter. Unknown query failures remain server errors, with a
    fixed public message rather than arbitrary exception details. A widget
    type's refusal keeps the type's status, code and message, which it wrote
    for the caller, and a failure already classified keeps its classification.
    """
    if isinstance(error, CanvasQueryFailedError):
        return error.error
    if isinstance(error, WidgetDataRefusedError):
        return CanvasQueryError(
            error.status, "WidgetDataRefused", error.message, code=error.code
        )
    if isinstance(error, DatasourceNotFound):
        return CanvasQueryError(
            404, "QueryError", "Datasource does not exist", reason="missing_datasource"
        )
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
        return CanvasQueryError(
            status,
            "QueryError",
            sanitize_superset_error(error.error).message,
            reason="security_refusal",
            security_error_type=error.error.error_type,
        )
    if isinstance(
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
            oauth_redirect_url=(
                errors[0].extra["url"]
                if isinstance(error, OAuth2RedirectError) and errors[0].extra
                else None
            ),
        )
    else:
        return CanvasQueryError(500, "QueryError", str(GENERIC_ERROR_MESSAGE))

    message = (
        sanitize_superset_error(error.error).message
        if isinstance(error, SupersetErrorException)
        else sanitize_error_message(str(error), status)
    )
    return CanvasQueryError(status, "QueryError", message)
