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

"""Adversarial tests for the shared chart query-result envelope contract."""

import os
import time as system_time
from collections.abc import Callable
from datetime import date, datetime, time as datetime_time, timedelta, timezone, tzinfo
from decimal import Decimal
from enum import Enum
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import pytest
import pytz
from dateutil import tz as dateutil_tz
from dateutil.zoneinfo import get_zonefile_instance
from pydantic import BaseModel

from superset.mcp_service.chart import query_result as query_result_module
from superset.mcp_service.chart.query_result import (
    _json_string_size,
    _truncate_utf8,
    MAX_QUERY_RESULT_DECIMAL_DIGITS,
    MAX_QUERY_RESULT_DECIMAL_EXPONENT,
    MAX_QUERY_RESULT_INTEGER_BITS,
    MAX_QUERY_RESULT_KEY_BYTES,
    MAX_QUERY_RESULT_METADATA_BYTES,
    MAX_QUERY_RESULT_ROWS,
    MAX_QUERY_RESULT_STRING_BYTES,
    MAX_QUERY_RESULT_TOTAL_ROWS,
    MAX_QUERY_RESULT_VALUE_BYTES,
    query_result_data,
    response_json_failure,
    safe_exception_message,
)
from superset.utils import json
from superset.utils.core import GenericDataType


def _hostile_call(*_args: object, **_kwargs: object) -> Any:
    raise AssertionError("hostile scalar method must not run")


class _HostileStr(str):
    __getitem__ = _hostile_call
    __str__ = _hostile_call


class _HostileInt(int):
    __abs__ = _hostile_call
    __eq__ = _hostile_call
    __lt__ = _hostile_call
    __str__ = _hostile_call
    bit_length = _hostile_call


class _HostileFloat(float):
    __str__ = _hostile_call


class _HostileBytes(bytes):
    __bytes__ = _hostile_call
    __getitem__ = _hostile_call
    decode = _hostile_call


class _HostileBytearray(bytearray):
    __bytes__ = _hostile_call
    __getitem__ = _hostile_call
    decode = _hostile_call


class _HostileBoolLike:
    @property  # type: ignore[misc]
    def __class__(self) -> type[object]:  # type: ignore[override]
        """Reject ABC instance checks that consult a spoofed class."""
        return _hostile_call()

    __bool__ = _hostile_call
    __repr__ = _hostile_call
    __str__ = _hostile_call


class _HostileBytesLike:
    __bytes__ = _hostile_call
    __getitem__ = _hostile_call
    __len__ = _hostile_call
    __repr__ = _hostile_call
    __str__ = _hostile_call


class _HostileEnumValue:
    __repr__ = _hostile_call
    __str__ = _hostile_call


class _HostileStringEnum(str, Enum):
    FAILED = "failed"

    @property
    def value(self) -> str:
        """Reject the public descriptor while leaving Enum's stored value intact."""
        return _hostile_call()

    __getitem__ = _hostile_call
    __str__ = _hostile_call


class _TextEnum(Enum):
    VALUE = "warehouse unavailable"


class _IntegerEnum(Enum):
    VALUE = 503


class _FloatEnum(Enum):
    VALUE = 1.25


class _BooleanEnum(Enum):
    VALUE = True


class _BytesEnum(Enum):
    VALUE = b"binary failure"


class _UnsupportedEnum(Enum):
    VALUE = _HostileEnumValue()


class _ResultEnum(Enum):
    TEXT = "value"
    NUMBER = 7


class _ProjectedResponse(BaseModel):
    value: str


class _UTCProjectedResponse(BaseModel):
    timestamp: datetime
    value: str


@pytest.mark.parametrize(
    "result",
    [
        {"queries": []},
        {"queries": [{}]},
        {"queries": [{"data": None}]},
        {"queries": [{"data": {}}]},
        {"queries": [{"data": []}, {}]},
    ],
)
def test_query_result_requires_nonempty_queries_with_present_list_data(
    result: dict[str, Any],
) -> None:
    data, failure = query_result_data(result)
    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


def test_query_result_accepts_one_legitimate_empty_dataset() -> None:
    data, failure = query_result_data({"queries": [{"data": []}]})
    assert data == [[]]
    assert failure is None


def test_query_result_normalizes_enum_row_values_without_public_hooks() -> None:
    row = {"text": _ResultEnum.TEXT, "number": _ResultEnum.NUMBER}

    data, failure = query_result_data({"queries": [{"data": [row]}]})

    assert failure is None
    assert data == [[{"text": "value", "number": 7}]]


@pytest.mark.parametrize(
    "chart_type", ["big_number", "waterfall", "echarts_timeseries", "mixed_timeseries"]
)
@pytest.mark.parametrize("is_cached", [False, True])
def test_real_dataframe_chart_data_normalizes_trusted_temporal_scalars(
    chart_type: str, is_cached: bool
) -> None:
    """The real DataFrame materializer leaves Timestamp/NaT values in records."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
    from superset.common.query_context import QueryContext
    from superset.common.query_context_processor import QueryContextProcessor

    folded = pd.Timestamp(
        datetime(
            2024,
            11,
            3,
            1,
            30,
            tzinfo=ZoneInfo("America/New_York"),
            fold=1,
        )
    )
    frame = pd.DataFrame(
        {
            "event_time": [folded, pd.NaT],
            "fixed_time": [
                pd.Timestamp(
                    datetime(
                        2024,
                        1,
                        1,
                        12,
                        tzinfo=dateutil_tz.tzoffset("east", 5 * 3600 + 30 * 60),
                    )
                ),
                pd.Timestamp(datetime(2024, 1, 1, 12, tzinfo=pytz.FixedOffset(-450))),
            ],
            "duration": [np.timedelta64(5, "s"), np.timedelta64("NaT")],
            "metric": [np.float64(1.25), np.float64(2.5)],
            "enabled": [np.bool_(True), np.bool_(False)],
        }
    )
    processor_context = SimpleNamespace(
        datasource=object(), result_format=ChartDataResultFormat.JSON
    )
    records = QueryContextProcessor(cast(QueryContext, processor_context)).get_data(
        frame,
        [
            GenericDataType.TEMPORAL,
            GenericDataType.TEMPORAL,
            GenericDataType.TEMPORAL,
            GenericDataType.NUMERIC,
            GenericDataType.BOOLEAN,
        ],
    )
    assert type(records) is list
    assert type(records[0]["event_time"]) is pd.Timestamp

    class _Context:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": records,
                        "colnames": list(frame.columns),
                        "coltypes": [
                            GenericDataType.TEMPORAL,
                            GenericDataType.TEMPORAL,
                            GenericDataType.TEMPORAL,
                            GenericDataType.NUMERIC,
                            GenericDataType.BOOLEAN,
                        ],
                        "rowcount": 2,
                        "is_cached": is_cached,
                        "cache_key": f"{chart_type}-cache" if is_cached else None,
                    }
                ]
            }

    result = ChartDataCommand(_Context()).run()  # type: ignore[arg-type]
    data, failure = query_result_data(result)

    assert failure is None
    assert data is not None
    assert data[0][0]["event_time"] == "2024-11-03T01:30:00-05:00"
    assert data[0][1]["event_time"] is None
    assert data[0][0]["fixed_time"] == "2024-01-01T12:00:00+05:30"
    assert data[0][1]["fixed_time"] == "2024-01-01T12:00:00-07:30"
    assert data[0][0]["duration"] == "P0DT0H0M5S"
    assert data[0][1]["duration"] is None
    assert type(data[0][0]["metric"]) is float
    assert type(data[0][0]["enabled"]) is bool


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (np.int64(7), 7),
        (np.uint64(8), 8),
        (np.float32(1.5), 1.5),
        (np.bool_(True), True),
        (np.str_("warehouse"), "warehouse"),
        (np.datetime64("2024-01-01T02:03:04"), "2024-01-01T02:03:04"),
        (np.timedelta64(1500, "ms"), "P0DT0H0M1.5S"),
        (pd.NA, None),
        (pd.NaT, None),
    ],
)
def test_query_result_normalizes_exact_trusted_numpy_and_pandas_scalars(
    value: object, expected: object
) -> None:
    data, failure = query_result_data(
        {"queries": [{"data": [{"value": value}], "rowcount": 1}]}
    )

    assert failure is None
    assert data == [[{"value": expected}]]
    assert type(data[0][0]["value"]) is type(expected)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (date(2024, 1, 2), "2024-01-02"),
        (timedelta(days=1, seconds=2, microseconds=3), "P1DT2.000003S"),
        (timedelta(days=-2, seconds=3), "-P1DT23H59M57S"),
        (
            UUID("12345678-1234-5678-1234-567812345678"),
            "12345678-1234-5678-1234-567812345678",
        ),
    ],
)
def test_query_result_canonicalizes_exact_json_string_scalars(
    value: object, expected: str
) -> None:
    data, failure = query_result_data(
        {"queries": [{"data": [{"value": value}], "rowcount": 1}]}
    )

    assert failure is None
    assert data == [[{"value": expected}]]


@pytest.mark.parametrize("timezone_name", ["US/Pacific", "dateutil/US/Pacific"])
def test_query_result_canonicalizes_common_pandas_timezones_without_tz_hooks(
    timezone_name: str,
) -> None:
    timestamp = pd.Timestamp("2024-11-03 01:30").tz_localize(
        timezone_name, ambiguous=False
    )

    data, failure = query_result_data(
        {"queries": [{"data": [{"value": timestamp}], "rowcount": 1}]}
    )

    assert failure is None
    assert data == [[{"value": "2024-11-03T01:30:00-08:00"}]]


@pytest.mark.parametrize(
    ("tzinfo_value", "expected_offset"),
    [
        (dateutil_tz.tzoffset("east", 5 * 3600 + 30 * 60), "+05:30"),
        (dateutil_tz.tzoffset("west", -(7 * 3600 + 30 * 60)), "-07:30"),
        (pytz.FixedOffset(330), "+05:30"),
        (pytz.FixedOffset(-450), "-07:30"),
        (dateutil_tz.UTC, "+00:00"),
        (pytz.UTC, "+00:00"),
    ],
)
def test_query_result_canonicalizes_fixed_offset_dataframe_timestamps(
    tzinfo_value: tzinfo, expected_offset: str
) -> None:
    timestamp = pd.Timestamp(datetime(2024, 2, 3, 4, 5, tzinfo=tzinfo_value))
    records = pd.DataFrame({"event_time": [timestamp]}).to_dict("records")

    data, failure = query_result_data({"queries": [{"data": records, "rowcount": 1}]})

    assert failure is None
    assert data == [[{"event_time": f"2024-02-03T04:05:00{expected_offset}"}]]


@pytest.mark.parametrize("timezone_name", ["US/Pacific", "dateutil/US/Pacific"])
def test_query_result_preserves_named_zone_fold_after_dataframe_materialization(
    timezone_name: str,
) -> None:
    folded = pd.Timestamp("2024-11-03 01:30").tz_localize(
        timezone_name, ambiguous=False
    )
    records = pd.DataFrame({"event_time": [folded]}).to_dict("records")

    data, failure = query_result_data({"queries": [{"data": records, "rowcount": 1}]})

    assert failure is None
    assert data == [[{"event_time": "2024-11-03T01:30:00-08:00"}]]


def test_query_result_accepts_dateutil_packaged_zoneinfo_type() -> None:
    tzinfo_value = get_zonefile_instance().get("America/Los_Angeles")
    assert tzinfo_value is not None
    timestamp = pd.Timestamp(datetime(2024, 1, 1, 12, tzinfo=tzinfo_value))

    data, failure = query_result_data(
        {"queries": [{"data": [{"value": timestamp}], "rowcount": 1}]}
    )

    assert failure is None
    assert data == [[{"value": "2024-01-01T12:00:00-08:00"}]]


@pytest.mark.parametrize(
    "tzinfo_value",
    [dateutil_tz.tzoffset("east", 3600), pytz.FixedOffset(60)],
)
def test_fixed_offset_canonicalization_never_calls_source_timezone_hooks(
    monkeypatch: pytest.MonkeyPatch, tzinfo_value: tzinfo
) -> None:
    timestamp = pd.Timestamp(datetime(2024, 1, 1, tzinfo=tzinfo_value))
    source_type = type(tzinfo_value)
    for method_name in ("utcoffset", "dst", "tzname"):
        monkeypatch.setattr(source_type, method_name, _hostile_call, raising=False)

    data, failure = query_result_data(
        {"queries": [{"data": [{"value": timestamp}], "rowcount": 1}]}
    )

    assert failure is None
    assert data == [[{"value": "2024-01-01T00:00:00+01:00"}]]


def test_object_dataframe_canonicalizes_python_temporals_and_tzlocal_timestamp() -> (
    None
):
    pacific = dateutil_tz.gettz("US/Pacific")
    packaged = get_zonefile_instance().get("America/Los_Angeles")
    assert pacific is not None
    assert packaged is not None
    localized = pytz.timezone("US/Pacific").localize(
        datetime(2024, 11, 3, 1, 30), is_dst=False
    )
    values = [
        datetime(2024, 11, 3, 1, 30, tzinfo=pacific, fold=1),
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=packaged),
        localized,
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=pytz.UTC),
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=dateutil_tz.tzlocal()),
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=dateutil_tz.tzoffset("east", 19_800)),
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=pytz.FixedOffset(-450)),
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=dateutil_tz.UTC),
    ]
    clock_values = [
        datetime_time(3, 4, 5, tzinfo=dateutil_tz.tzoffset("east", 19_800)),
        datetime_time(3, 4, 5, tzinfo=pytz.FixedOffset(-450)),
        datetime_time(3, 4, 5, tzinfo=pytz.UTC),
        datetime_time(3, 4, 5, tzinfo=packaged),
        datetime_time(3, 4, 5, tzinfo=dateutil_tz.tzlocal()),
        datetime_time(3, 4, 5, tzinfo=pacific),
        datetime_time(3, 4, 5, tzinfo=localized.tzinfo),
        datetime_time(3, 4, 5, tzinfo=dateutil_tz.UTC),
    ]
    frame = pd.DataFrame(
        {
            "event_time": pd.Series(values, dtype=object),
            "clock_time": pd.Series(clock_values, dtype=object),
        }
    )
    records = frame.to_dict("records")
    tzlocal_timestamp = pd.Timestamp(
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=dateutil_tz.tzlocal())
    )
    records[0]["local_timestamp"] = tzlocal_timestamp

    data, failure = query_result_data(
        {"queries": [{"data": records, "rowcount": len(records)}]}
    )

    assert failure is None
    assert data is not None
    assert [row["event_time"] for row in data[0]] == [
        value.isoformat() for value in values
    ]
    assert [row["clock_time"] for row in data[0]] == [
        value.isoformat() for value in clock_values
    ]
    assert data[0][0]["local_timestamp"] == tzlocal_timestamp.isoformat()


def test_python_and_timestamp_timezone_canonicalization_avoids_source_hooks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dateutil_named = dateutil_tz.gettz("US/Pacific")
    assert dateutil_named is not None
    pytz_named = (
        pytz.timezone("US/Pacific")
        .localize(datetime(2024, 11, 3, 1, 30), is_dst=False)
        .tzinfo
    )
    local = dateutil_tz.tzlocal()
    values: list[datetime | datetime_time | pd.Timestamp] = [
        datetime(2024, 11, 3, 1, 30, tzinfo=dateutil_named, fold=1),
        datetime(2024, 11, 3, 1, 30, tzinfo=pytz_named),
        datetime(2024, 1, 2, 3, 4, 5, tzinfo=local),
        datetime_time(3, 4, 5, tzinfo=dateutil_named),
        datetime_time(3, 4, 5, tzinfo=pytz_named),
        datetime_time(3, 4, 5, tzinfo=local),
        pd.Timestamp(datetime(2024, 1, 2, 3, 4, 5, tzinfo=local)),
    ]
    expected = [value.isoformat() for value in values]
    for timezone_type in {type(value.tzinfo) for value in values}:
        for method_name in ("utcoffset", "dst", "tzname"):
            monkeypatch.setattr(timezone_type, method_name, _hostile_call)

    data, failure = query_result_data(
        {
            "queries": [
                {
                    "data": [
                        {f"value_{index}": value for index, value in enumerate(values)}
                    ]
                }
            ]
        }
    )

    assert failure is None
    assert data == [[{f"value_{index}": value for index, value in enumerate(expected)}]]


@pytest.mark.skipif(not hasattr(system_time, "tzset"), reason="requires POSIX tzset")
def test_dateutil_local_datetime_preserves_ambiguous_fold_offsets() -> None:
    original_timezone = os.environ.get("TZ")
    try:
        os.environ["TZ"] = "America/New_York"
        system_time.tzset()
        local = dateutil_tz.tzlocal()
        values = [
            datetime(2024, 11, 3, 1, 30, tzinfo=local, fold=fold) for fold in (0, 1)
        ]
        expected = [value.isoformat() for value in values]

        data, failure = query_result_data(
            {"queries": [{"data": [{"value": value} for value in values]}]}
        )

        assert failure is None
        assert data == [[{"value": value} for value in expected]]
        assert expected == [
            "2024-11-03T01:30:00-04:00",
            "2024-11-03T01:30:00-05:00",
        ]
    finally:
        if original_timezone is None:
            os.environ.pop("TZ", None)
        else:
            os.environ["TZ"] = original_timezone
        system_time.tzset()


def test_shared_dataframe_object_container_is_normalized_for_every_occurrence() -> None:
    shared = [np.float64(1.5), pd.NA]
    records = pd.DataFrame(
        {
            "left": pd.Series([shared], dtype=object),
            "right": pd.Series([shared], dtype=object),
        }
    ).to_dict("records")
    assert records[0]["left"] is records[0]["right"]

    data, failure = query_result_data({"queries": [{"data": records, "rowcount": 1}]})

    assert failure is None
    assert data == [[{"left": [1.5, None], "right": [1.5, None]}]]
    assert data[0][0]["left"] is data[0][0]["right"]


def test_shared_row_and_metadata_containers_are_recharged_at_each_occurrence(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    shared_row_value = ["escaped\nvalue"]
    shared_metadata = {"value": [1, 2, 3]}
    result = {
        "metadata": [shared_metadata, shared_metadata],
        "queries": [
            {
                "data": [
                    {"left": shared_row_value, "right": shared_row_value},
                ],
                "rowcount": 1,
            }
        ],
    }
    exact_size = len(json.dumps(result, separators=(",", ":")).encode())
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_VALUE_BYTES",
        exact_size,
    )

    data, failure = query_result_data(result)

    assert failure is None
    assert data is not None

    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_VALUE_BYTES",
        exact_size - 1,
    )
    data, failure = query_result_data(result)

    assert data is None
    assert failure is not None
    assert "total JSON-encoded byte limit" in failure.error


@pytest.mark.parametrize("location", ["row", "metadata"])
def test_query_result_rejects_genuine_container_cycles(location: str) -> None:
    cycle: list[Any] = []
    cycle.append(cycle)
    result = (
        {"queries": [{"data": [{"value": cycle}]}]}
        if location == "row"
        else {"metadata": cycle, "queries": [{"data": []}]}
    )

    data, failure = query_result_data(result)

    assert data is None
    assert failure is not None
    assert "cyclic containers" in failure.error


@pytest.mark.parametrize(
    "value",
    [float("inf"), Decimal("NaN"), Decimal("Infinity"), np.inf],
)
def test_query_result_rejects_non_finite_non_missing_numeric_values(
    value: object,
) -> None:
    data, failure = query_result_data(
        {"queries": [{"data": [{"value": value}], "rowcount": 1}]}
    )

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


@pytest.mark.parametrize(
    "value",
    [float("nan"), np.float16("nan"), np.float32("nan"), np.float64("nan")],
)
def test_query_result_canonicalizes_exact_numeric_missing_values(value: object) -> None:
    data, failure = query_result_data(
        {"queries": [{"data": [{"value": value}], "rowcount": 1}]}
    )

    assert failure is None
    assert data == [[{"value": None}]]


def test_real_dataframe_and_chart_command_canonicalize_numeric_missing_values() -> None:
    """Pandas leaves NaN records after Superset converts infinities to NaN."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
    from superset.common.query_context import QueryContext
    from superset.common.query_context_processor import QueryContextProcessor

    frame = pd.DataFrame(
        {
            "builtin_missing": [float("nan")],
            "numpy_missing": [np.float64("nan")],
            "nullable_missing": pd.Series([pd.NA], dtype="Float64"),
        }
    )
    processor_context = SimpleNamespace(
        datasource=object(), result_format=ChartDataResultFormat.JSON
    )
    records = QueryContextProcessor(cast(QueryContext, processor_context)).get_data(
        frame,
        [GenericDataType.NUMERIC] * 3,
    )
    assert type(records) is list
    assert all(pd.isna(value) for value in records[0].values())

    class _Context:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": records,
                        "colnames": list(frame.columns),
                        "coltypes": [GenericDataType.NUMERIC] * 3,
                        "rowcount": 1,
                    }
                ]
            }

    result = ChartDataCommand(_Context()).run()  # type: ignore[arg-type]
    data, failure = query_result_data(result)

    assert failure is None
    assert data == [
        [
            {
                "builtin_missing": None,
                "numpy_missing": None,
                "nullable_missing": None,
            }
        ]
    ]


def test_real_query_processor_does_not_compare_hostile_object_cells() -> None:
    """Producer cleanup projects first and leaves validation to the consumer."""
    from superset.common.chart_data import ChartDataResultFormat
    from superset.common.query_context import QueryContext
    from superset.common.query_context_processor import QueryContextProcessor

    class HostileEquality:
        def __eq__(self, _other: object) -> bool:
            raise AssertionError("hostile object equality must not run")

    hostile = HostileEquality()
    frame = pd.DataFrame(
        {
            "hostile": pd.Series([hostile], dtype=object),
            "infinite": [np.inf],
        }
    )
    processor_context = SimpleNamespace(
        datasource=object(), result_format=ChartDataResultFormat.JSON
    )

    records = QueryContextProcessor(cast(QueryContext, processor_context)).get_data(
        frame,
        [GenericDataType.STRING, GenericDataType.NUMERIC],
    )

    assert type(records) is list
    assert records[0]["hostile"] is hostile
    assert records[0]["infinite"] is None

    data, failure = query_result_data(
        {
            "queries": [
                {
                    "data": records,
                    "colnames": ["hostile", "infinite"],
                    "coltypes": [GenericDataType.STRING, GenericDataType.NUMERIC],
                    "rowcount": 1,
                }
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert "unsupported or subclassed value" in failure.error


@pytest.mark.parametrize(
    ("compare_type", "source", "comparison"),
    [
        ("ratio", 1.0, 0.0),
        ("percentage", -1.0, 0.0),
        ("difference", np.finfo(float).max, -np.finfo(float).max),
    ],
)
def test_real_postprocessing_nonfinite_is_canonicalized_at_materialization(
    app_context: None,
    compare_type: str,
    source: float,
    comparison: float,
) -> None:
    """Built-in comparison overflow becomes null before ChartDataCommand output."""
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
    from superset.common.query_context import QueryContext
    from superset.common.query_context_processor import QueryContextProcessor
    from superset.common.query_object import QueryObject

    query = QueryObject(
        post_processing=[
            {
                "operation": "compare",
                "options": {
                    "source_columns": ["source"],
                    "compare_columns": ["comparison"],
                    "compare_type": compare_type,
                },
            }
        ]
    )
    processed = query.exec_post_processing(
        pd.DataFrame(
            {
                "source": [source],
                "comparison": [comparison],
                "finite": [3.5],
                "finite_integer": [2**53 + 1],
            }
        )
    )
    derived_column = next(
        column
        for column in processed.columns
        if column not in {"source", "comparison", "finite", "finite_integer"}
    )
    assert np.isinf(processed[derived_column].iloc[0])
    dtypes = processed.dtypes.copy()

    processor_context = SimpleNamespace(
        datasource=object(), result_format=ChartDataResultFormat.JSON
    )
    records = QueryContextProcessor(cast(QueryContext, processor_context)).get_data(
        processed, [GenericDataType.NUMERIC] * len(processed.columns)
    )
    assert type(records) is list
    assert records[0][derived_column] is None
    assert records[0]["finite"] == 3.5
    assert records[0]["finite_integer"] == 2**53 + 1
    assert type(records[0]["finite_integer"]) is int
    pd.testing.assert_series_equal(processed.dtypes, dtypes)
    assert np.isinf(processed[derived_column].iloc[0])

    class _Context:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {
                "queries": [
                    {
                        "data": records,
                        "colnames": list(processed.columns),
                        "coltypes": [GenericDataType.NUMERIC] * len(processed.columns),
                        "rowcount": 1,
                    }
                ]
            }

    result = ChartDataCommand(_Context()).run()  # type: ignore[arg-type]
    data, failure = query_result_data(result)

    assert failure is None
    assert data is not None
    assert data[0][0][derived_column] is None
    assert data[0][0]["finite"] == 3.5
    assert data[0][0]["finite_integer"] == 2**53 + 1


def test_query_result_rejects_infinity_outside_the_producer_boundary() -> None:
    """Superset replaces infinities with NaN; an injected infinity is malformed."""
    data, failure = query_result_data(
        {"queries": [{"data": [{"value": float("-inf")}], "rowcount": 1}]}
    )

    assert data is None
    assert failure is not None
    assert "non-finite" in failure.error


@pytest.mark.parametrize(
    "row",
    [
        {"value": "x" * (1024 * 1024)},
        {"k" * (1024 * 1024): "value"},
        {"value": 1 << 10_000},
    ],
)
def test_query_result_rejects_adversarial_values_with_bounded_errors(
    row: dict[str, Any],
) -> None:
    data, failure = query_result_data({"queries": [{"data": [row], "rowcount": 1}]})

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"
    assert len(failure.error.encode()) < 500


def test_query_result_accepts_documented_row_and_scalar_boundaries() -> None:
    rows: list[dict[str, Any]] = [{} for _ in range(MAX_QUERY_RESULT_ROWS)]
    boundary_integer = 1 << (MAX_QUERY_RESULT_INTEGER_BITS - 1)
    row = {
        "k" * MAX_QUERY_RESULT_KEY_BYTES: "x" * MAX_QUERY_RESULT_STRING_BYTES,
        "integer": boundary_integer,
    }

    data, failure = query_result_data(
        {
            "queries": [
                {"data": rows, "rowcount": MAX_QUERY_RESULT_ROWS},
                {"data": [row], "rowcount": 1},
            ]
        }
    )

    assert failure is None
    assert data == [rows, [row]]

    data, failure = query_result_data({"queries": [{"data": [row], "rowcount": 1}]})
    assert failure is None
    assert data == [[row]]


def test_query_result_keeps_source_cell_string_cap_at_64_kib() -> None:
    data, failure = query_result_data(
        {
            "queries": [
                {
                    "data": [{"value": "x" * (MAX_QUERY_RESULT_STRING_BYTES + 1)}],
                    "rowcount": 1,
                }
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert "oversized string" in failure.error


@pytest.mark.parametrize("chart_shape", ["big_number_raw_trend", "mixed_timeseries"])
def test_query_result_accepts_two_max_row_query_legs(chart_shape: str) -> None:
    rows: list[dict[str, Any]] = [{} for _ in range(MAX_QUERY_RESULT_ROWS)]
    result = {
        "chart_shape": chart_shape,
        "queries": [
            {"data": rows, "rowcount": MAX_QUERY_RESULT_ROWS},
            {"data": rows, "rowcount": MAX_QUERY_RESULT_ROWS},
        ],
    }

    data, failure = query_result_data(result)

    assert failure is None
    assert data is not None
    assert sum(len(query_rows) for query_rows in data) == MAX_QUERY_RESULT_TOTAL_ROWS


def test_query_result_rejects_one_row_beyond_aggregate_multi_query_budget() -> None:
    rows: list[dict[str, Any]] = [{} for _ in range(MAX_QUERY_RESULT_ROWS)]

    data, failure = query_result_data(
        {
            "queries": [
                {"data": rows, "rowcount": MAX_QUERY_RESULT_ROWS},
                {"data": rows, "rowcount": MAX_QUERY_RESULT_ROWS},
                {"data": [{}], "rowcount": 1},
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert "total row limit" in failure.error


def test_complete_response_accepts_exact_aggregate_boundary_and_rejects_one_byte() -> (
    None
):
    prefix = 'quote " newline\n slash\\ café'
    prefix_response = _ProjectedResponse(value=prefix)
    filler_size = MAX_QUERY_RESULT_VALUE_BYTES - len(
        prefix_response.model_dump_json().encode()
    )
    boundary = _ProjectedResponse(value=prefix + "x" * filler_size)
    oversized = _ProjectedResponse(value=boundary.value + "x")

    assert len(boundary.model_dump_json().encode()) == MAX_QUERY_RESULT_VALUE_BYTES
    assert response_json_failure(boundary) is None
    failure = response_json_failure(oversized)
    assert failure is not None
    assert "response exceeds the total JSON-encoded byte limit" in failure.error


def test_complete_response_counts_pydantic_utc_z_wire_spelling_exactly() -> None:
    empty = _UTCProjectedResponse(
        timestamp=datetime(2026, 9, 2, tzinfo=timezone.utc), value=""
    )
    assert '"timestamp":"2026-09-02T00:00:00Z"' in empty.model_dump_json()
    filler = "x" * (
        MAX_QUERY_RESULT_VALUE_BYTES - len(empty.model_dump_json().encode())
    )
    boundary = _UTCProjectedResponse(timestamp=empty.timestamp, value=filler)
    oversized = _UTCProjectedResponse(timestamp=empty.timestamp, value=filler + "x")

    assert len(boundary.model_dump_json().encode()) == MAX_QUERY_RESULT_VALUE_BYTES
    assert response_json_failure(boundary) is None
    assert response_json_failure(oversized) is not None


def test_timedelta_envelope_uses_exact_json_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = {
        "queries": [
            {
                "data": [{"duration": "P1DT2.000003S"}],
                "rowcount": 1,
            }
        ]
    }
    exact_bytes = len(
        json.dumps(expected, ensure_ascii=False, separators=(",", ":")).encode()
    )
    monkeypatch.setattr(
        query_result_module, "MAX_QUERY_RESULT_VALUE_BYTES", exact_bytes
    )

    result = {
        "queries": [
            {
                "data": [{"duration": timedelta(days=1, seconds=2, microseconds=3)}],
                "rowcount": 1,
            }
        ]
    }
    data, failure = query_result_data(result)

    assert failure is None
    assert data == [[{"duration": "P1DT2.000003S"}]]
    assert len(json.dumps(result, separators=(",", ":")).encode()) == exact_bytes

    monkeypatch.setattr(
        query_result_module, "MAX_QUERY_RESULT_VALUE_BYTES", exact_bytes - 1
    )
    data, failure = query_result_data(
        {
            "queries": [
                {
                    "data": [
                        {"duration": timedelta(days=1, seconds=2, microseconds=3)}
                    ],
                    "rowcount": 1,
                }
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert "total JSON-encoded byte limit" in failure.error


def test_query_result_accepts_fifty_thousand_rows_with_twenty_columns() -> None:
    row = {f"column_{index}": index for index in range(20)}
    rows = [row] * MAX_QUERY_RESULT_ROWS

    data, failure = query_result_data(
        {"queries": [{"data": rows, "rowcount": MAX_QUERY_RESULT_ROWS}]}
    )

    assert failure is None
    assert data == [rows]


def test_query_result_rejects_one_row_beyond_documented_boundary() -> None:
    data, failure = query_result_data(
        {
            "queries": [
                {
                    "data": [{} for _ in range(MAX_QUERY_RESULT_ROWS + 1)],
                    "rowcount": MAX_QUERY_RESULT_ROWS + 1,
                }
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert "row limit" in failure.error


def test_query_result_enforces_total_value_work_boundary(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    value_limit = 10_000
    monkeypatch.setattr(query_result_module, "MAX_QUERY_RESULT_VALUES", value_limit)
    monkeypatch.setattr(
        query_result_module,
        "MAX_QUERY_RESULT_WORK",
        value_limit + query_result_module.MAX_QUERY_RESULT_METADATA_ITEMS,
    )
    values_per_row = 4096
    rows_needed = value_limit // (values_per_row + 2) + 1
    shared_values = [None] * values_per_row
    rows: list[dict[str, Any]] = [{"values": shared_values} for _ in range(rows_needed)]

    data, failure = query_result_data(
        {"queries": [{"data": rows, "rowcount": len(rows)}]}
    )

    assert data is None
    assert failure is not None
    assert "total values" in failure.error or "total work" in failure.error


def test_query_result_enforces_exact_json_encoded_data_byte_boundary() -> None:
    full_chunks = 255
    # Exact compact envelope syntax/keys plus the final string's quotes.
    fixed_json_bytes = 306
    remainder = (
        MAX_QUERY_RESULT_VALUE_BYTES
        - fixed_json_bytes
        - full_chunks * (MAX_QUERY_RESULT_STRING_BYTES + 2)
        - 2
    )
    values = ["x" * MAX_QUERY_RESULT_STRING_BYTES for _ in range(full_chunks)]
    values.append("x" * remainder)
    result = {"queries": [{"data": [{"values": values}], "rowcount": 1}]}

    data, failure = query_result_data(result)
    assert failure is None
    assert data == [[{"values": values}]]

    values[-1] += "x"
    data, failure = query_result_data(result)
    assert data is None
    assert failure is not None
    assert "total JSON-encoded byte limit" in failure.error


def test_query_result_rejects_aggregate_huge_numeric_json_before_serialization() -> (
    None
):
    huge_value = 10**999
    rows = [{"value": huge_value}] * 17_000

    data, failure = query_result_data(
        {"queries": [{"data": rows, "rowcount": len(rows)}]}
    )

    assert data is None
    assert failure is not None
    assert "total JSON-encoded byte limit" in failure.error


@pytest.mark.parametrize(
    "value",
    ['quote"slash\\control\n', "café 💥", "\x00\x1f"],
)
def test_json_string_meter_matches_real_utf8_serialization(value: str) -> None:
    encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()

    assert _json_string_size(value, MAX_QUERY_RESULT_STRING_BYTES) == len(encoded)


def test_query_result_charges_escaped_non_ascii_keys_and_nested_syntax() -> None:
    row = {'quoted"\\\n💥': {"nested": [None, True, 123, "café"]}}
    result = {"queries": [{"data": [row], "rowcount": 1}]}

    data, failure = query_result_data(result)

    assert failure is None
    assert data == [[row]]


def test_query_result_enforces_total_metadata_byte_boundary() -> None:
    # Compact JSON syntax/keys plus the final string's quotes are all charged.
    fixed_json_bytes = 63
    full_chunks = 15
    remainder = (
        MAX_QUERY_RESULT_METADATA_BYTES
        - fixed_json_bytes
        - full_chunks * (MAX_QUERY_RESULT_STRING_BYTES + 2)
        - 2
    )
    at_limit = ["x" * MAX_QUERY_RESULT_STRING_BYTES for _ in range(full_chunks)]
    at_limit.append("x" * remainder)

    data, failure = query_result_data(
        {
            "queries": [
                {"data": [], "metadata": at_limit, "rowcount": 0},
            ]
        }
    )
    assert failure is None
    assert data == [[]]

    at_limit[-1] += "x"
    data, failure = query_result_data(
        {
            "queries": [
                {"data": [], "metadata": at_limit, "rowcount": 0},
            ]
        }
    )
    assert data is None
    assert failure is not None
    assert "metadata exceeds the total JSON-encoded byte limit" in failure.error


@pytest.mark.parametrize("metadata_key", ["query", "sql"])
@pytest.mark.parametrize("sql_bytes", [MAX_QUERY_RESULT_STRING_BYTES + 1, 70 * 1024])
def test_query_result_accepts_full_sql_above_source_cell_string_limit(
    metadata_key: str, sql_bytes: int
) -> None:
    from superset.commands.chart.data.get_data_command import ChartDataCommand
    from superset.common.chart_data import ChartDataResultType

    prefix = 'SELECT "café"\\n'
    sql = prefix + "x" * (sql_bytes - len(prefix.encode()))
    assert len(sql.encode()) == sql_bytes

    class _Context:
        result_type = ChartDataResultType.FULL

        def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
            return {"queries": [{"data": [], metadata_key: sql, "rowcount": 0}]}

    result = ChartDataCommand(_Context()).run()  # type: ignore[arg-type]

    data, failure = query_result_data(result)

    assert failure is None
    assert data == [[]]


def test_query_result_enforces_exact_single_metadata_scalar_boundary() -> None:
    prefix = 'SELECT "café"\\n'
    # The query-only envelope charges 30 metadata bytes outside the SQL value:
    # top/query object syntax and the compact JSON keys. Escaping/non-ASCII in
    # the prefix is measured exactly by the shared JSON-string meter.
    fixed_metadata_bytes = 30
    prefix_bytes = _json_string_size(prefix, MAX_QUERY_RESULT_METADATA_BYTES)
    assert prefix_bytes is not None
    filler = MAX_QUERY_RESULT_METADATA_BYTES - fixed_metadata_bytes - prefix_bytes
    sql = prefix + "x" * filler

    data, failure = query_result_data({"queries": [{"data": [], "query": sql}]})
    assert failure is None
    assert data == [[]]

    data, failure = query_result_data({"queries": [{"data": [], "query": sql + "x"}]})
    assert data is None
    assert failure is not None
    assert "metadata exceeds the total JSON-encoded byte limit" in failure.error


def test_metadata_scalar_is_also_charged_to_aggregate_json_budget() -> None:
    sql = "SELECT 'café' -- " + "m" * (70 * 1024)
    empty_result = {"queries": [{"data": [{"values": []}], "query": sql}]}
    empty_size = len(
        json.dumps(empty_result, ensure_ascii=False, separators=(",", ":")).encode()
    )
    # Replacing [] with the first quoted string adds its bytes; every later
    # string also adds one comma. Leave one partial value for the exact edge.
    per_full_value = MAX_QUERY_RESULT_STRING_BYTES + 3
    full_value_count = (MAX_QUERY_RESULT_VALUE_BYTES - empty_size) // per_full_value
    values = ["x" * MAX_QUERY_RESULT_STRING_BYTES for _ in range(full_value_count)]
    result = {"queries": [{"data": [{"values": values}], "query": sql}]}
    encoded_size = len(
        json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode()
    )
    remaining = MAX_QUERY_RESULT_VALUE_BYTES - encoded_size
    assert 3 <= remaining <= MAX_QUERY_RESULT_STRING_BYTES + 3
    # Appending the final array item costs its quotes and, because the array is
    # nonempty, one comma in addition to its raw bytes.
    values.append("x" * (remaining - 3))
    assert (
        len(json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode())
        == MAX_QUERY_RESULT_VALUE_BYTES
    )

    data, failure = query_result_data(result)
    assert failure is None
    assert data == [[{"values": values}]]

    values[-1] += "x"
    data, failure = query_result_data(result)
    assert data is None
    assert failure is not None
    assert "total JSON-encoded byte limit" in failure.error


def test_query_result_bounds_arbitrary_top_level_metadata() -> None:
    data, failure = query_result_data(
        {
            "producer_metadata": "x" * (MAX_QUERY_RESULT_METADATA_BYTES + 1),
            "queries": [{"data": []}],
        }
    )

    assert data is None
    assert failure is not None
    assert "top-level result metadata" in failure.error


def test_query_result_enforces_decimal_digit_and_exponent_boundaries() -> None:
    at_digit_limit = Decimal("9" * MAX_QUERY_RESULT_DECIMAL_DIGITS)
    at_exponent_limit = Decimal("1e4096")
    data, failure = query_result_data(
        {
            "queries": [
                {
                    "data": [{"digits": at_digit_limit, "exponent": at_exponent_limit}],
                    "rowcount": 1,
                }
            ]
        }
    )
    assert failure is None
    assert data is not None

    for value in (
        Decimal("9" * (MAX_QUERY_RESULT_DECIMAL_DIGITS + 1)),
        Decimal(f"1e{MAX_QUERY_RESULT_DECIMAL_EXPONENT + 1}"),
    ):
        data, failure = query_result_data(
            {"queries": [{"data": [{"value": value}], "rowcount": 1}]}
        )
        assert data is None
        assert failure is not None


def test_query_result_requires_rowcount_to_cover_returned_data() -> None:
    data, failure = query_result_data(
        {"queries": [{"data": [{"value": 1}], "rowcount": 0}]}
    )

    assert data is None
    assert failure is not None
    assert "rowcount is smaller than len(data)" in failure.error


@pytest.mark.parametrize(
    "query",
    [
        {"data": [{"a": 1}], "colnames": ["a"], "coltypes": []},
        {
            "data": [{"a": 1}],
            "colnames": ["a"],
            "coltypes": [0, 1],
        },
        {"data": [{"a": 1}], "colnames": ["a"], "coltypes": "numeric"},
        {"data": [{"a": 1}], "colnames": ["a"], "coltypes": [None]},
        {"data": [{"a": 1}], "colnames": ["a"], "coltypes": [[0]]},
        {"data": [{"a": 1}], "colnames": ["a"], "coltypes": [True]},
        {"data": [{"a": 1}], "colnames": ["a"], "coltypes": [1.0]},
        {"data": [{"a": 1}], "colnames": ["a"], "coltypes": [5]},
        {"data": [{"a": 1}], "coltypes": [0]},
    ],
)
def test_query_result_rejects_malformed_or_misaligned_coltypes(
    query: dict[str, Any],
) -> None:
    data, failure = query_result_data({"queries": [query]})

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


@pytest.mark.parametrize(
    "colnames",
    [
        ["a", "a"],
        [""],
        [1],
        [_HostileStr("a")],
        ["a" * 5000],
    ],
)
def test_query_result_rejects_duplicate_or_malformed_colnames(
    colnames: list[Any],
) -> None:
    data, failure = query_result_data(
        {"queries": [{"data": [{"a": 1}], "colnames": colnames}]}
    )

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


@pytest.mark.parametrize(
    "query",
    [
        {"data": [{"a": 1}]},
        {"data": [{"a": 1}], "colnames": ["a"]},
        {"data": [], "coltypes": []},
        {
            "data": [{"a": 1, "b": "x", "c": [1]}],
            "colnames": ["a", "b", "c"],
            "coltypes": [
                GenericDataType.NUMERIC,
                1,
                GenericDataType.MULTI_VALUE,
            ],
        },
    ],
)
def test_query_result_accepts_legitimate_optional_column_metadata(
    query: dict[str, Any],
) -> None:
    data, failure = query_result_data({"queries": [query]})

    assert data == [query["data"]]
    assert failure is None


def test_query_result_validates_column_metadata_on_every_query() -> None:
    data, failure = query_result_data(
        {
            "queries": [
                {"data": [{"a": 1}], "colnames": ["a"], "coltypes": [0]},
                {"data": [{"b": 2}], "colnames": ["b"], "coltypes": []},
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"
    assert "query 2" in failure.error


def test_query_result_extracts_normal_nested_errors() -> None:
    data, failure = query_result_data(
        {"errors": [{"detail": "warehouse unavailable"}, "retry later"]}
    )
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert "warehouse unavailable; retry later" in failure.error


@pytest.mark.parametrize("shape", ["deep", "wide", "cycle", "repeated"])
def test_query_result_bounds_adversarial_error_containers(shape: str) -> None:
    if shape == "deep":
        payload: Any = "bottom"
        for _index in range(1201):
            payload = {"error": payload}
    elif shape == "wide":
        payload = [f"error {index}" for index in range(1000)]
    elif shape == "cycle":
        payload = []
        payload.append(payload)
    else:
        shared = {"message": "same failure"}
        payload = [shared, shared]

    data, failure = query_result_data({"error": payload})
    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


def test_query_result_safely_describes_huge_integer_error() -> None:
    data, failure = query_result_data({"error": 10**10000})
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert "integer with approximately" in failure.error
    assert "decimal digits" in failure.error


def test_query_result_truncates_error_text_deterministically_by_bytes() -> None:
    result = {"error": "é" * 5000}
    first = query_result_data(result)[1]
    second = query_result_data(result)[1]
    assert first is not None
    assert second is not None
    assert first.error == second.error
    assert "[truncated]" in first.error
    assert len(first.error.encode("utf-8")) <= 2100


@pytest.mark.parametrize(
    "payload",
    [
        b"warehouse unavailable" * 100_000,
        bytearray(b"warehouse unavailable" * 100_000),
        memoryview(b"warehouse unavailable" * 100_000),
    ],
)
def test_query_result_bounds_binary_scalars_before_conversion(payload: object) -> None:
    data, failure = query_result_data({"error": payload})
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert "warehouse unavailable" in failure.error
    assert "[truncated]" in failure.error
    assert len(failure.error.encode("utf-8")) <= 2100


def test_query_result_never_calls_custom_object_string_or_repr() -> None:
    class HostileScalar:
        def __str__(self) -> str:
            raise AssertionError("unbounded custom __str__ must not run")

        def __repr__(self) -> str:
            raise AssertionError("unbounded custom __repr__ must not run")

    data, failure = query_result_data({"error": HostileScalar()})
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert "<HostileScalar object>" in failure.error


@pytest.mark.parametrize(
    ("payload_factory", "descriptor"),
    [
        (lambda: _HostileStr("x" * 1_000_000), "<_HostileStr object>"),
        (lambda: _HostileInt(10**10000), "<_HostileInt object>"),
        (lambda: _HostileFloat(1.25), "<_HostileFloat object>"),
        (lambda: _HostileBytes(b"x" * 1_000_000), "<_HostileBytes object>"),
        (
            lambda: _HostileBytearray(b"x" * 1_000_000),
            "<_HostileBytearray object>",
        ),
        (lambda: _HostileBoolLike(), "<_HostileBoolLike object>"),
        (lambda: _HostileBytesLike(), "<_HostileBytesLike object>"),
    ],
)
def test_query_result_describes_builtin_subclasses_without_invoking_them(
    payload_factory: Callable[[], object], descriptor: str
) -> None:
    data, failure = query_result_data({"error": payload_factory()})
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert descriptor in failure.error
    assert len(failure.error.encode("utf-8")) <= 2100


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        ("warehouse unavailable", "warehouse unavailable"),
        (503, "503"),
        (1.25, "1.25"),
        (True, "True"),
        (b"binary failure", "binary failure"),
        (bytearray(b"binary failure"), "binary failure"),
        (memoryview(b"binary failure"), "binary failure"),
    ],
)
def test_query_result_retains_useful_exact_builtin_errors(
    payload: object, message: str
) -> None:
    data, failure = query_result_data({"error": payload})
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert message in failure.error


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        (_HostileStringEnum.FAILED, "failed"),
        (_TextEnum.VALUE, "warehouse unavailable"),
        (_IntegerEnum.VALUE, "503"),
        (_FloatEnum.VALUE, "1.25"),
        (_BooleanEnum.VALUE, "True"),
        (_BytesEnum.VALUE, "binary failure"),
        (_UnsupportedEnum.VALUE, "<_UnsupportedEnum object>"),
    ],
)
def test_query_result_safely_renders_supported_enum_values(
    payload: object, message: str
) -> None:
    data, failure = query_result_data({"error": payload})
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert message in failure.error


def test_query_result_reads_enum_status_without_public_value_or_string_hooks() -> None:
    data, failure = query_result_data(
        {"status": _HostileStringEnum.FAILED, "message": "warehouse timeout"}
    )
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert "warehouse timeout" in failure.error


def test_query_result_bounds_non_invoking_type_descriptors() -> None:
    hostile_type = type("T" * 1_000_000, (), {"__str__": _hostile_call})
    data, failure = query_result_data({"error": hostile_type()})
    assert data is None
    assert failure is not None
    assert failure.error_type == "QueryError"
    assert "[truncated]" in failure.error
    assert len(failure.error.encode("utf-8")) <= 2100


class _HostileDict(dict[str, Any]):
    __bool__ = _hostile_call
    __contains__ = _hostile_call
    __getitem__ = _hostile_call
    __iter__ = _hostile_call
    __len__ = _hostile_call
    get = _hostile_call


class _HostileList(list[Any]):
    __bool__ = _hostile_call
    __getitem__ = _hostile_call
    __iter__ = _hostile_call
    __len__ = _hostile_call


class _HostileRowScalar(str):
    __hash__ = _hostile_call
    __repr__ = _hostile_call
    __str__ = _hostile_call


@pytest.mark.parametrize(
    "result",
    [
        _HostileDict(queries=[]),
        {"queries": _HostileList([{"data": []}])},
        {"queries": [_HostileDict(data=[])]},
        {"queries": [{"data": _HostileList()}]},
    ],
)
def test_query_result_rejects_container_subclasses_without_invoking_them(
    result: object,
) -> None:
    data, failure = query_result_data(result)
    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


@pytest.mark.parametrize(
    "row_factory",
    [
        lambda: 1,
        lambda: "row",
        object,
        _HostileBoolLike,
        lambda: _HostileDict(value=1),
    ],
)
def test_query_result_requires_exact_dict_rows_without_conversion(
    row_factory: Callable[[], Any],
) -> None:
    data, failure = query_result_data({"queries": [{"data": [row_factory()]}]})

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"
    assert len(failure.error.encode()) <= 2000


def test_query_result_rejects_scalar_subclasses_inside_exact_rows() -> None:
    data, failure = query_result_data(
        {"queries": [{"data": [{"value": _HostileRowScalar("unsafe")}]}]}
    )

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


def test_query_result_rejects_custom_metaclass_scalars_without_type_hooks() -> None:
    class _HostileMeta(type):
        __eq__ = _hostile_call
        __hash__ = _hostile_call

    class _HostileScalar(metaclass=_HostileMeta):
        __repr__ = _hostile_call
        __str__ = _hostile_call

    data, failure = query_result_data(
        {"queries": [{"data": [{"value": _HostileScalar()}]}]}
    )

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


def test_query_result_rejects_custom_timezone_without_invoking_it() -> None:
    class _HostileTimezone(tzinfo):
        def utcoffset(self, _value: datetime | None) -> timedelta | None:
            raise AssertionError("custom timezone hook must not run")

        def dst(self, _value: datetime | None) -> timedelta | None:
            raise AssertionError("custom timezone hook must not run")

        def tzname(self, _value: datetime | None) -> str | None:
            raise AssertionError("custom timezone hook must not run")

    for value in (
        datetime(2024, 1, 1, tzinfo=_HostileTimezone()),
        datetime_time(12, tzinfo=_HostileTimezone()),
    ):
        data, failure = query_result_data({"queries": [{"data": [{"value": value}]}]})

        assert data is None
        assert failure is not None
        assert failure.error_type == "MalformedQueryResult"


def test_bullet_temporal_mode_projects_timestamp_and_numpy_before_generic() -> None:
    timestamp = pd.Timestamp("2024-01-02 03:04:05.123456789")
    numpy_timestamp = np.datetime64("1969-12-31T23:59:59.999999999")
    result = {
        "queries": [
            {
                "data": [
                    {
                        "timestamp": timestamp,
                        "numpy_timestamp": numpy_timestamp,
                        "date": date(2024, 1, 2),
                        "pandas_nat": pd.NaT,
                        "numpy_nat": np.datetime64("NaT"),
                    }
                ]
            }
        ]
    }

    data, failure = query_result_data(result, temporal_json_numbers=True)

    assert failure is None
    assert data == [
        [
            {
                "timestamp": 1704164645123.456,
                "numpy_timestamp": -0.0010000000000287557,
                "date": 1704153600000.0,
                "pandas_nat": None,
                "numpy_nat": None,
            }
        ]
    ]


def test_non_bullet_temporal_mode_retains_canonical_iso_projection() -> None:
    result = {
        "queries": [
            {
                "data": [
                    {
                        "timestamp": pd.Timestamp("2024-01-02 03:04:05.123456789"),
                        "numpy_timestamp": np.datetime64("2024-01-02", "D"),
                    }
                ]
            }
        ]
    }

    data, failure = query_result_data(result)

    assert failure is None
    assert data == [
        [
            {
                "timestamp": "2024-01-02T03:04:05.123456789",
                "numpy_timestamp": "2024-01-02T00:00:00",
            }
        ]
    ]


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("rowcount", -1),
        ("rowcount", 1.5),
        ("rowcount", float("nan")),
        ("rowcount", float("inf")),
        ("rowcount", True),
        ("rowcount", 1 << 1000),
        ("total_rows", -1),
        ("total_rows", "1"),
        ("cache_key", _HostileStr("key")),
        ("cache_key", "x" * 5000),
        ("cached_dttm", _HostileStr("2024-01-01")),
        ("cached_dttm", "x" * 5000),
        ("cache_dttm", _HostileStr("2024-01-01")),
        ("cache_dttm", "x" * 5000),
    ],
)
def test_query_result_rejects_unbounded_or_malformed_metadata(
    key: str, value: Any
) -> None:
    data, failure = query_result_data({"queries": [{"data": [], key: value}]})

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


def test_query_result_validates_top_level_and_every_query_metadata() -> None:
    for result in (
        {"rowcount": -1, "queries": [{"data": []}]},
        {
            "queries": [
                {"data": [], "rowcount": 0},
                {"data": [], "total_rows": 2.25},
            ]
        },
    ):
        data, failure = query_result_data(result)
        assert data is None
        assert failure is not None
        assert failure.error_type == "MalformedQueryResult"


def test_query_result_accepts_bounded_cache_metadata_and_integral_float_count() -> None:
    data, failure = query_result_data(
        {
            "cache_key": "top",
            "cached_dttm": datetime(2024, 1, 1, tzinfo=timezone.utc),
            "rowcount": 1.0,
            "queries": [
                {
                    "data": [],
                    "cache_key": "query",
                    "cached_dttm": "2024-01-01T00:00:00+00:00",
                    "cache_dttm": "2024-01-01T00:00:00+00:00",
                    "rowcount": 0.0,
                    "total_rows": 0,
                    "is_cached": False,
                }
            ],
        }
    )

    assert failure is None
    assert data == [[]]


def test_query_result_cache_datetime_rejects_hostile_timezone_without_hooks() -> None:
    class _HostileTimezone(tzinfo):
        def utcoffset(self, _value: datetime | None) -> timedelta | None:
            raise AssertionError("custom timezone hook must not run")

        def dst(self, _value: datetime | None) -> timedelta | None:
            raise AssertionError("custom timezone hook must not run")

        def tzname(self, _value: datetime | None) -> str | None:
            raise AssertionError("custom timezone hook must not run")

    data, failure = query_result_data(
        {
            "queries": [
                {
                    "data": [],
                    "cached_dttm": datetime(2024, 1, 1, tzinfo=_HostileTimezone()),
                }
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


def test_query_result_rejects_hostile_error_containers_without_invoking_them() -> None:
    data, failure = query_result_data({"error": _HostileDict(message="no")})
    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("short\ud800text", "short?text"),
        ("é\ud800中", "é?中"),
        ("\ud800" * 5000, "[truncated]"),
    ],
)
def test_utf8_truncation_replacement_sanitizes_surrogates(
    value: str, expected: str
) -> None:
    result = _truncate_utf8(value, 2000)
    assert expected in result
    assert "\ud800" not in result
    assert len(result.encode("utf-8")) <= 2000


def test_safe_exception_message_bounds_assertions_without_string_conversion() -> None:
    class HostileAssertionError(AssertionError):
        __str__ = _hostile_call

    message = safe_exception_message(HostileAssertionError("x" * 100_000 + "\ud800"))
    assert "[truncated]" in message
    assert "\ud800" not in message
    assert len(message.encode("utf-8")) <= 2000
