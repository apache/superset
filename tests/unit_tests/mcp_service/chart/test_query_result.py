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

from typing import Any

import pytest

from superset.mcp_service.chart.query_result import query_result_data


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
