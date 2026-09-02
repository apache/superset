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

from datetime import date, datetime, time, timedelta, timezone, tzinfo
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import pytest
import pytz
from dateutil import tz as dateutil_tz

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.db_query_status import QueryStatus
from superset.mcp_service.chart.query_result import (
    first_query_data,
    MAX_QUERY_RESULTS,
    query_result_failure,
    validate_query_result_envelope,
)
from superset.utils.core import GenericDataType


class UppercaseStatus(Enum):
    FAILED = "FAILED"


class HostileEnum(Enum):
    VALUE = "hostile"

    def __getattribute__(self, name):
        if name == "value":
            raise AssertionError("hostile enum value hook executed")
        return object.__getattribute__(self, name)

    def __str__(self):
        raise AssertionError("hostile enum string hook executed")


@pytest.mark.parametrize(
    "payload",
    [
        {"error": "top-level error", "queries": []},
        {"error_message": "top-level error message", "queries": []},
        {"status": "ERROR", "message": "top-level status failure"},
        {"status": "timed out", "message": "top-level timeout"},
        {"success": False, "message": "top-level unsuccessful payload"},
        {"message": "standalone top-level failure"},
        {"queries": [{"status": "Failed", "message": "query failed"}]},
        {
            "queries": [
                {"status": "success", "data": [{"value": 1}]},
                {"status": QueryStatus.FAILED, "error_message": "second failed"},
            ]
        },
    ],
)
def test_query_result_failure_detects_every_failure_envelope(payload):
    failure = query_result_failure(payload)

    assert failure is not None
    assert failure.error_type == "QueryError"


def test_query_result_failure_rejects_arbitrary_status_enum_without_hooks():
    failure = query_result_failure(
        {"queries": [{"status": HostileEnum.VALUE, "message": "enum failed"}]}
    )

    assert failure is not None
    assert failure.error_type == "InvalidQueryResult"


@pytest.mark.parametrize(
    "payload",
    [
        None,
        [],
        {},
        {"queries": []},
        {"queries": [None]},
        {"queries": [{}]},
        {"queries": [{"data": None}]},
        {"queries": [{"data": {"value": 1}}]},
    ],
)
def test_first_query_data_rejects_malformed_envelopes(payload):
    data, error = first_query_data(payload)

    assert data is None
    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_first_query_data_allows_legitimate_empty_result():
    data, error = first_query_data(
        {"status": "success", "queries": [{"status": "success", "data": []}]}
    )

    assert data == []
    assert error is None


class HostileList(list[object]):
    def __iter__(self):
        raise AssertionError("hostile list hook executed")

    def __getitem__(self, key):
        raise AssertionError("hostile list slicing hook executed")


class HostileDict(dict[str, object]):
    def get(self, key, default=None):
        raise AssertionError("hostile mapping hook executed")

    def items(self):
        raise AssertionError("hostile mapping iteration executed")


class HostileColumnType(int):
    def __hash__(self):
        raise AssertionError("hostile column type hash hook executed")


@pytest.mark.parametrize(
    "payload",
    [
        {"queries": [HostileDict(data=[])]},
        {"queries": [{"data": HostileList()}]},
        {"queries": [{"data": [HostileDict(value=1)]}]},
        {"queries": [{"data": [{"value": 1}], "colnames": HostileList(["value"])}]},
        {"queries": [{"data": [{"value": object()}], "colnames": ["value"]}]},
    ],
)
def test_strict_result_validation_rejects_hostile_containers_without_hooks(
    payload,
):
    error = validate_query_result_envelope(payload)

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_strict_result_validation_rejects_oversized_multi_query_data(monkeypatch):
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_ROWS", 1
    )
    error = validate_query_result_envelope(
        {
            "queries": [
                {
                    "data": [{"value": 1}],
                    "colnames": ["value"],
                    "coltypes": [0],
                },
                {
                    "data": [{"value": 2}, {"value": 3}],
                    "colnames": ["value"],
                    "coltypes": [0],
                },
            ]
        }
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"
    assert "too many" in error.error
    assert "rows" in error.error


def test_strict_result_validation_accepts_bounded_multi_query_data():
    assert (
        validate_query_result_envelope(
            {
                "queries": [
                    {
                        "data": [{"value": 1}],
                        "colnames": ["value"],
                        "coltypes": [0],
                    },
                    {
                        "data": [{"total": 1}],
                        "colnames": ["total"],
                        "coltypes": [0],
                    },
                ]
            }
        )
        is None
    )


def test_first_query_data_validates_secondary_queries_before_returning_rows():
    data, error = first_query_data(
        {
            "queries": [
                {"data": [{"value": 1}], "colnames": ["value"], "coltypes": [0]},
                {"data": HostileList()},
            ]
        }
    )

    assert data is None
    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_first_query_data_none_as_empty_still_validates_all_queries() -> None:
    data, error = first_query_data(
        {
            "queries": [
                {"data": None},
                {"data": [{"value": object()}]},
            ]
        },
        none_as_empty=True,
    )

    assert data is None
    assert error is not None


@pytest.mark.parametrize(
    "metadata",
    [
        {"colnames": ["value", "value"]},
        {"colnames": [""]},
        {"colnames": ["value"], "coltypes": []},
        {"colnames": ["value"], "coltypes": [[0]]},
        {"colnames": ["value"], "coltypes": [{"value": 0}]},
        {"colnames": ["value"], "coltypes": [99]},
        {"colnames": ["value"], "coltypes": [HostileColumnType(0)]},
        {"coltypes": [0]},
    ],
)
def test_strict_result_validation_rejects_malformed_column_metadata(metadata):
    error = validate_query_result_envelope(
        {"queries": [{"data": [{"value": 1}], **metadata}]}
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_strict_result_validation_accepts_aligned_optional_column_metadata():
    assert (
        validate_query_result_envelope(
            {
                "queries": [
                    {
                        "data": [{"value": 1}],
                        "colnames": ["value"],
                        "coltypes": [0],
                    },
                    {
                        "data": [{"secondary": "x"}],
                        "colnames": ["secondary"],
                        "coltypes": [1],
                    },
                ]
            }
        )
        is None
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"queries": [{"data": [{"value": HostileEnum.VALUE}]}]},
        {"queries": [{"data": [], "status": HostileEnum.VALUE}]},
        {"queries": [{"data": [], "metadata": HostileEnum.VALUE}]},
        {"queries": [{"data": [], "rowcount": HostileEnum.VALUE}]},
    ],
)
def test_strict_result_validation_rejects_hostile_enums_without_hooks(payload):
    error = validate_query_result_envelope(payload)

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_first_query_data_rejects_hostile_enum_without_hooks():
    data, error = first_query_data(
        {"queries": [{"data": [{"value": HostileEnum.VALUE}]}]}
    )

    assert data is None
    assert error is not None
    assert error.error_type == "InvalidQueryResult"


@pytest.mark.parametrize(
    "metadata",
    [
        {"coltypes": [0]},
        {"colnames": ["value"]},
        {"colnames": ["other"], "coltypes": [0]},
        {"colnames": ["value", "other"], "coltypes": [0, 0]},
    ],
)
def test_column_metadata_requires_alignment_with_every_row(metadata):
    error = validate_query_result_envelope(
        {"queries": [{"data": [{"value": 1}], **metadata}]}
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


class IntSubclass(int):
    pass


class HostileScalarInt(int):
    def __str__(self) -> str:
        raise AssertionError("hostile scalar string hook executed")

    def __hash__(self) -> int:
        raise AssertionError("hostile scalar hash hook executed")


@pytest.mark.parametrize(
    "rowcount",
    [True, False, -1, 1.0, float("inf"), {}, IntSubclass(1), 2**63],
)
def test_rowcount_is_exact_bounded_nonnegative_int_or_null(rowcount):
    error = validate_query_result_envelope(
        {"queries": [{"data": [], "rowcount": rowcount}]}
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


@pytest.mark.parametrize("rowcount", [None, 0, 2**63 - 1])
def test_rowcount_accepts_exact_bounded_values(rowcount):
    assert (
        validate_query_result_envelope(
            {"queries": [{"data": [], "rowcount": rowcount}]}
        )
        is None
    )


@pytest.mark.parametrize("is_cached", [0, 1, {}, IntSubclass(1)])
def test_is_cached_requires_exact_bool(is_cached):
    error = validate_query_result_envelope(
        {"queries": [{"data": [], "is_cached": is_cached}]}
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_real_fresh_is_cached_null_is_canonicalized() -> None:
    result: dict[str, Any] = {"queries": [{"data": [], "is_cached": None}]}

    assert validate_query_result_envelope(result) is None
    assert result["queries"][0]["is_cached"] is False


def test_cache_and_filter_metadata_exact_shapes_are_accepted():
    assert (
        validate_query_result_envelope(
            {
                "queries": [
                    {
                        "data": [],
                        "cache_key": "key",
                        "cache_dttm": "2026-09-02T00:00:00+00:00",
                        "is_cached": False,
                        "applied_filters": [{"column": "region"}],
                        "rejected_filters": [
                            {"column": "missing", "reason": "not_in_datasource"}
                        ],
                        "rejected_filter_columns": ["missing"],
                    }
                ]
            }
        )
        is None
    )


@pytest.mark.parametrize(
    "metadata",
    [
        {"cache_key": {}},
        {"cache_dttm": {}},
        {"applied_filters": {"column": "region"}},
        {"applied_filters": [{"column": "region", "extra": True}]},
        {"rejected_filters": [{"column": "missing"}]},
        {"rejected_filter_columns": [{"column": "missing"}]},
    ],
)
def test_cache_and_filter_metadata_rejects_non_wire_shapes(metadata):
    error = validate_query_result_envelope({"queries": [{"data": [], **metadata}]})

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


@pytest.mark.parametrize(
    "value",
    [
        10**5000,
        float("nan"),
        float("inf"),
        float("-inf"),
        Decimal("NaN"),
        Decimal("Infinity"),
        Decimal("1e5000"),
        b"\xff",
        bytearray(b"unsafe"),
        memoryview(b"unsafe"),
        QueryStatus.SUCCESS,
        HostileScalarInt(1),
    ],
    ids=[
        "huge-int",
        "nan",
        "positive-infinity",
        "negative-infinity",
        "decimal-nan",
        "decimal-infinity",
        "decimal-magnitude",
        "bytes",
        "bytearray",
        "memoryview",
        "query-status",
        "hostile-int-subclass",
    ],
)
def test_row_scalars_are_exact_finite_bounded_primitives(value: Any) -> None:
    error = validate_query_result_envelope(
        {
            "queries": [
                {
                    "data": [{"value": value}],
                    "colnames": ["value"],
                    "coltypes": [0],
                }
            ]
        }
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_exact_known_status_enum_is_allowed_only_in_status_slot() -> None:
    assert (
        validate_query_result_envelope(
            {"queries": [{"status": QueryStatus.SUCCESS, "data": []}]}
        )
        is None
    )
    error = validate_query_result_envelope(
        {"queries": [{"data": [], "metadata": QueryStatus.SUCCESS}]}
    )
    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_row_keys_must_match_declared_column_order() -> None:
    error = validate_query_result_envelope(
        {
            "queries": [
                {
                    "data": [{"second": 2, "first": 1}],
                    "colnames": ["first", "second"],
                    "coltypes": [0, 0],
                }
            ]
        }
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"
    assert "column order" in error.error


class StringSubclass(str):
    pass


@pytest.mark.parametrize(
    "metadata",
    [
        {"cached_dttm": "not-a-timestamp"},
        {"cached_dttm": "2026-09-02T00:00:00"},
        {"cached_dttm": "2026-09-02T01:00:00+01:00"},
        {"cached_dttm": "2" * 1000},
        {"cached_dttm": StringSubclass("2026-09-02T00:00:00+00:00")},
        {"queried_dttm": -1},
        {"queried_dttm": "2026-09-02T00:00:00"},
        {"cache_timeout": -1},
        {"cache_timeout": 2**31},
        {"cache_timeout": IntSubclass(1)},
        {"cache_key": StringSubclass("key")},
    ],
)
def test_cache_timestamp_and_timeout_metadata_is_canonical(metadata: Any) -> None:
    error = validate_query_result_envelope({"queries": [{"data": [], **metadata}]})

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_canonical_and_bounded_legacy_cache_metadata_are_accepted() -> None:
    result = {
        "queries": [
            {
                "data": [],
                "cached_dttm": "2026-09-02T00:00:00+00:00",
                "cache_dttm": "2026-09-01T00:00:00Z",
                "queried_dttm": "2026-09-02T00:00:00Z",
                "cache_timeout": 300,
            }
        ]
    }

    assert validate_query_result_envelope(result) is None
    assert result["queries"][0] == {
        "data": [],
        "cached_dttm": "2026-09-02T00:00:00+00:00",
        "cache_dttm": "2026-09-01T00:00:00+00:00",
        "queried_dttm": "2026-09-02T00:00:00+00:00",
        "cache_timeout": 300,
    }


class FakeQueryContext:
    """Minimal real ``ChartDataCommand.run`` producer for boundary tests."""

    result_type = ChartDataResultType.FULL
    result_format = ChartDataResultFormat.JSON

    def __init__(self, query: dict[str, Any]) -> None:
        self.query = query

    def get_payload(self, **_kwargs: Any) -> dict[str, Any]:
        return {"queries": [self.query]}


def _producer_result(query: dict[str, Any]) -> dict[str, Any]:
    return ChartDataCommand(FakeQueryContext(query)).run()  # type: ignore[arg-type]


def test_actual_chart_data_command_envelope_is_canonicalized_by_both_consumers() -> (
    None
):
    query = {
        "data": [{"event_time": pd.Timestamp("2026-09-02T10:11:12Z"), "value": 7}],
        "colnames": ["event_time", "value"],
        "coltypes": [GenericDataType.TEMPORAL, GenericDataType.NUMERIC],
        "status": QueryStatus.SUCCESS,
        "result_format": ChartDataResultFormat.JSON,
        "is_cached": None,
        "cache_key": None,
        "cached_dttm": None,
        "queried_dttm": None,
        "cache_timeout": 300,
        "rowcount": 1,
        "sql_rowcount": 1,
        "from_dttm": datetime(2026, 9, 1, tzinfo=timezone.utc),
        "to_dttm": datetime(2026, 9, 2, tzinfo=timezone.utc),
        "label_map": {"value": ["value"]},
        "applied_filters": [],
        "rejected_filters": [],
    }

    validated = _producer_result(query.copy())
    assert "query_context" in validated
    sidecar = validated["query_context"]
    assert validate_query_result_envelope(validated) is None
    assert validated["query_context"] is sidecar
    assert validated["queries"][0]["result_format"] == "json"
    assert validated["queries"][0]["is_cached"] is False
    assert validated["queries"][0]["data"] == [
        {"event_time": "2026-09-02T10:11:12+00:00", "value": 7}
    ]

    consumed = _producer_result(query.copy())
    data, error = first_query_data(consumed)
    assert error is None
    assert data == [{"event_time": "2026-09-02T10:11:12+00:00", "value": 7}]


def test_query_context_sidecar_is_exempt_without_hook_dispatch() -> None:
    class HostileSidecar:
        def __getattribute__(self, name: str) -> Any:
            raise AssertionError(f"sidecar hook executed for {name}")

    sidecar = HostileSidecar()
    result = {"query_context": sidecar, "queries": [{"data": []}]}

    assert validate_query_result_envelope(result) is None
    assert dict.__getitem__(result, "query_context") is sidecar


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (
            pd.Timestamp("2024-01-02T03:04:05.123456789"),
            "2024-01-02T03:04:05.123456789",
        ),
        (pd.Timedelta("1 day 2 seconds"), "P1DT0H0M2S"),
        (pd.NaT, None),
        (pd.NA, None),
        (np.datetime64("2024-01-02T03:04:05"), "2024-01-02T03:04:05"),
        (np.timedelta64(1500, "ms"), "P0DT0H0M1.5S"),
        (np.int64(7), 7),
        (np.uint64(8), 8),
        (np.float32(1.5), 1.5),
        (np.bool_(True), True),
        (Decimal("1.2300"), "1.2300"),
        (date(2024, 1, 2), "2024-01-02"),
        (time(3, 4, 5), "03:04:05"),
        (datetime(2024, 1, 2, 3, 4, 5), "2024-01-02T03:04:05"),
        (timedelta(seconds=2), "P0DT0H0M2S"),
        (
            UUID("12345678-1234-5678-1234-567812345678"),
            "12345678-1234-5678-1234-567812345678",
        ),
    ],
)
def test_trusted_dataframe_scalars_are_json_native(value: Any, expected: Any) -> None:
    result = _producer_result({"data": [{"value": value}]})

    data, error = first_query_data(result)

    assert error is None
    assert data == [{"value": expected}]
    assert type(data[0]["value"]) is type(expected)


def test_pandas_timestamp_preserves_fold_offset() -> None:
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
    result = _producer_result({"data": [{"value": folded}]})

    data, error = first_query_data(result)

    assert error is None
    assert data == [{"value": "2024-11-03T01:30:00-05:00"}]


@pytest.mark.parametrize(
    ("timezone_value", "expected"),
    [
        (dateutil_tz.tzoffset("IST", 19_800), "2024-01-02T03:04:05+05:30"),
        (pytz.FixedOffset(-240), "2024-01-02T03:04:05-04:00"),
        (dateutil_tz.gettz("US/Pacific"), "2024-01-02T03:04:05-08:00"),
    ],
)
def test_pandas_timestamp_accepts_safe_producer_timezones(
    timezone_value: tzinfo, expected: str
) -> None:
    result = _producer_result(
        {"data": [{"value": pd.Timestamp(2024, 1, 2, 3, 4, 5, tz=timezone_value)}]}
    )

    data, error = first_query_data(result)

    assert error is None
    assert data == [{"value": expected}]


class HostileTimezone(tzinfo):
    def utcoffset(self, dt):
        raise AssertionError("timezone hook executed")

    def dst(self, dt):
        raise AssertionError("timezone hook executed")

    def tzname(self, dt):
        raise AssertionError("timezone hook executed")


def test_exact_datetime_rejects_untrusted_timezone_without_hooks() -> None:
    result = _producer_result(
        {"data": [{"value": datetime(2024, 1, 1, tzinfo=HostileTimezone())}]}
    )

    error = validate_query_result_envelope(result)

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


def test_aggregate_rows_accept_boundary_and_reject_one_beyond(monkeypatch) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_ROWS", 2
    )
    boundary: dict[str, Any] = {"queries": [{"data": [{}]}, {"data": [{}]}]}
    beyond: dict[str, Any] = {"queries": [{"data": [{}]}, {"data": [{}, {}]}]}

    assert validate_query_result_envelope(boundary) is None
    error = validate_query_result_envelope(beyond)
    assert error is not None
    assert "aggregate rows" in error.error


def test_per_query_row_limit_is_independent_of_aggregate_limit(monkeypatch) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_ROWS_PER_QUERY", 1
    )
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_ROWS", 3
    )
    boundary: dict[str, Any] = {"queries": [{"data": [{}]}, {"data": [{}]}]}
    beyond: dict[str, Any] = {"queries": [{"data": [{}, {}]}]}

    assert validate_query_result_envelope(boundary) is None
    error = validate_query_result_envelope(beyond)
    assert error is not None
    assert "too many rows for query 1" in error.error


def test_aggregate_nested_nodes_accept_boundary_and_reject_one_beyond(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_VALUES", 10
    )
    boundary = {"queries": [{"data": [{"x": 1}]}, {"data": [{"x": 2}]}]}
    beyond = {"queries": [{"data": [{"x": 1}]}, {"data": [{"x": [2]}]}]}

    assert validate_query_result_envelope(boundary) is None
    error = validate_query_result_envelope(beyond)
    assert error is not None
    assert "aggregate values" in error.error


def test_aggregate_utf8_bytes_accept_boundary_and_reject_one_beyond(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_VALUE_BYTES", 19
    )
    boundary = {"queries": [{"data": [{"x": "a"}]}, {"data": [{"x": "a"}]}]}
    beyond = {"queries": [{"data": [{"x": "a"}]}, {"data": [{"x": "aa"}]}]}

    assert validate_query_result_envelope(boundary) is None
    error = validate_query_result_envelope(beyond)
    assert error is not None
    assert "UTF-8 bytes" in error.error


def test_max_query_count_cannot_multiply_the_shared_nested_budget(monkeypatch) -> None:
    monkeypatch.setattr(
        "superset.mcp_service.chart.query_result.MAX_QUERY_RESULT_VALUES", 100
    )
    result = {
        "queries": [
            {"data": [{"value": [None, None]}]} for _ in range(MAX_QUERY_RESULTS)
        ]
    }

    error = validate_query_result_envelope(result)

    assert error is not None
    assert "aggregate values" in error.error
