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

from typing import Any

import pytest
from pytest_mock import MockerFixture
from requests.exceptions import HTTPError

from superset.superset_typing import OAuth2State
from superset.utils.oauth2 import encode_oauth2_state


@pytest.mark.parametrize(
    ("exchange_error", "expected_status", "expected_outcome"),
    [
        (None, 200, "success"),
        (HTTPError("token endpoint unavailable"), 500, "error"),
    ],
)
def test_oauth2_callback_emits_outcome_metric(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    exchange_error: Exception | None,
    expected_status: int,
    expected_outcome: str,
) -> None:
    from superset.databases.api import DatabaseRestApi

    command = mocker.patch("superset.databases.api.OAuth2StoreTokenCommand")
    command.return_value.run.side_effect = exchange_error
    mocker.patch("superset.databases.api.render_template", return_value="OK")
    incr_stats = mocker.patch.object(DatabaseRestApi, "incr_stats")

    state: OAuth2State = {
        "user_id": 1,
        "database_id": 1,
        "tab_id": "42",
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
    }
    response = client.get(
        "/api/v1/database/oauth2/",
        query_string={
            "state": encode_oauth2_state(state),
            "code": "XXX",
        },
    )

    assert response.status_code == expected_status
    incr_stats.assert_called_once_with(expected_outcome, "oauth2")
