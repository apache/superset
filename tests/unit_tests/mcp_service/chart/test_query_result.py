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

from decimal import Decimal
from enum import Enum
from typing import Any

import pytest

from superset.common.db_query_status import QueryStatus
from superset.mcp_service.chart.query_result import (
    first_query_data,
    query_result_failure,
    validate_query_result_envelope,
)


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
    assert "too many rows" in error.error


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


@pytest.mark.parametrize("is_cached", [0, 1, None, {}, IntSubclass(1)])
def test_is_cached_requires_exact_bool(is_cached):
    error = validate_query_result_envelope(
        {"queries": [{"data": [], "is_cached": is_cached}]}
    )

    assert error is not None
    assert error.error_type == "InvalidQueryResult"


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
    assert (
        validate_query_result_envelope(
            {
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
        )
        is None
    )
