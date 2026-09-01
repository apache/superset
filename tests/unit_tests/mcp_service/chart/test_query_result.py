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
