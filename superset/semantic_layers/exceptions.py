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
import traceback
from collections.abc import Callable, Iterable, Iterator
from contextlib import contextmanager, suppress
from dataclasses import dataclass
from typing import ParamSpec, TypeVar
from uuid import UUID

from billiard.exceptions import SoftTimeLimitExceeded
from flask_babel import gettext as _
from superset_core.semantic_layers.errors import (
    SemanticQueryErrorCode,
    SemanticQueryRejectedError,
)
from superset_core.semantic_layers.types import Dimension, Metric, SemanticResult
from superset_core.semantic_layers.view import SemanticView as ProviderView

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


# Host signals that keep their own classification when raised by a provider.
_HOST_SIGNALS: tuple[type[BaseException], ...] = (
    QueryObjectValidationError,
    SemanticLayerQueryRejectedError,
    SemanticLayerExecutionError,
    SupersetSecurityException,
    OAuth2RedirectError,
    OAuth2Error,
    SupersetCancelQueryException,
    SoftTimeLimitExceeded,
)

ProviderResult = TypeVar("ProviderResult")

_PROVIDER_FAULT: str = "_superset_semantic_provider_fault"


@contextmanager
def provider_code() -> Iterator[None]:
    """
    Attribute exceptions raised inside the block to the semantic provider.

    Discovery logs a provider fault without its text, which may carry
    credentials or provider URLs, and any other fault as a Superset fault with
    its full traceback. Every provider call reached while binding a view must
    therefore run inside this block. The exception propagates unchanged.
    """
    try:
        yield
    except Exception as ex:
        # An exception that refuses attributes is logged as a Superset fault
        # rather than replaced; its text is still not chained into the log.
        with suppress(Exception):
            setattr(ex, _PROVIDER_FAULT, True)
        raise


def _is_provider_fault(ex: BaseException) -> bool:
    return getattr(ex, _PROVIDER_FAULT, False) is True


@dataclass(frozen=True)
class DiscoveryTarget:
    """The semantic view whose metadata is discovered, for server logs only."""

    view_id: int | None
    layer_uuid: UUID | None

    @classmethod
    def of(cls, datasource: object) -> "DiscoveryTarget":
        # Query objects type their datasource as BaseDatasource.
        return cls(
            view_id=getattr(datasource, "id", None),
            layer_uuid=getattr(datasource, "semantic_layer_uuid", None),
        )


def discover_metrics(
    bind: Callable[[], ProviderView], target: DiscoveryTarget
) -> set[Metric]:
    """Read a view's metrics, classifying any fault as a backend error."""
    return _discover(bind, lambda view: view.get_metrics(), "get_metrics", target)


def discover_dimensions(
    bind: Callable[[], ProviderView], target: DiscoveryTarget
) -> set[Dimension]:
    """Read a view's dimensions, classifying any fault as a backend error."""
    return _discover(bind, lambda view: view.get_dimensions(), "get_dimensions", target)


def _discover(
    bind: Callable[[], ProviderView],
    read: Callable[[ProviderView], ProviderResult],
    operation: str,
    target: DiscoveryTarget,
) -> ProviderResult:
    """
    Run one metadata read, classifying any fault as a backend error.

    Discovery takes no user input, so a fault here is never a correctable
    request; it must not reach generic ``ValueError`` handlers that answer 400,
    and its text must not reach the response. ``bind`` returns the provider
    view; binding marks its provider calls with ``provider_code``, and the
    rest of it is Superset's own code.
    """
    try:
        view: ProviderView = bind()
        with provider_code():
            return read(view)
    except _HOST_SIGNALS:
        raise
    except Exception as ex:  # pylint: disable=broad-except
        _log_discovery_fault(ex, operation, target)
        # No chained cause: error handlers log with exc_info, which would print it.
        raise SemanticLayerExecutionError() from None


def _log_discovery_fault(
    ex: Exception, operation: str, target: DiscoveryTarget
) -> None:
    """Log enough to locate a discovery fault without logging provider text."""
    fields: str = (
        f"requested_operation={operation} view_id={target.view_id} "
        f"layer_uuid={target.layer_uuid} error={type(ex).__name__}"
    )
    # The read's nearest callers, which the fault's own traceback does not include.
    caller: str = _frame_locations(traceback.extract_stack(limit=12)[:-2])
    if _is_provider_fault(ex):
        # The message may carry credentials or provider URLs, and source lines
        # may carry literals, so only each frame's location is logged.
        logger.error(
            "Semantic provider metadata discovery failed: %s\n"
            "Called from:\n%s"
            "Traceback (exception text and source omitted):\n%s",
            fields,
            caller,
            _frame_locations(traceback.extract_tb(ex.__traceback__)),
        )
        return
    # chain=False: an implicit __context__ may be a provider exception that was
    # being handled when this fault was raised, and its text must not be logged.
    logger.error(
        "Semantic view metadata discovery failed in Superset, not the provider: "
        "%s\nCalled from:\n%s%s",
        fields,
        caller,
        "".join(traceback.format_exception(ex, chain=False)),
    )


def _frame_locations(frames: Iterable[traceback.FrameSummary]) -> str:
    return "".join(
        f'  File "{frame.filename}", line {frame.lineno}, in {frame.name}\n'
        for frame in frames
    )


def execute_semantic_query(
    dispatcher: Callable[ProviderArguments, SemanticResult],
    *args: ProviderArguments.args,
    **kwargs: ProviderArguments.kwargs,
) -> SemanticResult:
    """Translate provider signals without changing host validation or retries."""
    try:
        with provider_completeness():
            return dispatcher(*args, **kwargs)
    except SemanticQueryRejectedError as ex:
        raise SemanticLayerQueryRejectedError(ex.code) from ex
    except _HOST_SIGNALS:
        raise
    except Exception as ex:  # pylint: disable=broad-except
        logger.exception("Semantic provider query execution failed")
        raise SemanticLayerExecutionError() from ex
