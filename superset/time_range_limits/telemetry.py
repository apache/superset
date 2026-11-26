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
"""
Log lines and counters for time range limit rejections.

Each rejection writes one key=value line on the ``superset.time_range_limits``
logger and bumps one stats key whose segments come from closed lists, so a key
never holds an ID or free text. Nothing here runs while the feature flag is off,
and nothing here raises.
"""

from __future__ import annotations

import functools
import inspect
import logging
import re
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token
from types import TracebackType
from typing import Any, NamedTuple, TypeVar

from flask import has_request_context, request

from superset.errors import SupersetError
from superset.extensions import (
    feature_flag_manager,
    security_manager,
    stats_logger_manager,
)
from superset.time_range_limits.policy import (
    FEATURE_FLAG,
    load_global,
    RULES,
    TimeRangeLimitsInvalidError,
)
from superset.utils.core import get_user_id

logger = logging.getLogger("superset.time_range_limits")

_KNOWN_FIELDS = frozenset(
    {
        "schema_version",
        "dashboardId",
        *RULES,
        *(f"{rule}.{part}" for rule in RULES for part in ("quantity", "time_grain")),
    }
)
_SOURCES = frozenset({"global", "dataset", "dashboard"})
_RULE_BY_REASON = {"UNBOUNDED_RANGE": "unbounded", "NO_VALID_RANGE": "no_valid_range"}
_UNAVAILABLE = "POLICY_UNAVAILABLE"
_TOKEN = re.compile(r"[\w:+.\-]+")

_ENDPOINT_PATHS = {
    "ChartDataRestApi.data": "chart_data",
    "ChartDataRestApi.get_data": "chart_data",
    "Datasource.samples": "samples",
    "DatasourceRestApi.query": "datasource_query",
    "Api.query": "query_api",
    "ChartRestApi.warm_up_cache": "warm_up",
    "DatasetRestApi.warm_up_cache": "warm_up",
    "Superset.warm_up_cache": "warm_up",
    "ExploreRestApi.get": "explore_load",
    "TimeRangeLimitsRestApi.get": "policy_api",
    "DashboardRestApi.get_time_range_limits": "policy_api",
    "DashboardRestApi.put_time_range_limits": "policy_api",
    "DashboardRestApi.get_time_range_limits_charts": "policy_api",
    "DatasetRestApi.get_time_range_limits": "policy_api",
    "DatasetRestApi.get_time_range_limits_charts": "policy_api",
    "ChartRangesRestApi.chart_ranges": "policy_api",
    "DashboardRestApi.post": "policy_write",
    "DashboardRestApi.put": "policy_write",
    "DashboardRestApi.copy_dash": "policy_write",
    "DashboardRestApi.import_": "policy_write",
    "DashboardRestApi.restore_version": "policy_write",
    "DatasetRestApi.put": "policy_write",
    "DatasetRestApi.import_": "policy_write",
    "DatasetRestApi.restore_version": "policy_write",
    "Datasource.save": "policy_write",
    "ImportExportRestApi.import_": "policy_write",
}
# Paths a caller outside a request names itself with ``limit_path``.
_SET_PATHS = ("async_worker", "mcp", "report")
_PATHS = frozenset({*_ENDPOINT_PATHS.values(), *_SET_PATHS})

_F = TypeVar("_F", bound=Callable[..., Any])


class _Scope(NamedTuple):
    dataset_id: int | None = None
    chart_id: int | None = None
    dashboard_id: int | None = None


_NO_SCOPE = _Scope()
_scope: ContextVar[_Scope] = ContextVar("time_range_limit_scope", default=_NO_SCOPE)
_path_marker: ContextVar[str | None] = ContextVar("time_range_limit_path", default=None)


@contextmanager
def limit_scope(
    dataset_id: int | None = None,
    chart_id: int | None = None,
    dashboard_id: int | None = None,
) -> Iterator[None]:
    """
    The IDs a rejection inside this block is logged with. A ``None`` argument
    keeps the ID of the scope this one is opened in.
    """
    outer = _scope.get()
    token = _scope.set(
        _Scope(
            outer.dataset_id if dataset_id is None else dataset_id,
            outer.chart_id if chart_id is None else chart_id,
            outer.dashboard_id if dashboard_id is None else dashboard_id,
        )
    )
    try:
        yield
    finally:
        _scope.reset(token)


class _LimitPath:
    """See ``limit_path``."""

    def __init__(self, path: str) -> None:
        self._path = path
        self._tokens: list[Token[str | None]] = []

    def __enter__(self) -> None:
        self._tokens.append(_path_marker.set(self._path))

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        _path_marker.reset(self._tokens.pop())

    async def __aenter__(self) -> None:
        self.__enter__()

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.__exit__(exc_type, exc, traceback)

    def __call__(self, func: _F) -> _F:
        path = self._path
        if inspect.iscoroutinefunction(func):

            @functools.wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                with _LimitPath(path):
                    return await func(*args, **kwargs)

            return async_wrapper  # type: ignore[return-value]

        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with _LimitPath(path):
                return func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]


def limit_path(path: str) -> _LimitPath:
    """
    The ``path`` a rejection inside this block is counted under, ahead of the
    endpoint, for callers outside a request (the async worker, MCP tools, the
    report pre-check). Works as a ``with`` / ``async with`` block and decorates a
    function or an ``async`` function.
    """
    return _LimitPath(path)


def known_field(field: str | None) -> str | None:
    """
    ``field`` when it's a fixed path the policy parser names, ``"other"`` for any
    other value (such as a key name from stored JSON), ``None`` when not set.
    """
    if field is None:
        return None
    return field if field in _KNOWN_FIELDS else "other"


def _enabled() -> bool:
    return feature_flag_manager.is_feature_enabled(FEATURE_FLAG)


def _path() -> str:
    if (marker := _path_marker.get()) is not None:
        return marker if marker in _PATHS else "other"
    if has_request_context():
        return _ENDPOINT_PATHS.get(request.endpoint or "", "other")
    return "other"


def _closed(value: Any, allowed: frozenset[str], missing: str) -> str:
    if value is None:
        return missing
    return value if value in allowed else "other"


def _rule(extra: dict[str, Any]) -> str:
    if (rule := extra.get("rule")) is not None:
        return rule if rule in RULES else "other"
    return _RULE_BY_REASON.get(str(extra.get("reason_code")), "other")


def _id(value: Any) -> int | str:
    return value if isinstance(value, int) and not isinstance(value, bool) else "none"


def _text(value: Any) -> str:
    return value if isinstance(value, str) and _TOKEN.fullmatch(value) else "none"


def _first(*values: Any) -> Any:
    return next((value for value in values if value is not None), None)


def _limit(limit: Any) -> str:
    if not isinstance(limit, dict):
        return "none"
    quantity, grain = limit.get("quantity"), limit.get("time_grain")
    if type(quantity) is not int or not isinstance(grain, str):
        return "none"
    return f"{quantity}x{grain}" if _TOKEN.fullmatch(grain) else "none"


def _fields(
    path: str,
    extra: dict[str, Any],
    source: str,
    *,
    chart_id: Any = None,
    dashboard_id: Any = None,
) -> dict[str, Any]:
    scope = _scope.get()
    actual = extra.get("actual")
    if not isinstance(actual, dict):
        actual = {}
    fields: dict[str, Any] = {
        "path": path,
        "reason_code": _text(extra.get("reason_code")),
        "rule": _rule(extra) if extra.get("reason_code") != _UNAVAILABLE else "none",
        "source": source,
    }
    if extra.get("reason_code") == _UNAVAILABLE:
        fields["field"] = known_field(extra.get("field")) or "none"
    fields.update(
        {
            "dashboard_id": _id(
                _first(dashboard_id, extra.get("dashboard_id"), scope.dashboard_id)
            ),
            "chart_id": _id(_first(chart_id, scope.chart_id)),
            "dataset_id": _id(_first(extra.get("dataset_id"), scope.dataset_id)),
            "user_id": _id(get_user_id()),
            "guest": "true" if security_manager.is_guest_user() else "false",
            "limit": _limit(extra.get("limit")),
            "actual_start": _text(actual.get("start")),
            "actual_end": _text(actual.get("end")),
            "comparison": "true" if extra.get("time_offset") is not None else "false",
        }
    )
    return fields


def _emit(level: int, prefix: str, fields: dict[str, Any]) -> None:
    logger.log(
        level,
        "%s %s",
        prefix,
        " ".join(f"{name}={value}" for name, value in fields.items()),
        extra={"time_range_limit": fields},
    )


def _debug_failure() -> None:
    # An operator's logging.Filter can raise too, so the fallback is guarded.
    try:
        logger.debug("Time range limit telemetry failed", exc_info=True)
    except Exception:  # pylint: disable=broad-except  # noqa: S110
        pass


def record_rejection(error: SupersetError) -> None:
    """Log and count one time range rejection (400) or unavailable policy (503)."""
    try:
        if not _enabled():
            return
        extra = error.extra or {}
        path = _path()
        if extra.get("reason_code") == _UNAVAILABLE:
            source = _closed(extra.get("source"), _SOURCES, "unknown")
            key = f"time_range_limit.unavailable.{path}.{source}"
            level, prefix = logging.WARNING, "Time range limits unavailable:"
        else:
            source = _closed(extra.get("source"), _SOURCES, "none")
            key = f"time_range_limit.rejected.{path}.{_rule(extra)}.{source}"
            level, prefix = logging.INFO, "Time range rejected:"
        fields = _fields(path, extra, source)
        stats_logger_manager.instance.incr(key)
        _emit(level, prefix, fields)
    except Exception:  # pylint: disable=broad-except
        _debug_failure()


def record_report_unchecked(chart_id: int | None, dashboard_id: int | None) -> None:
    """Log and count one report chart whose time ranges could not be checked."""
    try:
        if not _enabled():
            return
        fields = _fields(
            "report",
            {"reason_code": _UNAVAILABLE},
            "unknown",
            chart_id=chart_id,
            dashboard_id=dashboard_id,
        )
        stats_logger_manager.instance.incr("time_range_limit.unchecked.report")
        _emit(logging.WARNING, "Time range limits not checked:", fields)
    except Exception:  # pylint: disable=broad-except
        _debug_failure()


def _describe_rule(rule: Any) -> str:
    return "none" if rule is None else f"{rule.quantity}x{rule.time_grain}"


def log_global_policy() -> None:
    """Log the global policy, or why it isn't valid, once at startup."""
    try:
        if not _enabled():
            return
        try:
            limits = load_global()
        except TimeRangeLimitsInvalidError as ex:
            message = str(ex)
            if ex.field is not None and not message.startswith(f"{ex.field}: "):
                message = f"{ex.field}: {message}"
            logger.error(
                "Time range limits: TIME_RANGE_LIMITS_GLOBAL is not valid "
                "(%s). Every guarded query fails closed (503).",
                message,
            )
            return
        if limits is None:
            logger.info("Time range limits: no global policy")
            return
        logger.info(
            "Time range limits: global policy %s",
            " ".join(
                f"{rule}={_describe_rule(getattr(limits, rule))}" for rule in RULES
            ),
        )
    except Exception:  # pylint: disable=broad-except
        _debug_failure()
