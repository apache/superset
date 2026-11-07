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
Export API for superset-core.

Provides dependency-injected functions that will be replaced by host
implementations during initialization.

Usage:
    from superset_core.exports.export import can_export_data, run_query_context

    if can_export_data():
        results = run_query_context(payload)
"""

from collections.abc import Iterator
from contextlib import AbstractContextManager
from typing import Any

from superset_core.exports.types import (
    ChartQueryResult,
    ChartResult,
    DashboardExportInfo,
)


def run_query_context(payload: dict[str, Any]) -> list[ChartQueryResult]:
    """
    Run a chart query context as the current user.

    Does not check the export permission; callers must call
    ``can_export_data()`` first. Results are always JSON rows: the payload's
    ``result_format`` is ignored, and ``result_type`` must be ``full``,
    ``results``, ``post_processed``, ``samples`` or ``drill_detail``.

    :param payload: The query context payload, as sent to ``/api/v1/chart/data``.
    :returns: One result per query in the payload.
    :raises ValueError: If the payload asks for a result type with no rows,
        such as ``query`` or ``columns``.
    :raises ValidationError: A marshmallow validation error if the payload is
        malformed (HTTP 400 semantics).
    :raises Exception: A security exception (HTTP 403 semantics) if the user may
        not access the datasource, or a query-failure exception if the query is
        invalid, fails in the database or cannot be loaded from the cache.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def iter_dashboard_chart_results(
    dashboard_id: int, active_data_mask: dict[str, Any]
) -> Iterator[ChartResult]:
    """
    Yield the results of each chart on a dashboard, with filters applied.

    A chart that cannot be queried yields a result with ``skipped_reason`` set
    instead of raising. A missing dashboard, or one the user cannot access,
    yields nothing. A Celery soft time limit propagates. Callers must check
    ``can_export_dashboard()`` first.

    :param dashboard_id: The dashboard ID.
    :param active_data_mask: The dashboard's active filter state, keyed by filter ID.
    :returns: An iterator of per-chart results.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def describe_dashboard_export(
    dashboard_id: int, active_data_mask: dict[str, Any]
) -> DashboardExportInfo:
    """
    Describe the dashboard for an export: title, links and applied filters.

    ``applied_filters`` lists the dashboard's native filters only. Cross-filters
    are left out because exports do not apply them.

    :param dashboard_id: The dashboard ID.
    :param active_data_mask: The dashboard's active filter state, keyed by filter ID.
    :returns: The dashboard export metadata.
    :raises Exception: A not-found exception (HTTP 404 semantics) if the
        dashboard does not exist, or a security exception (HTTP 403 semantics)
        if the user cannot access it.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def build_tab_name(raw: str, used: set[str], max_len: int) -> str:
    """
    Build a sheet tab name that is unique among ``used`` and within ``max_len``.

    Uniqueness is case-insensitive; a collision gets a ``~N`` suffix.

    :param raw: The desired name.
    :param used: Lowercased names already taken. Share one set across calls;
        each call adds the lowercased name it returns.
    :param max_len: The maximum name length, at least 4.
    :returns: The tab name.
    :raises ValueError: If ``max_len`` is below 4, or no unique name fits in it.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def can_export_data() -> bool:
    """
    Check whether the current user may export chart data.

    :returns: True if the user holds the export permission.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def can_export_dashboard(dashboard_id: int) -> bool:
    """
    Check whether the current user may export a dashboard.

    Does not check the data export permission; callers also need
    ``can_export_data()``.

    :param dashboard_id: The dashboard ID.
    :returns: True if the user holds the dashboard export permission and can
        access the dashboard; False if the dashboard does not exist.
    """
    raise NotImplementedError("Function will be replaced during initialization")


def as_user(user_id: int) -> AbstractContextManager[None]:
    """
    Run the enclosed block as the given user.

    Background tasks use this because the task framework does not set a user.

    :param user_id: The ID of the user to act as: the requester's ID, recorded
        server-side when the request is made. Never pass a client-supplied value.
    :returns: A context manager that restores the previous user on exit.
    :raises ValueError: On entry, if no user has the given ID.
    """
    raise NotImplementedError("Function will be replaced during initialization")
