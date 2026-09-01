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
from superset.mcp_service.chart.query_result import query_result_failure


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
def test_query_result_failure_detects_failure_envelopes(payload):
    failure = query_result_failure(payload)

    assert failure is not None
    assert failure.error_type == "QueryError"


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "success", "message": "served from cache", "queries": []},
        {
            "queries": [
                {"status": QueryStatus.SUCCESS, "message": "no rows", "data": []}
            ]
        },
        {"queries": [{"status": "running", "message": "in progress", "data": []}]},
        {"queries": [{"message": "informational", "data": []}]},
        {"queries": [{"data": []}]},
    ],
)
def test_query_result_failure_allows_valid_and_informational_envelopes(payload):
    assert query_result_failure(payload) is None
