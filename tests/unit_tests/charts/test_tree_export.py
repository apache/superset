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
# pylint: disable=redefined-outer-name, unused-argument
import copy
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask import current_app
from pandas import DataFrame
from pytest_mock import MockerFixture

from superset.charts.data import tree_export
from superset.charts.data.tree_export import apply_tree_export
from superset.common.chart_data import ChartDataResultFormat
from superset.exceptions import QueryObjectValidationError
from superset.models.helpers import ExploreMixin
from superset.utils.pandas_postprocessing import tree_rows

RANGE = "2026-11-08 : 2026-11-09"

LEVELS = [
    {
        "id_column": "session_id",
        "columns": ["session_id", "channel", "session_started_at"],
    },
    {
        "id_column": "step_id",
        "columns": ["step_id", "step", "step_started_at"],
        "time_column": "step_started_at",
    },
]

CHILD_FILTERS = [{"col": "step_started_at", "op": "TEMPORAL_RANGE", "val": RANGE}]


@pytest.mark.parametrize("query_mode", ["aggregate", "raw"])
def test_table_v2_non_tree_export_is_unchanged(query_mode: str) -> None:
    """retained Tree export metadata cannot replace a Table V2 query."""
    form = make_form(viz_type="ag-grid-table")
    form["form_data"]["query_mode"] = query_mode
    original = copy.deepcopy(form)
    assert apply_tree_export(form) is form
    assert form == original


def export_query(
    time_range: str | None = None, extras: dict[str, Any] | None = None
) -> dict[str, Any]:
    return {
        "columns": [
            "session_id",
            "channel",
            "session_started_at",
            "step_id",
            "step",
            "step_started_at",
        ],
        "orderby": [["session_id", True], ["step_id", True]],
        "filters": [
            {"col": "session_started_at", "op": "TEMPORAL_RANGE", "val": RANGE},
            {"col": "channel", "op": "IN", "val": ["Voice"]},
        ],
        "extras": extras or {"having": "", "where": ""},
        "time_range": time_range,
        "row_limit": 0,
        "row_offset": 0,
        "post_processing": [
            {
                "operation": "tree_rows",
                "options": {"levels": copy.deepcopy(LEVELS), "time_ranges": [RANGE]},
            }
        ],
    }


def make_form(
    result_format: str = "csv",
    viz_type: str = "ag-grid-table",
    row_limit: int = 100,
    query: dict[str, Any] | None = None,
    with_export: bool = True,
) -> dict[str, Any]:
    form_data: dict[str, Any] = {
        "viz_type": viz_type,
        "query_mode": "tree",
        "row_limit": row_limit,
    }
    if with_export:
        form_data["tree_export"] = {
            "query": query or export_query(),
            "child_filters": copy.deepcopy(CHILD_FILTERS),
        }
    return {
        "datasource": {"id": 1, "type": "table"},
        "form_data": form_data,
        "queries": [{"columns": ["session_id"]}, {"is_rowcount": True}],
        "result_format": result_format,
        "result_type": "full",
    }


def step_options(form: dict[str, Any]) -> dict[str, Any]:
    (step,) = [
        step
        for step in form["queries"][0]["post_processing"]
        if step["operation"] == "tree_rows"
    ]
    return step["options"]


@pytest.mark.parametrize("result_format", ["csv", "xlsx"])
def test_tree_exports_ignore_frontend_feature_flags(
    app_context: None, mocker: MockerFixture, result_format: str
) -> None:
    """Saved Tree charts export even when both frontend flags are disabled."""
    mocker.patch.dict(
        current_app.config,
        {
            "FEATURE_FLAGS": {
                "AG_GRID_TABLE_ENABLED": False,
                "TABLE_V2_TREE_MODE_ENABLED": False,
            }
        },
    )
    form = make_form(result_format)
    result = apply_tree_export(form)
    assert result is not form
    assert result["queries"][0]["columns"] == export_query()["columns"]


@pytest.fixture
def config(app_context: None, mocker: MockerFixture) -> None:
    mocker.patch.dict(
        current_app.config,
        {"SQL_MAX_ROW": 12345, "CSV_STREAMING_ROW_THRESHOLD": 1000},
    )


@pytest.mark.parametrize("result_format", ["csv", "xlsx"])
def test_swaps_the_queries_for_the_export_query(
    config: None, result_format: str
) -> None:
    form = make_form(result_format)
    original = copy.deepcopy(form)
    result = apply_tree_export(form)
    assert form == original
    assert result is not form
    query, parents = result["queries"]
    assert query["columns"] == export_query()["columns"]
    assert query["row_limit"] == 12345
    assert query["row_offset"] == 0
    date_filter, channel_filter = export_query()["filters"]
    assert query["filters"] == [date_filter]
    assert parents["filters"] == [date_filter, channel_filter]
    assert parents["columns"] == LEVELS[0]["columns"]
    assert parents["orderby"] == [["session_id", True]]
    assert parents["row_limit"] == 100
    assert parents["row_offset"] == 0
    assert parents["post_processing"] == []
    assert result["form_data"] == form["form_data"]
    assert result["result_format"] == result_format


@pytest.mark.parametrize(
    ("result_format", "row_limit"), [("xlsx", 100), ("csv", 100), ("csv", 1000)]
)
@pytest.mark.parametrize("saved_range", ["No filter", RANGE])
def test_dashboard_defaults_filter_tree_export_rows(
    config: None, result_format: str, row_limit: int, saved_range: str
) -> None:
    query = export_query()
    query["filters"][0]["val"] = saved_range
    query["post_processing"][0]["options"]["time_ranges"] = [saved_range]
    form = make_form(result_format, row_limit=row_limit, query=query)
    if saved_range == "No filter":
        query["filters"].pop(0)
        query["post_processing"][0]["options"]["levels"][1].pop("time_column")
        form["form_data"]["tree_export"]["child_filters"] = []
    form["form_data"]["levels"] = [
        {"time_column": "session_started_at"},
        {"time_column": "step_started_at", "apply_date_filter": True},
    ]
    dashboard_range = "2026-11-10 : 2026-11-11"
    result = apply_tree_export(
        form,
        dashboard_extra_form_data={
            "filters": [{"col": "step", "op": "IN", "val": ["start"]}],
            "time_range": dashboard_range,
        },
    )
    export, parents = result["queries"]
    effective_range = dashboard_range
    step_filter = {"col": "step", "op": "IN", "val": ["start"], "isExtra": True}
    assert step_filter in parents["filters"]
    assert step_filter not in export["filters"]
    assert parents["time_range"] == export["time_range"] == effective_range
    for query in (parents, export):
        assert [
            flt["val"]
            for flt in query["filters"]
            if flt["col"] == "session_started_at" and flt["op"] == "TEMPORAL_RANGE"
        ] == [effective_range]
    assert all(flt["col"] != "step_started_at" for flt in parents["filters"])
    if result_format == "csv" and row_limit == 1000:
        assert {
            "col": "step_started_at",
            "op": "TEMPORAL_RANGE",
            "val": effective_range,
        } in export["filters"]
    else:
        since, until = effective_range.split(" : ")
        assert step_options(result)["bounds"] == [
            [f"{since}T00:00:00", f"{until}T00:00:00"]
        ]


def test_sql_where_selects_only_parents(config: None) -> None:
    """The child query keeps temporal filters and drops SQL constraints."""
    query = export_query(extras={"where": "step = 'start'", "having": "COUNT(*) > 0"})
    query["filters"] = query["filters"][:1]
    rows, parents = apply_tree_export(make_form(query=query, row_limit=20000))[
        "queries"
    ]
    assert rows["extras"] == {"where": "", "having": ""}
    assert parents["extras"] == query["extras"]
    assert parents["row_limit"] == 12345


@pytest.mark.parametrize("one_level", [False, True])
def test_unconstrained_or_single_level_export_still_uses_one_query(
    config: None, one_level: bool
) -> None:
    """Only linked exports with non-date filters need parent selection."""
    query = export_query()
    if one_level:
        query["post_processing"][0]["options"]["levels"] = LEVELS[:1]
    else:
        query["filters"] = query["filters"][:1]
    (rows,) = apply_tree_export(make_form(query=query))["queries"]
    assert rows["filters"] == query["filters"]


@pytest.mark.parametrize(
    ("ids", "expected"),
    [
        (
            ["b", None, "a", "b"],
            [{"col": "session_id", "op": "IN", "val": ["b", None, "a"]}],
        ),
        (
            [],
            [
                {"col": "session_id", "op": "IS NULL"},
                {"col": "session_id", "op": "IS NOT NULL"},
            ],
        ),
    ],
)
def test_resolves_export_parent_ids(
    ids: list[str | None], expected: list[dict[str, Any]]
) -> None:
    """Preserve raw IDs and constrain an empty export to zero rows."""
    context = MagicMock()
    context.form_data = make_form()["form_data"]
    context.result_format = ChartDataResultFormat.CSV
    context.datasource = MagicMock(spec=ExploreMixin)
    rows, parents = MagicMock(filter=[]), MagicMock(columns=LEVELS[0]["columns"])
    context.queries = [rows, parents]
    cached_rows = {"columns": ["session_id", "step_id"]}
    context.cache_values = {"queries": [cached_rows, {"columns": ["session_id"]}]}
    context.datasource.query.return_value = MagicMock(
        status="success", df=DataFrame({"session_id": ids}) if ids else DataFrame()
    )
    tree_export.resolve_tree_export_parents(context)
    context.datasource.query.assert_called_once_with(parents.to_dict.return_value)
    assert context.queries == [rows]
    assert context.cache_values["queries"] == [cached_rows]
    assert rows.filter == expected


def test_failed_parent_query_raises_validation_error() -> None:
    """Propagate the parent query error through chart-data validation."""
    context = MagicMock()
    context.form_data = make_form()["form_data"]
    context.result_format = ChartDataResultFormat.XLSX
    context.datasource = MagicMock(spec=ExploreMixin)
    context.queries = [MagicMock(), MagicMock(columns=LEVELS[0]["columns"])]
    context.datasource.query.return_value = MagicMock(
        status="failed", error_message="Parent query failed"
    )
    with pytest.raises(QueryObjectValidationError, match="Parent query failed"):
        tree_export.resolve_tree_export_parents(context)


@pytest.mark.parametrize("is_tree", [False, True])
def test_resolver_ignores_unprepared_context(is_tree: bool) -> None:
    """Do not resolve an ordinary chart or a single-query Tree export."""
    context = MagicMock()
    context.form_data = make_form(with_export=is_tree)["form_data"]
    context.result_format = ChartDataResultFormat.CSV
    context.queries = [MagicMock()] if is_tree else [MagicMock(), MagicMock()]
    original = context.queries
    tree_export.resolve_tree_export_parents(context)
    assert context.queries is original
    context.datasource.query.assert_not_called()


@pytest.mark.parametrize(("result_format", "row_limit"), [("xlsx", 100), ("csv", 1000)])
def test_no_dashboard_time_filter_keeps_the_saved_export_range(
    config: None, result_format: str, row_limit: int
) -> None:
    form = make_form(result_format, row_limit=row_limit, query=export_query(RANGE))
    form["form_data"]["levels"] = [
        {"time_column": "session_started_at"},
        {"time_column": "step_started_at", "apply_date_filter": True},
    ]
    expected = apply_tree_export(form)
    dashboard_defaults = {"time_range": "No filter"}
    result = apply_tree_export(form, dashboard_extra_form_data=dashboard_defaults)
    assert dashboard_defaults["time_range"] == "No filter"
    for key in ("time_range", "filters", "post_processing"):
        assert result["queries"][0][key] == expected["queries"][0][key]


@pytest.mark.parametrize(
    "form",
    [
        make_form("json"),
        make_form(viz_type="table"),
        make_form(viz_type="tree_table"),
        make_form("xlsx", viz_type="table"),
        make_form("xlsx", viz_type="tree_table"),
        make_form(with_export=False),
        make_form("xlsx", with_export=False),
    ],
)
def test_returns_other_forms_and_old_tree_table_identity_unchanged(
    config: None, form: dict[str, Any]
) -> None:
    original = copy.deepcopy(form)
    reader = MagicMock(return_value=5000)
    assert apply_tree_export(form, reader) is form
    assert form == original
    reader.assert_not_called()


def test_a_query_that_is_not_a_dict_is_ignored(config: None) -> None:
    form = make_form()
    form["form_data"]["tree_export"]["query"] = "SELECT 1"
    assert apply_tree_export(form) is form


def test_streaming_by_row_limit_moves_child_filters_into_sql(config: None) -> None:
    form = make_form(row_limit=1000)
    reader = MagicMock(return_value=None)
    query, parents = apply_tree_export(form, reader)["queries"]
    date_filter, channel_filter = export_query()["filters"]
    assert query["filters"] == [date_filter, *CHILD_FILTERS]
    assert parents["filters"] == [date_filter, channel_filter]
    assert query["post_processing"] == []
    assert query["row_limit"] == 12345


def test_streaming_adds_each_child_filter_once(config: None) -> None:
    query = export_query()
    query["filters"].append(copy.deepcopy(CHILD_FILTERS[0]))
    form = make_form(row_limit=5000, query=query)
    form["form_data"]["tree_export"]["child_filters"] *= 2
    result = apply_tree_export(form)["queries"][0]
    assert result["filters"].count(CHILD_FILTERS[0]) == 1


def test_streaming_by_expected_rows(config: None) -> None:
    reader = MagicMock(return_value=1000)
    query = apply_tree_export(make_form(), reader)["queries"][0]
    reader.assert_called_once_with()
    assert CHILD_FILTERS[0] in query["filters"]
    assert query["post_processing"] == []


@pytest.mark.parametrize("expected_rows", [None, 999])
def test_expected_rows_below_the_threshold_keeps_the_step(
    config: None, expected_rows: int | None
) -> None:
    reader = MagicMock(return_value=expected_rows)
    query = apply_tree_export(make_form(), reader)["queries"][0]
    reader.assert_called_once_with()
    assert CHILD_FILTERS[0] not in query["filters"]
    assert step_options({"queries": [query]})["bounds"] == [
        ["2026-11-08T00:00:00", "2026-11-09T00:00:00"]
    ]


def test_xlsx_never_streams(config: None) -> None:
    reader = MagicMock(return_value=5000)
    form = apply_tree_export(make_form("xlsx", row_limit=5000), reader)
    reader.assert_not_called()
    assert CHILD_FILTERS[0] not in form["queries"][0]["filters"]
    assert "bounds" in step_options(form)


def test_bounds_from_the_filter_values(config: None) -> None:
    options = step_options(apply_tree_export(make_form()))
    assert options == {
        "levels": LEVELS,
        "bounds": [["2026-11-08T00:00:00", "2026-11-09T00:00:00"]],
    }


def test_bounds_from_legacy_time_range_when_no_filter_range_exists(
    config: None,
) -> None:
    query = export_query(time_range="2026-11-10 : 2026-11-11")
    query["post_processing"][0]["options"]["time_ranges"] = []
    options = step_options(apply_tree_export(make_form(query=query)))
    assert options["bounds"] == [["2026-11-10T00:00:00", "2026-11-11T00:00:00"]]
    assert options["levels"][1]["time_column"] == "step_started_at"


def test_filter_ranges_win_over_a_legacy_time_range(config: None) -> None:
    form = make_form(query=export_query(time_range="2026-11-10 : 2026-11-11"))
    options = step_options(apply_tree_export(form))
    assert options["bounds"] == [["2026-11-08T00:00:00", "2026-11-09T00:00:00"]]


@pytest.mark.parametrize("time_range", ["No filter", None])
def test_no_range_anywhere_gives_no_bounds_and_no_time_column(
    config: None, time_range: str | None
) -> None:
    query = export_query(time_range=time_range)
    query["post_processing"][0]["options"]["time_ranges"] = ["No filter"]
    options = step_options(apply_tree_export(make_form(query=query)))
    assert "bounds" not in options
    assert "time_ranges" not in options
    assert all("time_column" not in level for level in options["levels"])


def steps_frame() -> DataFrame:
    return DataFrame(
        [
            ("s1", "Voice", "2026-11-08 00:00:00", "a", "Greet", "2026-11-07 23:00"),
            ("s1", "Voice", "2026-11-08 00:00:00", "b", "Menu", "2026-11-08 06:00"),
            ("s1", "Voice", "2026-11-08 00:00:00", "c", "Agent", "2026-11-08 18:00"),
            ("s1", "Voice", "2026-11-08 00:00:00", "d", "Bye", "2026-11-09 01:00"),
        ],
        columns=export_query()["columns"],
    )


def exported_steps(form: dict[str, Any]) -> list[str]:
    options = step_options(apply_tree_export(form))
    result = tree_rows(steps_frame(), **options)
    return result["step_id"].tolist()


def test_legacy_no_filter_beside_an_adhoc_range_keeps_children_in_range(
    config: None,
) -> None:
    form = make_form(query=export_query(time_range="No filter"))
    assert exported_steps(form) == ["b", "c"]


def test_two_ranges_keep_only_children_inside_both(config: None) -> None:
    second = "2026-11-08T12:00:00 : 2026-11-10"
    query = export_query(time_range="No filter")
    query["filters"].append(
        {"col": "session_started_at", "op": "TEMPORAL_RANGE", "val": second}
    )
    query["post_processing"][0]["options"]["time_ranges"] = [RANGE, second]
    assert exported_steps(make_form(query=query)) == ["c"]


@pytest.mark.parametrize("result_format", ["csv", "xlsx"])
def test_an_explicit_no_filter_range_beats_a_stale_legacy_range(
    config: None, result_format: str
) -> None:
    query = export_query(time_range=RANGE)
    query["filters"][0]["val"] = "No filter"
    query["post_processing"][0]["options"]["time_ranges"] = ["No filter"]
    form = make_form(result_format, query=query)
    options = step_options(apply_tree_export(form))
    assert "bounds" not in options
    assert all("time_column" not in level for level in options["levels"])
    assert exported_steps(form) == ["a", "b", "c", "d"]


def test_relative_start_and_end_in_extras_are_used(config: None) -> None:
    query = export_query(
        time_range="Last day",
        extras={"relative_start": "2020-01-10", "relative_end": "2020-01-10"},
    )
    query["post_processing"][0]["options"]["time_ranges"] = ["Last day"]
    options = step_options(apply_tree_export(make_form(query=query)))
    assert options["bounds"] == [["2020-01-09T00:00:00", "2020-01-10T00:00:00"]]
