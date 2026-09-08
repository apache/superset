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
Unit tests for get_chart_preview MCP tool
"""

import importlib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pandas as pd
import pytest
import pytz
from dateutil import tz as dateutil_tz
from dateutil.zoneinfo import get_zonefile_instance

from superset.mcp_service.chart.query_result import MAX_QUERY_RESULT_VALUE_BYTES
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    ASCIIPreview,
    ChartError,
    ChartPreview,
    GetChartPreviewRequest,
    InteractivePreview,
    PerformanceMetadata,
    TablePreview,
    URLPreview,
    VegaLitePreview,
)
from superset.mcp_service.chart.tool.get_chart_preview import (
    _build_chart_description,
    _build_query_columns,
    _build_query_metrics,
    _first_query_has_fields,
    _no_query_fields_error,
    ASCIIPreviewStrategy,
    get_chart_preview,
    PreviewFormatStrategy,
    TablePreviewStrategy,
)
from superset.utils import json as utils_json


def _query_context_stub(form_data: dict[str, Any] | None = None) -> Any:
    """Return the minimal real-shaped context needed by Jinja form-data seeding."""
    return SimpleNamespace(form_data=form_data or {}, queries=[])


def _entrypoint_preview(content: str) -> ChartPreview:
    return ChartPreview(
        chart_id=1,
        chart_name="",
        chart_type="bullet",
        explore_url="",
        content=ASCIIPreview(ascii_content=content, width=80, height=20),
        chart_description="",
        accessibility=AccessibilityMetadata(
            color_blind_safe=True,
            alt_text="",
            high_contrast_available=False,
        ),
        performance=PerformanceMetadata(
            query_duration_ms=0,
            cache_status="miss",
            optimization_suggestions=[],
        ),
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("request_payload", "extra", "expected_type"),
    [
        ({"id": 1, "format": "ascii"}, 0, ChartPreview),
        ({"form_data_key": "cached-preview", "format": "ascii"}, 1, ChartError),
    ],
    ids=["identifier-alias-exact-limit", "cached-preview-limit-plus-one"],
)
async def test_get_chart_preview_entrypoint_preflights_complete_exact_wire_response(
    request_payload: dict[str, object], extra: int, expected_type: type[object]
) -> None:
    empty = _entrypoint_preview("")
    filler = "x" * (
        MAX_QUERY_RESULT_VALUE_BYTES - len(empty.model_dump_json().encode()) + extra
    )
    candidate = _entrypoint_preview(filler)
    request = GetChartPreviewRequest.model_validate(request_payload)
    ctx = MagicMock()
    ctx.info = AsyncMock()
    ctx.debug = AsyncMock()
    ctx.warning = AsyncMock()

    user = MagicMock(id=1, username="admin", roles=[], groups=[])
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch(
            "superset.mcp_service.chart.tool.get_chart_preview."
            "_get_chart_preview_internal",
            new=AsyncMock(return_value=candidate),
        ),
    ):
        result = await get_chart_preview(request, ctx=ctx)

    assert isinstance(result, expected_type)
    if extra == 0:
        assert len(candidate.model_dump_json().encode()) == (
            MAX_QUERY_RESULT_VALUE_BYTES
        )
        assert result is candidate
    else:
        assert isinstance(result, ChartError)
        assert result.error_type == "MalformedQueryResult"


@pytest.mark.asyncio
@pytest.mark.parametrize("format_", ["ascii", "vega_lite"])
async def test_bullet_numeric_and_temporal_categories_reach_real_mcp_entrypoint(
    format_: str,
) -> None:
    from contextlib import nullcontext

    from fastmcp import Client

    from superset.mcp_service.app import mcp

    preview_module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Category"],
    }
    chart = SimpleNamespace(
        id=121,
        slice_name="Number boundaries",
        viz_type="bullet",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(form_data),
    )
    rows = [
        {"Category": 9007199254740993, "Revenue": 1},
        {"Category": Decimal("1.0000000000000001"), "Revenue": 2},
        {"Category": Decimal("1.7976931348623159e308"), "Revenue": 3},
        {"Category": date(2026, 9, 2), "Revenue": 4},
        {
            "Category": datetime(2026, 9, 2, 3, 4, 5, tzinfo=timezone.utc),
            "Revenue": 5,
        },
        {
            "Category": datetime(
                2023,
                11,
                5,
                1,
                30,
                tzinfo=ZoneInfo("America/New_York"),
                fold=0,
            ),
            "Revenue": 6,
        },
        {
            "Category": datetime(
                2023,
                11,
                5,
                1,
                30,
                tzinfo=ZoneInfo("America/New_York"),
                fold=1,
            ),
            "Revenue": 7,
        },
    ]

    class _Command:
        def __init__(self, _query_context: Any) -> None: ...

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": rows,
                        "colnames": ["Category", "Revenue"],
                    }
                ]
            }

    query_context = SimpleNamespace(
        form_data={},
        queries=[SimpleNamespace(metrics=["Revenue"], columns=["Category"])],
    )
    user = MagicMock(id=1, username="admin", roles=[], groups=[])
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch.object(preview_module, "find_chart_by_identifier", return_value=chart),
        patch.object(preview_module.db.session, "refresh", return_value=None),
        patch.object(
            preview_module,
            "validate_chart_dataset",
            return_value=SimpleNamespace(is_valid=True, warnings=[], error=None),
        ),
        patch.object(
            preview_module.event_logger,
            "log_context",
            side_effect=lambda **_kwargs: nullcontext(),
        ),
        patch.object(
            preview_module,
            "build_query_context_from_form_data",
            return_value=query_context,
        ),
        patch.object(preview_module, "set_query_context_form_data", return_value=None),
        patch.object(command_module, "ChartDataCommand", _Command),
        patch.object(
            preview_module, "get_superset_base_url", return_value="http://localhost"
        ),
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(
                "get_chart_preview",
                {"request": {"id": 121, "format": format_}},
            )

    payload = utils_json.loads(result.content[0].text)
    if format_ == "ascii":
        content = payload["content"]["ascii_content"]
        assert "9007199254740992" in content
        assert "Infinity" in content
        assert "1788307200000" in content
        assert "1699162200000" in content
        assert "1699165800000" in content
    else:
        specification = payload["content"]["specification"]
        bar = next(
            layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
        )
        category_field = bar["encoding"]["y"]["field"]
        assert [row[category_field] for row in specification["data"]["values"]] == [
            "9007199254740992",
            "1",
            "Infinity",
            "1788307200000",
            "1788318245000",
            "1699162200000",
            "1699165800000",
        ]
        assert [row["Category"] for row in specification["data"]["values"][3:]] == [
            1788307200000.0,
            1788318245000.0,
            1699162200000.0,
            1699165800000.0,
        ]
        assert bar["encoding"]["tooltip"][0]["field"] == category_field
        assert "transform" not in specification


@pytest.mark.asyncio
@pytest.mark.parametrize("format_", ["ascii", "vega_lite"])
async def test_bullet_timestamp_categories_from_dataframe_reach_fastmcp(
    format_: str,
) -> None:
    from contextlib import nullcontext

    from fastmcp import Client

    from superset.dataframe import df_to_records
    from superset.mcp_service.app import mcp

    preview_module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    zoneinfo_tz = ZoneInfo("America/New_York")
    pytz_tz = pytz.timezone("America/New_York")
    dateutil_dublin = dateutil_tz.gettz("Europe/Dublin")
    dateutil_new_york = dateutil_tz.gettz("America/New_York")
    assert dateutil_dublin is not None
    assert dateutil_new_york is not None
    dublin_fold = datetime(
        2024,
        10,
        27,
        1,
        30,
        0,
        123456,
        tzinfo=dateutil_dublin,
        fold=1,
    )
    new_york_gap = datetime(2024, 3, 10, 2, 30, 0, 123456, tzinfo=dateutil_new_york)
    source_values = [
        pd.Timestamp("2024-01-02 03:04:05.123456789"),
        pd.Timestamp("2024-01-02 08:34:05.123456789+05:30"),
        pd.Timestamp(datetime(2024, 11, 3, 1, 30, tzinfo=zoneinfo_tz, fold=0)),
        pd.Timestamp(datetime(2024, 11, 3, 1, 30, tzinfo=zoneinfo_tz, fold=1)),
        pd.Timestamp(pytz_tz.localize(datetime(2024, 11, 3, 1, 30), is_dst=True)),
        pd.Timestamp(pytz_tz.localize(datetime(2024, 11, 3, 1, 30), is_dst=False)),
        pd.Timestamp("1969-12-31 23:59:59.999999999"),
        date(2024, 1, 2),
        pd.NaT,
        dublin_fold,
        new_york_gap,
        datetime(2040, 7, 1, 12, 0, 0, 123456, tzinfo=dateutil_new_york),
        datetime(
            2024,
            3,
            10,
            2,
            30,
            0,
            123456,
            tzinfo=dateutil_tz.tzoffset("EDT", -4 * 3600),
        ),
        datetime(2024, 3, 10, 6, 30, 0, 123456, tzinfo=timezone.utc),
        pd.Timestamp(dublin_fold),
        pd.Timestamp(new_york_gap),
    ]
    rows = df_to_records(
        pd.DataFrame(
            {
                "Category": pd.Series(source_values, dtype=object),
                "Revenue": range(1, len(source_values) + 1),
            }
        ),
        convert_big_integers=False,
    )
    if format_ == "ascii":
        # ASCII intentionally displays at most ten categories. Keep every
        # dateutil named-zone edge in this public-format invocation.
        rows = rows[9:12]
    expected = [
        "1704164645123.456",
        "1704164645123.456",
        "1730611800000",
        "1730615400000",
        "1730611800000",
        "1730615400000",
        "-0.0010000000000287557",
        "1704153600000",
        "null",
        "1729989000123.456",
        "1710052200123.456",
        "2224774800123.456",
        "1710052200123.456",
        "1710052200123.456",
        "1729989000123.456",
        "1710052200123.456",
    ]
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Category"],
    }
    chart = SimpleNamespace(
        id=122,
        slice_name="Timestamp categories",
        viz_type="bullet",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(form_data),
    )

    class _Command:
        def __init__(self, _query_context: Any) -> None: ...

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": rows,
                        "colnames": ["Category", "Revenue"],
                    }
                ]
            }

    query_context = SimpleNamespace(
        form_data={},
        queries=[SimpleNamespace(metrics=["Revenue"], columns=["Category"])],
    )
    user = MagicMock(id=1, username="admin", roles=[], groups=[])
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch.object(preview_module, "find_chart_by_identifier", return_value=chart),
        patch.object(preview_module.db.session, "refresh", return_value=None),
        patch.object(
            preview_module,
            "validate_chart_dataset",
            return_value=SimpleNamespace(is_valid=True, warnings=[], error=None),
        ),
        patch.object(
            preview_module.event_logger,
            "log_context",
            side_effect=lambda **_kwargs: nullcontext(),
        ),
        patch.object(
            preview_module,
            "build_query_context_from_form_data",
            return_value=query_context,
        ),
        patch.object(preview_module, "set_query_context_form_data", return_value=None),
        patch.object(command_module, "ChartDataCommand", _Command),
        patch.object(
            preview_module, "get_superset_base_url", return_value="http://localhost"
        ),
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(
                "get_chart_preview",
                {"request": {"id": 122, "format": format_}},
            )

    payload = utils_json.loads(result.content[0].text)
    if format_ == "ascii":
        content = payload["content"]["ascii_content"]
        for category in set(expected[9:12]):
            assert category[:20] in content
    else:
        specification = payload["content"]["specification"]
        bar = next(
            layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
        )
        category_field = bar["encoding"]["y"]["field"]
        assert [row[category_field] for row in specification["data"]["values"]] == (
            expected
        )
        assert bar["encoding"]["tooltip"][0]["field"] == category_field
        assert [row["Category"] for row in specification["data"]["values"]] == [
            1704164645123.456,
            1704164645123.456,
            1730611800000.0,
            1730615400000.0,
            1730611800000.0,
            1730615400000.0,
            -0.0010000000000287557,
            1704153600000.0,
            None,
            1729989000123.456,
            1710052200123.456,
            2224774800123.456,
            1710052200123.456,
            1710052200123.456,
            1729989000123.456,
            1710052200123.456,
        ]


@pytest.mark.asyncio
async def test_transitionless_dateutil_dataframe_reaches_fastmcp_preview() -> None:
    from contextlib import nullcontext

    from fastmcp import Client

    from superset.commands.chart.data.get_data_command import (
        ChartDataCommand as ProducerChartDataCommand,
    )
    from superset.common.chart_data import ChartDataResultType
    from superset.dataframe import df_to_records
    from superset.mcp_service.app import mcp
    from superset.mcp_service.chart.preview_utils import _javascript_number_string
    from superset.utils.json import json_int_dttm_ser

    preview_module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    names = [
        "UTC",
        "GMT",
        "Universal",
        "Zulu",
        "EST",
        "HST",
        "MST",
        "Etc/GMT+1",
        "Etc/GMT-2",
    ]
    values = []
    for getter in (dateutil_tz.gettz, get_zonefile_instance().get):
        for name in names:
            timezone_value = getter(name)
            assert timezone_value is not None
            values.append(
                datetime(2040, 7, 1, 12, 34, 56, 123456, tzinfo=timezone_value)
            )
    rows = df_to_records(
        pd.DataFrame(
            {
                "Category": pd.Series(values, dtype=object),
                "Revenue": range(1, len(values) + 1),
            }
        ),
        convert_big_integers=False,
    )

    class _ProducerContext:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": rows,
                        "colnames": ["Category", "Revenue"],
                        "rowcount": len(rows),
                    }
                ]
            }

    producer_result = ProducerChartDataCommand(
        _ProducerContext()  # type: ignore[arg-type]
    ).run()
    expected_numbers = [json_int_dttm_ser(value) for value in values]
    expected_categories = [
        _javascript_number_string(float(value)) for value in expected_numbers
    ]
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Category"],
    }
    chart = SimpleNamespace(
        id=123,
        slice_name="Transitionless timestamps",
        viz_type="bullet",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(form_data),
    )

    class _Command:
        def __init__(self, _query_context: Any) -> None: ...

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return producer_result

    query_context = SimpleNamespace(
        form_data={},
        queries=[SimpleNamespace(metrics=["Revenue"], columns=["Category"])],
    )
    user = MagicMock(id=1, username="admin", roles=[], groups=[])
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch.object(preview_module, "find_chart_by_identifier", return_value=chart),
        patch.object(preview_module.db.session, "refresh", return_value=None),
        patch.object(
            preview_module,
            "validate_chart_dataset",
            return_value=SimpleNamespace(is_valid=True, warnings=[], error=None),
        ),
        patch.object(
            preview_module.event_logger,
            "log_context",
            side_effect=lambda **_kwargs: nullcontext(),
        ),
        patch.object(
            preview_module,
            "build_query_context_from_form_data",
            return_value=query_context,
        ),
        patch.object(preview_module, "set_query_context_form_data", return_value=None),
        patch.object(command_module, "ChartDataCommand", _Command),
        patch.object(
            preview_module, "get_superset_base_url", return_value="http://localhost"
        ),
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(
                "get_chart_preview",
                {"request": {"id": 123, "format": "vega_lite"}},
            )

    payload = utils_json.loads(result.content[0].text)
    specification = payload["content"]["specification"]
    bar = next(
        layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
    )
    category_field = bar["encoding"]["y"]["field"]
    assert [row["Category"] for row in specification["data"]["values"]] == (
        expected_numbers
    )
    assert [row[category_field] for row in specification["data"]["values"]] == (
        expected_categories
    )
    assert bar["encoding"]["tooltip"][0]["field"] == category_field


@pytest.mark.asyncio
@pytest.mark.parametrize("format_", ["ascii", "vega_lite"])
async def test_duration_dataframe_reaches_fastmcp_bullet_preview(
    format_: str,
) -> None:
    from contextlib import nullcontext

    import numpy as np
    from fastmcp import Client

    from superset.commands.chart.data.get_data_command import (
        ChartDataCommand as ProducerChartDataCommand,
    )
    from superset.common.chart_data import ChartDataResultType
    from superset.dataframe import df_to_records
    from superset.mcp_service.app import mcp

    preview_module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    source_values = [
        timedelta(0),
        timedelta(days=1, seconds=2, microseconds=3),
        pd.Timedelta(-1, unit="ns"),
        np.timedelta64(123456789, "ns"),
        np.timedelta64("NaT"),
    ]
    rows = df_to_records(
        pd.DataFrame(
            {
                "Duration": pd.Series(source_values, dtype=object),
                "Revenue": [50, 120, 350, 0, 200],
            }
        ),
        convert_big_integers=False,
    )
    assert type(rows[3]["Duration"]) is pd.Timedelta
    assert rows[4]["Duration"] is None
    expected = [
        "null"
        if row["Duration"] is None
        else utils_json.loads(
            utils_json.dumps(row["Duration"], default=utils_json.json_int_dttm_ser)
        )
        for row in rows
    ]

    class _ProducerContext:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": rows,
                        "colnames": ["Duration", "Revenue"],
                        "rowcount": len(rows),
                    }
                ]
            }

    producer_result = ProducerChartDataCommand(
        _ProducerContext()  # type: ignore[arg-type]
    ).run()
    form_data = {
        "viz_type": "bullet",
        "metric": "Revenue",
        "groupby": ["Duration"],
        "ranges": "100,200,300",
        "range_labels": "Low,Mid,High",
    }
    chart = SimpleNamespace(
        id=124,
        slice_name="Duration categories",
        viz_type="bullet",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(form_data),
    )

    class _Command:
        def __init__(self, _query_context: Any) -> None: ...

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return producer_result

    query_context = SimpleNamespace(
        form_data={},
        queries=[SimpleNamespace(metrics=["Revenue"], columns=["Duration"])],
    )
    user = MagicMock(id=1, username="admin", roles=[], groups=[])
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch.object(preview_module, "find_chart_by_identifier", return_value=chart),
        patch.object(preview_module.db.session, "refresh", return_value=None),
        patch.object(
            preview_module,
            "validate_chart_dataset",
            return_value=SimpleNamespace(is_valid=True, warnings=[], error=None),
        ),
        patch.object(
            preview_module.event_logger,
            "log_context",
            side_effect=lambda **_kwargs: nullcontext(),
        ),
        patch.object(
            preview_module,
            "build_query_context_from_form_data",
            return_value=query_context,
        ),
        patch.object(preview_module, "set_query_context_form_data", return_value=None),
        patch.object(command_module, "ChartDataCommand", _Command),
        patch.object(
            preview_module, "get_superset_base_url", return_value="http://localhost"
        ),
    ):
        async with Client(mcp) as client:
            result = await client.call_tool(
                "get_chart_preview",
                {"request": {"id": 124, "format": format_}},
            )

    payload = utils_json.loads(result.content[0].text)
    if format_ == "ascii":
        for category in expected:
            assert category[:20] in payload["content"]["ascii_content"]
    else:
        specification = payload["content"]["specification"]
        bar = next(
            layer for layer in specification["layer"] if layer["mark"]["type"] == "bar"
        )
        category_field = bar["encoding"]["y"]["field"]
        range_tooltip = next(
            item for item in bar["encoding"]["tooltip"] if item.get("title") == "Range"
        )
        assert [row[category_field] for row in specification["data"]["values"]] == (
            expected
        )
        assert [
            row[range_tooltip["field"]] for row in specification["data"]["values"]
        ] == ["Low", "Mid", "> High", "Low", "Mid"]
        range_layers = [
            layer for layer in specification["layer"] if layer["mark"]["type"] == "rect"
        ]
        assert range_layers
        assert all(
            layer["encoding"]["y"] == bar["encoding"]["y"] for layer in range_layers
        )


def test_ascii_preview_accepts_real_postprocessing_null_and_large_full_sql(
    monkeypatch: pytest.MonkeyPatch, app_context: None
) -> None:
    """Preview consumes a real producer envelope whose SQL exceeds 64 KiB."""
    from tests.unit_tests.mcp_service.chart.query_result_test_utils import (
        real_compare_command_result,
    )

    preview_module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    sql = "SELECT 'café' -- " + "x" * (70 * 1024)

    class _Command:
        def __init__(self, _query_context: Any) -> None: ...
        def validate(self) -> None: ...
        def run(self) -> dict[str, Any]:
            return real_compare_command_result(sql)

    monkeypatch.setattr(
        preview_module,
        "build_query_context_from_form_data",
        lambda *_args, **_kwargs: SimpleNamespace(
            queries=[SimpleNamespace(metrics=["source"], columns=[])]
        ),
    )
    monkeypatch.setattr(command_module, "ChartDataCommand", _Command)
    monkeypatch.setattr(
        preview_module,
        "set_query_context_form_data",
        lambda *_args, **_kwargs: None,
    )
    chart = SimpleNamespace(
        id=104,
        slice_name="Comparison",
        viz_type="table",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps({"viz_type": "table", "metrics": ["source"]}),
    )

    preview = ASCIIPreviewStrategy(
        chart, GetChartPreviewRequest(identifier=104, format="ascii")
    ).generate()

    assert isinstance(preview, ASCIIPreview)
    assert "2.5" in preview.ascii_content
    assert "None" in preview.ascii_content


def test_saved_timeseries_preview_executes_final_frontend_query_contract(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from superset.common.query_object import QueryObject

    query_context_factory_module = importlib.import_module(
        "superset.common.query_context_factory"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    captured: dict[str, Any] = {}

    class _Factory:
        def create(self, **kwargs: Any) -> Any:
            captured.update(kwargs)
            return SimpleNamespace(
                form_data=kwargs["form_data"],
                queries=[QueryObject(**query) for query in kwargs["queries"]],
            )

    class _Command:
        def __init__(self, query_context: Any) -> None:
            self.query_context = query_context

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": [{"event_time": "2024-01-01", "revenue": 1}],
                        "colnames": ["event_time", "revenue"],
                    }
                ]
            }

    monkeypatch.setattr(query_context_factory_module, "QueryContextFactory", _Factory)
    monkeypatch.setattr(command_module, "ChartDataCommand", _Command)
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    chart = SimpleNamespace(
        id=105,
        slice_name="Ungrouped Timeseries",
        viz_type="echarts_timeseries_bar",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(
            {
                "viz_type": "echarts_timeseries_bar",
                "x_axis": "event_time",
                "groupby": [],
                "metrics": ["revenue"],
                "timeseries_limit_metric": "ranking",
                "x_axis_sort": "ranking",
                "x_axis_sort_asc": True,
                "contributionMode": "row",
            }
        ),
    )

    preview = ASCIIPreviewStrategy(
        chart, GetChartPreviewRequest(identifier=105, format="ascii")
    ).generate()

    assert isinstance(preview, ASCIIPreview)
    query = captured["queries"][0]
    assert query["series_columns"] == []
    assert query["metrics"] == ["revenue", "ranking"]
    assert query["series_limit_metric"] == "ranking"
    assert query["post_processing"][0]["options"]["columns"] == []
    assert [item["operation"] for item in query["post_processing"]] == [
        "pivot",
        "contribution",
        "sort",
        "flatten",
    ]


def test_saved_big_number_preview_executes_timestamp_pivot_without_series(
    monkeypatch: pytest.MonkeyPatch,
    app_context: None,
) -> None:
    from superset.common.query_object import QueryObject

    query_context_factory_module = importlib.import_module(
        "superset.common.query_context_factory"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    captured: dict[str, Any] = {}

    class _Factory:
        def create(self, **kwargs: Any) -> Any:
            captured.update(kwargs)
            return SimpleNamespace(
                form_data=kwargs["form_data"],
                queries=[QueryObject(**query) for query in kwargs["queries"]],
            )

    class _Command:
        def __init__(self, query_context: Any) -> None:
            self.query_context = query_context

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            query = self.query_context.queries[0]
            processed = query.exec_post_processing(
                pd.DataFrame(
                    {
                        "event_time": pd.Series(
                            [
                                datetime(
                                    2024,
                                    1,
                                    1,
                                    tzinfo=dateutil_tz.gettz("US/Pacific"),
                                ),
                                datetime(
                                    2024,
                                    2,
                                    1,
                                    tzinfo=dateutil_tz.gettz("US/Pacific"),
                                ),
                            ],
                            dtype=object,
                        ),
                        "saved_revenue": [1.0, 2.0],
                    }
                )
            )
            assert list(processed.columns) == ["event_time", "saved_revenue"]
            records = processed.to_dict("records")
            records[0]["numeric_missing"] = float("nan")
            result = {
                "queries": [
                    {
                        "data": records,
                        "colnames": ["event_time", "saved_revenue"],
                    }
                ]
            }
            captured["result"] = result
            return result

    monkeypatch.setattr(query_context_factory_module, "QueryContextFactory", _Factory)
    monkeypatch.setattr(command_module, "ChartDataCommand", _Command)
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    chart = SimpleNamespace(
        id=106,
        slice_name="Revenue trend",
        viz_type="big_number",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(
            {
                "viz_type": "big_number",
                "metric": "saved_revenue",
                "x_axis": "event_time",
                "granularity_sqla": "event_time",
                "time_grain_sqla": "P1M",
            }
        ),
    )

    preview = ASCIIPreviewStrategy(
        chart, GetChartPreviewRequest(identifier=106, format="ascii")
    ).generate()

    assert isinstance(preview, ASCIIPreview)
    assert all(
        type(row["event_time"]) is str
        for row in captured["result"]["queries"][0]["data"]
    )
    assert captured["result"]["queries"][0]["data"][0]["numeric_missing"] is None
    query = captured["queries"][0]
    assert query["columns"] == [
        {
            "timeGrain": "P1M",
            "columnType": "BASE_AXIS",
            "sqlExpression": "event_time",
            "label": "event_time",
            "expressionType": "SQL",
            "isColumnReference": True,
        }
    ]
    assert query["series_columns"] == []
    assert "is_timeseries" not in query
    assert query["post_processing"][0]["options"] == {
        "index": ["event_time"],
        "columns": [],
        "aggregates": {"saved_revenue": {"operator": "mean"}},
        "drop_missing_columns": True,
    }


def test_saved_deck_geojson_preview_uses_layer_query_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from superset.common.query_object import QueryObject

    query_context_factory_module = importlib.import_module(
        "superset.common.query_context_factory"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    captured: dict[str, Any] = {}

    class _Factory:
        def create(self, **kwargs: Any) -> Any:
            captured.update(kwargs)
            return SimpleNamespace(
                form_data=kwargs["form_data"],
                queries=[QueryObject(**query) for query in kwargs["queries"]],
            )

    class _Command:
        def __init__(self, query_context: Any) -> None:
            self.query_context = query_context

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": [
                            {
                                "geom": '{"type":"Point","coordinates":[0,0]}',
                                "region": "North",
                                "name": "HQ",
                            }
                        ],
                        "colnames": ["geom", "region", "name"],
                    }
                ]
            }

    monkeypatch.setattr(query_context_factory_module, "QueryContextFactory", _Factory)
    monkeypatch.setattr(command_module, "ChartDataCommand", _Command)
    monkeypatch.setattr(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        lambda *_args: "base",
    )
    chart = SimpleNamespace(
        id=107,
        slice_name="Regions",
        viz_type="deck_geojson",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(
            {
                "viz_type": "deck_geojson",
                "geojson": "geom",
                "cross_filter_column": "region",
                "tooltip_contents": ["name"],
            }
        ),
    )

    preview = TablePreviewStrategy(
        chart, GetChartPreviewRequest(identifier=107, format="table")
    ).generate()

    assert isinstance(preview, TablePreview)
    query = captured["queries"][0]
    assert query["columns"] == ["geom", "region", "name"]
    assert query["metrics"] == []
    assert query["groupby"] == []
    assert query["filters"] == [{"col": "geom", "op": "IS NOT NULL"}]
    assert query["is_timeseries"] is False


@pytest.mark.parametrize("strategy_name", ["ascii", "table", "vega_lite"])
def test_saved_preview_paths_seed_virtual_dataset_jinja_before_run(
    monkeypatch: pytest.MonkeyPatch,
    strategy_name: str,
) -> None:
    from flask import current_app

    from superset.common.query_object import QueryObject
    from superset.jinja_context import ExtraCache

    module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    query_context = SimpleNamespace(
        queries=[
            QueryObject(
                columns=["region"],
                filters=[{"col": "region", "op": "IN", "val": ["North"]}],
            )
        ],
        form_data={"url_params": {"tenant": "acme"}},
    )
    observed: dict[str, Any] = {}

    class _Command:
        def __init__(self, context: Any) -> None:
            assert context is query_context

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            macros = ExtraCache()
            observed["url_param"] = macros.url_param("tenant")
            observed["filter_values"] = macros.filter_values("region")
            observed["get_filters"] = macros.get_filters("region")
            return {
                "queries": [{"data": [{"region": "North"}], "colnames": ["region"]}]
            }

    monkeypatch.setattr(
        module, "build_query_context_from_form_data", lambda *_a, **_k: query_context
    )
    monkeypatch.setattr(command_module, "ChartDataCommand", _Command)
    chart = SimpleNamespace(
        id=42,
        slice_name="Virtual dataset chart",
        viz_type="table",
        datasource_id=7,
        datasource_type="table",
        params=utils_json.dumps({"viz_type": "table", "groupby": ["region"]}),
    )
    request = GetChartPreviewRequest(identifier=42, format=strategy_name)
    strategy_class = {
        "ascii": module.ASCIIPreviewStrategy,
        "table": module.TablePreviewStrategy,
        "vega_lite": module.VegaLitePreviewStrategy,
    }[strategy_name]

    with current_app.test_request_context():
        strategy_class(chart, request).generate()

    assert observed == {
        "url_param": "acme",
        "filter_values": ["North"],
        "get_filters": [{"col": "region", "op": "IN", "val": ["North"]}],
    }


class TestPreviewXAxisInQueryContext:
    """Tests for x_axis inclusion in preview query context columns.

    When generating chart previews (table, vega_lite), the query context must
    include both x_axis and groupby columns. Previously only groupby was used,
    causing series charts with group_by to lose the x_axis dimension.
    """

    def test_table_preview_includes_x_axis_and_groupby(self):
        """Test that table preview builds columns with both x_axis and groupby."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["territory", "year"]

    def test_vega_lite_preview_includes_x_axis_and_groupby(self):
        """Test that vega_lite preview builds columns with both x_axis and groupby."""
        form_data = {
            "x_axis": "platform",
            "groupby": ["genre"],
            "metrics": [{"label": "SUM(global_sales)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["platform", "genre"]

    def test_preview_x_axis_dict_format(self):
        """Test preview column building with x_axis as dict."""
        form_data = {
            "x_axis": {"column_name": "order_date"},
            "groupby": ["region"],
            "metrics": [{"label": "SUM(revenue)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)
        elif x_axis_config and isinstance(x_axis_config, dict):
            col_name = x_axis_config.get("column_name")
            if col_name and col_name not in columns:
                columns.insert(0, col_name)

        assert columns == ["order_date", "region"]

    def test_preview_no_groupby_x_axis_only(self):
        """Test preview with x_axis but no groupby."""
        form_data = {
            "x_axis": "date",
            "metrics": [{"label": "SUM(sales)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["date"]

    def test_preview_no_x_axis_groupby_only(self):
        """Test preview with groupby but no x_axis (e.g., table chart)."""
        form_data = {
            "groupby": ["category", "region"],
            "metrics": [{"label": "COUNT(*)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["category", "region"]

    def test_preview_x_axis_not_duplicated(self):
        """Test x_axis isn't duplicated if already in groupby."""
        form_data = {
            "x_axis": "territory",
            "groupby": ["territory", "year"],
            "metrics": [{"label": "SUM(sales)"}],
        }

        x_axis_config = form_data.get("x_axis")
        groupby_columns = form_data.get("groupby", [])
        columns = groupby_columns.copy()
        if x_axis_config and isinstance(x_axis_config, str):
            if x_axis_config not in columns:
                columns.insert(0, x_axis_config)

        assert columns == ["territory", "year"]


class TestGetChartPreview:
    """Tests for get_chart_preview MCP tool."""

    @pytest.mark.asyncio
    async def test_get_chart_preview_request_structure(self):
        """Test that preview request structures are properly formed."""
        # Numeric ID request
        request1 = GetChartPreviewRequest(identifier=123, format="url")
        assert request1.identifier == 123
        assert request1.format == "url"
        # Default dimensions are set
        assert request1.width == 800
        assert request1.height == 600

        # String ID request
        request2 = GetChartPreviewRequest(identifier="456", format="ascii")
        assert request2.identifier == "456"
        assert request2.format == "ascii"

        # UUID request
        request3 = GetChartPreviewRequest(
            identifier="a1b2c3d4-e5f6-7890-abcd-ef1234567890", format="table"
        )
        assert request3.identifier == "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        assert request3.format == "table"

        # Default format
        request4 = GetChartPreviewRequest(identifier=789)
        assert request4.format == "ascii"  # default

    @pytest.mark.asyncio
    async def test_preview_format_types(self):
        """Test different preview format types."""
        formats = ["url", "ascii", "table"]
        for fmt in formats:
            request = GetChartPreviewRequest(identifier=1, format=fmt)
            assert request.format == fmt

    @pytest.mark.asyncio
    async def test_url_preview_structure(self):
        """Test URLPreview response structure."""
        preview = URLPreview(
            preview_url="http://example.com/explore/?slice_id=123",
            width=800,
            height=600,
        )
        assert preview.type == "url"
        assert preview.preview_url == "http://example.com/explore/?slice_id=123"
        assert preview.width == 800
        assert preview.height == 600
        assert preview.supports_interaction is True

    @pytest.mark.asyncio
    async def test_ascii_preview_structure(self):
        """Test ASCIIPreview response structure."""
        ascii_art = """
┌─────────────────────────┐
│    Sales by Region      │
├─────────────────────────┤
│ North  ████████ 45%     │
│ South  ██████   30%     │
│ East   ████     20%     │
│ West   ██       5%      │
└─────────────────────────┘
"""
        preview = ASCIIPreview(
            ascii_content=ascii_art.strip(),
            width=25,
            height=8,
        )
        assert preview.type == "ascii"
        assert "Sales by Region" in preview.ascii_content
        assert preview.width == 25
        assert preview.height == 8

    @pytest.mark.asyncio
    async def test_table_preview_structure(self):
        """Test TablePreview response structure."""
        table_content = """
| Region | Sales  | Profit |
|--------|--------|--------|
| North  | 45000  | 12000  |
| South  | 30000  | 8000   |
| East   | 20000  | 5000   |
| West   | 5000   | 1000   |
"""
        preview = TablePreview(
            table_data=table_content.strip(),
            row_count=4,
            supports_sorting=True,
        )
        assert preview.type == "table"
        assert "Region" in preview.table_data
        assert "North" in preview.table_data
        assert preview.row_count == 4
        assert preview.supports_sorting is True

    @pytest.mark.asyncio
    async def test_chart_preview_response_structure(self):
        """Test the expected response structure for chart preview."""
        # Core fields that should always be present
        _ = [
            "chart_id",
            "chart_name",
            "chart_type",
            "explore_url",
            "content",  # Union of URLPreview | ASCIIPreview | TablePreview
            "chart_description",
            "accessibility",
            "performance",
        ]

        # Versioning fields
        _ = [
            "schema_version",
            "api_version",
        ]

        # This is a structural test - actual integration tests would verify
        # the tool returns data matching this structure

    def test_table_preview_converts_saved_adhoc_filters_to_query_filters(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Saved chart adhoc filters should constrain table previews."""
        query_context_factory_module = importlib.import_module(
            "superset.common.query_context_factory"
        )
        get_data_command_module = importlib.import_module(
            "superset.commands.chart.data.get_data_command"
        )

        captured_query_contexts: list[dict[str, Any]] = []

        class QueryContextFactory:
            def create(self, **kwargs: Any) -> object:
                captured_query_contexts.append(kwargs)
                return _query_context_stub(kwargs.get("form_data"))

        class ChartDataCommand:
            def __init__(self, query_context: object) -> None:
                self.query_context = query_context

            def validate(self) -> None:
                pass

            def run(self) -> dict[str, Any]:
                return {
                    "queries": [
                        {
                            "data": [
                                {
                                    "event_time": pd.Timestamp(
                                        "2024-01-01T00:00:00"
                                    ).tz_localize(
                                        dateutil_tz.tzoffset("east", 5 * 3600 + 30 * 60)
                                    ),
                                    "gender": "boy",
                                    "count": 1,
                                }
                            ],
                            "colnames": ["event_time", "gender", "count"],
                            "rowcount": 1,
                        }
                    ]
                }

        monkeypatch.setattr(
            query_context_factory_module,
            "QueryContextFactory",
            QueryContextFactory,
        )
        monkeypatch.setattr(
            get_data_command_module, "ChartDataCommand", ChartDataCommand
        )

        adhoc_filter = {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": "gender",
            "operator": "==",
            "comparator": "boy",
        }
        chart = SimpleNamespace(
            id=0,
            slice_name="Unsaved Chart Preview",
            viz_type="table",
            datasource_id=1,
            datasource_type="table",
            params=utils_json.dumps(
                {
                    "viz_type": "table",
                    "groupby": ["gender"],
                    "metrics": ["count"],
                    "adhoc_filters": [adhoc_filter],
                }
            ),
        )

        preview = TablePreviewStrategy(
            chart,
            GetChartPreviewRequest(identifier=1, format="table"),
        ).generate()

        assert isinstance(preview, TablePreview)
        query = captured_query_contexts[0]["queries"][0]
        assert query["filters"] == [{"col": "gender", "op": "==", "val": "boy"}]
        assert "adhoc_filters" not in query

    def test_table_preview_uses_singular_metric(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Preview query construction should handle charts without metrics[]."""
        query_context_factory_module = importlib.import_module(
            "superset.common.query_context_factory"
        )
        get_data_command_module = importlib.import_module(
            "superset.commands.chart.data.get_data_command"
        )

        captured_query_contexts: list[dict[str, Any]] = []

        class QueryContextFactory:
            def create(self, **kwargs: Any) -> object:
                captured_query_contexts.append(kwargs)
                return _query_context_stub(kwargs.get("form_data"))

        class ChartDataCommand:
            def __init__(self, query_context: object) -> None:
                self.query_context = query_context

            def validate(self) -> None:
                pass

            def run(self) -> dict[str, Any]:
                return {
                    "queries": [
                        {
                            "data": [{"count": 10}],
                            "colnames": ["count"],
                            "rowcount": 1,
                        }
                    ]
                }

        monkeypatch.setattr(
            query_context_factory_module,
            "QueryContextFactory",
            QueryContextFactory,
        )
        monkeypatch.setattr(
            get_data_command_module, "ChartDataCommand", ChartDataCommand
        )

        metric = {"label": "count", "expressionType": "SIMPLE"}
        chart = SimpleNamespace(
            id=0,
            slice_name="Big Number Preview",
            viz_type="big_number",
            datasource_id=1,
            datasource_type="table",
            params=utils_json.dumps(
                {
                    "viz_type": "big_number",
                    "metric": metric,
                }
            ),
        )

        preview = TablePreviewStrategy(
            chart,
            GetChartPreviewRequest(identifier=1, format="table"),
        ).generate()

        assert isinstance(preview, TablePreview)
        query = captured_query_contexts[0]["queries"][0]
        assert query["columns"] == []
        assert query["metrics"] == [metric]

    def test_ascii_preview_uses_shared_query_builder(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """ASCII preview should use chart-type-aware query construction."""
        query_context_factory_module = importlib.import_module(
            "superset.common.query_context_factory"
        )
        get_data_command_module = importlib.import_module(
            "superset.commands.chart.data.get_data_command"
        )

        captured_query_contexts: list[dict[str, Any]] = []

        class QueryContextFactory:
            def create(self, **kwargs: Any) -> object:
                captured_query_contexts.append(kwargs)
                return _query_context_stub(kwargs.get("form_data"))

        class ChartDataCommand:
            def __init__(self, query_context: object) -> None:
                self.query_context = query_context

            def validate(self) -> None:
                pass

            def run(self) -> dict[str, Any]:
                return {
                    "queries": [
                        {
                            "data": [{"count": 10}],
                            "colnames": ["count"],
                            "rowcount": 1,
                        }
                    ]
                }

        monkeypatch.setattr(
            query_context_factory_module,
            "QueryContextFactory",
            QueryContextFactory,
        )
        monkeypatch.setattr(
            get_data_command_module, "ChartDataCommand", ChartDataCommand
        )

        metric = {"label": "count", "expressionType": "SIMPLE"}
        chart = SimpleNamespace(
            id=0,
            slice_name="Big Number Preview",
            viz_type="big_number",
            datasource_id=1,
            datasource_type="table",
            params=utils_json.dumps(
                {
                    "viz_type": "big_number",
                    "metric": metric,
                }
            ),
        )

        preview = ASCIIPreviewStrategy(
            chart,
            GetChartPreviewRequest(identifier=1, format="ascii"),
        ).generate()

        assert isinstance(preview, ASCIIPreview)
        query = captured_query_contexts[0]["queries"][0]
        assert query["columns"] == []
        assert query["metrics"] == [metric]
        assert query["row_limit"] == 50

    def test_ascii_preview_ignores_populated_query_after_empty_first_query(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Preview validation must match the first query result it renders."""
        query_context_factory_module = importlib.import_module(
            "superset.common.query_context_factory"
        )
        get_data_command_module = importlib.import_module(
            "superset.commands.chart.data.get_data_command"
        )

        class QueryContextFactory:
            def create(self, **kwargs: Any) -> object:
                queries = [
                    SimpleNamespace(metrics=q.get("metrics"), columns=q.get("columns"))
                    for q in kwargs["queries"]
                ]
                queries.append(SimpleNamespace(metrics=["secondary"], columns=[]))
                return SimpleNamespace(queries=queries)

        command_calls: list[str] = []

        class ChartDataCommand:
            def __init__(self, query_context: object) -> None:
                self.query_context = query_context

            def validate(self) -> None:
                command_calls.append("validate")

            def run(self) -> dict[str, Any]:
                command_calls.append("run")
                raise AssertionError("ChartDataCommand.run() should not be called")

        monkeypatch.setattr(
            query_context_factory_module,
            "QueryContextFactory",
            QueryContextFactory,
        )
        monkeypatch.setattr(
            get_data_command_module, "ChartDataCommand", ChartDataCommand
        )

        chart = SimpleNamespace(
            id=96,
            slice_name="Big Number Preview",
            viz_type="big_number",
            datasource_id=1,
            datasource_type="table",
            params=utils_json.dumps({"viz_type": "big_number"}),
        )

        preview = ASCIIPreviewStrategy(
            chart,
            GetChartPreviewRequest(identifier=96, format="ascii"),
        ).generate()

        assert isinstance(preview, ChartError)
        assert preview.error_type == "NoQueryFields"
        assert "no metrics or columns" in preview.error
        assert command_calls == []

    def test_ascii_preview_rejects_none_data_as_malformed_envelope(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """An explicit ``data=None`` must return a structured envelope error."""
        query_context_factory_module = importlib.import_module(
            "superset.common.query_context_factory"
        )
        get_data_command_module = importlib.import_module(
            "superset.commands.chart.data.get_data_command"
        )

        class QueryContextFactory:
            def create(self, **kwargs: Any) -> object:
                return _query_context_stub(kwargs.get("form_data"))

        class ChartDataCommand:
            def __init__(self, query_context: object) -> None:
                self.query_context = query_context

            def validate(self) -> None:
                pass

            def run(self) -> dict[str, Any]:
                return {"queries": [{"data": None, "colnames": [], "rowcount": 0}]}

        monkeypatch.setattr(
            query_context_factory_module,
            "QueryContextFactory",
            QueryContextFactory,
        )
        monkeypatch.setattr(
            get_data_command_module, "ChartDataCommand", ChartDataCommand
        )

        chart = SimpleNamespace(
            id=103,
            slice_name="Line Chart Preview",
            viz_type="echarts_timeseries_line",
            datasource_id=1,
            datasource_type="table",
            params=utils_json.dumps(
                {
                    "viz_type": "echarts_timeseries_line",
                    "metrics": ["count"],
                    "x_axis": "date",
                }
            ),
        )

        preview = ASCIIPreviewStrategy(
            chart,
            GetChartPreviewRequest(identifier=103, format="ascii"),
        ).generate()

        assert isinstance(preview, ChartError)
        assert preview.error_type == "MalformedQueryResult"
        assert "data must be an array" in preview.error

    @pytest.mark.asyncio
    async def test_form_data_key_overrides_saved_params_for_table_preview(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """form_data_key should drive table preview query construction."""
        from contextlib import nullcontext

        get_chart_preview_module = importlib.import_module(
            "superset.mcp_service.chart.tool.get_chart_preview"
        )
        query_context_factory_module = importlib.import_module(
            "superset.common.query_context_factory"
        )
        get_data_command_module = importlib.import_module(
            "superset.commands.chart.data.get_data_command"
        )
        get_form_data_module = importlib.import_module(
            "superset.commands.explore.form_data.get"
        )

        class AsyncContext:
            async def debug(self, *args: Any, **kwargs: Any) -> None:
                pass

            async def error(self, *args: Any, **kwargs: Any) -> None:
                pass

            async def info(self, *args: Any, **kwargs: Any) -> None:
                pass

            async def report_progress(self, *args: Any, **kwargs: Any) -> None:
                pass

            async def warning(self, *args: Any, **kwargs: Any) -> None:
                pass

        captured_query_contexts: list[dict[str, Any]] = []

        class QueryContextFactory:
            def create(self, **kwargs: Any) -> object:
                captured_query_contexts.append(kwargs)
                return _query_context_stub(kwargs.get("form_data"))

        class ChartDataCommand:
            def __init__(self, query_context: object) -> None:
                self.query_context = query_context

            def validate(self) -> None:
                pass

            def run(self) -> dict[str, Any]:
                return {
                    "queries": [
                        {
                            "data": [
                                {
                                    "event_time": pd.Timestamp(
                                        "2024-01-01T00:00:00"
                                    ).tz_localize(
                                        dateutil_tz.tzoffset("east", 5 * 3600 + 30 * 60)
                                    ),
                                    "gender": "boy",
                                    "count": 1,
                                }
                            ],
                            "colnames": ["event_time", "gender", "count"],
                            "rowcount": 1,
                        }
                    ]
                }

        saved_filter = {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": "gender",
            "operator": "==",
            "comparator": "girl",
        }
        cached_filter = {
            "clause": "WHERE",
            "expressionType": "SIMPLE",
            "subject": "gender",
            "operator": "==",
            "comparator": "boy",
        }
        chart = SimpleNamespace(
            id=42,
            slice_name="Saved Chart Preview",
            viz_type="table",
            datasource_id=1,
            datasource_type="table",
            params=utils_json.dumps(
                {
                    "viz_type": "table",
                    "groupby": ["gender"],
                    "metrics": ["count"],
                    "adhoc_filters": [saved_filter],
                }
            ),
        )

        monkeypatch.setattr(
            get_chart_preview_module,
            "find_chart_by_identifier",
            lambda identifier: chart,
        )
        monkeypatch.setattr(
            get_chart_preview_module,
            "validate_chart_dataset",
            lambda *args, **kwargs: SimpleNamespace(
                is_valid=True,
                warnings=[],
                error=None,
            ),
        )
        monkeypatch.setattr(
            get_chart_preview_module.db.session,
            "refresh",
            lambda chart: None,
        )
        monkeypatch.setattr(
            get_chart_preview_module.event_logger,
            "log_context",
            lambda **kwargs: nullcontext(),
        )
        monkeypatch.setattr(
            query_context_factory_module,
            "QueryContextFactory",
            QueryContextFactory,
        )
        monkeypatch.setattr(
            get_data_command_module,
            "ChartDataCommand",
            ChartDataCommand,
        )
        monkeypatch.setattr(
            get_form_data_module.GetFormDataCommand,
            "__init__",
            lambda self, cmd_params: None,
        )
        monkeypatch.setattr(
            get_form_data_module.GetFormDataCommand,
            "run",
            lambda self: utils_json.dumps(
                {
                    "viz_type": "table",
                    "groupby": ["gender"],
                    "metrics": ["count"],
                    "adhoc_filters": [cached_filter],
                }
            ),
        )

        result = await get_chart_preview_module._get_chart_preview_internal(
            GetChartPreviewRequest(
                identifier=42,
                form_data_key="cached-key",
                format="table",
            ),
            AsyncContext(),
        )

        assert isinstance(result, ChartPreview)
        assert isinstance(result.content, TablePreview)
        assert "2024-01-01T00:00:00+05:30" in result.content.table_data
        query = captured_query_contexts[0]["queries"][0]
        assert query["filters"] == [{"col": "gender", "op": "==", "val": "boy"}]

    @pytest.mark.asyncio
    async def test_preview_dimensions(self):
        """Test preview dimensions in response."""
        # Standard dimensions that may appear in preview responses
        standard_sizes = [
            (800, 600),  # Default
            (1200, 800),  # Large
            (400, 300),  # Small
            (1920, 1080),  # Full HD
        ]

        for width, height in standard_sizes:
            # URL preview with dimensions
            url_preview = URLPreview(
                preview_url="http://example.com/explore/?slice_id=123",
                width=width,
                height=height,
            )
            assert url_preview.width == width
            assert url_preview.height == height

    @pytest.mark.asyncio
    async def test_error_response_structures(self):
        """Test error response structures."""
        # Error responses typically follow this structure
        error_response = {
            "error_type": "not_found",
            "message": "Chart not found",
            "details": "No chart found with ID 999",
            "chart_id": 999,
        }
        assert error_response["error_type"] == "not_found"
        assert error_response["chart_id"] == 999

        # Preview generation error structure
        preview_error = {
            "error_type": "preview_error",
            "message": "Failed to generate preview",
            "details": "Screenshot service unavailable",
        }
        assert preview_error["error_type"] == "preview_error"

    @pytest.mark.asyncio
    async def test_accessibility_metadata(self):
        """Test accessibility metadata structure."""
        from superset.mcp_service.chart.schemas import AccessibilityMetadata

        metadata = AccessibilityMetadata(
            color_blind_safe=True,
            alt_text="Bar chart showing sales by region",
            high_contrast_available=False,
        )
        assert metadata.color_blind_safe is True
        assert "sales by region" in metadata.alt_text
        assert metadata.high_contrast_available is False

    @pytest.mark.asyncio
    async def test_performance_metadata(self):
        """Test performance metadata structure."""
        from superset.mcp_service.chart.schemas import PerformanceMetadata

        metadata = PerformanceMetadata(
            query_duration_ms=150,
            cache_status="hit",
            optimization_suggestions=["Consider adding an index on date column"],
        )
        assert metadata.query_duration_ms == 150
        assert metadata.cache_status == "hit"
        assert len(metadata.optimization_suggestions) == 1


class TestChartPreviewValuePreservation:
    """Tests for chart preview read-path value preservation."""

    def test_chart_preview_preserves_ascii_and_alt_text(self) -> None:
        """ASCII preview values and operational URLs remain exact."""
        preview = ChartPreview(
            chart_id=3,
            chart_name="Regional Trend",
            chart_type="line",
            explore_url="http://localhost:8088/explore/?slice_id=3",
            content=ASCIIPreview(ascii_content="North > South", width=20, height=5),
            chart_description="Preview of line: Regional Trend",
            accessibility=AccessibilityMetadata(
                color_blind_safe=True,
                alt_text="Preview of Regional Trend",
                high_contrast_available=False,
            ),
            performance=PerformanceMetadata(query_duration_ms=8, cache_status="miss"),
        )

        result = preview

        assert result.chart_name == ("Regional Trend")
        assert result.explore_url == "http://localhost:8088/explore/?slice_id=3"
        assert result.chart_description == ("Preview of line: Regional Trend")
        assert result.content.ascii_content == ("North > South")
        assert result.accessibility.alt_text == ("Preview of Regional Trend")

    def test_chart_preview_preserves_vega_lite_data_values(self):
        """Vega-Lite descriptions and row string values remain exact."""
        preview = ChartPreview(
            chart_id=4,
            chart_name="Category Share",
            chart_type="pie",
            explore_url="http://localhost:8088/explore/?slice_id=4",
            content=VegaLitePreview(
                specification={
                    "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
                    "description": "Pie chart for category share",
                    "data": {
                        "values": [
                            {
                                "category": "Retail",
                                "url": "https://example.com/retail",
                                "value": 10,
                            },
                            {"category": "Enterprise", "value": 20},
                        ]
                    },
                }
            ),
            chart_description="Preview of pie: Category Share",
            accessibility=AccessibilityMetadata(
                color_blind_safe=True,
                alt_text="Preview of Category Share",
                high_contrast_available=False,
            ),
            performance=PerformanceMetadata(query_duration_ms=11, cache_status="miss"),
            format="vega_lite",
        )

        result = preview
        specification = result.content.specification

        assert specification["$schema"] == (
            "https://vega.github.io/schema/vega-lite/v5.json"
        )
        assert specification["description"] == ("Pie chart for category share")
        assert specification["data"]["values"][0]["category"] == ("Retail")
        assert specification["data"]["values"][0]["url"] == (
            "https://example.com/retail"
        )
        assert specification["data"]["values"][0]["value"] == 10

    def test_chart_preview_leaves_non_mapping_vega_lite_data_unchanged(
        self,
    ) -> None:
        """Non-mapping Vega-Lite data should not be treated as inline values."""
        preview = ChartPreview(
            chart_id=4,
            chart_name="Category Share",
            chart_type="pie",
            explore_url="http://localhost:8088/explore/?slice_id=4",
            content=VegaLitePreview(
                specification={
                    "description": "Pie chart for category share",
                    "data": "named_dataset",
                }
            ),
            chart_description="Preview of pie: Category Share",
            accessibility=AccessibilityMetadata(
                color_blind_safe=True,
                alt_text="Preview of Category Share",
                high_contrast_available=False,
            ),
            performance=PerformanceMetadata(query_duration_ms=11, cache_status="miss"),
            format="vega_lite",
        )

        result = preview
        specification = result.content.specification

        assert specification["description"] == ("Pie chart for category share")
        assert specification["data"] == "named_dataset"

    def test_chart_preview_preserves_table_content(self):
        preview = ChartPreview(
            chart_id=5,
            chart_name="Top Customers",
            chart_type="table",
            explore_url="/explore/?slice_id=5",
            content=TablePreview(
                table_data="Customer | Revenue\nAcme | 100",
                row_count=1,
                supports_sorting=True,
            ),
            chart_description="Preview of table: Top Customers",
            accessibility=AccessibilityMetadata(
                color_blind_safe=True,
                alt_text="Top customer revenue table",
                high_contrast_available=False,
            ),
            performance=PerformanceMetadata(query_duration_ms=9, cache_status="miss"),
        )

        result = preview

        assert result.content.table_data == ("Customer | Revenue\nAcme | 100")
        assert result.content.row_count == 1
        assert result.content.supports_sorting is True

    def test_chart_preview_preserves_interactive_html_and_urls(self):
        preview = ChartPreview(
            chart_id=6,
            chart_name="Interactive Trend",
            chart_type="line",
            explore_url="/explore/?slice_id=6",
            content=InteractivePreview(
                html_content="<div>Revenue by region</div>",
                preview_url="/superset/explore/?slice_id=6&standalone=1",
                width=800,
                height=600,
            ),
            chart_description="Interactive preview",
            accessibility=AccessibilityMetadata(
                color_blind_safe=True,
                alt_text="Interactive revenue trend",
                high_contrast_available=False,
            ),
            performance=PerformanceMetadata(query_duration_ms=13, cache_status="hit"),
            format="interactive",
            width=800,
            height=600,
        )

        result = preview

        assert result.content.html_content == ("<div>Revenue by region</div>")
        assert (
            result.content.preview_url == "/superset/explore/?slice_id=6&standalone=1"
        )
        assert result.explore_url == "/explore/?slice_id=6"

    @pytest.mark.asyncio
    async def test_chart_types_support(self):
        """Test that various chart types are supported."""
        chart_types = [
            "echarts_timeseries_line",
            "echarts_timeseries_bar",
            "echarts_area",
            "echarts_timeseries_scatter",
            "table",
            "pie",
            "big_number",
            "big_number_total",
            "pivot_table_v2",
            "dist_bar",
            "box_plot",
        ]

        # All chart types should be previewable
        for _chart_type in chart_types:
            # This would be tested in integration tests
            pass

    @pytest.mark.asyncio
    async def test_ascii_art_variations(self):
        """Test ASCII art generation for different chart types."""
        # Line chart ASCII
        _ = """
Sales Trend
│
│     ╱╲
│    ╱  ╲
│   ╱    ╲
│  ╱      ╲
│ ╱        ╲
└────────────
  Jan  Feb  Mar
"""

        # Bar chart ASCII
        _ = """
Sales by Region
│
│ ████ North
│ ███  South
│ ██   East
│ █    West
└────────────
"""

        # Pie chart ASCII
        _ = """
Market Share
  ╭─────╮
 ╱       ╲
│  45%    │
│ North   │
╰─────────╯
"""

        # These demonstrate the expected ASCII formats for different chart types


def test_build_query_columns_standard_groupby():
    form_data = {"x_axis": "date", "groupby": ["region"]}
    assert _build_query_columns(form_data) == ["date", "region"]


def test_build_query_columns_pivot_table():
    """Pivot tables use groupbyColumns/groupbyRows instead of groupby."""
    form_data = {
        "groupbyRows": ["product"],
        "groupbyColumns": ["region"],
        "metrics": [{"label": "SUM(sales)"}],
    }
    columns = _build_query_columns(form_data)
    assert "product" in columns
    assert "region" in columns


def test_build_query_columns_mixed_timeseries_groupby_b():
    """Mixed timeseries stores secondary groupby under groupby_b."""
    form_data = {
        "x_axis": "date",
        "groupby": ["series_a"],
        "groupby_b": ["series_b"],
    }
    columns = _build_query_columns(form_data)
    assert "date" in columns
    assert "series_a" in columns
    assert "series_b" in columns


def test_build_query_columns_no_duplicates():
    form_data = {
        "x_axis": "date",
        "groupby": ["date", "region"],
    }
    columns = _build_query_columns(form_data)
    assert columns.count("date") == 1


def test_build_query_metrics_plural():
    form_data = {"metrics": [{"label": "SUM(sales)"}, {"label": "COUNT(*)"}]}
    assert _build_query_metrics(form_data) == [
        {"label": "SUM(sales)"},
        {"label": "COUNT(*)"},
    ]


def test_build_query_metrics_singular_for_pie():
    """Pie charts use metric (singular) instead of metrics."""
    form_data = {"metric": "SUM(amount)"}
    assert _build_query_metrics(form_data) == ["SUM(amount)"]


def test_build_query_metrics_mixed_timeseries():
    """Mixed timeseries stores secondary metrics under metrics_b."""
    form_data = {
        "metrics": [{"label": "SUM(revenue)"}],
        "metrics_b": [{"label": "AVG(cost)"}],
    }
    result = _build_query_metrics(form_data)
    assert {"label": "SUM(revenue)"} in result
    assert {"label": "AVG(cost)"} in result


def test_build_query_metrics_empty():
    assert _build_query_metrics({}) == []


def test_first_query_has_fields_true_with_metrics():
    query_context = SimpleNamespace(
        queries=[SimpleNamespace(metrics=["count"], columns=[])]
    )
    assert _first_query_has_fields(query_context) is True


def test_first_query_has_fields_true_with_columns():
    query_context = SimpleNamespace(
        queries=[SimpleNamespace(metrics=[], columns=["region"])]
    )
    assert _first_query_has_fields(query_context) is True


def test_first_query_has_fields_false_when_both_empty():
    query_context = SimpleNamespace(queries=[SimpleNamespace(metrics=[], columns=[])])
    assert _first_query_has_fields(query_context) is False


def test_first_query_has_fields_ignores_later_populated_query():
    # Preview strategies render only the first query result, so a populated
    # secondary mixed-timeseries query must not make an empty preview valid.
    query_context = SimpleNamespace(
        queries=[
            SimpleNamespace(metrics=[], columns=[]),
            SimpleNamespace(metrics=["count"], columns=[]),
        ]
    )
    assert _first_query_has_fields(query_context) is False


def test_first_query_has_fields_defers_when_queries_attr_missing():
    # Test doubles / unexpected objects without a `.queries` attribute
    # should not be treated as "no fields" — defer to normal execution.
    assert _first_query_has_fields(object()) is True


def test_no_query_fields_error_mentions_chart_and_viz_type():
    chart = SimpleNamespace(id=96, slice_name="Total Sales", viz_type="big_number")
    error = _no_query_fields_error(chart)
    assert error.error_type == "NoQueryFields"
    assert "Total Sales" in error.error
    assert "big_number" in error.error


def test_build_query_columns_pivot_overlapping_rows_and_columns():
    """Overlapping values in groupbyRows and groupbyColumns are deduplicated."""
    form_data = {
        "groupbyRows": ["country", "region"],
        "groupbyColumns": ["region", "city"],
    }
    columns = _build_query_columns(form_data)
    assert columns.count("region") == 1
    assert "country" in columns
    assert "city" in columns


def test_build_chart_description_standard():
    chart = MagicMock(viz_type="line", slice_name="Sales Trend", id=1)
    desc = _build_chart_description(chart)
    assert desc == "Preview of line: Sales Trend"


def test_build_chart_description_handlebars():
    chart = MagicMock(viz_type="handlebars", slice_name="My Template", id=2)
    desc = _build_chart_description(chart)
    assert "Handlebars" in desc
    assert "raw underlying data" in desc
    assert "template rendering" in desc


class TestDetachedInstanceError:
    """Tests that DetachedInstanceError is handled gracefully.

    When the SQLAlchemy session commits mid-request, ORM objects expire and
    become detached.  Accessing lazy attributes on a detached Slice raises
    DetachedInstanceError.  The tool must:
    1. Call db.session.refresh() immediately after loading the chart so all
       column values are loaded upfront before any downstream operation.
    2. Catch SQLAlchemyError (the base class) and return a ChartError
       instead of propagating the exception.
    """

    @pytest.mark.asyncio
    async def test_session_refresh_called_after_chart_load(self):
        """db.session.refresh() is invoked right after find_chart_by_identifier."""
        import importlib
        from contextlib import nullcontext
        from unittest.mock import MagicMock, patch

        from superset.mcp_service.chart.schemas import URLPreview
        from superset.utils import json

        get_chart_preview_module = importlib.import_module(
            "superset.mcp_service.chart.tool.get_chart_preview"
        )

        mock_chart = MagicMock()
        mock_chart.id = 42
        mock_chart.slice_name = "Sales Chart"
        mock_chart.viz_type = "table"
        mock_chart.datasource_id = 1
        mock_chart.datasource_type = "table"
        mock_chart.params = "{}"

        refresh_calls: list[object] = []

        def _fake_refresh(obj: object) -> None:
            refresh_calls.append(obj)

        url_preview = URLPreview(
            preview_url="http://localhost/explore/?slice_id=42",
            width=800,
            height=600,
        )

        with (
            patch.object(
                get_chart_preview_module,
                "find_chart_by_identifier",
                return_value=mock_chart,
            ),
            patch.object(
                get_chart_preview_module.db,
                "session",
                **{"refresh.side_effect": _fake_refresh},
            ),
            patch.object(
                get_chart_preview_module,
                "validate_chart_dataset",
                return_value=MagicMock(is_valid=True, warnings=[]),
            ),
            patch.object(
                get_chart_preview_module.event_logger,
                "log_context",
                return_value=nullcontext(),
            ),
            # Return a real URLPreview so Pydantic model validation succeeds
            patch.object(
                get_chart_preview_module.PreviewFormatGenerator,
                "generate",
                return_value=url_preview,
            ),
            patch(
                "superset.mcp_service.utils.url_utils.get_superset_base_url",
                return_value="http://localhost",
            ),
        ):
            from fastmcp import Client

            from superset.mcp_service.app import mcp
            from superset.mcp_service.chart.schemas import GetChartPreviewRequest

            with patch("superset.mcp_service.auth.get_user_from_request") as mu:
                mu.return_value = MagicMock(id=1, username="admin")
                with patch(
                    "superset.mcp_service.auth.check_tool_permission", return_value=True
                ):
                    async with Client(mcp) as client:
                        response = await client.call_tool(
                            "get_chart_preview",
                            {
                                "request": GetChartPreviewRequest(
                                    identifier=42, format="url"
                                ).model_dump()
                            },
                        )

        data = json.loads(response.content[0].text)
        # The tool should succeed — not return a ChartError
        assert "error_type" not in data, (
            f"Expected ChartPreview but got ChartError: {data.get('error')}"
        )
        assert data.get("chart_id") == 42

        assert len(refresh_calls) == 1, (
            "db.session.refresh() should be called once after loading the chart"
        )
        assert refresh_calls[0] is mock_chart

    @pytest.mark.asyncio
    async def test_detached_instance_error_returns_chart_error(self):
        """DetachedInstanceError during preview generation returns ChartError."""
        import importlib
        from contextlib import nullcontext
        from unittest.mock import MagicMock, patch

        from sqlalchemy.orm.exc import DetachedInstanceError

        get_chart_preview_module = importlib.import_module(
            "superset.mcp_service.chart.tool.get_chart_preview"
        )

        mock_chart = MagicMock()
        mock_chart.id = 7
        mock_chart.slice_name = "Broken Chart"
        mock_chart.viz_type = "bar"
        mock_chart.datasource_id = 3
        mock_chart.datasource_type = "table"
        mock_chart.params = "{}"

        with (
            patch.object(
                get_chart_preview_module,
                "find_chart_by_identifier",
                return_value=mock_chart,
            ),
            patch.object(
                get_chart_preview_module.db,
                "session",
                **{"refresh.return_value": None},
            ),
            patch.object(
                get_chart_preview_module,
                "validate_chart_dataset",
                return_value=MagicMock(is_valid=True, warnings=[]),
            ),
            patch.object(
                get_chart_preview_module.event_logger,
                "log_context",
                return_value=nullcontext(),
            ),
            # Simulate the session expiring inside the strategy
            patch.object(
                get_chart_preview_module.PreviewFormatGenerator,
                "generate",
                side_effect=DetachedInstanceError(),
            ),
            patch(
                "superset.mcp_service.utils.url_utils.get_superset_base_url",
                return_value="http://localhost",
            ),
        ):
            from fastmcp import Client

            from superset.mcp_service.app import mcp
            from superset.mcp_service.chart.schemas import GetChartPreviewRequest
            from superset.utils import json

            with patch("superset.mcp_service.auth.get_user_from_request") as mu:
                mu.return_value = MagicMock(id=1, username="admin")
                with patch(
                    "superset.mcp_service.auth.check_tool_permission", return_value=True
                ):
                    async with Client(mcp) as client:
                        response = await client.call_tool(
                            "get_chart_preview",
                            {
                                "request": GetChartPreviewRequest(
                                    identifier=7, format="ascii"
                                ).model_dump()
                            },
                        )

        data = json.loads(response.content[0].text)
        assert data["error_type"] == "InternalError"
        assert "session" in data["error"].lower() or "retry" in data["error"].lower()


def _guest_strategy() -> PreviewFormatStrategy:
    chart = MagicMock()
    return PreviewFormatStrategy(chart, GetChartPreviewRequest(identifier=1))


def test_authorize_guest_query_attaches_dashboard_context() -> None:
    """For a guest, the preview query is pinned to the token's dashboard so
    raise_for_access can authorize it."""
    strategy = _guest_strategy()
    query_context = MagicMock()

    with (
        patch("superset.mcp_service.guest_scope.guest_dashboard_id", return_value=6),
        patch("superset.mcp_service.guest_scope.authorize_query") as mock_authorize,
    ):
        strategy._authorize_guest_query(query_context)

    mock_authorize.assert_called_once_with(query_context, 6, strategy.chart)


def test_authorize_guest_query_noop_for_non_guest() -> None:
    """A non-guest has no dashboard id, so nothing is attached."""
    strategy = _guest_strategy()

    with (
        patch("superset.mcp_service.guest_scope.guest_dashboard_id", return_value=None),
        patch("superset.mcp_service.guest_scope.authorize_query") as mock_authorize,
    ):
        strategy._authorize_guest_query(MagicMock())

    mock_authorize.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("format_", ["ascii", "vega_lite"])
@pytest.mark.parametrize("saved", [True, False])
async def test_bullet_short_labels_and_case_distinct_dimensions_reach_fastmcp(
    format_: str,
    saved: bool,
) -> None:
    from contextlib import nullcontext

    from fastmcp import Client

    from superset.mcp_service.app import mcp

    preview_module = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_preview"
    )
    command_module = importlib.import_module(
        "superset.commands.chart.data.get_data_command"
    )
    form_data = {
        "viz_type": "bullet",
        "datasource": "1__table",
        "metric": "Revenue",
        "groupby": ["Region", "region"],
        "ranges": "10,20,30",
        "range_labels": "Low",
        "markers": "12,22",
        "marker_labels": "Plan",
        "marker_lines": "13,23",
        "marker_line_labels": "Forecast",
        "show_labels": True,
        "y_axis_format": ".1f",
    }
    chart = SimpleNamespace(
        id=121,
        slice_name="Number boundaries",
        viz_type="bullet",
        datasource_id=1,
        datasource_type="table",
        params=utils_json.dumps(form_data),
    )
    rows = [{"Region": "North", "region": "South", "Revenue": 15}]

    class _Command:
        def __init__(self, _query_context: Any) -> None: ...

        def validate(self) -> None: ...

        def run(self) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": rows,
                        "colnames": ["Region", "region", "Revenue"],
                    }
                ]
            }

    query_context = SimpleNamespace(
        form_data={},
        queries=[SimpleNamespace(metrics=["Revenue"], columns=["Region", "region"])],
    )
    user = MagicMock(id=1, username="admin", roles=[], groups=[])
    with (
        patch("superset.mcp_service.auth.get_user_from_request", return_value=user),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch(
            "superset.commands.explore.form_data.get.GetFormDataCommand.run",
            return_value=utils_json.dumps(form_data),
        ),
        patch.object(preview_module, "find_chart_by_identifier", return_value=chart),
        patch.object(preview_module.db.session, "refresh", return_value=None),
        patch.object(
            preview_module,
            "validate_chart_dataset",
            return_value=SimpleNamespace(is_valid=True, warnings=[], error=None),
        ),
        patch.object(
            preview_module.event_logger,
            "log_context",
            side_effect=lambda **_kwargs: nullcontext(),
        ),
        patch.object(
            preview_module,
            "build_query_context_from_form_data",
            return_value=query_context,
        ),
        patch.object(preview_module, "set_query_context_form_data", return_value=None),
        patch.object(command_module, "ChartDataCommand", _Command),
        patch.object(
            preview_module, "get_superset_base_url", return_value="http://localhost"
        ),
    ):
        request_payload: dict[str, str | int] = {"format": format_}
        if saved:
            request_payload["id"] = 121
        else:
            request_payload["form_data_key"] = "short-labels"
        async with Client(mcp) as client:
            result = await client.call_tool(
                "get_chart_preview",
                {"request": request_payload},
            )

    payload = utils_json.loads(result.content[0].text)
    assert payload["chart_type"] == "bullet"
    if format_ == "ascii":
        assert "North, South" in payload["content"]["ascii_content"]
    else:
        spec = payload["content"]["specification"]
        bar = next(layer for layer in spec["layer"] if layer["mark"]["type"] == "bar")
        category = bar["encoding"]["y"]["field"]
        assert spec["data"]["values"][0][category] == "North, South"
        labels = {
            layer["encoding"]["x"]["datum"]: layer["encoding"]["text"]["value"]
            for layer in spec["layer"]
            if layer["mark"]["type"] == "text"
        }
        assert labels == {
            10.0: "Low",
            12.0: "Plan",
            22.0: "22.0",
            13.0: "Forecast",
            23.0: "23.0",
        }
