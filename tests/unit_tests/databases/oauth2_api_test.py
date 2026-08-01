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
from unittest.mock import call, MagicMock

import pytest
from pytest_mock import MockerFixture
from requests.exceptions import HTTPError

from superset import db
from superset.extensions import event_logger, stats_logger_manager
from superset.superset_typing import OAuth2State
from superset.utils.oauth2 import encode_oauth2_state


@pytest.fixture
def oauth2_command(mocker: MockerFixture) -> MagicMock:
    command = mocker.patch("superset.databases.api.OAuth2StoreTokenCommand")
    mocker.patch("superset.databases.api.render_template", return_value="OK")
    return command


def callback_state() -> str:
    state: OAuth2State = {
        "user_id": 1,
        "database_id": 1,
        "tab_id": "42",
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
    }
    return encode_oauth2_state(state)


@pytest.mark.parametrize(
    ("exchange_error", "expected_status", "expected_outcome", "transaction_method"),
    [
        (None, 200, "success", "commit"),
        (HTTPError("token endpoint unavailable"), 500, "error", "rollback"),
    ],
)
def test_oauth2_callback_emits_one_outcome_metric_after_transaction(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    oauth2_command: MagicMock,
    exchange_error: Exception | None,
    expected_status: int,
    expected_outcome: str,
    transaction_method: str,
) -> None:
    oauth2_command.return_value.run.side_effect = exchange_error
    mocker.patch.object(event_logger, "log")

    calls = mocker.MagicMock()
    transaction_complete = mocker.patch.object(db.session, transaction_method)
    metric = mocker.patch.object(stats_logger_manager.instance, "incr")
    calls.attach_mock(transaction_complete, "transaction_complete")
    calls.attach_mock(metric, "metric")

    response = client.get(
        "/api/v1/database/oauth2/",
        query_string={
            "state": callback_state(),
            "code": "XXX",
        },
    )

    assert response.status_code == expected_status
    assert calls.mock_calls == [
        call.transaction_complete(),
        call.metric(f"DatabaseRestApi.oauth2.{expected_outcome}"),
    ]


def test_oauth2_callback_excludes_provider_data_from_event_log(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    oauth2_command: MagicMock,
) -> None:
    event_log = mocker.patch.object(event_logger, "log")

    response = client.get(
        "/api/v1/database/oauth2/",
        query_string={
            "state": callback_state(),
            "code": "oauth-code-sentinel",
            "scope": "oauth-scope-sentinel",
            "error_description": "provider-error-sentinel",
            "provider_payload": "provider-payload-sentinel",
        },
    )

    assert response.status_code == 200
    record = event_log.call_args.kwargs["records"][0]
    assert record["path"] == "/api/v1/database/oauth2/"
    assert {
        "state",
        "code",
        "scope",
        "error_description",
        "provider_payload",
    }.isdisjoint(record)
