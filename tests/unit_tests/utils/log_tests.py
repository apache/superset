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
from unittest.mock import MagicMock, patch

from superset.utils.log import AuditLogSource, DBEventLogger, get_logger_from_status


def test_log_from_status_exception() -> None:
    (func, log_level) = get_logger_from_status(500)
    assert func.__name__ == "exception"
    assert log_level == "exception"


def test_log_from_status_warning() -> None:
    (func, log_level) = get_logger_from_status(422)
    assert func.__name__ == "warning"
    assert log_level == "warning"


def test_log_from_status_info() -> None:
    (func, log_level) = get_logger_from_status(300)
    assert func.__name__ == "info"
    assert log_level == "info"


def test_audit_log_source_values() -> None:
    assert AuditLogSource.API == "API"
    assert AuditLogSource.MCP == "MCP"
    assert AuditLogSource.CHATBOT == "Chatbot"
    assert AuditLogSource.PRESET == "Preset"
    assert AuditLogSource.EMBEDDED == "Embedded"
    assert set(AuditLogSource) == {"API", "MCP", "Chatbot", "Preset", "Embedded"}


def test_db_event_logger_log_with_source() -> None:
    logger = DBEventLogger()

    with (
        patch("superset.db") as mock_db,
        patch("superset.models.core.Log") as mock_log,
    ):
        mock_db.session.bulk_save_objects = MagicMock()
        mock_db.session.commit = MagicMock()
        mock_log.return_value = MagicMock()

        logger.log(
            user_id=1,
            action="test_action",
            dashboard_id=None,
            duration_ms=100,
            slice_id=None,
            referrer=None,
            records=[{}],
            source=AuditLogSource.MCP,
        )

        mock_log.assert_called_once()
        call_kwargs = mock_log.call_args[1]
        assert call_kwargs["source"] == AuditLogSource.MCP


def test_db_event_logger_log_without_source() -> None:
    logger = DBEventLogger()

    with (
        patch("superset.db") as mock_db,
        patch("superset.models.core.Log") as mock_log,
    ):
        mock_db.session.bulk_save_objects = MagicMock()
        mock_db.session.commit = MagicMock()
        mock_log.return_value = MagicMock()

        logger.log(
            user_id=1,
            action="test_action",
            dashboard_id=None,
            duration_ms=100,
            slice_id=None,
            referrer=None,
            records=[{}],
        )

        call_kwargs = mock_log.call_args[1]
        assert call_kwargs["source"] is None


def test_log_with_context_passes_audit_source() -> None:
    logger = DBEventLogger()
    captured: list[Any] = []

    def fake_log(*args: Any, **kwargs: Any) -> None:
        captured.append(kwargs.get("source"))

    logger.log = fake_log  # type: ignore[method-assign]

    # Pre-create mocks to avoid patch() calling _is_async_obj() on LocalProxies
    # (Python 3.11 hasattr introspection requires an active request context).
    mock_g = MagicMock()
    mock_g.get.return_value = AuditLogSource.API
    mock_request = MagicMock()
    mock_request.referrer = None
    mock_request.form.to_dict.return_value = {}
    mock_request.args.to_dict.return_value = {}
    mock_request.is_json = False
    mock_request.url_rule = "/test"
    mock_request.path = "/test"

    with (
        patch("superset.utils.log.has_request_context", return_value=True),
        patch("superset.utils.log.g", new=mock_g),
        patch("superset.utils.log.request", new=mock_request),
        patch("superset.utils.log.get_user_id", return_value=None),
        patch("superset.utils.log.stats_logger_manager"),
    ):
        logger.log_with_context(action="test_action", log_to_statsd=False)

    assert captured == [AuditLogSource.API]


def test_log_with_context_no_audit_source() -> None:
    logger = DBEventLogger()
    captured: list[Any] = []

    def fake_log(*args: Any, **kwargs: Any) -> None:
        captured.append(kwargs.get("source"))

    logger.log = fake_log  # type: ignore[method-assign]

    # Pre-create mocks to avoid patch() calling _is_async_obj() on LocalProxies
    # (Python 3.11 hasattr introspection requires an active request context).
    mock_g = MagicMock()
    mock_g.get.return_value = None
    mock_request = MagicMock()
    mock_request.referrer = None
    mock_request.form.to_dict.return_value = {}
    mock_request.args.to_dict.return_value = {}
    mock_request.is_json = False
    mock_request.url_rule = "/test"
    mock_request.path = "/test"

    with (
        patch("superset.utils.log.has_request_context", return_value=True),
        patch("superset.utils.log.g", new=mock_g),
        patch("superset.utils.log.request", new=mock_request),
        patch("superset.utils.log.get_user_id", return_value=None),
        patch("superset.utils.log.stats_logger_manager"),
    ):
        logger.log_with_context(action="test_action", log_to_statsd=False)

    assert captured == [None]


def test_log_with_context_outside_request() -> None:
    logger = DBEventLogger()
    captured: list[Any] = []

    def fake_log(*args: Any, **kwargs: Any) -> None:
        captured.append(kwargs.get("source"))

    logger.log = fake_log  # type: ignore[method-assign]

    with (
        patch("superset.utils.log.has_request_context", return_value=False),
        patch("superset.utils.log.request", None),
        patch("superset.utils.log.get_user_id", return_value=None),
        patch("superset.utils.log.stats_logger_manager"),
    ):
        logger.log_with_context(action="test_action", log_to_statsd=False)

    assert captured == [None]
