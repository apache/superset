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
"Export to .CSV" and "Export to Excel" for a Tree table chart.

The chart's ``buildQuery`` sends its flat export query under
``form_data.tree_export``; the chart data API swaps the chart's queries
for it on CSV and XLSX requests, so the file has one row per child.
"""

import copy
import csv
import hashlib
import io
import zipfile
from collections.abc import Iterator
from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from unittest import mock
from uuid import uuid4

import pandas as pd
import pytest
from flask import g
from flask_appbuilder.security.sqla.models import Role
from freezegun import freeze_time
from openpyxl import load_workbook

from superset import db, security_manager
from superset.charts.data.api import ChartDataRestApi
from superset.charts.data.dashboard_filter_context import DashboardFilterContext
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.data.streaming_export_command import (
    StreamingCSVExportCommand,
)
from superset.commands.report.execute import (
    AsyncExecuteReportScheduleCommand,
    BaseReportState,
)
from superset.connectors.sqla.models import RowLevelSecurityFilter, SqlaTable
from superset.models.core import Database
from superset.models.slice import Slice
from superset.reports.models import ReportDataFormat
from superset.subjects.sync import sync_role_subject
from superset.subjects.utils import subjects_from_roles
from superset.utils import json
from superset.utils.core import get_example_default_schema, RowLevelSecurityFilterType
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.reports.utils import (
    cleanup_report_schedule,
    create_report_notification,
)
from tests.integration_tests.test_app import app

WORKFLOW = "tree_export_workflow_trace"
SEGMENTS = "tree_export_interaction_segments"
TODAY = date.today()

# Pasted from superset-frontend/plugins/plugin-chart-ag-grid-table/src/TreeTable/
# exportQuery.test.ts ("export specs pasted in tree_export_tests.py", "the
# day variants tree_export_tests.py builds with with_day" and "saved query
# context pasted in tree_export_tests.py (reports)").
BASE_QUERY: dict[str, Any] = {
    "time_range": "No filter",
    "filters": [],
    "extras": {"having": "", "where": ""},
    "applied_time_extras": {},
    "annotation_layers": [],
    "series_limit": 0,
    "group_others_when_limit_reached": False,
    "order_desc": True,
    "url_params": {},
    "custom_params": {},
    "custom_form_data": {},
}
SESSION_COLUMNS = [
    "session_id",
    "channel",
    "duration_ms",
    "step_count",
    "outcome",
    "channel_key",
    "person_device_id",
    "web_chat_id",
    "display_name_override",
    "inbound_number",
    "inbound_domain",
]
STEP_COLUMNS = [
    "step_id",
    "item_desc",
    "item_label",
    "step",
    "loop",
    "step_duration_ms",
    "step_started_at",
    "step_ended_at",
    "result",
]
SESSION_EXPORT: dict[str, Any] = {
    "query": {
        **BASE_QUERY,
        "metrics": [],
        "columns": [*SESSION_COLUMNS, *STEP_COLUMNS],
        "orderby": [
            ["duration_ms", False],
            ["session_id", True],
            ["channel", True],
            ["step_count", True],
            ["outcome", True],
            ["step", True],
            ["step_id", True],
        ],
        "row_limit": 0,
        "row_offset": 0,
        "post_processing": [
            {
                "operation": "tree_rows",
                "options": {
                    "levels": [
                        {"id_column": "session_id", "columns": SESSION_COLUMNS},
                        {"id_column": "step_id", "columns": STEP_COLUMNS},
                    ],
                    "time_ranges": [],
                },
            }
        ],
    },
    "child_filters": [],
}
INTERACTION_COLUMNS = [
    "interaction_id",
    "agent",
    "queue",
    "channel",
    "segment_count",
    "start_local",
    "source_phone",
    "interaction_type",
]
SEGMENT_COLUMNS = [
    "segment_id",
    "segment_no",
    "segment_start",
    "segment_end",
    "segment_type",
    "subject",
    "from_party",
    "to_party",
    "disposition",
]
CALL_TRACE_EXPORT: dict[str, Any] = {
    "query": {
        **BASE_QUERY,
        "metrics": [],
        "columns": [*INTERACTION_COLUMNS, *SEGMENT_COLUMNS],
        "orderby": [
            ["segment_count", False],
            ["interaction_id", True],
            ["agent", True],
            ["queue", True],
            ["channel", True],
            ["segment_no", False],
            ["segment_id", True],
        ],
        "row_limit": 0,
        "row_offset": 0,
        "post_processing": [
            {
                "operation": "tree_rows",
                "options": {
                    "levels": [
                        {"id_column": "interaction_id", "columns": INTERACTION_COLUMNS},
                        {"id_column": "segment_id", "columns": SEGMENT_COLUMNS},
                    ],
                    "time_ranges": [],
                },
            }
        ],
    },
    "child_filters": [],
}
S4_EXPORT: dict[str, Any] = {
    "query": {
        **BASE_QUERY,
        "metrics": [],
        "columns": [
            "queue",
            "agent",
            "interaction_id",
            "channel",
            "segment_count",
            "source_phone",
            "interaction_type",
            *SEGMENT_COLUMNS,
        ],
        "orderby": [
            ["queue", True],
            ["agent", True],
            ["segment_count", False],
            ["interaction_id", True],
            ["segment_no", False],
            ["segment_id", True],
        ],
        "row_limit": 0,
        "row_offset": 0,
        "post_processing": [
            {
                "operation": "tree_rows",
                "options": {
                    "levels": [
                        {"id_column": "queue", "columns": ["queue"]},
                        {"id_column": "agent", "columns": ["agent"]},
                        {
                            "id_column": "interaction_id",
                            "columns": [
                                "interaction_id",
                                "channel",
                                "segment_count",
                                "source_phone",
                                "interaction_type",
                            ],
                        },
                        {"id_column": "segment_id", "columns": SEGMENT_COLUMNS},
                    ],
                    "time_ranges": [],
                },
            }
        ],
    },
    "child_filters": [],
}
SESSION_LEVELS: list[dict[str, Any]] = [
    {
        "key": "level-1",
        "name": "Session",
        "name_plural": "Sessions",
        "id_column": "session_id",
        "time_column": "session_started_at",
        "columns": ["channel", "duration_ms", "step_count", "outcome"],
        "detail_fields": SESSION_COLUMNS[5:],
        "sort": ["duration_ms", False],
    },
    {
        "key": "level-2",
        "name": "Step",
        "name_plural": "Steps",
        "id_column": "step_id",
        "parent_column": "session_id",
        "time_column": "step_started_at",
        "columns": ["item_desc", "item_label", "step", "loop", "step_duration_ms"],
        "detail_fields": ["step_started_at", "step_ended_at", "result"],
        "sort": ["step", True],
        "children_shown": 100,
        "apply_date_filter": False,
    },
]
SAVED_PAGE: dict[str, Any] = {
    **BASE_QUERY,
    "columns": SESSION_COLUMNS,
    "metrics": [],
    "orderby": [
        ["duration_ms", False],
        ["session_id", True],
        ["channel", True],
        ["step_count", True],
        ["outcome", True],
    ],
    "row_limit": 50,
    "row_offset": 0,
}
SAVED_COUNT: dict[str, Any] = {
    **SAVED_PAGE,
    "orderby": [],
    "row_limit": 1000,
    "post_processing": [],
    "is_rowcount": True,
}


def with_day(
    spec: dict[str, Any],
    day: str,
    date_column: str,
    child_level: int | None = None,
    child_column: str | None = None,
) -> dict[str, Any]:
    """The export spec ``buildQuery`` gives for a day range (see withDay)."""
    result = copy.deepcopy(spec)
    date_range = {"op": "TEMPORAL_RANGE", "val": day}
    result["query"]["time_range"] = day
    result["query"]["filters"] = [{"col": date_column, **date_range}]
    options = result["query"]["post_processing"][0]["options"]
    options["time_ranges"] = [day]
    if child_level is not None:
        options["levels"][child_level]["time_column"] = child_column
        result["child_filters"] = [{"col": child_column, **date_range}]
    return result


LABELS = {
    "session_id": "Session Id",
    "channel": "Channel",
    "duration_ms": "Duration",
    "step_count": "Steps",
    "outcome": "Outcome",
    "channel_key": "channelKey",
    "person_device_id": "personDeviceId",
    "web_chat_id": "webChatId",
    "display_name_override": "displayNameOverride",
    "inbound_number": "inboundNumber",
    "inbound_domain": "inboundDomain",
    "session_started_at": "Session start (not in PDF)",
    "step_id": "Step Id (not in PDF)",
    "item_desc": "Item Desc",
    "item_label": "Item Label",
    "step": "Step",
    "loop": "Loop",
    "step_duration_ms": "Duration",
    "step_started_at": "Step start (placeholder)",
    "step_ended_at": "Step end (placeholder)",
    "result": "Result (placeholder)",
}

# Cases from the workflow test data, with dates relative to today `D`:
# (a) no steps, (b) 150, (c) 520, (d) D-3 23:50 with 10 of 20 steps after
# midnight, (e) NULL session ID with 7 steps, (e2) '' with 5, (h) D-6 23:59
# with all 6 steps the next day.
CASES: list[tuple[str, int, str | None, int, datetime]] = [
    *[
        (
            f"n{i}",
            i,
            hashlib.md5(f"s{i}".encode()).hexdigest()[:16],  # noqa: S324
            5 + (i * 7) % 26,
            datetime.combine(TODAY - timedelta(days=7 * i), time())
            + timedelta(minutes=(i * 37) % 1380),
        )
        for i in range(1, 13)
    ],
    ("a", 1091, "sa", 0, datetime.combine(TODAY - timedelta(days=1), time(10))),
    ("b", 1092, "sb", 150, datetime.combine(TODAY - timedelta(days=2), time(11))),
    ("c", 1093, "sc", 520, datetime.combine(TODAY - timedelta(days=2), time(12))),
    ("d", 1094, "sd", 20, datetime.combine(TODAY - timedelta(days=3), time(23, 50))),
    ("e", 1095, None, 7, datetime.combine(TODAY - timedelta(days=4), time(9))),
    ("e2", 1096, "", 5, datetime.combine(TODAY - timedelta(days=4), time(10))),
    ("h", 1099, "sh", 6, datetime.combine(TODAY - timedelta(days=6), time(23, 59))),
]


def channel_key(i: int) -> str:
    return f"ck{i}"


def workflow_rows() -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for key, i, session_id, steps, started in CASES:
        durations = [
            0 if st == 0 else 1000 * ((i * 13 + st * 17) % 60) for st in range(steps)
        ]
        for st in [*range(steps)] or [None]:
            if key == "h" and st is not None:
                step_at = datetime.combine(
                    started.date() + timedelta(days=1), time()
                ) + timedelta(minutes=1 + st)
            elif st is not None:
                step_at = started + timedelta(minutes=st)
            rows.append(
                {
                    "session_id": session_id,
                    "channel": ["Voice", "Chat", "Email"][i % 3],
                    "duration_ms": sum(durations),
                    "step_count": steps,
                    "outcome": ["Transferred", "Completed", "Abandoned"][(i // 3) % 3],
                    "channel_key": channel_key(i),
                    "person_device_id": f"pd{i}",
                    "web_chat_id": f"wc{i}",
                    "display_name_override": f"Caller {i}" if i % 4 == 0 else None,
                    "inbound_number": f"+1200{(i * 7919) % 10000000:07d}",
                    "inbound_domain": str(120000000 + (i * 104729) % 1000000),
                    "session_started_at": started,
                    "step_id": None if st is None else f"st-{key}-{st}",
                    "item_desc": None if st is None else f"desc {st % 7}",
                    "item_label": None if st is None else f"label {st % 7}",
                    "step": st,
                    "loop": None if st is None else (2 if st % 7 == 6 else 0),
                    "step_duration_ms": None if st is None else durations[st],
                    "step_started_at": None if st is None else step_at,
                    "step_ended_at": None
                    if st is None
                    else step_at + timedelta(seconds=durations[st] // 1000),
                    "result": None
                    if st is None
                    else ("error" if st % 11 == 10 else "ok"),
                }
            )
    df = pd.DataFrame(rows)
    for column in ("step", "loop", "step_duration_ms"):
        df[column] = df[column].astype("Int64")
    return df


def segment_rows() -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    interactions = [
        (
            f"n{i}",
            i,
            1 + (i * 5) % 8,
            datetime.combine(TODAY - timedelta(days=11 * i), time())
            + timedelta(minutes=(i * 53) % 1380),
        )
        for i in range(1, 10)
    ] + [("mid", 450, 6, datetime.combine(TODAY - timedelta(days=4), time(23, 50)))]
    for key, i, count, started in interactions:
        for g_no in range(1, count + 1):
            rows.append(
                {
                    "interaction_id": f"i-{key}",
                    "agent": [
                        "Priya Nair",
                        "Marco Rossi",
                        "Dana Lee",
                        "Sam Okafor",
                        "Lena Vogel",
                    ][i % 5],
                    "queue": [
                        "Support Tier 1",
                        "Sales Inbound",
                        "Default Hybrid Queue",
                    ][i % 3],
                    "channel": "phone",
                    "segment_count": count,
                    "start_local": started,
                    "source_phone": str(300000 + (i * 7919) % 700000),
                    "interaction_type": "outbound" if i % 4 == 0 else "inbound",
                    "segment_id": f"sg-{key}-{g_no}",
                    "segment_no": g_no,
                    "segment_start": started + timedelta(minutes=(g_no - 1) * 5),
                    "segment_end": started + timedelta(minutes=g_no * 5 - 1),
                    "segment_type": "Transfer",
                    "subject": "Transfer",
                    "from_party": f"Party {1 + (i + g_no) % 9}",
                    "to_party": f"Party {1 + (i + g_no + 4) % 9}",
                    "disposition": "Completed" if g_no == count else "Transferred",
                }
            )
    return pd.DataFrame(rows)


def day_range(days_ago: int) -> str:
    day = TODAY - timedelta(days=days_ago)
    return f"{day.isoformat()} : {(day + timedelta(days=1)).isoformat()}"


def make_dataset(name: str, df: pd.DataFrame, labels: dict[str, str]) -> SqlaTable:
    database = get_example_database()
    with database.get_sqla_engine() as engine:
        df.to_sql(
            name,
            engine,
            if_exists="replace",
            index=False,
            schema=get_example_default_schema(),
        )
    table = SqlaTable(
        table_name=name,
        database=database,
        schema=get_example_default_schema(),
    )
    db.session.add(table)
    db.session.commit()
    table.fetch_metadata()
    for column in table.columns:
        column.verbose_name = labels.get(column.column_name)
        if column.column_name.endswith(("_at", "_start", "_end", "_local")):
            column.is_dttm = True
    db.session.commit()
    return table


def drop_dataset(name: str) -> None:
    table = db.session.query(SqlaTable).filter_by(table_name=name).one_or_none()
    if table:
        db.session.delete(table)
        db.session.commit()
    with get_example_database().get_sqla_engine() as engine:
        with engine.begin() as conn:
            conn.exec_driver_sql(f"DROP TABLE IF EXISTS {name}")


@pytest.fixture(scope="module")
def tree_table_datasets() -> Iterator[None]:
    with app.app_context():
        make_dataset(WORKFLOW, workflow_rows(), LABELS)
        make_dataset(SEGMENTS, segment_rows(), {})
    yield
    with app.app_context():
        drop_dataset(WORKFLOW)
        drop_dataset(SEGMENTS)


def csv_rows(response: Any) -> list[list[str]]:
    return list(csv.reader(io.StringIO(response.data.decode("utf-8-sig"))))


def xlsx_rows(response: Any) -> list[list[Any]]:
    sheet = load_workbook(io.BytesIO(response.data)).active
    return [list(row) for row in sheet.iter_rows(values_only=True)]


def column(name: str) -> int:
    return [*SESSION_COLUMNS, *STEP_COLUMNS].index(name)


def rows_of(rows: list[list[Any]], case: int) -> list[list[Any]]:
    return [row for row in rows if row[column("channel_key")] == channel_key(case)]


def is_empty(value: Any) -> bool:
    return value in ("", None)


@pytest.mark.usefixtures("tree_table_datasets")
class TestTreeTableExport(SupersetTestCase):
    """Real chart data requests with a Tree table export query."""

    def setUp(self) -> None:
        self.workflow = self._table(WORKFLOW).id
        self.segments = self._table(SEGMENTS).id
        self.login(ADMIN_USERNAME)

    @staticmethod
    def _table(name: str) -> SqlaTable:
        return db.session.query(SqlaTable).filter_by(table_name=name).one()

    def _body(
        self,
        table: int,
        export: dict[str, Any] | None,
        result_format: str = "csv",
        row_limit: int = 1000,
        viz_type: str = "ag-grid-table",
        query_mode: str = "tree",
    ) -> dict[str, Any]:
        form_data: dict[str, Any] = {
            "datasource": f"{table}__table",
            "viz_type": viz_type,
            "query_mode": query_mode,
            "row_limit": row_limit,
            "tree_server_page_length": 50,
        }
        if export is not None:
            form_data["tree_export"] = export
        return {
            "datasource": {"id": table, "type": "table"},
            "form_data": form_data,
            "queries": [SAVED_PAGE, SAVED_COUNT],
            "result_format": result_format,
            "result_type": "full",
        }

    def _post(self, body: dict[str, Any], **kwargs: Any) -> Any:
        g.pop("_login_user", None)
        g.pop("user", None)
        return self.client.post("/api/v1/chart/data", json=body, **kwargs)

    def _session_csv(self, export: dict[str, Any], **kwargs: Any) -> list[list[str]]:
        response = self._post(self._body(self.workflow, export, **kwargs))
        assert response.status_code == 200, response.data
        assert response.mimetype == "text/csv"
        return csv_rows(response)

    def test_session_csv_has_one_row_per_step(self) -> None:
        response = self._post(self._body(self.workflow, SESSION_EXPORT))
        assert response.status_code == 200, response.data
        assert response.mimetype == "text/csv"
        assert not response.data.startswith(b"PK")
        header, *rows = csv_rows(response)
        assert header == [LABELS[name] for name in [*SESSION_COLUMNS, *STEP_COLUMNS]]
        assert header[0] == "Session Id"
        assert header.count("Duration") == 2
        assert len(rows_of(rows, 1092)) == 150
        assert len(rows_of(rows, 1093)) == 520
        (empty,) = rows_of(rows, 1091)
        assert all(is_empty(empty[column(name)]) for name in STEP_COLUMNS), (
            "(a) has empty step columns"
        )
        assert empty[column("session_id")] == "sa"
        for case in (1095, 1096):
            (folded,) = rows_of(rows, case)
            assert is_empty(folded[column("session_id")])
            assert all(is_empty(folded[column(name)]) for name in STEP_COLUMNS)
        expected = sum(max(steps, 1) for *_, steps, _ in CASES) - 7 - 5 + 2
        assert len(rows) == expected
        for case in (1092, 1093):
            steps = [float(row[column("step")]) for row in rows_of(rows, case)]
            assert steps == sorted(steps)
        keys = [row[column("channel_key")] for row in rows]
        blocks = [key for position, key in enumerate(keys) if key != keys[position - 1]]
        assert len(blocks) == len(set(keys))
        durations = [
            float(row[column("duration_ms")])
            for position, row in enumerate(rows)
            if position == 0
            or row[column("channel_key")] != rows[position - 1][column("channel_key")]
        ]
        assert durations == sorted(durations, reverse=True)
        assert keys[0] == channel_key(1093)

    def test_session_and_call_trace_xlsx(self) -> None:
        response = self._post(self._body(self.workflow, SESSION_EXPORT, "xlsx"))
        assert response.status_code == 200, response.data
        assert response.mimetype == (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert (
            "xl/workbook.xml" in zipfile.ZipFile(io.BytesIO(response.data)).namelist()
        )
        header, *rows = xlsx_rows(response)
        assert header == [LABELS[name] for name in [*SESSION_COLUMNS, *STEP_COLUMNS]]
        assert header.count("Duration") == 2
        assert len(rows) == len(self._session_csv(SESSION_EXPORT)) - 1
        assert len(rows_of(rows, 1093)) == 520

        day = day_range(4)
        export = with_day(CALL_TRACE_EXPORT, day, "start_local", 1, "segment_start")
        response = self._post(self._body(self.segments, export, "xlsx"))
        assert response.status_code == 200, response.data
        assert (
            "xl/workbook.xml" in zipfile.ZipFile(io.BytesIO(response.data)).namelist()
        )
        header, *rows = xlsx_rows(response)
        assert header[0] == "interaction_id"
        assert [row[0] for row in rows] == ["i-mid", "i-mid"]

    def test_child_date_option(self) -> None:
        def session_rows(days_ago: int, on: bool, case: int) -> list[list[str]]:
            day = day_range(days_ago)
            child = (1, "step_started_at") if on else (None, None)
            export = with_day(SESSION_EXPORT, day, "session_started_at", *child)
            return rows_of(self._session_csv(export)[1:], case)

        assert len(session_rows(3, False, 1094)) == 20
        assert len(session_rows(3, True, 1094)) == 10
        assert len(session_rows(6, False, 1099)) == 6
        (empty,) = session_rows(6, True, 1099)
        assert all(is_empty(empty[column(name)]) for name in STEP_COLUMNS)
        assert empty[column("session_id")] == "sh"
        assert session_rows(5, False, 1099) == []
        assert session_rows(5, True, 1099) == []

        day = day_range(4)
        for on, expected in ((False, 6), (True, 2)):
            child = (1, "segment_start") if on else (None, None)
            export = with_day(CALL_TRACE_EXPORT, day, "start_local", *child)
            response = self._post(self._body(self.segments, export))
            assert response.status_code == 200, response.data
            rows = csv_rows(response)[1:]
            assert [row[0] for row in rows] == ["i-mid"] * expected

    def test_deeper_levels(self) -> None:
        day = day_range(4)
        for on, expected in ((False, 6), (True, 2)):
            child = (3, "segment_start") if on else (None, None)
            export = with_day(S4_EXPORT, day, "start_local", *child)
            response = self._post(self._body(self.segments, export))
            assert response.status_code == 200, response.data
            rows = csv_rows(response)[1:]
            assert len(rows) == expected
            assert {tuple(row[:3]) for row in rows} == {
                ("Support Tier 1", "Priya Nair", "i-mid")
            }
        response = self._post(self._body(self.segments, S4_EXPORT))
        assert len(csv_rows(response)) - 1 == len(segment_rows())

    def _streamed(self, **post: Any) -> tuple[Any, Any, Any]:
        with (
            mock.patch.dict(app.config, {"CSV_STREAMING_ROW_THRESHOLD": 50}),
            mock.patch(
                "superset.charts.data.api.StreamingCSVExportCommand",
                wraps=StreamingCSVExportCommand,
            ) as streaming,
            mock.patch.object(
                ChartDataCommand,
                "execute",
                autospec=True,
                side_effect=ChartDataCommand.execute,
            ) as run,
        ):
            g.pop("_login_user", None)
            g.pop("user", None)
            response = self.client.post("/api/v1/chart/data", **post)
            assert response.status_code == 200, response.data
            response.data  # noqa: B018
        return response, streaming, run

    def test_streaming_moves_the_child_range_into_sql(self) -> None:
        day = day_range(6)
        on = with_day(SESSION_EXPORT, day, "session_started_at", 1, "step_started_at")
        off = with_day(SESSION_EXPORT, day, "session_started_at")
        for export, case_rows in ((on, 0), (off, 6)):
            response, streaming, _ = self._streamed(
                json=self._body(self.workflow, export, row_limit=50)
            )
            assert streaming.call_count == 1
            rows = csv_rows(response)
            assert rows[0][0] == "session_id"
            assert len(rows_of(rows[1:], 1099)) == case_rows

        response, streaming, _ = self._streamed(
            json=self._body(self.workflow, SESSION_EXPORT, row_limit=50)
        )
        assert streaming.call_count == 1
        rows = csv_rows(response)[1:]
        assert len(rows_of(rows, 1095)) == 7
        assert len(rows_of(rows, 1096)) == 5
        assert len(rows_of(rows, 1091)) == 1
        assert len(rows) == len(workflow_rows())

    def test_pre_execution_streaming_gate(self) -> None:
        day = day_range(6)
        export = with_day(
            SESSION_EXPORT, day, "session_started_at", 1, "step_started_at"
        )
        body = self._body(self.workflow, export, row_limit=10)
        response, streaming, run = self._streamed(
            data={"form_data": json.dumps(body), "expected_rows": "50"}
        )
        assert streaming.call_count == 1
        assert run.call_count == 0
        assert rows_of(csv_rows(response)[1:], 1099) == []

        response, streaming, run = self._streamed(data={"form_data": json.dumps(body)})
        assert streaming.call_count == 0
        assert run.call_count == 1
        (empty,) = rows_of(csv_rows(response)[1:], 1099)
        assert is_empty(empty[column("step_id")])

    def test_duplicate_source_rows_give_one_row_per_child(self) -> None:
        name = "tree_export_duplicate_steps"
        df = pd.DataFrame(
            [
                ("s1", "Voice", "a", "Greet"),
                ("s1", "Voice", "a", "Greet"),
                ("s1", "Voice", "b", "Menu"),
                ("s2", "Chat", None, None),
            ],
            columns=["session_id", "channel", "step_id", "step"],
        )
        export = {
            "query": {
                **BASE_QUERY,
                "metrics": [],
                "columns": ["session_id", "channel", "step_id", "step"],
                "orderby": [["session_id", True], ["step_id", True]],
                "row_limit": 0,
                "row_offset": 0,
                "post_processing": [
                    {
                        "operation": "tree_rows",
                        "options": {
                            "levels": [
                                {
                                    "id_column": "session_id",
                                    "columns": ["session_id", "channel"],
                                },
                                {
                                    "id_column": "step_id",
                                    "columns": ["step_id", "step"],
                                },
                            ],
                            "time_ranges": [],
                        },
                    }
                ],
            },
            "child_filters": [],
        }
        expected = [
            ["s1", "Voice", "a", "Greet"],
            ["s1", "Voice", "b", "Menu"],
            ["s2", "Chat", "", ""],
        ]
        table = make_dataset(name, df, {})
        try:
            response = self._post(self._body(table.id, export))
            assert response.status_code == 200, response.data
            assert csv_rows(response)[1:] == expected

            response, streaming, _ = self._streamed(
                json=self._body(table.id, export, row_limit=50)
            )
            assert streaming.call_count == 1
            assert csv_rows(response)[1:] == expected
        finally:
            drop_dataset(name)

    @with_feature_flags(ENABLE_TEMPLATE_PROCESSING=True)
    def test_non_date_filter_selects_parents_for_each_export_path(self) -> None:
        """Export both children of a selected timestamp parent."""
        name = "tree_export_filtered_steps"
        selected = datetime(2026, 1, 1, 12, 30, 5)
        excluded = selected + timedelta(days=1)
        columns = ["session_at", "step_id", "channel"]
        table = make_dataset(
            name,
            pd.DataFrame(
                [
                    (selected, "a", "Voice"),
                    (selected, "b", "Chat"),
                    (excluded, "c", "Chat"),
                ],
                columns=columns,
            ),
            {},
        )
        export: dict[str, Any] = {
            "query": {
                **BASE_QUERY,
                "metrics": [],
                "columns": columns,
                "orderby": [["session_at", True], ["step_id", True]],
                "row_limit": 0,
                "row_offset": 0,
                "post_processing": [
                    {
                        "operation": "tree_rows",
                        "options": {
                            "levels": [
                                {"id_column": "session_at", "columns": ["session_at"]},
                                {
                                    "id_column": "step_id",
                                    "columns": ["step_id", "channel"],
                                },
                            ],
                        },
                    }
                ],
            },
            "child_filters": [],
        }
        try:
            table.sql = (
                "SELECT session_at, step_id, channel FROM tree_export_filtered_steps "
                "{% if filter_values('channel') %} WHERE channel <> 'Chat' {% endif %}"
            )
            db.session.commit()
            table_id = table.id
            for value, children in (
                ("Voice", [["a", "Voice"], ["b", "Chat"]]),
                ("missing", []),
            ):
                filtered = copy.deepcopy(export)
                filtered["query"]["filters"] = [
                    {"col": "channel", "op": "IN", "val": [value]}
                ]
                response = self._post(self._body(table_id, filtered))
                assert response.status_code == 200, response.data
                header, *rows = csv_rows(response)
                assert header == columns
                assert [row[1:] for row in rows] == children

                response = self._post(self._body(table_id, filtered, "xlsx"))
                assert response.status_code == 200, response.data
                header, *rows = xlsx_rows(response)
                assert header == columns
                assert [row[1:] for row in rows] == children

                response, streaming, _ = self._streamed(
                    json=self._body(table_id, filtered, row_limit=50)
                )
                assert streaming.call_count == 1
                header, *rows = csv_rows(response)
                assert header == columns
                assert [row[1:] for row in rows] == children
        finally:
            drop_dataset(name)

    def test_post_reads_export_parameters_once(self) -> None:
        reader = ChartDataRestApi._extract_export_params_from_request
        cases = (
            ("ag-grid-table", "tree", "csv"),
            ("ag-grid-table", "tree", "json"),
            ("ag-grid-table", "tree", "xlsx"),
            ("ag-grid-table", "aggregate", "csv"),
            ("table", "tree", "csv"),
        )
        for viz_type, query_mode, result_format in cases:
            with mock.patch.object(
                ChartDataRestApi,
                "_extract_export_params_from_request",
                autospec=True,
                side_effect=reader,
            ) as spy:
                response = self._post(
                    self._body(
                        self.workflow,
                        SESSION_EXPORT,
                        result_format,
                        viz_type=viz_type,
                        query_mode=query_mode,
                    )
                )
            assert response.status_code == 200, (viz_type, result_format)
            assert spy.call_count == 1, (viz_type, result_format)

    def test_other_charts_and_old_tree_table_identity_are_unchanged(self) -> None:
        for viz_type, query_mode in (
            ("ag-grid-table", "aggregate"),
            ("ag-grid-table", "raw"),
            ("table", "tree"),
            ("tree_table", "tree"),
        ):
            for result_format in ("csv", "xlsx"):
                with freeze_time(datetime.now(timezone.utc)):
                    plain = self._post(
                        self._body(
                            self.workflow,
                            None,
                            result_format,
                            viz_type=viz_type,
                            query_mode=query_mode,
                        )
                    )
                    planted = self._post(
                        self._body(
                            self.workflow,
                            SESSION_EXPORT,
                            result_format,
                            viz_type=viz_type,
                            query_mode=query_mode,
                        )
                    )
                assert plain.status_code == planted.status_code == 200
                assert plain.mimetype == planted.mimetype == "application/zip"
                assert plain.data == planted.data, (viz_type, result_format)

        json_body = self._body(self.workflow, None, "json")
        json_body["form_data"]["viz_type"] = "ag-grid-table"
        plain = self._post(json_body)
        planted = self._post(self._body(self.workflow, SESSION_EXPORT, "json"))
        assert plain.status_code == planted.status_code == 200
        keys = ("colnames", "data", "query", "rowcount")
        assert [
            {key: result[key] for key in keys} for result in planted.json["result"]
        ] == [{key: result[key] for key in keys} for result in plain.json["result"]]

    def _saved_chart(self, with_export: bool = True) -> Slice:
        form_data: dict[str, Any] = {
            "datasource": f"{self.workflow}__table",
            "viz_type": "ag-grid-table",
            "query_mode": "tree",
            "row_limit": 1000,
            "levels": SESSION_LEVELS,
            "tree_server_page_length": 50,
            "time_range": "No filter",
            "result_format": "json",
            "result_type": "full",
        }
        if with_export:
            form_data["tree_export"] = SESSION_EXPORT
        chart = Slice(
            slice_name="Tree table export",
            viz_type="ag-grid-table",
            datasource_type="table",
            datasource_id=self.workflow,
            params=json.dumps(
                {k: v for k, v in form_data.items() if "result" not in k}
            ),
            query_context=json.dumps(
                {
                    "datasource": {"id": self.workflow, "type": "table"},
                    "force": False,
                    "queries": [SAVED_PAGE, SAVED_COUNT],
                    "form_data": form_data,
                    "result_format": "json",
                    "result_type": "full",
                }
            ),
        )
        db.session.add(chart)
        db.session.commit()
        return chart

    def test_saved_chart_get_path(self) -> None:
        for with_export in (True, False):
            chart = self._saved_chart(with_export)
            try:
                g.pop("_login_user", None)
                g.pop("user", None)
                response = self.client.get(
                    f"/api/v1/chart/{chart.id}/data/?format=csv&type=post_processed"
                )
            finally:
                db.session.delete(chart)
                db.session.commit()
            assert response.status_code == 200, response.data
            if not with_export:
                assert response.mimetype == "application/zip"
                assert len(zipfile.ZipFile(io.BytesIO(response.data)).namelist()) == 2
                continue
            assert response.mimetype == "text/csv"
            header, *rows = csv_rows(response)
            assert header[0] == "Session Id"
            assert len(rows_of(rows, 1093)) == 520
            assert rows[0][column("channel_key")] == channel_key(1093)

    def test_saved_tree_export_applies_dashboard_filter_defaults(self) -> None:
        chart = self._saved_chart()
        context = DashboardFilterContext(
            extra_form_data={
                "filters": [
                    {"col": "channel_key", "op": "IN", "val": [channel_key(1093)]},
                    {"col": "step", "op": "IN", "val": [0]},
                ]
            }
        )
        try:
            g.pop("_login_user", None)
            g.pop("user", None)
            with mock.patch(
                "superset.charts.data.api.get_dashboard_filter_context",
                return_value=context,
            ) as get_context:
                response = self.client.get(
                    f"/api/v1/chart/{chart.id}/data/?format=csv&filters_dashboard_id=1"
                )
            get_context.assert_called_once_with(dashboard_id=1, chart_id=chart.id)
            assert response.status_code == 200, response.data
            _, *rows = csv_rows(response)
            assert rows
            assert rows_of(rows, 1093) == rows
            assert len(rows) == 520
        finally:
            db.session.delete(chart)
            db.session.commit()

    def test_saved_tree_export_streams_without_materializing(self) -> None:
        chart = self._saved_chart()
        try:
            g.pop("_login_user", None)
            g.pop("user", None)
            with (
                mock.patch.dict(app.config, {"CSV_STREAMING_ROW_THRESHOLD": 50}),
                mock.patch(
                    "superset.charts.data.api.StreamingCSVExportCommand",
                    wraps=StreamingCSVExportCommand,
                ) as streaming,
                mock.patch.object(
                    ChartDataCommand,
                    "execute",
                    autospec=True,
                    side_effect=ChartDataCommand.execute,
                ) as materialized,
            ):
                response = self.client.get(f"/api/v1/chart/{chart.id}/data/?format=csv")
                assert response.status_code == 200, response.data
                assert len(csv_rows(response)) > 1
            streaming.assert_called_once()
            materialized.assert_not_called()
        finally:
            db.session.delete(chart)
            db.session.commit()

    def test_report_command_attaches_the_children(self) -> None:
        chart = self._saved_chart()
        report = create_report_notification(
            email_target="target@email.com",
            chart=chart,
            report_format=ReportDataFormat.CSV,
            name="tree table csv report",
        )
        client = self.client

        def post_to_test_client(
            chart_url: str,
            auth_cookies: dict[str, str] | None,
            request_payload: dict[str, Any],
            timeout: float | None = None,
        ) -> bytes:
            response = client.post(
                "/api/v1/chart/data",
                data={"form_data": json.dumps(request_payload)},
            )
            assert response.status_code == 200, response.data
            return response.data

        try:
            with (
                mock.patch.object(
                    BaseReportState,
                    "_post_chart_data",
                    side_effect=post_to_test_client,
                ) as fetch,
                mock.patch(
                    "superset.reports.notifications.email.send_email_smtp"
                ) as email,
            ):
                AsyncExecuteReportScheduleCommand(
                    str(uuid4()), report.id, datetime.utcnow()
                ).run()
            assert fetch.call_count == 1
            (attachment,) = email.call_args[1]["data"].values()
            header, *rows = list(
                csv.reader(io.StringIO(attachment.decode("utf-8-sig")))
            )
            assert header[0] == "Session Id"
            assert len(rows_of(rows, 1093)) == 520
            assert len(rows_of(rows, 1092)) == 150
        finally:
            cleanup_report_schedule(report)
            db.session.delete(chart)
            db.session.commit()

    def _user_pvms(self, *grants: tuple[str, str]) -> list[Any]:
        perm = self._table(WORKFLOW).perm
        security_manager.add_permission_view_menu("datasource_access", perm)
        return [("datasource_access", perm), *grants]

    def _as_user(
        self,
        grants: list[tuple[str, str]],
        remove: list[tuple[str, str]],
        result_format: str,
    ) -> int:
        gamma = security_manager.find_user("gamma")
        self.logout()
        with self.temporary_user(
            clone_user=gamma,
            extra_pvms=self._user_pvms(*grants),
            pvms_to_remove=remove,
            login=True,
        ) as user:
            assert self.client.get("/api/v1/me/").json["result"]["username"] == (
                user.username
            )
            response = self._post(
                self._body(self.workflow, SESSION_EXPORT, result_format)
            )
        self.login(ADMIN_USERNAME)
        return response.status_code

    def test_export_permission_without_granular_controls(self) -> None:
        both = [("can_csv", "Superset"), ("can_export_data", "Superset")]
        for result_format in ("csv", "xlsx"):
            assert self._as_user([("can_csv", "Superset")], [], result_format) == 200
            assert self._as_user([], both, result_format) == 403
            assert (
                self._as_user(
                    [("can_export_data", "Superset")],
                    [("can_csv", "Superset")],
                    result_format,
                )
                == 403
            )

    @with_feature_flags(GRANULAR_EXPORT_CONTROLS=True)
    def test_export_permission_with_granular_controls(self) -> None:
        security_manager.add_permission_view_menu("can_export_data", "Superset")
        for result_format in ("csv", "xlsx"):
            assert (
                self._as_user(
                    [("can_export_data", "Superset")],
                    [("can_csv", "Superset")],
                    result_format,
                )
                == 200
            )
            assert (
                self._as_user(
                    [("can_csv", "Superset")],
                    [("can_export_data", "Superset")],
                    result_format,
                )
                == 403
            )

    def test_rls_applies_to_the_csv(self) -> None:
        admin_rows = rows_of(self._session_csv(SESSION_EXPORT)[1:], 1092)
        assert "error" in {row[column("result")] for row in admin_rows}

        role = Role(name="tree_export_rls")
        db.session.add(role)
        db.session.flush()
        sync_role_subject(role)
        db.session.flush()
        rls = RowLevelSecurityFilter(
            name="Tree export excludes errors",
            filter_type=RowLevelSecurityFilterType.REGULAR,
            clause="result <> 'error'",
        )
        rls.tables.append(self._table(WORKFLOW))
        rls.subjects = subjects_from_roles([role])
        db.session.add(rls)
        db.session.commit()
        gamma = security_manager.find_user("gamma")
        queries: list[str] = []
        get_df = Database.get_df

        def record(database: Database, sql: str, *args: Any, **kwargs: Any) -> Any:
            queries.append(sql)
            return get_df(database, sql, *args, **kwargs)

        self.logout()
        try:
            with self.temporary_user(
                clone_user=gamma,
                extra_pvms=self._user_pvms(("can_csv", "Superset")),
                login=True,
            ) as user:
                assert self.client.get("/api/v1/me/").json["result"]["username"] == (
                    user.username
                )
                user.roles.append(role)
                db.session.commit()
                with mock.patch.object(
                    Database, "get_df", autospec=True, side_effect=record
                ):
                    rows = rows_of(self._session_csv(SESSION_EXPORT)[1:], 1092)
                user.roles.remove(role)
                db.session.commit()
        finally:
            self.login(ADMIN_USERNAME)
            db.session.delete(rls)
            db.session.delete(role)
            db.session.commit()
        assert 0 < len(rows) < len(admin_rows)
        assert "error" not in {row[column("result")] for row in rows}
        assert any("result <> 'error'" in sql for sql in queries)
        g.pop("user", None)
