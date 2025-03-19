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

from __future__ import annotations

from collections import defaultdict
from typing import Any, Optional

from flask_babel import gettext as _
from marshmallow import ValidationError

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType


class SupersetException(Exception):
    status = 500
    message = ""

    def __init__(
        self,
        message: str = "",
        exception: Optional[Exception] = None,
        error_type: Optional[SupersetErrorType] = None,
    ) -> None:
        if message:
            self.message = message
        self._exception = exception
        self._error_type = error_type
        super().__init__(self.message)

    @property
    def exception(self) -> Optional[Exception]:
        return self._exception

    @property
    def error_type(self) -> Optional[SupersetErrorType]:
        return self._error_type

    def to_dict(self) -> dict[str, Any]:
        rv = {}
        if hasattr(self, "message"):
            rv["message"] = self.message
        if self.error_type:
            rv["error_type"] = self.error_type
        if self.exception is not None and hasattr(self.exception, "to_dict"):
            rv = {**rv, **self.exception.to_dict()}
        return rv


class SupersetErrorException(SupersetException):
    """Exceptions with a single SupersetErrorType associated with them"""

    def __init__(self, error: SupersetError, status: Optional[int] = None) -> None:
        super().__init__(error.message)
        self.error = error
        if status is not None:
            self.status = status

    def to_dict(self) -> dict[str, Any]:
        return self.error.to_dict()


class SupersetGenericErrorException(SupersetErrorException):
    """Exceptions that are too generic to have their own type"""

    def __init__(self, message: str, status: Optional[int] = None) -> None:
        super().__init__(
            SupersetError(
                message=message,
                error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                level=ErrorLevel.ERROR,
            )
        )
        if status is not None:
            self.status = status


class SupersetErrorFromParamsException(SupersetErrorException):
    """Exceptions that pass in parameters to construct a SupersetError"""

    def __init__(
        self,
        error_type: SupersetErrorType,
        message: str,
        level: ErrorLevel,
        extra: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            SupersetError(
                error_type=error_type, message=message, level=level, extra=extra or {}
            )
        )


class SupersetErrorsException(SupersetException):
    """Exceptions with multiple SupersetErrorType associated with them"""

    def __init__(
        self, errors: list[SupersetError], status: Optional[int] = None
    ) -> None:
        super().__init__(str(errors))
        self.errors = errors
        if status is not None:
            self.status = status


class SupersetSyntaxErrorException(SupersetErrorsException):
    status = 422
    error_type = SupersetErrorType.SYNTAX_ERROR

    def __init__(self, errors: list[SupersetError]) -> None:
        super().__init__(errors)


class SupersetTimeoutException(SupersetErrorFromParamsException):
    status = 408


class SupersetGenericDBErrorException(SupersetErrorFromParamsException):
    status = 400

    def __init__(
        self,
        message: str,
        level: ErrorLevel = ErrorLevel.ERROR,
        extra: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            message,
            level,
            extra,
        )


class SupersetTemplateParamsErrorException(SupersetErrorFromParamsException):
    status = 400

    def __init__(
        self,
        message: str,
        error: SupersetErrorType,
        level: ErrorLevel = ErrorLevel.ERROR,
        extra: Optional[dict[str, Any]] = None,
    ) -> None:
        super().__init__(
            error,
            message,
            level,
            extra,
        )


class SupersetSecurityException(SupersetErrorException):
    status = 403

    def __init__(
        self, error: SupersetError, payload: Optional[dict[str, Any]] = None
    ) -> None:
        super().__init__(error)
        self.payload = payload


class SupersetVizException(SupersetErrorsException):
    status = 400


class NoDataException(SupersetException):
    status = 400


class NullValueException(SupersetException):
    status = 400


class SupersetTemplateException(SupersetException):
    pass


class SpatialException(SupersetException):
    pass


class CertificateException(SupersetException):
    message = _("Invalid certificate")


class DatabaseNotFound(SupersetException):
    status = 400


class MissingUserContextException(SupersetException):
    status = 422


class QueryObjectValidationError(SupersetException):
    status = 400


class AdvancedDataTypeResponseError(SupersetException):
    status = 400


class InvalidPostProcessingError(SupersetException):
    status = 400


class CacheLoadError(SupersetException):
    status = 404


class QueryClauseValidationException(SupersetException):
    status = 400


class DashboardImportException(SupersetException):
    pass


class DatasetInvalidPermissionEvaluationException(SupersetException):
    """
    When a dataset can't compute its permission name
    """


class SerializationError(SupersetException):
    pass


class InvalidPayloadFormatError(SupersetErrorException):
    status = 400

    def __init__(self, message: str = "Request payload has incorrect format"):
        error = SupersetError(
            message=message,
            error_type=SupersetErrorType.INVALID_PAYLOAD_FORMAT_ERROR,
            level=ErrorLevel.ERROR,
        )
        super().__init__(error)


class InvalidPayloadSchemaError(SupersetErrorException):
    status = 422

    def __init__(self, error: ValidationError):
        # dataclasses.asdict does not work with defaultdict, convert to dict
        # https://bugs.python.org/issue35540
        for k, v in error.messages.items():
            if isinstance(v, defaultdict):
                error.messages[k] = dict(v)
        error = SupersetError(
            message="An error happened when validating the request",
            error_type=SupersetErrorType.INVALID_PAYLOAD_SCHEMA_ERROR,
            level=ErrorLevel.ERROR,
            extra={"messages": error.messages},
        )
        super().__init__(error)


class SupersetCancelQueryException(SupersetException):
    status = 422


class QueryNotFoundException(SupersetException):
    status = 404


class ColumnNotFoundException(SupersetException):
    status = 404


class SupersetMarshmallowValidationError(SupersetErrorException):
    """
    Exception to be raised for Marshmallow validation errors.
    """

    status = 422

    def __init__(self, exc: ValidationError, payload: dict[str, Any]):
        error = SupersetError(
            message=_("The schema of the submitted payload is invalid."),
            error_type=SupersetErrorType.MARSHMALLOW_ERROR,
            level=ErrorLevel.ERROR,
            extra={"messages": exc.messages, "payload": payload},
        )
        super().__init__(error)


class SupersetParseError(SupersetErrorException):
    """
    Exception to be raised when we fail to parse SQL.
    """

    status = 422

    def __init__(  # pylint: disable=too-many-arguments
        self,
        sql: str,
        engine: Optional[str] = None,
        message: Optional[str] = None,
        highlight: Optional[str] = None,
        line: Optional[int] = None,
        column: Optional[int] = None,
    ):
        if message is None:
            parts = [_("Error parsing")]
            if highlight:
                parts.append(_(" near '%(highlight)s'", highlight=highlight))
            if line:
                parts.append(_(" at line %(line)d", line=line))
                if column:
                    parts.append(_(":%(column)d", column=column))
            message = "".join(parts)

        error = SupersetError(
            message=message,
            error_type=SupersetErrorType.INVALID_SQL_ERROR,
            level=ErrorLevel.ERROR,
            extra={"sql": sql, "engine": engine, "line": line, "column": column},
        )
        super().__init__(error)


class OAuth2RedirectError(SupersetErrorException):
    """
    Exception used to start OAuth2 dance for personal tokens.

    The exception requires 3 parameters:

    - The URL that starts the OAuth2 dance.
    - The UUID of the browser tab where OAuth2 started, so that the newly opened tab
      where OAuth2 happens can communicate with the original tab to inform that OAuth2
      was successful (or not).
    - The redirect URL, so that the original tab can validate that the message from the
      second tab is coming from a valid origin.

    See the `OAuth2RedirectMessage.tsx` component for more details of how this
    information is handled.
    """

    def __init__(self, url: str, tab_id: str, redirect_uri: str):
        super().__init__(
            SupersetError(
                message="You don't have permission to access the data.",
                error_type=SupersetErrorType.OAUTH2_REDIRECT,
                level=ErrorLevel.WARNING,
                extra={"url": url, "tab_id": tab_id, "redirect_uri": redirect_uri},
            )
        )


class OAuth2Error(SupersetErrorException):
    """
    Exception for when OAuth2 goes wrong.
    """

    def __init__(self, error: str):
        super().__init__(
            SupersetError(
                message="Something went wrong while doing OAuth2",
                error_type=SupersetErrorType.OAUTH2_REDIRECT_ERROR,
                level=ErrorLevel.ERROR,
                extra={"error": error},
            )
        )


class DisallowedSQLFunction(SupersetErrorException):
    """
    Disallowed function found on SQL statement
    """

    def __init__(self, functions: set[str]):
        super().__init__(
            SupersetError(
                message=f"SQL statement contains disallowed function(s): {functions}",
                error_type=SupersetErrorType.SYNTAX_ERROR,
                level=ErrorLevel.ERROR,
            )
        )


class CreateKeyValueDistributedLockFailedException(Exception):
    """
    Exception to signalize failure to acquire lock.
    """


class DeleteKeyValueDistributedLockFailedException(Exception):
    """
    Exception to signalize failure to delete lock.
    """


class DatabaseNotFoundException(SupersetErrorException):
    status = 404

    def __init__(self, message: str):
        super().__init__(
            SupersetError(
                message=message,
                error_type=SupersetErrorType.DATABASE_NOT_FOUND_ERROR,
                level=ErrorLevel.ERROR,
            )
        )


class TableNotFoundException(SupersetErrorException):
    status = 404

    def __init__(self, message: str):
        super().__init__(
            SupersetError(
                message=message,
                error_type=SupersetErrorType.TABLE_NOT_FOUND_ERROR,
                level=ErrorLevel.ERROR,
            )
        )
