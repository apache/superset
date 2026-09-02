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

from collections.abc import Callable
from datetime import datetime, timedelta, timezone, tzinfo
from enum import Enum
from typing import Any

import pytest

from superset.mcp_service.chart.query_result import (
    _truncate_utf8,
    query_result_data,
    safe_exception_message,
)
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


def test_query_result_rejects_custom_timezone_without_invoking_it() -> None:
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
                {"data": [{"value": datetime(2024, 1, 1, tzinfo=_HostileTimezone())}]}
            ]
        }
    )

    assert data is None
    assert failure is not None
    assert failure.error_type == "MalformedQueryResult"


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
