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

"""Host-owned presentation and classification for semantic provider execution."""

from collections.abc import Callable

from billiard.exceptions import SoftTimeLimitExceeded
from flask_babel import gettext as _
from superset_core.semantic_layers.exceptions import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)
from superset_core.semantic_layers.types import SemanticQuery, SemanticResult

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2Error,
    OAuth2RedirectError,
    SupersetCancelQueryException,
    SupersetErrorException,
    SupersetSecurityException,
)
from superset.utils.error_sanitization import (
    GENERIC_ERROR_MESSAGE,
    sanitize_error_message,
)


def rejection_message(code: SemanticQueryErrorCode) -> str:
    """Select localized host text, with a safe fallback for newer SDK codes."""
    if code == SemanticQueryErrorCode.UNSUPPORTED_QUERY:
        return _(
            "This semantic provider does not support this query. "
            "Remove unsupported filters or grouping and try again."
        )
    if code == SemanticQueryErrorCode.UNSUPPORTED_OFFSET:
        return _(
            "This semantic provider cannot apply the requested offset. "
            "Turn off pagination or use a supported limit and offset."
        )
    if code == SemanticQueryErrorCode.INVALID_FILTER:
        return _(
            "A semantic query filter is invalid. "
            "Check its operator and values, then try again."
        )
    return _(
        "The semantic query is invalid. Check its fields and options, then try again."
    )


class SemanticLayerQueryRejectedError(SupersetErrorException):
    """A deliberate provider rejection that must not become a cached payload."""

    def __init__(self, code: SemanticQueryErrorCode) -> None:
        self.code: SemanticQueryErrorCode = code
        super().__init__(
            SupersetError(
                message=sanitize_error_message(rejection_message(code)),
                error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                level=ErrorLevel.WARNING,
            ),
            status=400,
        )


class SemanticLayerExecutionError(SupersetErrorException):
    """An unclassified provider fault with no public diagnostic detail."""

    def __init__(self) -> None:
        super().__init__(
            SupersetError(
                message=str(GENERIC_ERROR_MESSAGE),
                error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                level=ErrorLevel.ERROR,
            ),
            status=500,
        )


def execute_semantic_query(
    dispatcher: Callable[[SemanticQuery], SemanticResult], query: SemanticQuery
) -> SemanticResult:
    """Translate provider signals without changing host validation or retries."""
    try:
        return dispatcher(query)
    except SemanticQueryRejectedError as ex:
        raise SemanticLayerQueryRejectedError(ex.code) from ex
    except (
        SemanticLayerQueryRejectedError,
        SemanticLayerExecutionError,
        SupersetSecurityException,
        OAuth2RedirectError,
        OAuth2Error,
        SupersetCancelQueryException,
        SoftTimeLimitExceeded,
    ):
        raise
    except Exception as ex:  # pylint: disable=broad-except
        raise SemanticLayerExecutionError() from ex
