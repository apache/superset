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
# pylint: disable=redefined-outer-name, unused-argument, import-outside-toplevel
"""the charts and filter defaults proposed time range limits would refuse."""

from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from flask import current_app
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.extensions import security_manager
from superset.time_range_limits.policy import (
    parse_time_range_limits,
    TimeRangeLimitError,
    TimeRangeLimitsUnavailableError,
)
from superset.time_range_limits.save_check import (
    chart_datasets,
    dashboard_save_check,
    dataset_save_check,
    load_stored_levels,
)
from superset.utils import json
from tests.fixtures.time_range_enforcement import make_dataset, tr
from tests.fixtures.time_range_query_paths import as_user
from tests.fixtures.time_range_save_check import (
    adhoc,
    DASHBOARD_URL,
    DATASET_URL,
    FLAG_ON,
    form_data_chart,
    layout,
    MODERN,
    modern,
    named_filter,
    NOW,
    P,
    rison,
    snapshot,
)
from tests.unit_tests.conftest import with_feature_flags

SPAN_90 = "Range can't be longer than 90 days. This one is 365 days."
UNBOUNDED_DASHBOARD = (
    "This chart requires a bounded time range. Ask a dashboard editor to add or "
    "scope a time range filter."
)


def other_ts(value: str) -> list[dict[str, Any]]:
    return [adhoc(tr(value, "other_ts"))]


def make_dash(
    charts: list[Any],
    filters: list[dict[str, Any]] | None = None,
    stored: Any = None,
    tab_charts: tuple[int, ...] = (),
) -> Any:
    from superset.models.dashboard import Dashboard

    metadata: dict[str, Any] = {"native_filter_configuration": filters or []}
    if stored is not None:
        metadata["time_range_limits"] = stored
    return Dashboard(
        id=3,
        dashboard_title="Contact center",
        json_metadata=json.dumps(metadata),
        position_json=layout(
            [chart.id for chart in charts if chart.id not in tab_charts],
            list(tab_charts),
        ),
        slices=charts,
    )


@pytest.fixture
def world(mocker: MockerFixture) -> dict[int, Any]:
    """Dataset 7 temporal, 8 with no temporal column, 9 temporal with 7 days."""
    from superset.models.slice import Slice

    temporal = make_dataset()
    flat = make_dataset(temporal=False)
    flat.id = 8
    strict = make_dataset(extra=json.dumps({"time_range_limits": P(span=7)}))
    strict.id = 9
    datasets = {7: temporal, 8: flat, 9: strict}
    mocker.patch.object(security_manager, "get_guest_rls_filters", return_value=[])
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None)
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource",
        side_effect=lambda datasource_type, database_id_or_uuid: datasets[
            int(database_id_or_uuid)
        ],
    )
    for attribute in ("datasource", "resolved_datasource"):
        mocker.patch.object(
            Slice, attribute, property(lambda self: datasets.get(self.datasource_id))
        )
    as_user(mocker, "alpha")
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None})
    return datasets


@pytest.fixture
def counted(mocker: MockerFixture) -> dict[str, Any]:
    return {
        "TimeRangeLimitError": mocker.spy(TimeRangeLimitError, "__init__"),
        "TimeRangeLimitsUnavailableError": mocker.spy(
            TimeRangeLimitsUnavailableError, "__init__"
        ),
    }


def built(counted: dict[str, Any]) -> dict[str, int]:
    return {name: spy.call_count for name, spy in counted.items()}


def check(dashboard: Any, proposed: Any = None) -> dict[str, Any]:
    levels = load_stored_levels(chart_datasets(list(dashboard.slices)))
    return dashboard_save_check(
        dashboard, levels, parse_time_range_limits(proposed), datetime.now()
    )


def names(result: dict[str, Any], key: str) -> list[str]:
    return [item.get("slice_name", item.get("name")) for item in result[key]]


def line(item: dict[str, Any]) -> tuple[Any, ...]:
    return (
        item["slice_name"],
        item["range"],
        item["time_offset"],
        item["reason_code"],
        item["source"],
        item["message"],
    )


def query_check(chart: Any, dashboard: Any, mocker: MockerFixture) -> str:
    """The query check's verdict for ``chart`` on ``dashboard`` (policy stored)."""
    from superset.time_range_limits.enforcement import (
        _chart_source,
        check_query_context_date_ranges,
    )

    mocker.patch(
        "superset.daos.dashboard.DashboardDAO.find_by_id", return_value=dashboard
    )
    query_context = _chart_source(chart, dashboard)
    query_context.limit_slice_id = chart.id
    query_context.limit_dashboard_id = dashboard.id
    try:
        check_query_context_date_ranges(query_context)
    except TimeRangeLimitError as ex:
        return f"{(ex.error.extra or {})['reason_code']} {ex.error.message}"
    return "OK"


PROPOSED = P(span=90, back=6, back_grain="P1M")


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dashboard_lists_own_ranges(world: Any, counted: Any) -> None:
    charts = [
        modern(11, "Calls by queue", 7, [tr("Last year")]),
        modern(12, "Abandon trend", 7, [tr("No filter")]),
        modern(13, "Two own ranges", 7, [tr("Last week"), tr("Last year", "other_ts")]),
        form_data_chart(
            14,
            "Form data time range",
            7,
            time_range="Last year",
            adhoc_filters=other_ts("Last week"),
        ),
    ]
    dashboard = make_dash(
        charts,
        [named_filter("Time range", "Last 30 days", excluded=[11, 12, 13, 14])],
    )

    result = check(dashboard, P(span=90))

    assert [line(item) for item in result["charts"]] == [
        ("Abandon trend", None, None, "UNBOUNDED_RANGE", None, UNBOUNDED_DASHBOARD),
        (
            "Calls by queue",
            "Last year",
            None,
            "MAX_SPAN_EXCEEDED",
            "dashboard",
            SPAN_90,
        ),
        (
            "Form data time range",
            "Last year",
            None,
            "MAX_SPAN_EXCEEDED",
            "dashboard",
            SPAN_90,
        ),
        (
            "Two own ranges",
            "Last year",
            None,
            "MAX_SPAN_EXCEEDED",
            "dashboard",
            SPAN_90,
        ),
    ]
    assert result["charts"][1]["url"] == "/explore/?slice_id=11"
    assert result["charts"][1]["rule"] == "max_span"
    assert result["filters"] == result["unlimited"] == result["unchecked"] == []
    assert built(counted) == {
        "TimeRangeLimitError": 0,
        "TimeRangeLimitsUnavailableError": 0,
    }


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_scope_rootpath_excluded_tabs(world: Any, mocker: MockerFixture) -> None:
    charts = [
        modern(21, "In scope", 7, [tr("Last year")]),
        modern(22, "Excluded", 7, [tr("Last year")]),
        modern(23, "In TAB-B outside rootPath", 7, [tr("Last year")]),
    ]
    filters = [named_filter("Time range", "Last 30 days", excluded=[22])]
    dashboard = make_dash(charts, filters, tab_charts=(23,))

    result = check(dashboard, P(span=90))

    assert [line(item) for item in result["charts"]] == [
        ("Excluded", "Last year", None, "MAX_SPAN_EXCEEDED", "dashboard", SPAN_90),
        (
            "In TAB-B outside rootPath",
            "Last year",
            None,
            "MAX_SPAN_EXCEEDED",
            "dashboard",
            SPAN_90,
        ),
    ]
    stored = make_dash(charts, filters, stored=P(span=90), tab_charts=(23,))
    assert [query_check(chart, stored, mocker) for chart in stored.slices] == [
        "OK",
        f"MAX_SPAN_EXCEEDED {SPAN_90}",
        f"MAX_SPAN_EXCEEDED {SPAN_90}",
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_a_chart_with_a_selected_layer_takes_the_filter(world: Any) -> None:
    charts = [
        modern(24, "Excluded, its layer selected", 7, [tr("Last year")]),
        modern(25, "Excluded", 7, [tr("Last year")]),
    ]
    native_filter = named_filter("Time range", "Last 30 days", excluded=[24, 25])
    native_filter["scope"]["selectedLayers"] = ["chart-24-layer-0"]

    result = check(make_dash(charts, [native_filter]), P(span=90))

    assert [item["slice_name"] for item in result["charts"]] == ["Excluded"]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_filter_default_reported_once(world: Any) -> None:
    charts = [
        modern(41, "Supplied A", 7, [tr("Last month")]),
        form_data_chart(42, "Supplied B", 7, time_range="Last month"),
    ]
    dashboard = make_dash(charts, [named_filter("Time range", "Last year")])

    result = check(dashboard, P(span=90))

    assert result["charts"] == []
    assert result["filters"] == [
        {
            "id": "NATIVE_FILTER-time",
            "name": "Time range",
            "range": "Last year",
            "no_default": False,
            "reason_code": "MAX_SPAN_EXCEEDED",
            "rule": "max_span",
            "source": "dashboard",
            "message": SPAN_90,
        }
    ]


@pytest.mark.parametrize("value", [None, "No filter"], ids=["none", "no_filter"])
@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_filter_without_default(world: Any, value: str | None) -> None:
    dashboard = make_dash(
        [modern(43, "Chart", 7, [tr("Last month")])],
        [named_filter("Time range", value)],
    )

    result = check(dashboard, P(span=90))

    assert result["filters"] == [
        {
            "id": "NATIVE_FILTER-time",
            "name": "Time range",
            "range": None,
            "no_default": True,
            "reason_code": None,
            "rule": None,
            "source": None,
            "message": None,
        }
    ]
    assert check(dashboard)["filters"] == []


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_filter_levels_match_t7e(world: Any) -> None:
    charts = [
        modern(44, "In scope", 7, [tr("Last week")]),
        modern(45, "Strict dataset, outside scope", 9, [tr("Last 3 days")]),
    ]
    dashboard = make_dash(
        charts, [named_filter("Time range", "Last 30 days", excluded=[45])]
    )

    result = check(dashboard, P(span=90))

    assert result["charts"] == []
    assert [
        (item["range"], item["reason_code"], item["source"], item["message"])
        for item in result["filters"]
    ] == [
        (
            "Last 30 days",
            "MAX_SPAN_EXCEEDED",
            "dataset",
            "Range can't be longer than 7 days. This one is 30 days.",
        )
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_two_time_filters(world: Any, mocker: MockerFixture) -> None:
    from superset.time_range_limits.enforcement import dashboard_time_filter

    charts = [modern(46, "In scope of both", 7, [tr("Last year")])]
    filters = [
        named_filter("First", "Last year", filter_id="NATIVE_FILTER-first"),
        named_filter("Second", "Last 7 days", filter_id="NATIVE_FILTER-second"),
    ]
    dashboard = make_dash(charts, filters)

    result = check(dashboard, P(span=90))

    assert dashboard_time_filter(dashboard, charts[0]) == (
        "NATIVE_FILTER-second",
        "Second",
        "Last 7 days",
    )
    assert result["charts"] == []
    assert [(item["name"], item["reason_code"]) for item in result["filters"]] == [
        ("First", "MAX_SPAN_EXCEEDED")
    ]
    stored = make_dash(charts, filters, stored=P(span=90))
    assert query_check(stored.slices[0], stored, mocker) == "OK"


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_time_comparison_in_scope_listed(world: Any, mocker: MockerFixture) -> None:
    charts = [
        modern(
            51, "Week over week", 7, [tr("Last month")], time_offsets=["1 year ago"]
        ),
        form_data_chart(
            52,
            "Form data week over week",
            7,
            time_range="Last week",
            time_compare=["1 year ago"],
        ),
    ]
    filters = [named_filter("Time range", "Last 30 days")]
    look_back = (
        'Time comparison "1 year ago": Start can\'t be earlier than Apr 28, '
        "2026 (6 months ago)."
    )

    result = check(make_dash(charts, filters), PROPOSED)

    assert [line(item) for item in result["charts"]] == [
        (
            "Form data week over week",
            "Last week",
            "1 year ago",
            "MAX_LOOK_BACK_EXCEEDED",
            "dashboard",
            look_back,
        ),
        (
            "Week over week",
            "Last month",
            "1 year ago",
            "MAX_LOOK_BACK_EXCEEDED",
            "dashboard",
            look_back,
        ),
    ]
    stored = make_dash(charts, filters, stored=PROPOSED)
    for chart in stored.slices:
        assert (
            query_check(chart, stored, mocker) == f"MAX_LOOK_BACK_EXCEEDED {look_back}"
        )


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_levels_dataset_stricter(world: Any) -> None:
    dashboard = make_dash([modern(61, "Strict", 9, [tr("Last 30 days")])])

    result = check(dashboard, P(span=90))

    assert [(item["reason_code"], item["source"]) for item in result["charts"]] == [
        ("MAX_SPAN_EXCEEDED", "dataset")
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_policy_null_drops_level(world: Any) -> None:
    current_app.config["TIME_RANGE_LIMITS_GLOBAL"] = P(span=180)
    charts = [
        modern(62, "Last year", 7, [tr("Last year")]),
        modern(63, "Last quarter", 7, [tr("Last quarter")]),
    ]
    dashboard = make_dash(charts)

    with_proposed = check(dashboard, P(span=30))
    without = check(dashboard, None)

    assert names(with_proposed, "charts") == ["Last quarter", "Last year"]
    assert [(item["slice_name"], item["source"]) for item in without["charts"]] == [
        ("Last year", "global")
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_unlimited_charts(world: Any) -> None:
    charts = [
        modern(71, "Queue names", 8, []),
        modern(72, "Calls", 7, [tr("Last week")]),
    ]

    result = check(make_dash(charts), P(span=90))

    assert result["unlimited"] == [
        {"id": 71, "slice_name": "Queue names", "url": "/explore/?slice_id=71"}
    ]
    assert result["charts"] == []


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_unlimited_empty_without_limits(world: Any) -> None:
    charts = [
        modern(73, "Queue names", 8, []),
        modern(74, "Calls", 7, [tr("Last year")]),
    ]

    assert check(make_dash(charts), None) == {
        "charts": [],
        "filters": [],
        "unlimited": [],
        "unchecked": [],
    }
    assert names(
        check(make_dash([*charts, modern(75, "S", 9, [])]), None), "unlimited"
    ) == ["Queue names"]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_deck_multi_temporal_not_listed(world: Any) -> None:
    from superset.models.slice import Slice

    deck = Slice(
        id=76,
        slice_name="Deck multi",
        datasource_id=7,
        datasource_type="table",
        viz_type="deck_multi",
        params=json.dumps(
            {
                "datasource": "7__table",
                "viz_type": "deck_multi",
                "deck_slices": [31],
                "time_range": "Last year",
            }
        ),
    )

    result = check(make_dash([deck]), P(span=90))

    assert result == {"charts": [], "filters": [], "unlimited": [], "unchecked": []}


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dataset_without_temporal_column(world: Any, mocker: MockerFixture) -> None:
    listed = mocker.patch(
        "superset.time_range_limits.save_check.dataset_charts",
        return_value=[modern(77, "Queue names", 8, [])],
    )
    levels = load_stored_levels([world[8]])

    result = dataset_save_check(
        world[8], levels, parse_time_range_limits(P(span=90)), datetime.now()
    )

    assert result == {
        "charts": [],
        "filters": [],
        "unlimited": [],
        "unchecked": [],
        "truncated": False,
    }
    listed.assert_not_called()


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dataset_check_each_chart_once(world: Any, mocker: MockerFixture) -> None:
    charts = [
        modern(81, "On two dashboards", 7, [tr("Last 60 days")]),
        modern(82, "Wide", 7, [tr("Last year")]),
    ]
    stricter = P(span=30)
    for dashboard_id in (4, 5):
        dashboard = make_dash(charts, stored=stricter)
        dashboard.id = dashboard_id
    mocker.patch(
        "superset.time_range_limits.save_check.dataset_charts", return_value=charts
    )

    result = dataset_save_check(
        world[7],
        load_stored_levels([world[7]]),
        parse_time_range_limits(P(span=90)),
        datetime.now(),
    )

    assert [line(item) for item in result["charts"]] == [
        (
            "Wide",
            "Last year",
            None,
            "MAX_SPAN_EXCEEDED",
            "dataset",
            "Range can't be longer than 90 days. This one is 365 days.",
        )
    ]
    assert result["charts"][0]["message"].startswith("Range")


@pytest.mark.parametrize(
    "params, failing, label",
    [
        ({"time_range": "Last year"}, None, "Last year"),
        (
            {"adhoc_filters": [adhoc(tr("Last month"))], "time_range": "No filter"},
            None,
            "Last month",
        ),
        (
            {"adhoc_filters": [adhoc(tr("No filter"))], "time_range": "Last year"},
            None,
            None,
        ),
        (
            {
                "adhoc_filters": [
                    adhoc(tr("Last week")),
                    adhoc(tr("Last year", "other_ts")),
                ]
            },
            None,
            "Last week",
        ),
        (
            {
                "adhoc_filters": [
                    adhoc(tr("Last week")),
                    adhoc(tr("Last year", "other_ts")),
                ]
            },
            (datetime(2025, 10, 28), datetime(2026, 10, 28)),
            "Last year",
        ),
        (
            {"adhoc_filters": other_ts("Last week"), "time_range": "Last year"},
            (datetime(2025, 10, 28), datetime(2026, 10, 28)),
            "Last year",
        ),
    ],
    ids=[
        "time_range",
        "adhoc",
        "no_filter",
        "several",
        "failing_second",
        "failing_time_range",
    ],
)
@freeze_time(NOW)
def test_chart_range_label(params: dict[str, Any], failing: Any, label: Any) -> None:
    from superset.models.slice import Slice
    from superset.time_range_limits.enforcement import chart_range_label

    chart = Slice(id=1, params=json.dumps(params))

    assert chart_range_label(chart, failing) == label


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON, ENABLE_TEMPLATE_PROCESSING=True)
def test_template_removes_time_filter(world: Any, mocker: MockerFixture) -> None:
    metric = {
        "expressionType": "SQL",
        "sqlExpression": "SUM(CASE WHEN ds >= "
        "{{ get_time_filter('ds', remove_filter=True).from_expr }} THEN 1 END)",
        "label": "templated",
    }
    charts = [
        modern(93, "Template removes filter", 7, [tr("Last 30 days")], [metric]),
        modern(94, "Plain", 7, [tr("Last 30 days")]),
    ]

    result = check(make_dash(charts), P(span=90))

    assert [line(item) for item in result["charts"]] == [
        (
            "Template removes filter",
            "Last 30 days",
            None,
            "UNBOUNDED_RANGE",
            None,
            UNBOUNDED_DASHBOARD,
        )
    ]
    stored = make_dash(charts, stored=P(span=90))
    assert [query_check(chart, stored, mocker) for chart in stored.slices] == [
        f"UNBOUNDED_RANGE {UNBOUNDED_DASHBOARD}",
        "OK",
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_check_runs_no_query(world: Any, counted: Any, mocker: MockerFixture) -> None:
    from superset.models.core import Database

    engine = mocker.patch.object(Database, "get_sqla_engine")
    get_df = mocker.patch.object(Database, "get_df")
    charts = [
        modern(101, "Calls by queue", 7, [tr("Last year")]),
        modern(102, "Abandon trend", 7, [tr("No filter")]),
        form_data_chart(
            103,
            "Form data compare",
            7,
            time_range="Last year",
            time_compare=["1 year ago"],
        ),
        modern(
            104, "Week over week", 7, [tr("Last month")], time_offsets=["1 year ago"]
        ),
    ]
    dashboard = make_dash(
        charts, [named_filter("Time range", "Last 30 days", excluded=[101, 102, 103])]
    )

    result = check(dashboard, PROPOSED)

    assert len(result["charts"]) == 4
    engine.assert_not_called()
    get_df.assert_not_called()
    assert built(counted) == {
        "TimeRangeLimitError": 0,
        "TimeRangeLimitsUnavailableError": 0,
    }


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_unbuildable_chart_listed(world: Any) -> None:
    from superset.models.slice import Slice

    broken = modern(111, "Broken query context", 7, [tr("Last year")])
    broken.query_context = "{not json"
    gone = Slice(
        id=112,
        slice_name="Dataset gone",
        datasource_id=99,
        datasource_type="table",
        viz_type=MODERN,
        params="{}",
    )

    result = check(make_dash([broken, gone]), P(span=90))

    assert result["unchecked"] == [
        {
            "id": 111,
            "slice_name": "Broken query context",
            "url": "/explore/?slice_id=111",
        },
        {"id": 112, "slice_name": "Dataset gone", "url": "/explore/?slice_id=112"},
    ]
    assert result["charts"] == []


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_result_sort_order(world: Any) -> None:
    charts = [
        modern(123, "b", 7, [tr("Last year")]),
        modern(121, "a", 7, [tr("Last year")]),
        modern(122, "b", 7, [tr("Last year")]),
        modern(124, "B", 8, []),
        modern(125, "A", 8, []),
        modern(10, "c", 7, [tr("Last year")]),
        modern(9, "c", 7, [tr("Last year")]),
    ]
    excluded = [121, 122, 123, 10, 9]
    filters = [
        named_filter("Z", "Last year", filter_id="F-2", excluded=excluded),
        named_filter("Y", None, filter_id="F-1", excluded=excluded),
    ]

    result = check(make_dash(charts, filters), P(span=90))

    assert [item["id"] for item in result["charts"]] == [121, 122, 123, 9, 10]
    assert [item["id"] for item in result["unlimited"]] == [125, 124]
    assert [item["name"] for item in result["filters"]] == ["Y", "Z"]


# Endpoints, on a real SQLite session

LOGGER = "superset.time_range_limits"


def log_actions() -> list[str]:
    from superset import db
    from superset.models.core import Log

    return [row.action for row in db.session.query(Log).order_by(Log.id)]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_check_writes_nothing(save_check_objects: dict[str, Any], client: Any) -> None:
    before = snapshot(save_check_objects)
    logs = log_actions()

    dashboard = client.get(
        DASHBOARD_URL.format(save_check_objects["dashboard"].id) + rison(PROPOSED)
    )
    dataset = client.get(
        DATASET_URL.format(save_check_objects["table"].id) + rison(P(span=90))
    )

    assert dashboard.status_code == dataset.status_code == 200
    assert names(dashboard.json["result"], "charts") == [
        "Calls by queue",
        "Form data line",
        "Week over week",
    ]
    assert names(dataset.json["result"], "charts") == [
        "Calls by queue",
        "Form data line",
    ]
    assert snapshot(save_check_objects) == before
    assert log_actions()[len(logs) :] == [
        "DashboardRestApi.get_time_range_limits_charts",
        "DatasetRestApi.get_time_range_limits_charts",
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_check_records_no_rejection(
    save_check_objects: dict[str, Any],
    client: Any,
    counted: Any,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    import logging

    incr = mocker.patch(
        "superset.time_range_limits.telemetry.stats_logger_manager"
    ).instance.incr
    caplog.set_level(logging.DEBUG, logger=LOGGER)

    response = client.get(
        DASHBOARD_URL.format(save_check_objects["dashboard"].id) + rison(PROPOSED)
    )

    assert response.status_code == 200
    assert len(response.json["result"]["charts"]) == 3
    assert built(counted) == {
        "TimeRangeLimitError": 0,
        "TimeRangeLimitsUnavailableError": 0,
    }
    assert incr.call_count == 0
    assert [record for record in caplog.records if record.name == LOGGER] == []


BAD = {
    "time_range_limits": {
        **P(span=90),
        "max_span": {"quantity": 0, "time_grain": "P1D"},
    }
}


@pytest.mark.parametrize(
    "level, url, query",
    [
        ("global", DASHBOARD_URL, ""),
        ("global", DASHBOARD_URL, rison(P(span=30))),
        ("global", DATASET_URL, rison(P(span=30))),
        ("dataset", DASHBOARD_URL, rison(P(span=30))),
        ("dataset", DATASET_URL, rison(P(span=30))),
        ("dashboard", DASHBOARD_URL, ""),
    ],
    ids=[
        "global",
        "global-proposed_differs",
        "global-dataset_endpoint",
        "dataset",
        "dataset-dataset_endpoint",
        "dashboard",
    ],
)
@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_bad_stored_policy_503_counted_once(
    save_check_objects: dict[str, Any],
    client: Any,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    level: str,
    url: str,
    query: str,
) -> None:
    import logging

    from superset import db

    incr = mocker.patch(
        "superset.time_range_limits.telemetry.stats_logger_manager"
    ).instance.incr
    caplog.set_level(logging.DEBUG, logger=LOGGER)
    if level == "global":
        current_app.config["TIME_RANGE_LIMITS_GLOBAL"] = BAD["time_range_limits"]
    elif level == "dataset":
        save_check_objects["table"].extra = json.dumps(BAD)
    else:
        save_check_objects["dashboard"].json_metadata = json.dumps(BAD)
    db.session.commit()
    pk = save_check_objects["dashboard" if url == DASHBOARD_URL else "table"].id
    dataset_id = save_check_objects["table"].id

    response = client.get(url.format(pk) + query)

    assert response.status_code == 503
    assert response.json["errors"][0]["extra"] == {
        "reason_code": "POLICY_UNAVAILABLE",
        "source": level,
        "field": "max_span.quantity",
        "value": 0,
        **({"dataset_id": dataset_id} if level == "dataset" else {}),
        "issue_codes": [
            {
                "code": 1042,
                "message": "Issue 1042 - The time range is outside the allowed "
                "limits, or the limits can't be verified.",
            }
        ],
    }
    scope = "dashboard_id" if url == DASHBOARD_URL else "dataset_id"
    [record] = [record for record in caplog.records if record.name == LOGGER]
    assert f" {scope}={pk} " in record.getMessage()
    assert incr.call_args_list == [
        mocker.call(f"time_range_limit.unavailable.policy_api.{level}")
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dataset_check_hides_charts_user_cannot_see(
    save_check_objects: dict[str, Any], client: Any, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.models.slice import Slice

    visible, _week, hidden = save_check_objects["charts"]
    db.session.query(Slice).filter_by(id=hidden.id).update({"perm": "[db].[gone]"})
    db.session.commit()
    mocker.patch.object(
        security_manager, "can_access_all_datasources", return_value=False
    )
    mocker.patch.object(security_manager, "get_accessible_databases", return_value=[])
    mocker.patch.object(
        security_manager,
        "user_view_menu_names",
        side_effect=lambda name: {visible.perm}
        if name == "datasource_access"
        else set(),
    )
    mocker.patch(
        "superset.datasets.api.DatasetDAO.find_by_id",
        return_value=save_check_objects["table"],
    )

    response = client.get(
        DATASET_URL.format(save_check_objects["table"].id) + rison(P(span=90))
    )

    assert response.status_code == 200
    assert names(response.json["result"], "charts") == ["Calls by queue"]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_unbuildable_chart_listed_by_endpoint(
    save_check_objects: dict[str, Any], client: Any
) -> None:
    from superset import db

    broken = save_check_objects["charts"][0]
    broken.query_context = "{not json"
    db.session.commit()

    response = client.get(
        DASHBOARD_URL.format(save_check_objects["dashboard"].id) + rison(PROPOSED)
    )

    assert response.status_code == 200
    assert response.json["result"]["unchecked"] == [
        {
            "id": broken.id,
            "slice_name": "Calls by queue",
            "url": f"/explore/?slice_id={broken.id}",
        }
    ]


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dataset_check_stops_at_the_cap(
    save_check_objects: dict[str, Any], client: Any, mocker: MockerFixture
) -> None:
    from superset import db
    from superset.time_range_limits import save_check as time_range_save_check

    table = save_check_objects["table"]
    db.session.add_all(
        modern(None, f"Extra {index:02}", table.id, [tr("Last year")])
        for index in range(48)
    )
    db.session.commit()
    built_ranges = mocker.spy(time_range_save_check, "chart_date_ranges")
    mocker.patch("superset.datasets.api.DatasetDAO.find_by_id", return_value=table)

    response = client.get(DATASET_URL.format(table.id) + rison(P(span=7)))

    assert response.status_code == 200
    result = response.json["result"]
    assert len(result["charts"]) == 50
    assert result["truncated"] is True
    assert built_ranges.call_count == 50


@freeze_time(NOW)
@with_feature_flags(**FLAG_ON)
def test_dataset_check_cap_is_its_own_constant(
    save_check_objects: dict[str, Any], client: Any, mocker: MockerFixture
) -> None:
    from superset.time_range_limits import save_check as time_range_save_check

    table = save_check_objects["table"]
    mocker.patch.object(time_range_save_check, "DATASET_SAVE_CHECK_MAX_CHARTS", 1)
    mocker.patch("superset.datasets.api.DatasetDAO.find_by_id", return_value=table)

    response = client.get(DATASET_URL.format(table.id) + rison(P(span=7)))

    assert response.status_code == 200
    assert len(response.json["result"]["charts"]) <= 1
    assert response.json["result"]["truncated"] is True
