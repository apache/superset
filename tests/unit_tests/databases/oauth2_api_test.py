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

import logging
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from requests.exceptions import HTTPError
from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.daos.database import DatabaseUserOAuth2TokensDAO
from superset.exceptions import OAuth2Error
from superset.extensions import event_logger, stats_logger_manager
from superset.models.core import Database, Log
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
        (DatabaseNotFoundError(), 404, "warning", "rollback"),
        (OAuth2Error("Token exchange failed"), 500, "error", "rollback"),
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

    calls = mocker.MagicMock()
    transaction_complete = mocker.patch.object(db.session, transaction_method)
    event_log = mocker.patch.object(event_logger, "log")
    metric = mocker.patch.object(stats_logger_manager.instance, "incr")
    calls.attach_mock(transaction_complete, "transaction_complete")
    calls.attach_mock(event_log, "event_log")
    calls.attach_mock(metric, "metric")

    response = client.get(
        "/api/v1/database/oauth2/",
        query_string={
            "state": callback_state(),
            "code": "XXX",
        },
    )

    assert response.status_code == expected_status
    expected_calls = ["transaction_complete"]
    if exchange_error is None:
        expected_calls.append("event_log")
    expected_calls.append("metric")
    assert [mock_call[0] for mock_call in calls.mock_calls] == expected_calls
    metric.assert_called_once_with(f"DatabaseRestApi.oauth2.{expected_outcome}")


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
        headers={
            "Referer": "https://idp.example/authorize?code=referrer-code-sentinel"
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
    assert event_log.call_args.kwargs["referrer"] is None


def test_oauth2_callback_redacts_exchange_exception_from_all_logs(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    client: Any,
    full_api_access: None,
) -> None:
    database = mocker.MagicMock(spec=Database)
    database.id = 1
    database.db_engine_spec.engine = "postgresql"
    database.get_oauth2_config.return_value = {
        "client_id": "client-id",
        "client_secret": "client-secret",
    }
    database.db_engine_spec.get_oauth2_token.side_effect = HTTPError(
        "provider-payload-sentinel"
    )
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "get_database",
        return_value=database,
    )
    mocker.patch.object(event_logger, "log")

    with caplog.at_level(logging.DEBUG):
        response = client.get(
            "/api/v1/database/oauth2/",
            query_string={
                "state": callback_state(),
                "code": "oauth-code-sentinel",
            },
        )

    assert response.status_code == 500
    assert "provider-payload-sentinel" not in caplog.text
    assert "oauth-code-sentinel" not in caplog.text
    assert "provider-payload-sentinel" not in response.get_data(as_text=True)
    assert "oauth-code-sentinel" not in response.get_data(as_text=True)


def test_oauth2_callback_event_log_failure_preserves_business_write(
    mocker: MockerFixture,
    client: Any,
    full_api_access: None,
    oauth2_command: MagicMock,
) -> None:
    action = "oauth2_business_write_test"
    db.session.query(Log).filter_by(action=action).delete()
    db.session.commit()
    oauth2_command.return_value.run.side_effect = lambda: db.session.add(
        Log(action=action)
    )
    mocker.patch.object(
        db.session,
        "bulk_save_objects",
        side_effect=SQLAlchemyError("event log failure"),
    )
    metric = mocker.patch.object(stats_logger_manager.instance, "incr")

    try:
        response = client.get(
            "/api/v1/database/oauth2/",
            query_string={
                "state": callback_state(),
                "code": "XXX",
            },
        )

        assert response.status_code == 200
        assert db.session.query(Log).filter_by(action=action).one()
        metric.assert_called_once_with("DatabaseRestApi.oauth2.success")
    finally:
        db.session.query(Log).filter_by(action=action).delete()
        db.session.commit()
