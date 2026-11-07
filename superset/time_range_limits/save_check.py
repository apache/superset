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
List the saved charts and time range filter defaults that proposed time range
limits would refuse. Read only: no data query, nothing written, no error built.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from operator import attrgetter
from typing import Any, Callable, cast, TYPE_CHECKING

from marshmallow import ValidationError

from superset.common.utils.time_range_utils import get_since_until_from_time_range
from superset.time_range_limits.enforcement import (
    chart_date_ranges,
    chart_range_label,
    dashboard_time_filter,
    DateRange,
    has_temporal_column,
    time_filter_value,
)
from superset.time_range_limits.policy import (
    checked_policy,
    date_range_failure,
    DateRangeFailure,
    load_dataset_limits,
    load_global_limits,
    load_level,
    parse_time_range_limits,
    policy_errors,
    resolve_time_range_limits,
    ResolvedTimeRangeLimits,
    stored_limits,
    TimeRangeLimits,
)
from superset.utils import json
from superset.utils.core import DatasourceType

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explorables.base import Explorable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)

DATASET_SAVE_CHECK_MAX_CHARTS = 50


@dataclass
class StoredLevels:
    """
    The stored global policy and the stored policy of each dataset by ID, loaded
    once per request with the limits GET's loaders.
    """

    global_limits: TimeRangeLimits | None
    datasets: dict[int, TimeRangeLimits | None] = field(default_factory=dict)

    @property
    def dataset_limits(self) -> list[TimeRangeLimits]:
        return [limits for limits in self.datasets.values() if limits is not None]


class ProposedPolicyError(Exception):
    """A proposed policy that the limits PUT would refuse: 400 or 422."""

    def __init__(self, status: int, messages: dict[str, list[str]]) -> None:
        super().__init__(messages)
        self.status = status
        self.messages = messages


def chart_datasets(charts: list[Slice]) -> list[SqlaTable]:
    """The datasets of ``charts``, each once, by ID."""
    from superset.connectors.sqla.models import SqlaTable

    tables = {
        datasource.id: datasource
        for chart in charts
        if isinstance(datasource := chart.datasource, SqlaTable)
    }
    return sorted(tables.values(), key=attrgetter("id"))


def load_stored_levels(datasets: list[SqlaTable]) -> StoredLevels:
    """
    The stored global policy and the stored policy of each of ``datasets``.
    Raises ``TimeRangeLimitsUnavailableError`` naming the first bad level, as the
    limits GET does.
    """
    global_limits = load_global_limits()
    return StoredLevels(
        global_limits, {table.id: load_dataset_limits(table) for table in datasets}
    )


def stored_dashboard_limits(dashboard: Dashboard) -> TimeRangeLimits | None:
    """The dashboard's stored policy, failing closed as the limits GET does."""
    return checked_policy(
        "dashboard",
        stored_limits(dashboard.json_metadata),
        lambda: load_level(dashboard.json_metadata, "Dashboard json_metadata"),
    )


def proposed_policy(
    args: dict[str, Any],
    stored_text: str | None,
    level: str,
    load_stored: Callable[[], TimeRangeLimits | None],
) -> TimeRangeLimits | None:
    """
    The policy of ``level`` to check: the request's ``policy`` (``None`` sets no
    limit), else the stored one from ``load_stored``. A given policy is validated
    as the limits PUT validates it, against the level's stored policy in
    ``stored_text``; raises ``ProposedPolicyError`` keyed ``policy.<path>``.
    """
    if "policy" not in args:
        return load_stored()
    shape, errors, policy = policy_errors(
        lambda: parse_time_range_limits(args["policy"]),
        stored_limits(stored_text),
        level,
        "policy",
    )
    if shape:
        raise ProposedPolicyError(400, shape)
    if errors:
        raise ProposedPolicyError(422, errors)
    return policy


def _chart_entry(chart: Slice) -> dict[str, Any]:
    return {"id": chart.id, "slice_name": chart.slice_name, "url": chart.url}


def _failure_fields(failure: DateRangeFailure) -> dict[str, Any]:
    return {
        "reason_code": failure.reason_code,
        "rule": failure.rule,
        "source": failure.source,
        "message": failure.message,
    }


def _resolve(value: str) -> tuple[datetime | None, datetime | None] | None:
    try:
        return get_since_until_from_time_range(time_range=value)
    except (ValueError, ValidationError):
        return None


def _chart_ranges(chart: Slice, dashboard: Dashboard | None) -> list[DateRange] | None:
    """The ranges of ``chart``, ``None`` when its query can't be built."""
    try:
        return chart_date_ranges(chart, dashboard=dashboard)
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Time range limits could not be checked for chart %s",
            chart.id,
            exc_info=True,
        )
        return None


def _first_failure(
    ranges: list[DateRange],
    limits: ResolvedTimeRangeLimits,
    dashboard_id: int | None,
    covered: tuple[datetime | None, datetime | None] | None = None,
) -> tuple[DateRange, DateRangeFailure] | None:
    """
    The first range that breaks ``limits`` and its failure. A main range equal to
    ``covered`` is skipped. Raises ``ValueError`` on a range whose start is after
    its end.
    """
    for since, until, offset in ranges:
        if offset is None and covered is not None and (since, until) == covered:
            continue
        failure = date_range_failure(
            since, until, limits, time_offset=offset, dashboard_id=dashboard_id
        )
        if failure is not None:
            return (since, until, offset), failure
    return None


def _check_chart(
    chart: Slice,
    limits: ResolvedTimeRangeLimits,
    result: dict[str, list[dict[str, Any]]],
    dashboard: Dashboard | None = None,
) -> None:
    if (ranges := _chart_ranges(chart, dashboard)) is None:
        result["unchecked"].append(_chart_entry(chart))
        return
    time_filter = (
        dashboard_time_filter(dashboard, chart) if dashboard is not None else None
    )
    covered = _resolve(time_filter.value) if time_filter is not None else None
    try:
        found = _first_failure(
            ranges,
            limits,
            dashboard.id if dashboard is not None else None,
            covered,
        )
    except ValueError:
        result["unchecked"].append(_chart_entry(chart))
        return
    if found is None:
        return
    (since, until, offset), failure = found
    result["charts"].append(
        {
            **_chart_entry(chart),
            "range": chart_range_label(chart, (since, until)),
            "time_offset": offset,
            **_failure_fields(failure),
        }
    )


def _sorted(result: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    def key(item: dict[str, Any]) -> tuple[str, Any]:
        name = item.get("slice_name", item.get("name"))
        return str(name or ""), item["id"]

    return {name: sorted(items, key=key) for name, items in result.items()}


def _time_range_filters(dashboard: Dashboard) -> list[dict[str, Any]]:
    try:
        metadata = json.loads(dashboard.json_metadata or "{}")
    except (TypeError, ValueError, RecursionError):
        return []
    filters = (
        metadata.get("native_filter_configuration")
        if isinstance(metadata, dict)
        else None
    )
    return [
        native_filter
        for native_filter in (filters if isinstance(filters, list) else [])
        if isinstance(native_filter, dict)
        and native_filter.get("filterType") == "filter_time"
    ]


def _check_filters(
    dashboard: Dashboard,
    limits: ResolvedTimeRangeLimits,
    result: dict[str, list[dict[str, Any]]],
) -> None:
    for native_filter in _time_range_filters(dashboard):
        entry = {"id": native_filter.get("id"), "name": native_filter.get("name")}
        value = time_filter_value("filter_time", native_filter.get("defaultDataMask"))
        if value is None:
            result["filters"].append(
                {
                    **entry,
                    "range": None,
                    "no_default": True,
                    "reason_code": None,
                    "rule": None,
                    "source": None,
                    "message": None,
                }
            )
            continue
        if (resolved := _resolve(value)) is None:
            continue
        try:
            failure = date_range_failure(*resolved, limits, dashboard_id=dashboard.id)
        except ValueError:
            continue
        if failure is not None:
            result["filters"].append(
                {
                    **entry,
                    "range": value,
                    "no_default": False,
                    **_failure_fields(failure),
                }
            )


def _empty() -> dict[str, list[dict[str, Any]]]:
    return {"charts": [], "filters": [], "unlimited": [], "unchecked": []}


def dashboard_save_check(
    dashboard: Dashboard,
    levels: StoredLevels,
    proposed: TimeRangeLimits | None,
    now: datetime,
    charts: list[Slice] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """
    The charts of ``dashboard`` (or only ``charts``, when given) and its Time
    Range filter defaults that the ``proposed`` dashboard policy would refuse,
    with the stored global and dataset ``levels``, judged as the query check
    judges them at ``now``.

    A chart in scope of a time range filter with a default isn't listed for the
    range that default gives it: the filter's own line covers it. A chart whose
    dataset has no temporal column, or whose semantic view has no temporal
    dimension, is in ``unlimited`` when a limit applies, and one whose query
    can't be built is in ``unchecked``.
    """
    result = _empty()
    if charts is None:
        charts = list(dashboard.slices)
    limited = (
        levels.global_limits is not None
        or proposed is not None
        or bool(levels.dataset_limits)
    )
    for chart in charts:
        if (datasource := chart.resolved_datasource) is None:
            result["unchecked"].append(_chart_entry(chart))
            continue
        try:
            temporal = has_temporal_column(cast("Explorable", datasource))
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "Time range limits could not be checked for chart %s",
                chart.id,
                exc_info=True,
            )
            result["unchecked"].append(_chart_entry(chart))
            continue
        if not temporal:
            if limited:
                result["unlimited"].append(_chart_entry(chart))
            continue
        dataset_limits = (
            levels.datasets.get(datasource.id)
            if chart.datasource_type == DatasourceType.TABLE
            else None
        )
        limits = resolve_time_range_limits(
            [
                ("global", levels.global_limits),
                ("dataset", dataset_limits),
                ("dashboard", proposed),
            ],
            now,
        )
        if limits is not None:
            _check_chart(chart, limits, result, dashboard)

    filter_limits = resolve_time_range_limits(
        [
            ("global", levels.global_limits),
            *(("dataset", limits) for limits in levels.dataset_limits),
            ("dashboard", proposed),
        ],
        now,
    )
    if filter_limits is not None:
        _check_filters(dashboard, filter_limits, result)
    return _sorted(result)


def dataset_charts(dataset: SqlaTable, limit: int) -> list[Slice]:
    """
    The first ``limit`` charts on ``dataset`` the user may list, as the chart list
    shows them, by ID.
    """
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset import db
    from superset.daos.chart import ChartDAO
    from superset.models.slice import Slice

    query = db.session.query(Slice).filter_by(
        datasource_id=dataset.id, datasource_type="table"
    )
    query = ChartDAO.base_filter(  # pylint: disable=not-callable
        ChartDAO.id_column_name, SQLAInterface(Slice, db.session)
    ).apply(query, None)
    return query.order_by(Slice.id).limit(limit).all()


def dataset_save_check(
    dataset: SqlaTable,
    levels: StoredLevels,
    proposed: TimeRangeLimits | None,
    now: datetime,
) -> dict[str, Any]:
    """
    The charts on ``dataset`` the user may list that the ``proposed`` dataset
    policy would refuse, with the stored global level, judged as the query check
    judges them at ``now`` outside any dashboard. Only the first
    ``DATASET_SAVE_CHECK_MAX_CHARTS`` charts are checked; ``truncated`` says the dataset
    has more. A dataset with no temporal column has nothing to check.
    """
    result = _empty()
    if not has_temporal_column(dataset):
        return {**result, "truncated": False}
    limits = resolve_time_range_limits(
        [("global", levels.global_limits), ("dataset", proposed)], now
    )
    if limits is None:
        return {**result, "truncated": False}
    charts = dataset_charts(dataset, DATASET_SAVE_CHECK_MAX_CHARTS + 1)
    for chart in charts[:DATASET_SAVE_CHECK_MAX_CHARTS]:
        _check_chart(chart, limits, result)
    return {**_sorted(result), "truncated": len(charts) > DATASET_SAVE_CHECK_MAX_CHARTS}
