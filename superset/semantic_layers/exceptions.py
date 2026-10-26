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

import logging
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from typing import Any, ParamSpec

from billiard.exceptions import SoftTimeLimitExceeded
from flask_babel import gettext as _
from superset_core.semantic_layers.errors import (
    SemanticBackendError,
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)
from superset_core.semantic_layers.transport import (
    ProviderRequestError,
    ProviderRequestFailure,
)
from superset_core.semantic_layers.types import SemanticResult

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2Error,
    OAuth2RedirectError,
    QueryObjectValidationError,
    SupersetCancelQueryException,
    SupersetErrorException,
    SupersetSecurityException,
)
from superset.semantic_layers.completeness import provider_completeness
from superset.utils.error_sanitization import (
    GENERIC_ERROR_MESSAGE,
    sanitize_error_message,
)

logger: logging.Logger = logging.getLogger(__name__)

ProviderArguments = ParamSpec("ProviderArguments")


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


def provider_request_message(error: ProviderRequestError) -> str:
    """Rebuild transport text without trusting mutable fields or subclass formatters."""
    fields: dict[str, Any] = vars(error)
    failure: Any = fields.get("failure")
    status: Any = fields.get("status")
    provider: Any = fields.get("provider")
    valid_status: bool = (
        type(status) is int and 100 <= status <= 599
        if failure is ProviderRequestFailure.HTTP_STATUS
        else status is None
    )
    if type(failure) is not ProviderRequestFailure or not valid_status:
        logger.error("Semantic provider supplied invalid transport failure fields")
        raise SemanticLayerExecutionError() from None
    return str(
        ProviderRequestError(
            failure,
            status=status,
            provider=provider if type(provider) is str else "Provider",
        )
    )


def log_provider_failure(message: str, error: Exception) -> None:
    """Keep typed failures quiet; retain unknown diagnostics in server DEBUG logs."""
    if isinstance(
        error, (ProviderRequestError, SemanticBackendError, SemanticQueryRejectedError)
    ):
        logger.error("%s", message)
        return
    logger.error(
        "%s (%s.%s)", message, type(error).__module__, type(error).__qualname__
    )
    logger.debug(message, exc_info=(type(error), error, error.__traceback__))


@contextmanager
def normalize_provider_request_errors() -> Iterator[None]:
    """Give query preparation and dispatch the same safe transport failure."""
    try:
        yield
    except ProviderRequestError as ex:
        raise QueryObjectValidationError(provider_request_message(ex)) from None


def execute_semantic_query(
    dispatcher: Callable[ProviderArguments, SemanticResult],
    *args: ProviderArguments.args,
    **kwargs: ProviderArguments.kwargs,
) -> SemanticResult:
    """Translate provider signals without changing host validation or retries."""
    try:
        with provider_completeness(), normalize_provider_request_errors():
            return dispatcher(*args, **kwargs)
    except SemanticQueryRejectedError as ex:
        raise SemanticLayerQueryRejectedError(ex.code) from None
    except SemanticBackendError:
        logger.error("Semantic provider reported an execution failure")
        raise SemanticLayerExecutionError() from None
    except (
        QueryObjectValidationError,
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
        log_provider_failure("Semantic provider query execution failed", ex)
        raise SemanticLayerExecutionError() from None
