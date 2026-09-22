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

import glob
import os
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager, ExitStack
from typing import Any
from unittest import mock

import pytest
from celery.exceptions import SoftTimeLimitExceeded

from superset.utils import json

MODULE = "superset.tasks.export_dashboard_excel"


# A minimal valid 1x1 transparent PNG for image-mode tests.
_PNG_1x1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01\x00\x00\x05\x00"
    b"\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _chart(
    chart_id: int,
    name: str,
    has_context: bool = True,
    viz_type: str = "line",
) -> mock.MagicMock:
    chart = mock.MagicMock()
    chart.id = chart_id
    chart.slice_name = name
    chart.viz_type = viz_type
    chart.query_context = json.dumps({"queries": [{}]}) if has_context else None
    return chart


def _media(path: str) -> list[str]:
    """Embedded media entries of an xlsx (which is a zip archive)."""
    import zipfile

    with zipfile.ZipFile(path) as archive:
        return [n for n in archive.namelist() if n.startswith("xl/media/")]


@pytest.fixture
def mocks() -> Iterator[dict[str, Any]]:
    """Patch every external dependency of the task; keep the real xlsx writer."""
    with ExitStack() as stack:
        # Use explicit MagicMock instances: patch() auto-creates async-flavored
        # mocks for these targets (their real objects expose async members), which
        # would make calls like security_manager.get_user_by_id() return coroutines.
        patched = {
            name: stack.enter_context(
                mock.patch(f"{MODULE}.{name}", new=mock.MagicMock())
            )
            for name in (
                "security_manager",
                "db",
                "get_charts_in_layout_order",
                "get_dashboard_filter_context",
                "ChartDataQueryContextSchema",
                "ChartDataCommand",
                "render_chart_image",
                "s3",
                "email",
                "ReleaseDistributedLock",
            )
        }
        user = mock.MagicMock()
        user.email = "user@example.com"
        patched["security_manager"].get_user_by_id.return_value = user

        dashboard = mock.MagicMock()
        dashboard.id = 1
        dashboard.dashboard_title = "Sales"
        patched[
            "db"
        ].session.query.return_value.filter_by.return_value.one_or_none.return_value = (  # noqa: E501
            dashboard
        )

        patched["get_dashboard_filter_context"].return_value.extra_form_data = {}
        patched["s3"].generate_presigned_url.return_value = "https://signed/file.xlsx"

        patched["user"] = user
        patched["dashboard"] = dashboard
        yield patched


def _run(
    job_id: str = "job-1",
    mode: str = "data",
) -> None:
    from superset.tasks.export_dashboard_excel import export_dashboard_excel

    export_dashboard_excel(
        dashboard_id=1,
        user_id=2,
        active_data_mask={},
        job_id=job_id,
        mode=mode,
    )


def _no_temp_files_left(job_id: str) -> bool:
    pattern = os.path.join(tempfile.gettempdir(), f"dash-export-{job_id}-*")
    return glob.glob(pattern) == []


def _read_sheets(path: str) -> dict[str, list[list[object]]]:
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.load_workbook(path, read_only=True)
    sheets = {
        ws.title: [list(r) for r in ws.iter_rows(values_only=True)]
        for ws in workbook.worksheets
    }
    workbook.close()
    return sheets


def test_happy_path_uploads_and_emails(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "First"),
        _chart(20, "Second"),
    ]
    mocks["ChartDataCommand"].return_value.run.side_effect = [
        {"queries": [{"colnames": ["a", "b"], "data": [{"a": 1, "b": 2}]}]},
        {"queries": [{"colnames": ["c"], "data": [{"c": "x"}]}]},
    ]

    # Capture the workbook before the task deletes it.
    uploaded: dict[str, Any] = {}

    def _capture(path: str, bucket: str, key: str) -> None:
        uploaded["sheets"] = _read_sheets(path)

    mocks["s3"].upload_file_to_s3.side_effect = _capture

    _run()

    mocks["s3"].upload_file_to_s3.assert_called_once()
    assert list(uploaded["sheets"].keys()) == ["10 - First", "20 - Second"]
    mocks["email"].send_export_email.assert_called_once()
    mocks["email"].build_success_email.assert_called_once()
    assert _no_temp_files_left("job-1")


def test_chart_without_query_context_is_skipped(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "Good"),
        _chart(20, "NoContext", has_context=False),
    ]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {
        mocks["email"].ERROR_NO_QUERY_CONTEXT: ["20 - NoContext"]
    }


@pytest.mark.parametrize(
    "raw_context",
    [
        "",  # blank
        "null",  # parses to None
        "{}",  # object with no queries
        '{"queries": []}',  # object with an empty queries list
        '{"queries": "oops"}',  # queries present but not a list
        '{"queries": {"a": 1}}',  # queries present but not a list
        "not valid json",  # unparseable
    ],
)
def test_chart_with_empty_query_context_is_skipped(
    mocks: dict[str, Any], raw_context: str
) -> None:
    # A present-but-empty/unusable query context is treated the same as a
    # missing one: the chart is listed under "no query context" and the export
    # continues, rather than raising mid-export and landing in the general bucket.
    good = _chart(10, "Good")
    empty = _chart(20, "Empty")
    empty.query_context = raw_context
    mocks["get_charts_in_layout_order"].return_value = [good, empty]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {mocks["email"].ERROR_NO_QUERY_CONTEXT: ["20 - Empty"]}
    # The empty chart is skipped before any query runs; only the good one runs.
    mocks["ChartDataCommand"].return_value.run.assert_called_once()


def test_empty_query_context_rebuilt_from_form_data_for_eligible_viz(
    mocks: dict[str, Any],
) -> None:
    # An eligible viz type (table) with no saved query context is rebuilt from
    # its form data and exported instead of being skipped.
    good = _chart(10, "Good")
    rebuilt = _chart(20, "Rebuilt", viz_type="table")
    rebuilt.query_context = None
    rebuilt.params = json.dumps({"groupby": ["country"], "metrics": ["count"]})
    rebuilt.datasource_id = 5
    rebuilt.datasource_type = "table"
    mocks["get_charts_in_layout_order"].return_value = [good, rebuilt]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {}
    # Both charts ran a query (the saved one and the rebuilt one).
    assert mocks["ChartDataCommand"].return_value.run.call_count == 2


def test_empty_query_context_ineligible_viz_is_skipped(
    mocks: dict[str, Any],
) -> None:
    # A viz type outside the rebuild allowlist (mixed_timeseries — a multi-query
    # chart the generic rebuild can't reproduce) is skipped, not exported wrong.
    good = _chart(10, "Good")
    ineligible = _chart(20, "Ineligible", viz_type="mixed_timeseries")
    ineligible.query_context = None
    ineligible.params = json.dumps({"groupby": ["x"], "metrics": ["count"]})
    ineligible.datasource_id = 5
    mocks["get_charts_in_layout_order"].return_value = [good, ineligible]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {
        mocks["email"].ERROR_NO_QUERY_CONTEXT: ["20 - Ineligible"]
    }
    mocks["ChartDataCommand"].return_value.run.assert_called_once()


def _rebuildable_chart(
    viz_type: str = "table",
    form_data: dict[str, Any] | None = None,
) -> mock.MagicMock:
    """A chart with no saved query context whose form data can be rebuilt."""
    fd = form_data or {"groupby": ["country"], "metrics": ["count"]}
    chart = _chart(20, "Rebuilt", has_context=False, viz_type=viz_type)
    chart.params = json.dumps(fd)
    chart.datasource_id = 5
    chart.datasource_type = "table"
    # Mirror Slice.form_data, which injects viz_type + the "id__type" datasource.
    chart.form_data = {
        **fd,
        "slice_id": 20,
        "viz_type": viz_type,
        "datasource": "5__table",
    }
    return chart


@contextmanager
def _builder_hook(builder: Any) -> Iterator[None]:
    """Patch current_app so EXCEL_EXPORT_QUERY_CONTEXT_BUILDER resolves to builder."""
    from superset.tasks import export_dashboard_excel as module

    fake_app = mock.MagicMock()
    fake_app.config.get.side_effect = lambda key, default=None: (
        builder if key == "EXCEL_EXPORT_QUERY_CONTEXT_BUILDER" else default
    )
    # Real values for the keys the task subscripts directly, so a full export can
    # run under the hook (a MagicMock ttl would blow up building the link expiry).
    fake_app.config.__getitem__.side_effect = {
        "EXCEL_EXPORT_S3_BUCKET": "bucket",
        "EXCEL_EXPORT_S3_KEY_PREFIX": "dashboard-exports/",
        "EXCEL_EXPORT_LINK_TTL_SECONDS": 3600,
    }.__getitem__
    with mock.patch.object(module, "current_app", fake_app):
        yield


def test_builder_hook_context_is_used_for_any_viz_type() -> None:
    # A configured builder can supply a context for a viz type outside the
    # built-in allowlist (pivot_table_v2), and is called with the chart's form data.
    from superset.tasks import export_dashboard_excel as module

    ctx = {
        "datasource": {"id": 5, "type": "table"},
        "queries": [{"metrics": ["count"]}],
    }
    builder = mock.MagicMock(return_value=ctx)
    chart = _rebuildable_chart(viz_type="pivot_table_v2")

    with _builder_hook(builder):
        result = module._resolve_query_context(chart)

    assert result == ctx
    builder.assert_called_once_with(chart.form_data)


def test_builder_hook_none_falls_through_to_builtin_rebuild() -> None:
    # When the builder returns None (can't build faithfully) the export falls
    # through to the built-in rebuild, so an allowlisted table is unaffected.
    from superset.tasks import export_dashboard_excel as module

    builder = mock.MagicMock(return_value=None)
    chart = _rebuildable_chart(viz_type="table")

    with _builder_hook(builder):
        result = module._resolve_query_context(chart)

    builder.assert_called_once_with(chart.form_data)
    assert result is not None
    assert result["queries"][0]["metrics"] == ["count"]


@pytest.mark.parametrize(
    "built",
    [
        {},
        {"queries": []},
        "not-a-dict",
        42,
        # ``queries`` present but not a list: truthy, yet unusable downstream.
        {"queries": "oops"},
        {"queries": {"a": 1}},
    ],
)
def test_builder_hook_malformed_result_falls_through(built: Any) -> None:
    # A stub / empty / malformed builder result is treated as "not built" and
    # falls through to the built-in rebuild rather than shipping an empty context.
    from superset.tasks import export_dashboard_excel as module

    builder = mock.MagicMock(return_value=built)
    chart = _rebuildable_chart(viz_type="table")

    with _builder_hook(builder):
        result = module._resolve_query_context(chart)

    builder.assert_called_once_with(chart.form_data)
    assert result is not None
    assert result["queries"][0]["metrics"] == ["count"]


def test_builder_hook_exception_falls_through() -> None:
    # A raising builder (e.g. sidecar down) must not fail the chart; the export
    # falls through to the built-in rebuild and no exception escapes.
    from superset.tasks import export_dashboard_excel as module

    builder = mock.MagicMock(side_effect=RuntimeError("sidecar down"))
    chart = _rebuildable_chart(viz_type="table")

    with _builder_hook(builder):
        result = module._resolve_query_context(chart)

    builder.assert_called_once_with(chart.form_data)
    assert result is not None
    assert result["queries"][0]["metrics"] == ["count"]


def test_builder_hook_soft_time_limit_propagates() -> None:
    # A soft timeout raised while the builder is in flight is a task-level signal,
    # not a builder failure: it must escape _resolve_query_context so the export
    # aborts cleanly, rather than being swallowed by the broad fall-through guard.
    from superset.tasks import export_dashboard_excel as module

    builder = mock.MagicMock(side_effect=SoftTimeLimitExceeded())
    chart = _rebuildable_chart(viz_type="table")

    with _builder_hook(builder), pytest.raises(SoftTimeLimitExceeded):
        module._resolve_query_context(chart)

    builder.assert_called_once_with(chart.form_data)


def test_no_builder_hook_leaves_builtin_behavior_unchanged() -> None:
    # With no builder configured, an allowlisted chart is rebuilt and an
    # ineligible one is skipped — identical to the pre-hook behavior.
    from superset.tasks import export_dashboard_excel as module

    with _builder_hook(None):
        table = module._resolve_query_context(_rebuildable_chart(viz_type="table"))
        ineligible = module._resolve_query_context(
            _rebuildable_chart(viz_type="mixed_timeseries")
        )

    assert table is not None
    assert table["queries"][0]["metrics"] == ["count"]
    assert ineligible is None


def test_saved_context_short_circuits_builder_hook() -> None:
    # A saved query context wins over the builder hook, which is never called.
    from superset.tasks import export_dashboard_excel as module

    builder = mock.MagicMock(return_value={"queries": [{"from": "hook"}]})
    chart = _rebuildable_chart(viz_type="table")
    chart.query_context = json.dumps({"queries": [{"from": "saved"}]})

    with _builder_hook(builder):
        result = module._resolve_query_context(chart)

    assert result == {"queries": [{"from": "saved"}]}
    builder.assert_not_called()


def test_builder_hook_result_is_not_mutated_across_charts(
    mocks: dict[str, Any],
) -> None:
    # Dashboard filters are applied by mutating queries[*] in place. A builder
    # that memoizes or caches its return value would otherwise accumulate isExtra
    # filters chart after chart (and export after export), progressively
    # over-filtering, so the hook's payload must be copied before use.
    shared_context: dict[str, Any] = {
        "datasource": {"id": 5, "type": "table"},
        "queries": [{"metrics": ["count"], "filters": []}],
    }
    builder = mock.MagicMock(return_value=shared_context)

    first = _rebuildable_chart(viz_type="pivot_table_v2")
    first.id = 10
    second = _rebuildable_chart(viz_type="pivot_table_v2")
    second.id = 20
    mocks["get_charts_in_layout_order"].return_value = [first, second]

    def _fresh_filter_context(**kwargs: Any) -> mock.MagicMock:
        # Resolved per chart in production, and consumed destructively by
        # apply_dashboard_filter_context, so it must not be shared here.
        context = mock.MagicMock()
        context.extra_form_data = {
            "filters": [{"col": "country", "op": "IN", "val": ["US"]}]
        }
        return context

    mocks["get_dashboard_filter_context"].side_effect = _fresh_filter_context
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    with _builder_hook(builder):
        _run()

    loads = mocks["ChartDataQueryContextSchema"].return_value.load.call_args_list
    assert len(loads) == 2
    for call in loads:
        assert call.args[0]["queries"][0]["filters"] == [
            {"col": "country", "op": "IN", "val": ["US"], "isExtra": True}
        ]
    # The builder's own object is untouched, so a cached return stays reusable.
    assert shared_context["queries"][0]["filters"] == []


@pytest.mark.parametrize(
    ("params", "datasource_id"),
    [
        ("not valid json", 5),  # params don't parse → cannot rebuild
        ("null", 5),  # params parse to a non-object → cannot rebuild
        ('{"groupby": ["x"]}', None),  # no datasource to point the query at
    ],
)
def test_eligible_viz_skipped_when_form_data_unusable(
    mocks: dict[str, Any], params: str, datasource_id: int | None
) -> None:
    # Even for an allowlisted viz type, a rebuild is only attempted when the form
    # data is a usable object and a datasource is known; otherwise the chart is
    # skipped rather than raising.
    good = _chart(10, "Good")
    bad = _chart(20, "Bad", viz_type="table")
    bad.query_context = None
    bad.params = params
    bad.datasource_id = datasource_id
    bad.datasource_type = "table"
    mocks["get_charts_in_layout_order"].return_value = [good, bad]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {mocks["email"].ERROR_NO_QUERY_CONTEXT: ["20 - Bad"]}
    # Only the good chart ran a query; the unusable one never reached execution.
    mocks["ChartDataCommand"].return_value.run.assert_called_once()


@pytest.mark.parametrize(
    "form_data",
    [
        {"groupby": ["c"], "metrics": ["m"], "time_compare": ["1 year ago"]},
        {"groupby": ["c"], "metrics": ["m"], "rolling_type": "mean"},
        {"groupby": ["c"], "metrics": ["m"], "resample_rule": "1D"},
        {"groupby": ["c"], "metrics": ["m"], "percent_metrics": ["pct"]},
        {"groupby": ["c"], "metrics": ["m"], "show_totals": True},
        {"columns": ["a", "b"], "aggregation": "raw"},
    ],
)
def test_eligible_viz_skipped_when_form_data_needs_post_processing(
    mocks: dict[str, Any], form_data: dict[str, Any]
) -> None:
    # An allowlisted viz type whose form data relies on post-processing or extra
    # queries the single-query rebuild can't reproduce (time comparison, rolling,
    # resample, raw aggregation, a totals row) is skipped rather than exported
    # with data that differs from the chart.
    good = _chart(10, "Good")
    fancy = _chart(20, "Fancy", viz_type="table")
    fancy.query_context = None
    fancy.params = json.dumps(form_data)
    fancy.datasource_id = 5
    fancy.datasource_type = "table"
    mocks["get_charts_in_layout_order"].return_value = [good, fancy]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {mocks["email"].ERROR_NO_QUERY_CONTEXT: ["20 - Fancy"]}
    mocks["ChartDataCommand"].return_value.run.assert_called_once()


def test_rebuilt_query_context_payload_carries_query_shape(
    mocks: dict[str, Any],
) -> None:
    # Assert the actual payload handed to ChartDataQueryContextSchema().load for a
    # rebuilt chart: columns, filters, ordering and granularity must survive so the
    # exported data matches the chart (not just that a query ran).
    chart = _chart(10, "Rebuilt", viz_type="table")
    chart.query_context = None
    chart.datasource_id = 5
    chart.datasource_type = "table"
    chart.params = json.dumps(
        {
            "groupby": ["country"],
            "metrics": ["count"],
            "granularity_sqla": "ds",
            "time_range": "Last quarter",
            "row_limit": 25,
            "adhoc_filters": [
                {
                    "expressionType": "SIMPLE",
                    "subject": "year",
                    "operator": ">",
                    "comparator": 2000,
                }
            ],
        }
    )
    mocks["get_charts_in_layout_order"].return_value = [chart]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    load_args = mocks["ChartDataQueryContextSchema"].return_value.load.call_args
    payload = load_args.args[0]
    query = payload["queries"][0]
    assert query["columns"] == ["country"]
    assert query["metrics"] == ["count"]
    assert query["filters"] == [{"col": "year", "op": ">", "val": 2000}]
    assert query["orderby"] == [["count", False]]
    assert query["granularity"] == "ds"
    assert query["time_range"] == "Last quarter"
    assert query["row_limit"] == 25


def test_raw_mode_table_ignores_stale_show_totals() -> None:
    # show_totals only produces a second query in aggregate mode (the frontend
    # gates the totals query on queryMode === Aggregate), and the control isn't
    # reset when hidden. A raw-mode table carrying a stale value must still
    # rebuild rather than be needlessly skipped.
    from superset.tasks import export_dashboard_excel as module

    chart = _rebuildable_chart(
        viz_type="table",
        form_data={"query_mode": "raw", "all_columns": ["a"], "show_totals": True},
    )

    with _builder_hook(None):
        result = module._resolve_query_context(chart)

    assert result is not None
    assert result["queries"][0]["columns"] == ["a"]


def test_rebuild_viz_types_is_the_conservative_default() -> None:
    # The rebuild allow-list is a fixed fallback (no config override): only viz
    # types whose data maps faithfully to a single plain query.
    from superset.tasks import export_dashboard_excel as module

    assert module.REBUILD_VIZ_TYPES == {
        "table",
        "big_number_total",
        "big_number",
        "pie",
    }


def test_chart_query_error_grouped_as_general_export_continues(
    mocks: dict[str, Any],
) -> None:
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "Boom"),
        _chart(20, "Ok"),
    ]
    mocks["ChartDataCommand"].return_value.run.side_effect = [
        RuntimeError("query failed"),
        {"queries": [{"colnames": ["a"], "data": [{"a": 1}]}]},
    ]

    _run()

    mocks["s3"].upload_file_to_s3.assert_called_once()
    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {mocks["email"].ERROR_GENERAL: ["10 - Boom"]}


def test_chart_timeout_aborts_export_and_sends_failure_email(
    mocks: dict[str, Any],
) -> None:
    # A soft timeout raised while a chart runs must abort the whole export
    # (propagate to the outer handler) rather than being recorded per-chart and
    # letting the task run on until the hard limit kills the worker — which would
    # skip cleanup, leak temp files, and never send a failure email.
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "Ok"),
        _chart(20, "Slow"),
    ]
    mocks["ChartDataCommand"].return_value.run.side_effect = [
        {"queries": [{"colnames": ["a"], "data": [{"a": 1}]}]},
        SoftTimeLimitExceeded(),
    ]

    with pytest.raises(SoftTimeLimitExceeded):
        _run("job-timeout")

    mocks["s3"].upload_file_to_s3.assert_not_called()
    mocks["email"].build_success_email.assert_not_called()
    mocks["email"].build_failure_email.assert_called_once()
    assert _no_temp_files_left("job-timeout")


def test_image_render_timeout_aborts_export(mocks: dict[str, Any]) -> None:
    # In image mode a soft timeout during a chart render must also propagate and
    # abort the export rather than being swallowed as a per-chart render failure.
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "Line", viz_type="line"),
    ]
    mocks["render_chart_image"].side_effect = SoftTimeLimitExceeded()

    with pytest.raises(SoftTimeLimitExceeded):
        _run("job-img-timeout", mode="images")

    mocks["email"].build_success_email.assert_not_called()
    mocks["email"].build_failure_email.assert_called_once()
    assert _no_temp_files_left("job-img-timeout")


def test_all_charts_skipped_writes_summary(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "NoContext", has_context=False),
    ]
    uploaded: dict[str, Any] = {}

    def _capture(path: str, bucket: str, key: str) -> None:
        uploaded["sheets"] = _read_sheets(path)

    mocks["s3"].upload_file_to_s3.side_effect = _capture

    _run()

    assert "Export Summary" in uploaded["sheets"]
    mocks["email"].build_success_email.assert_called_once()


def test_upload_failure_sends_failure_email_and_cleans_up(
    mocks: dict[str, Any],
) -> None:
    mocks["get_charts_in_layout_order"].return_value = [_chart(10, "Good")]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }
    mocks["s3"].upload_file_to_s3.side_effect = RuntimeError("s3 down")

    with pytest.raises(RuntimeError):
        _run("job-fail")

    mocks["email"].build_failure_email.assert_called_once()
    mocks["email"].send_export_email.assert_called_once()
    assert _no_temp_files_left("job-fail")


def test_soft_time_limit_sends_failure_email(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].side_effect = SoftTimeLimitExceeded()

    with pytest.raises(SoftTimeLimitExceeded):
        _run("job-timeout")

    mocks["email"].build_failure_email.assert_called_once()
    assert _no_temp_files_left("job-timeout")


# --- image mode ---


def test_images_mode_embeds_non_table_and_keeps_tables_tabular(
    mocks: dict[str, Any],
) -> None:
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "Line", viz_type="line"),
        _chart(20, "Tbl", viz_type="table"),
    ]
    mocks["render_chart_image"].return_value = _PNG_1x1
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    uploaded: dict[str, Any] = {}

    def _capture(path: str, bucket: str, key: str) -> None:
        uploaded["sheets"] = _read_sheets(path)
        uploaded["media"] = _media(path)

    mocks["s3"].upload_file_to_s3.side_effect = _capture

    _run(mode="images")

    # The non-table chart is rendered as an image (with the requesting user)...
    mocks["render_chart_image"].assert_called_once()
    render_args = mocks["render_chart_image"].call_args[0]
    assert render_args[0].id == 10
    assert render_args[3] is mocks["user"]
    # ...and the table chart still goes through the data path.
    mocks["ChartDataCommand"].return_value.run.assert_called_once()

    assert set(uploaded["sheets"].keys()) == {"10 - Line", "20 - Tbl"}
    # Exactly one embedded image (the non-table chart).
    assert len(uploaded["media"]) == 1


def test_images_mode_renders_chart_without_query_context(
    mocks: dict[str, Any],
) -> None:
    # An image chart with no saved query context can still render.
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "Line", viz_type="line", has_context=False),
    ]
    mocks["render_chart_image"].return_value = _PNG_1x1

    uploaded: dict[str, Any] = {}

    def _capture(path: str, bucket: str, key: str) -> None:
        uploaded["media"] = _media(path)

    mocks["s3"].upload_file_to_s3.side_effect = _capture

    _run(mode="images")

    mocks["render_chart_image"].assert_called_once()
    assert len(uploaded["media"]) == 1


def test_images_mode_none_render_is_skipped(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [
        _chart(10, "Line", viz_type="line"),
    ]
    mocks["render_chart_image"].return_value = None

    uploaded: dict[str, Any] = {}

    def _capture(path: str, bucket: str, key: str) -> None:
        uploaded["sheets"] = _read_sheets(path)

    mocks["s3"].upload_file_to_s3.side_effect = _capture

    _run(mode="images")

    # A chart that cannot render is grouped under the general-error reason.
    _, kwargs = mocks["email"].build_success_email.call_args
    assert kwargs["errored"] == {mocks["email"].ERROR_GENERAL: ["10 - Line"]}
    # Nothing rendered → the summary sheet stands in for an empty workbook.
    assert "Export Summary" in uploaded["sheets"]


def test_inflight_lock_released_on_success(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [_chart(10, "Good")]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }

    _run()

    # The distributed lock is released for this user+dashboard when the task
    # settles (namespace + params match what the API acquired).
    mocks["ReleaseDistributedLock"].assert_called_once_with(
        "excel_export", {"user_id": 2, "dashboard_id": 1}
    )
    mocks["ReleaseDistributedLock"].return_value.run.assert_called_once_with()


def test_inflight_lock_released_on_failure(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [_chart(10, "Good")]
    mocks["ChartDataCommand"].return_value.run.return_value = {
        "queries": [{"colnames": ["a"], "data": [{"a": 1}]}]
    }
    mocks["s3"].upload_file_to_s3.side_effect = RuntimeError("s3 down")

    with pytest.raises(RuntimeError):
        _run("job-fail")

    # The lock is freed in ``finally`` even when the export fails.
    mocks["ReleaseDistributedLock"].assert_called_once_with(
        "excel_export", {"user_id": 2, "dashboard_id": 1}
    )
    mocks["ReleaseDistributedLock"].return_value.run.assert_called_once_with()
