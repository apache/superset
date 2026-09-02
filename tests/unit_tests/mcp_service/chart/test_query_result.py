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

from enum import Enum

import pytest

from superset.common.db_query_status import QueryStatus
from superset.mcp_service.chart.query_result import (
    first_query_data,
    query_result_failure,
    validate_query_result_envelope,
)


class UppercaseStatus(Enum):
    FAILED = "FAILED"


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
        {"queries": [{"status": UppercaseStatus.FAILED, "message": "enum failed"}]},
    ],
)
def test_query_result_failure_detects_every_failure_envelope(payload):
    failure = query_result_failure(payload)

    assert failure is not None
    assert failure.error_type == "QueryError"


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
                {"data": [{"value": 1}], "colnames": ["value"]},
                {"data": [{"value": 2}, {"value": 3}], "colnames": ["value"]},
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
                    {"data": [{"value": 1}], "colnames": ["value"]},
                    {"data": [{"total": 1}], "colnames": ["total"]},
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
                    {"data": [{"secondary": "x"}], "colnames": ["secondary"]},
                ]
            }
        )
        is None
    )
