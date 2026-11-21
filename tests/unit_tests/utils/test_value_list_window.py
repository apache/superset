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
"""Value lists with no time range read the window the time range limits allow."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any
from unittest.mock import patch

import pandas as pd
import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.extensions import feature_flag_manager, security_manager
from superset.time_range_limits.policy import (
    FEATURE_FLAG,
    resolve_time_range_limits,
    Rule,
    TimeRangeLimitError,
    TimeRangeLimits,
    validate_date_range,
    value_list_window,
)
from superset.utils import json
from tests.fixtures.time_range_query_paths import (
    as_user,
    BAD_GLOBAL,
    NOW,
    policy,
    set_global,
    tr,
    use_dashboards,
)

AUG_WINDOW = (datetime(2026, 7, 24), datetime(2026, 10, 22))


@contextmanager
def flag(on: bool) -> Iterator[None]:
    base = feature_flag_manager._feature_flags or {}
    with patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**base, FEATURE_FLAG: on},
    ):
        yield


@pytest.fixture
def flag_on() -> Iterator[None]:
    with flag(True):
        yield


with_flag_on = pytest.mark.usefixtures("flag_on")


def limits(
    now: datetime,
    span: tuple[int, str] | None = None,
    back: tuple[int, str] | None = None,
    forward: tuple[int, str] | None = None,
    dashboard_span: tuple[int, str] | None = None,
) -> Any:
    def rule(value: tuple[int, str] | None) -> Rule | None:
        return Rule(*value) if value is not None else None

    levels: list[tuple[str, TimeRangeLimits | None]] = [
        ("global", TimeRangeLimits(rule(span), rule(back), rule(forward))),
        (
            "dashboard",
            TimeRangeLimits(max_span=rule(dashboard_span)) if dashboard_span else None,
        ),
    ]
    return resolve_time_range_limits(levels, now)


# The window


@pytest.mark.parametrize(
    "now,rules,window",
    [
        (
            datetime(2026, 11, 13, 9, 30),
            {"span": (3, "P1M"), "back": (13, "P1M"), "forward": (0, "P1D")},
            (datetime(2026, 8, 14), datetime(2026, 11, 14)),
        ),
        (
            datetime(2026, 11, 13, 9, 30),
            {"span": (90, "P1D")},
            (datetime(2026, 8, 16), datetime(2026, 11, 14)),
        ),
        (
            datetime(2026, 11, 13, 9, 30),
            {"back": (13, "P1M")},
            (datetime(2025, 10, 13), datetime(2026, 11, 14)),
        ),
        (
            datetime(2026, 11, 13, 9, 30),
            {"span": (3, "P1M"), "back": (7, "P1D")},
            (datetime(2026, 11, 6), datetime(2026, 11, 14)),
        ),
        (
            datetime(2026, 11, 13, 9, 30, 15, 500),
            {"span": (6, "PT1H")},
            (datetime(2026, 11, 13, 3, 35), datetime(2026, 11, 13, 9, 35)),
        ),
        (
            datetime(2026, 11, 13, 9, 31, 20),
            {"back": (6, "PT1H")},
            (datetime(2026, 11, 13, 3, 35), datetime(2026, 11, 13, 9, 35)),
        ),
        (
            datetime(2026, 11, 13, 9, 31, 20),
            {"span": (2, "PT1M")},
            (datetime(2026, 11, 13, 9, 30), datetime(2026, 11, 13, 9, 32)),
        ),
        (
            datetime(2026, 11, 13, 9, 31, 20),
            {"span": (30, "P1D"), "forward": (0, "PT1H")},
            (datetime(2026, 10, 14, 9, 30), datetime(2026, 11, 13, 9, 30)),
        ),
        (
            datetime(2026, 11, 13, 0, 2, 10),
            {"back": (0, "P1D"), "forward": (0, "PT1H")},
            (datetime(2026, 11, 13), datetime(2026, 11, 13, 0, 2, 10)),
        ),
        (
            datetime(2026, 11, 13, 9, 30),
            {"span": (30, "P1D"), "forward": (0, "PT1H")},
            (datetime(2026, 10, 14, 9, 30), datetime(2026, 11, 13, 9, 30)),
        ),
        (
            datetime(2026, 5, 31, 23, 0),
            {"span": (3, "P1M")},
            (datetime(2026, 3, 1), datetime(2026, 6, 1)),
        ),
        (
            datetime(2026, 11, 13, 9, 30),
            {"span": (90, "P1D"), "dashboard_span": (30, "P1D")},
            (datetime(2026, 10, 15), datetime(2026, 11, 14)),
        ),
    ],
    ids=[
        "docs global",
        "span only",
        "look-back only",
        "look-back narrower than span",
        "sub-day span ends at the next step",
        "sub-day look-back starts on a step",
        "a rule shorter than the step sets the step",
        "end clipped to the latest end on a step",
        "a step never empties a window",
        "sub-day look-forward ends now",
        "month end",
        "dashboard span narrows",
    ],
)
def test_window_is_the_longest_allowed_range_ending_today(
    now: datetime, rules: dict[str, Any], window: tuple[datetime, datetime]
) -> None:
    resolved = limits(now, **rules)

    assert value_list_window(resolved, now) == window
    validate_date_range(*window, resolved, timezone=None)


def test_no_window_without_a_start() -> None:
    now = datetime(2026, 11, 13, 9, 30)

    assert value_list_window(limits(now, forward=(30, "P1D")), now) is None


@pytest.mark.parametrize(
    "rules",
    [{"back": (0, "PT1H")}, {"back": (0, "PT1H"), "span": (6, "PT1H")}],
    ids=["zero look-back", "zero look-back and a span"],
)
def test_window_is_empty_when_no_range_ending_now_fits(
    rules: dict[str, Any],
) -> None:
    now = datetime(2026, 11, 13, 9, 30, 20)

    since, until = value_list_window(limits(now, **rules), now) or (None, None)

    assert since is not None
    assert since == until


def test_sub_day_window_holds_within_a_step() -> None:
    windows = {
        value_list_window(limits(now, span=(6, "PT1H")), now)
        for now in (
            datetime(2026, 11, 13, 9, 30, 1),
            datetime(2026, 11, 13, 9, 30, 2),
            datetime(2026, 11, 13, 9, 30, 3),
            datetime(2026, 11, 13, 9, 34, 59),
        )
    }
    later = datetime(2026, 11, 13, 9, 35, 1)

    assert windows == {
        (datetime(2026, 11, 13, 3, 35), datetime(2026, 11, 13, 9, 35)),
    }
    assert value_list_window(limits(later, span=(6, "PT1H")), later) == (
        datetime(2026, 11, 13, 3, 40),
        datetime(2026, 11, 13, 9, 40),
    )


# Native Select filter option queries


SELECT = {
    "id": "NATIVE_FILTER-select",
    "filterType": "filter_select",
    "targets": [{"datasetId": 7, "column": {"name": "name"}}],
    "controlValues": {},
}
FORM_DATA = {
    "type": "NATIVE_FILTER",
    "native_filter_id": "NATIVE_FILTER-select",
    "dashboardId": 3,
}


def make_dataset(
    main_dttm_col: str | None = "ds",
    sql: str | None = None,
    temporal: tuple[str, ...] = ("ds", "created"),
) -> Any:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    return SqlaTable(
        id=7,
        table_name="calls",
        sql=sql,
        columns=[
            TableColumn(column_name="name", type="VARCHAR"),
            *(
                TableColumn(column_name=column, is_dttm=1, type="TIMESTAMP")
                for column in temporal
            ),
        ],
        main_dttm_col=main_dttm_col,
        database=Database(id=1, database_name="db", sqlalchemy_uri="sqlite://"),
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
        changed_on=datetime(2026, 1, 1),
    )


def make_dashboard(native_filter: dict[str, Any] = SELECT, limits: Any = None) -> Any:
    from superset.models.dashboard import Dashboard

    metadata: dict[str, Any] = {"native_filter_configuration": [native_filter]}
    if limits is not None:
        metadata["time_range_limits"] = limits
    return Dashboard(id=3, json_metadata=json.dumps(metadata), slices=[])


def option_query(**extra: Any) -> dict[str, Any]:
    return {
        "columns": ["name"],
        "metrics": [],
        "orderby": [["name", True]],
        "row_limit": 1000,
        **extra,
    }


def make_context(
    mocker: MockerFixture,
    dataset: Any,
    queries: list[dict[str, Any]],
    form_data: dict[str, Any] = FORM_DATA,
) -> Any:
    from superset.common.query_context_factory import QueryContextFactory

    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=dataset
    )
    return QueryContextFactory().create(
        datasource={"type": "table", "id": 7},
        queries=queries,
        form_data=form_data,
    )


def check(context: Any) -> None:
    from superset.time_range_limits.enforcement import (
        check_query_context_date_ranges,
    )

    check_query_context_date_ranges(context)


def checked(
    mocker: MockerFixture,
    dataset: Any,
    query: dict[str, Any],
    form_data: dict[str, Any] = FORM_DATA,
) -> Any:
    """The query object after the check, and its SQL."""
    context = make_context(mocker, dataset, [query], form_data)
    check(context)
    query_object = context.queries[0]
    return query_object, " ".join(dataset.get_query_str(query_object.to_dict()).split())


@pytest.fixture
def viewer(mocker: MockerFixture) -> None:
    as_user(mocker, "alpha")
    mocker.patch.object(security_manager, "get_rls_cache_key", return_value=[])
    mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_open_option_query_reads_the_window(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())

    query, sql = checked(mocker, make_dataset(), option_query())

    assert (query.granularity, query.from_dttm, query.to_dttm) == ("ds", *AUG_WINDOW)
    assert sql == (
        "SELECT name AS name FROM calls WHERE ds >= '2026-07-24 00:00:00' "
        "AND ds < '2026-10-22 00:00:00' GROUP BY name ORDER BY name ASC "
        "LIMIT 1000 OFFSET 0;"
    )


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_search_reads_the_window(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())
    search = {"col": "name", "op": "ILIKE", "val": "%sales%"}

    query, sql = checked(mocker, make_dataset(), option_query(filters=[search]))

    assert (query.from_dttm, query.to_dttm) == AUG_WINDOW
    assert "name ILIKE '%sales%'" in sql or "lower(name) LIKE" in sql
    assert "ds >= '2026-07-24 00:00:00'" in sql


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
@pytest.mark.parametrize(
    "rules,window",
    [
        (policy(90, back=30), (datetime(2026, 9, 21), datetime(2026, 10, 22))),
        (policy(back=30), (datetime(2026, 9, 21), datetime(2026, 10, 22))),
        (policy(30, back=90), (datetime(2026, 9, 22), datetime(2026, 10, 22))),
    ],
    ids=["look-back narrower", "look-back only", "span narrower"],
)
def test_span_and_look_back_together(
    mocker: MockerFixture, rules: Any, window: tuple[datetime, datetime]
) -> None:
    set_global(mocker, rules)
    use_dashboards(mocker, make_dashboard())

    query, _sql = checked(mocker, make_dataset(), option_query())

    assert (query.from_dttm, query.to_dttm) == window


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_dashboard_limits_narrow_the_window(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(limits=policy(30)))

    query, _sql = checked(mocker, make_dataset(), option_query())

    assert (query.from_dttm, query.to_dttm) == (
        datetime(2026, 9, 22),
        datetime(2026, 10, 22),
    )


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_filter_time_column_is_bounded(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard({**SELECT, "granularity_sqla": "created"}))

    query, sql = checked(mocker, make_dataset(), option_query(granularity="created"))

    assert query.granularity == "created"
    assert "created >= '2026-07-24 00:00:00'" in sql
    assert "ds >=" not in sql


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_virtual_dataset_is_bounded_outside(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())
    dataset = make_dataset(sql="SELECT * FROM raw_calls")

    _query, sql = checked(mocker, dataset, option_query())

    assert sql.startswith(
        "SELECT name AS name FROM (SELECT * FROM raw_calls ) AS virtual_table "
        "WHERE ds >= '2026-07-24 00:00:00' "
        "AND ds < '2026-10-22 00:00:00'"
    )


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_carried_range_is_kept_and_checked(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard({**SELECT, "granularity_sqla": "ds"}))
    dataset = make_dataset()

    query, sql = checked(
        mocker,
        dataset,
        option_query(granularity="ds", time_range="2026-10-01 : 2026-10-15"),
    )
    assert (query.from_dttm, query.to_dttm) == (
        datetime(2026, 10, 1),
        datetime(2026, 10, 15),
    )
    assert "ds >= '2026-10-01 00:00:00'" in sql

    with pytest.raises(TimeRangeLimitError) as info:
        checked(
            mocker,
            dataset,
            option_query(granularity="ds", time_range="2025-10-01 : 2026-10-15"),
        )
    assert info.value.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_one_sided_range_is_still_refused(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())

    with pytest.raises(TimeRangeLimitError) as info:
        checked(
            mocker,
            make_dataset(),
            option_query(filters=[tr("2026-10-01 : ")]),
        )
    assert info.value.error.extra["reason_code"] == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@pytest.mark.usefixtures("viewer")
@pytest.mark.parametrize(
    "enabled,rules,dataset",
    [
        (False, policy(90), make_dataset),
        (True, None, make_dataset),
        (
            True,
            {
                **(policy() or {}),
                "max_look_forward": {"quantity": 7, "time_grain": "P1D"},
            },
            make_dataset,
        ),
        (True, policy(90), lambda: make_dataset(main_dttm_col=None, temporal=())),
        (True, policy(90), lambda: make_dataset(main_dttm_col=None)),
        (True, policy(90), lambda: make_dataset(main_dttm_col="name")),
    ],
    ids=[
        "flag off",
        "no rule",
        "look-forward only",
        "no time column",
        "no default datetime column",
        "default datetime column not temporal",
    ],
)
def test_option_query_runs_as_before(
    mocker: MockerFixture, enabled: bool, rules: Any, dataset: Any
) -> None:
    set_global(mocker, rules)
    use_dashboards(mocker, make_dashboard())

    with flag(enabled):
        query, sql = checked(mocker, dataset(), option_query())

    assert (query.granularity, query.from_dttm, query.to_dttm) == (None, None, None)
    assert sql == (
        "SELECT name AS name FROM calls GROUP BY name ORDER BY name ASC "
        "LIMIT 1000 OFFSET 0;"
    )


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_bad_limits_still_fail_closed(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    set_global(mocker, BAD_GLOBAL)
    use_dashboards(mocker, make_dashboard())

    with pytest.raises(TimeRangeLimitsUnavailableError):
        checked(mocker, make_dataset(), option_query())


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_chart_with_a_saved_value_keeps_its_range(mocker: MockerFixture) -> None:
    """A Select filter's saved default reaches charts as a filter, untouched."""
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())
    chart = {
        "columns": ["name"],
        "metrics": ["count"],
        "filters": [
            {"col": "name", "op": "IN", "val": ["queue-from-2025"]},
            tr("2026-09-01 : 2026-10-01"),
        ],
    }

    query, sql = checked(mocker, make_dataset(), chart, {"dashboardId": 3})

    assert (query.from_dttm, query.to_dttm) == (
        datetime(2026, 9, 1),
        datetime(2026, 10, 1),
    )
    assert "name IN ('queue-from-2025')" in sql


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_option_query_cache_key_follows_the_day(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())
    dataset = make_dataset()

    morning, _sql = checked(mocker, dataset, option_query())
    with freeze_time("2026-10-21 23:59:00"):
        evening, _sql = checked(mocker, dataset, option_query())
    with freeze_time("2026-10-22 00:01:00"):
        next_day, _sql = checked(mocker, dataset, option_query())
    with flag(False):
        open_query, _sql = checked(mocker, dataset, option_query())

    assert morning.cache_key() == evening.cache_key()
    assert len({morning.cache_key(), next_day.cache_key(), open_query.cache_key()}) == 3


ZERO_LOOK_BACK = {
    "schema_version": 1,
    "max_span": None,
    "max_look_back": {"quantity": 0, "time_grain": "PT1H"},
    "max_look_forward": None,
}
SIX_HOURS = {
    "schema_version": 1,
    "max_span": {"quantity": 6, "time_grain": "PT1H"},
    "max_look_back": None,
    "max_look_forward": None,
}
RANGE = {
    "id": "NATIVE_FILTER-range",
    "filterType": "filter_range",
    "targets": [{"datasetId": 7, "column": {"name": "name"}}],
    "controlValues": {},
}


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
@pytest.mark.parametrize(
    "extra,native_filter",
    [
        ({}, SELECT),
        ({"time_range": "No filter"}, SELECT),
        (
            {"time_range": "No filter", "granularity": "ds"},
            {**SELECT, "granularity_sqla": "ds"},
        ),
    ],
    ids=["no time range", "No filter", "No filter on the filter's time column"],
)
def test_bounded_cache_key_names_the_window(
    mocker: MockerFixture, extra: dict[str, Any], native_filter: dict[str, Any]
) -> None:
    set_global(mocker, policy(90))
    dataset = make_dataset()

    def bounded(dashboard_limits: Any = None) -> Any:
        use_dashboards(mocker, make_dashboard(native_filter, limits=dashboard_limits))
        return checked(mocker, dataset, option_query(**extra))[0]

    today = bounded()
    stricter_dashboard = bounded(policy(30))
    with freeze_time("2026-10-22 08:00:00"):
        next_day = bounded()
    with flag(False):
        flag_off = bounded()
    with freeze_time("2026-10-21 23:00:00"):
        tonight = bounded()

    assert today.time_range == "2026-07-24T00:00:00 : 2026-10-22T00:00:00"
    assert stricter_dashboard.time_range == (
        "2026-09-22T00:00:00 : 2026-10-22T00:00:00"
    )
    keys = [
        query.cache_key() for query in (today, stricter_dashboard, next_day, flag_off)
    ]
    assert len(set(keys)) == 4
    assert tonight.cache_key() == keys[0]


@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_sub_day_window_is_shared_by_requests_and_the_async_worker(
    mocker: MockerFixture,
) -> None:
    from superset.common.query_serialization import (
        load_serialized_query,
        serialize_query,
    )

    set_global(mocker, SIX_HOURS)
    use_dashboards(mocker, make_dashboard())
    dataset = make_dataset()

    def request() -> Any:
        context = make_context(mocker, dataset, [option_query()])
        check(context)
        return context

    def key(context: Any) -> str:
        return context.query_cache_key(context.queries[0])

    keys = []
    for second in ("01", "02", "03"):
        with freeze_time(f"2026-10-21 12:00:{second}"):
            keys.append(key(request()))
    with freeze_time("2026-10-21 12:00:01"):
        submitted = request()
        payload = serialize_query(submitted, 0)
    with freeze_time("2026-10-21 12:00:40"):
        worker = load_serialized_query(payload)
        check(worker)
    with freeze_time("2026-10-21 12:01:30"):
        reread = request()

    assert len(set(keys)) == 1
    assert key(submitted) == key(worker) == key(reread) == keys[0]
    assert worker.queries[0].time_range == ("2026-10-21T06:05:00 : 2026-10-21T12:05:00")


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
@pytest.mark.parametrize(
    "rules", [ZERO_LOOK_BACK, {**ZERO_LOOK_BACK, "max_span": SIX_HOURS["max_span"]}]
)
def test_empty_window_refuses_the_option_query(
    mocker: MockerFixture, rules: dict[str, Any]
) -> None:
    set_global(mocker, rules)
    use_dashboards(mocker, make_dashboard())

    with pytest.raises(TimeRangeLimitError) as info:
        checked(mocker, make_dataset(), option_query())
    assert info.value.error.extra["reason_code"] == "UNBOUNDED_RANGE"


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_range_filter_runs_as_before(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard(RANGE))
    min_max = {
        "columns": [],
        "metrics": [
            {
                "expressionType": "SIMPLE",
                "aggregate": aggregate,
                "column": {"column_name": "name"},
                "label": aggregate.lower(),
            }
            for aggregate in ("MIN", "MAX")
        ],
    }

    query, sql = checked(
        mocker,
        make_dataset(),
        min_max,
        {**FORM_DATA, "native_filter_id": "NATIVE_FILTER-range"},
    )

    assert (query.granularity, query.from_dttm, query.time_range) == (None, None, None)
    assert "WHERE" not in sql


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_only_the_option_query_is_bounded(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())
    context = make_context(
        mocker,
        make_dataset(),
        [option_query(), {"columns": ["name"], "metrics": ["count"]}],
    )

    with pytest.raises(TimeRangeLimitError) as info:
        check(context)

    assert info.value.error.extra["reason_code"] == "UNBOUNDED_RANGE"
    assert context.queries[0].from_dttm == AUG_WINDOW[0]
    assert context.queries[1].from_dttm is None


@freeze_time(NOW)
@with_flag_on
@pytest.mark.usefixtures("viewer")
def test_the_check_validates_the_bounded_query(mocker: MockerFixture) -> None:
    set_global(mocker, policy(90))
    use_dashboards(mocker, make_dashboard())
    mocker.patch(
        "superset.time_range_limits.enforcement.value_list_window",
        return_value=(datetime(2026, 1, 1), AUG_WINDOW[1]),
    )

    with pytest.raises(TimeRangeLimitError) as info:
        checked(mocker, make_dataset(), option_query())
    assert info.value.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"


# Explore's column values


def column_values(mocker: MockerFixture, client: Any, dataset: Any) -> tuple[Any, Any]:
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=dataset
    )
    mocker.patch.object(security_manager, "raise_for_access")
    values = mocker.patch.object(type(dataset), "values_for_column", return_value=["a"])
    return client.get("/api/v1/datasource/table/7/column/name/values/"), values


@freeze_time(NOW)
@with_flag_on
def test_column_values_read_the_window(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    set_global(mocker, policy(90))

    response, values = column_values(mocker, client, make_dataset())

    assert response.status_code == 200
    assert response.json["result"] == ["a"]
    assert values.call_args.kwargs["time_window"] == ("ds", *AUG_WINDOW)


@freeze_time(NOW)
@pytest.mark.parametrize(
    "enabled,rules,dataset",
    [
        (False, policy(90), make_dataset),
        (False, BAD_GLOBAL, make_dataset),
        (True, None, make_dataset),
        (True, BAD_GLOBAL, lambda: make_dataset(main_dttm_col=None, temporal=())),
        (True, policy(90), lambda: make_dataset(main_dttm_col=None)),
    ],
    ids=[
        "flag off",
        "flag off, bad global",
        "no rule",
        "no time column",
        "no default datetime column",
    ],
)
def test_column_values_run_as_before(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    enabled: bool,
    rules: Any,
    dataset: Any,
) -> None:
    set_global(mocker, rules)

    with flag(enabled):
        response, values = column_values(mocker, client, dataset())

    assert response.status_code == 200
    assert values.call_args.kwargs["time_window"] is None


@freeze_time(NOW)
@with_flag_on
def test_column_values_refuse_an_empty_window(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    set_global(mocker, ZERO_LOOK_BACK)

    response, values = column_values(mocker, client, make_dataset())

    assert response.status_code == 400
    assert response.json["errors"][0]["extra"]["reason_code"] == "UNBOUNDED_RANGE"
    values.assert_not_called()


@freeze_time(NOW)
@with_flag_on
def test_column_values_window_moves_in_steps(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    set_global(mocker, SIX_HOURS)
    windows = []
    for second in ("01", "02", "03"):
        with freeze_time(f"2026-10-21 12:00:{second}"):
            response, values = column_values(mocker, client, make_dataset())
            assert response.status_code == 200
            windows.append(values.call_args.kwargs["time_window"])

    assert set(windows) == {
        ("ds", datetime(2026, 10, 21, 6, 5), datetime(2026, 10, 21, 12, 5))
    }


@freeze_time(NOW)
@with_flag_on
def test_column_values_fail_closed_on_bad_limits(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    set_global(mocker, BAD_GLOBAL)

    response, values = column_values(mocker, client, make_dataset())

    assert response.status_code == 503
    assert response.json["errors"][0]["extra"]["reason_code"] == "POLICY_UNAVAILABLE"
    values.assert_not_called()


def values_sql(mocker: MockerFixture, dataset: Any, **kwargs: Any) -> str:
    read = mocker.patch(
        "superset.models.helpers.pd.read_sql_query",
        return_value=pd.DataFrame({"column_values": ["a"]}),
    )
    mocker.patch.object(security_manager, "get_rls_filters", return_value=[])
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    assert dataset.values_for_column("name", limit=10000, **kwargs) == ["a"]
    return " ".join(str(read.call_args.kwargs["sql"]).split())


VIRTUAL = "(SELECT * FROM raw_calls ) AS virtual_table"
WINDOW_SQL = "WHERE ds >= '2026-07-24 00:00:00' AND ds < '2026-10-22 00:00:00' "


@pytest.mark.parametrize(
    "sql,source",
    [(None, "calls"), ("SELECT * FROM raw_calls", VIRTUAL)],
    ids=["physical", "virtual"],
)
def test_values_for_column_sql(
    mocker: MockerFixture, sql: str | None, source: str
) -> None:
    dataset = make_dataset(sql=sql)
    select = " ".join(["SELECT DISTINCT name AS column_values FROM", source])

    assert values_sql(mocker, dataset) == select + " LIMIT 10000 OFFSET 0"
    assert values_sql(mocker, dataset, time_window=("ds", *AUG_WINDOW)) == (
        select + " " + WINDOW_SQL + "LIMIT 10000 OFFSET 0"
    )


def test_column_values_cache_key_carries_the_window(mocker: MockerFixture) -> None:
    from superset.datasource.api import get_cached_column_values

    stored: dict[str, Any] = {}
    cache = mocker.patch("superset.datasource.api.cache_manager")
    cache.data_cache.get.side_effect = stored.get
    cache.data_cache.set.side_effect = lambda key, value, timeout: stored.update(
        {key: value}
    )
    mocker.patch.object(security_manager, "get_rls_cache_key", return_value=[])
    dataset = make_dataset()
    mocker.patch.object(type(dataset), "values_for_column", return_value=["a"])
    next_day = (AUG_WINDOW[0].replace(day=25), AUG_WINDOW[1].replace(day=23))

    for window in [None, ("ds", *AUG_WINDOW), ("ds", *AUG_WINDOW), ("ds", *next_day)]:
        get_cached_column_values(
            dataset,
            column_name="name",
            limit=10,
            denormalize_column=False,
            time_window=window,
        )

    assert len(stored) == 3


# Async chart data


ONE_SECOND = {
    "schema_version": 1,
    "max_span": {"quantity": 1, "time_grain": "PT1S"},
    "max_look_back": None,
    "max_look_forward": None,
}


@pytest.fixture
def calls_db(tmp_path: Any) -> Any:
    """A dataset on a SQLite file with one old and one recent row."""
    import sqlite3

    path = tmp_path / "calls.db"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE calls (name TEXT, ds TEXT, created TEXT)")
        connection.executemany(
            "INSERT INTO calls VALUES (?, ?, ?)",
            [
                ("old", "2026-06-01 10:00:00", "2026-06-01 10:00:00"),
                ("recent", "2026-10-21 11:00:00", "2026-10-21 11:00:00"),
            ],
        )
    dataset = make_dataset()
    dataset.database.sqlalchemy_uri = f"sqlite:///{path}"
    return dataset


def post_async(
    mocker: MockerFixture, client: Any, dataset: Any, query: dict[str, Any]
) -> Any:
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=dataset
    )
    return client.post(
        "/api/v1/chart/data",
        json={
            "datasource": {"id": 7, "type": "table"},
            "queries": [query],
            "form_data": FORM_DATA,
            "result_format": "json",
            "result_type": "full",
            "async_mode": True,
        },
    )


@pytest.fixture
def async_on(mocker: MockerFixture) -> Any:
    """Async chart data on, with a data cache async can read back from."""
    from flask_caching.backends import SimpleCache

    from superset import is_feature_enabled

    mocker.patch(
        "superset.charts.data.api.is_feature_enabled",
        side_effect=lambda name: name == "GLOBAL_ASYNC_QUERIES"
        or is_feature_enabled(name),
    )
    cache = mocker.patch("superset.charts.data.api.cache_manager")
    cache.data_cache.cache = SimpleCache()
    mocker.patch("superset.charts.data.api.get_user_id", return_value=1)
    mocker.patch.object(security_manager, "raise_for_access")
    return mocker.patch(
        "superset.charts.data.api.submit_chart_data_query_tasks",
        return_value={"task_ids": ["task"], "cursor": "0"},
    )


@with_flag_on
@pytest.mark.usefixtures("viewer", "full_api_access")
@pytest.mark.parametrize(
    "rules,dataset_forward,times,data",
    [
        (
            SIX_HOURS,
            None,
            ["2026-10-21 12:00:10", "2026-10-21 12:06:20", "2026-10-21 12:12:40"],
            [{"name": "recent"}],
        ),
        (
            ONE_SECOND,
            None,
            ["2026-10-21 12:00:01", "2026-10-21 12:00:02", "2026-10-21 12:00:03"],
            [],
        ),
        (
            {
                "schema_version": 1,
                "max_span": None,
                "max_look_back": {"quantity": 0, "time_grain": "P1D"},
                "max_look_forward": None,
            },
            {"quantity": 0, "time_grain": "PT1H"},
            ["2026-10-21 00:00:01", "2026-10-21 00:00:02", "2026-10-21 00:03:00"],
            [],
        ),
    ],
    ids=["across steps", "one-second rule", "exact window after midnight"],
)
def test_value_list_with_a_window_runs_synchronously(
    mocker: MockerFixture,
    client: Any,
    calls_db: Any,
    async_on: Any,
    rules: dict[str, Any],
    dataset_forward: dict[str, Any] | None,
    times: list[str],
    data: list[dict[str, Any]],
) -> None:
    set_global(mocker, rules)
    use_dashboards(mocker, make_dashboard())
    if dataset_forward is not None:
        calls_db.extra = json.dumps(
            {
                "time_range_limits": {
                    "schema_version": 1,
                    "max_span": None,
                    "max_look_back": None,
                    "max_look_forward": dataset_forward,
                }
            }
        )

    for moment in times:
        with freeze_time(moment):
            response = post_async(mocker, client, calls_db, option_query())
            assert response.status_code == 200, response.json
            assert response.json["result"][0]["data"] == data

    async_on.assert_not_called()


@freeze_time("2026-10-21 12:00:10")
@with_flag_on
@pytest.mark.usefixtures("viewer", "full_api_access")
def test_value_list_with_its_own_range_stays_async(
    mocker: MockerFixture, client: Any, calls_db: Any, async_on: Any
) -> None:
    set_global(mocker, SIX_HOURS)
    use_dashboards(mocker, make_dashboard({**SELECT, "granularity_sqla": "ds"}))
    carried = option_query(
        granularity="ds", time_range="2026-10-21T08:00:00 : 2026-10-21T12:00:00"
    )

    response = post_async(mocker, client, calls_db, carried)

    assert response.status_code == 202
    async_on.assert_called_once()
