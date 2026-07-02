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
from contextlib import ExitStack
from typing import Any
from unittest import mock

import pytest
from celery.exceptions import SoftTimeLimitExceeded

from superset.utils import json

MODULE = "superset.tasks.export_dashboard_excel"


def _chart(chart_id: int, name: str, has_context: bool = True) -> mock.MagicMock:
    chart = mock.MagicMock()
    chart.id = chart_id
    chart.slice_name = name
    chart.query_context = json.dumps({"queries": [{}]}) if has_context else None
    return chart


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
                "s3",
                "email",
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


def _run(job_id: str = "job-1") -> None:
    from superset.tasks.export_dashboard_excel import export_dashboard_excel

    export_dashboard_excel(
        dashboard_id=1, user_id=2, active_data_mask={}, job_id=job_id
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
    assert kwargs["skipped_charts"] == ["20 - NoContext"]


def test_chart_query_error_is_skipped_export_continues(
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
    assert kwargs["skipped_charts"] == ["10 - Boom"]


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
