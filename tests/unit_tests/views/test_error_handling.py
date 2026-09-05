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
from __future__ import annotations

import logging
from typing import Any, cast
from unittest.mock import patch

import pytest
import sshtunnel
from flask import Flask, Response
from flask_babel import Babel
from sqlalchemy.exc import IntegrityError, OperationalError, ProgrammingError
from werkzeug.exceptions import GatewayTimeout

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import QueryObjectValidationError, SupersetException
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.error_sanitization import (
    GENERIC_ACCESS_MESSAGE,
    GENERIC_ERROR_MESSAGE,
)
from superset.views.error_handling import (
    handle_api_exception,
    json_error_response,
    set_app_error_handlers,
)


class TestHandleApiExceptionSSHTunnelError:
    def test_returns_400_with_connection_host_down_error_and_no_error_log(
        self, app, caplog: pytest.LogCaptureFixture
    ):
        @handle_api_exception
        def view(self: object) -> FlaskResponse:
            raise sshtunnel.BaseSSHTunnelForwarderError(
                "Could not establish session to SSH gateway"
            )

        with app.test_request_context():
            with caplog.at_level(logging.WARNING):
                response = cast(Response, view(self=object()))

        assert response.status_code == 400
        payload = json.loads(response.data)
        assert (
            payload["errors"][0]["error_type"]
            == SupersetErrorType.CONNECTION_HOST_DOWN_ERROR.value
        )
        assert not any(record.levelno >= logging.ERROR for record in caplog.records)
        assert any(
            record.levelno == logging.WARNING
            and "BaseSSHTunnelForwarderError" in record.message
            for record in caplog.records
        )


class TestHandleApiExceptionDatabaseErrors:
    """
    `OperationalError` is a `DatabaseError` subclass, so it must be matched by
    its own clause ahead of the 422 handler for other `DatabaseError`s.
    """

    def _run(self, app, ex: Exception, *, guest: bool = False) -> Response:
        @handle_api_exception
        def view(self: object) -> FlaskResponse:
            raise ex

        with (
            app.test_request_context(),
            patch(
                "superset.security.SupersetSecurityManager.is_guest_user",
                return_value=guest,
            ),
        ):
            return cast(Response, view(self=object()))

    def test_operational_error_returns_500(self, app):
        response = self._run(
            app, OperationalError("SELECT 1", {}, Exception("connection closed"))
        )

        assert response.status_code == 500

    def test_non_connection_database_error_still_returns_422(self, app):
        response = self._run(
            app,
            ProgrammingError("SELECT 1", {}, Exception("relation does not exist")),
        )

        assert response.status_code == 422

    def test_integrity_error_still_returns_422(self, app):
        response = self._run(
            app, IntegrityError("INSERT", {}, Exception("duplicate key"))
        )

        assert response.status_code == 422

    def test_operational_error_message_is_redacted_for_guest_users(self, app):
        """
        The 500 clause hands the raw driver message to `json_error_response`,
        which routes a bare string through `sanitize_error_message`. A driver
        message quotes the host, port and user of the connection it failed on,
        so an embedded viewer must receive the generic text instead.
        """
        leaky = (
            "could not connect to server: Connection refused\n\tIs the server "
            'running on host "analytics-prod.internal" (10.0.4.17) and accepting '
            "TCP/IP connections on port 5432?"
        )

        response = self._run(
            app, OperationalError("SELECT 1", {}, Exception(leaky)), guest=True
        )

        assert response.status_code == 500
        payload = json.loads(response.data)
        assert payload["error"] == str(GENERIC_ERROR_MESSAGE)
        for secret in ("analytics-prod.internal", "10.0.4.17", "5432"):
            assert secret not in response.get_data(as_text=True)

    def test_operational_error_message_is_kept_for_regular_users(self, app):
        """The redaction above is guest-only; an operator still needs the detail."""
        response = self._run(
            app, OperationalError("SELECT 1", {}, Exception("Connection refused"))
        )

        assert response.status_code == 500
        assert "Connection refused" in json.loads(response.data)["error"]


class TestShowUnexpectedException:
    def _build_app_with_handlers(self) -> Flask:
        # A fresh, minimal Flask app per test: `set_app_error_handlers` can
        # only register handlers before the app has served its first
        # request, so it can't share the module-scoped `app` fixture across
        # tests in this class.
        test_app = Flask(__name__)
        test_app.config["DEBUG"] = False
        Babel(test_app)
        set_app_error_handlers(test_app)

        @test_app.route("/ssh-tunnel-error")
        def ssh_tunnel_error_view() -> FlaskResponse:
            raise sshtunnel.BaseSSHTunnelForwarderError(
                "Could not establish session to SSH gateway"
            )

        @test_app.route("/generic-error")
        def generic_error_view() -> FlaskResponse:
            raise ValueError("boom")

        return test_app

    def test_ssh_tunnel_error_returns_structured_400(
        self, caplog: pytest.LogCaptureFixture
    ):
        client = self._build_app_with_handlers().test_client()

        with caplog.at_level(logging.WARNING):
            response = client.get("/ssh-tunnel-error")

        assert response.status_code == 400
        payload = json.loads(response.data)
        assert (
            payload["errors"][0]["error_type"]
            == SupersetErrorType.CONNECTION_HOST_DOWN_ERROR.value
        )
        assert not any(record.levelno >= logging.ERROR for record in caplog.records)

    def test_generic_exception_still_returns_original_500_shape(
        self, caplog: pytest.LogCaptureFixture
    ):
        client = self._build_app_with_handlers().test_client()

        with caplog.at_level(logging.WARNING):
            response = client.get("/generic-error")

        assert response.status_code == 500
        payload = json.loads(response.data)
        assert (
            payload["errors"][0]["error_type"]
            == SupersetErrorType.GENERIC_BACKEND_ERROR.value
        )
        assert any(record.levelno >= logging.ERROR for record in caplog.records)


class TestShowSupersetException:
    def _build_app_with_handlers(self) -> Flask:
        # A fresh, minimal Flask app per test: `set_app_error_handlers` can
        # only register handlers before the app has served its first
        # request, so it can't share the module-scoped `app` fixture across
        # tests in this class.
        test_app = Flask(__name__)
        test_app.config["DEBUG"] = False
        Babel(test_app)
        set_app_error_handlers(test_app)

        @test_app.route("/query-validation-error")
        def query_validation_error_view() -> FlaskResponse:
            raise QueryObjectValidationError("list object has no element 0")

        @test_app.route("/generic-superset-exception")
        def generic_superset_exception_view() -> FlaskResponse:
            raise SupersetException("boom")

        return test_app

    def test_4xx_superset_exception_returns_its_status_and_logs_at_warning(
        self, caplog: pytest.LogCaptureFixture
    ):
        client = self._build_app_with_handlers().test_client()

        with caplog.at_level(logging.WARNING):
            response = client.get("/query-validation-error")

        assert response.status_code == 400
        payload = json.loads(response.data)
        assert payload["errors"][0]["message"] == "list object has no element 0"
        assert not any(record.levelno >= logging.ERROR for record in caplog.records)
        assert any(
            record.levelno == logging.WARNING
            and record.message == "list object has no element 0"
            for record in caplog.records
        )

    def test_5xx_superset_exception_still_returns_500_and_logs_at_error(
        self, caplog: pytest.LogCaptureFixture
    ):
        client = self._build_app_with_handlers().test_client()

        with caplog.at_level(logging.WARNING):
            response = client.get("/generic-superset-exception")

        assert response.status_code == 500
        payload = json.loads(response.data)
        assert payload["errors"][0]["message"] == "boom"
        assert any(record.levelno >= logging.ERROR for record in caplog.records)

    def test_html_accept_serves_branded_error_page_not_raw_json(self):
        client = self._build_app_with_handlers().test_client()

        with patch(
            "superset.views.error_handling.send_file",
            return_value=Response("<html>500</html>", mimetype="text/html"),
        ) as mock_send_file:
            response = client.get(
                "/generic-superset-exception", headers={"Accept": "text/html"}
            )

        assert response.status_code == 500
        assert response.content_type.startswith("text/html")
        mock_send_file.assert_called_once()


class TestGuestErrorSanitization:
    def _response_payload(
        self,
        error_details: str | list[SupersetError],
        status: int,
        app: Flask,
    ) -> dict[str, Any]:
        with (
            app.test_request_context(),
            patch(
                "superset.security.SupersetSecurityManager.is_guest_user",
                return_value=True,
            ),
        ):
            response = cast(Response, json_error_response(error_details, status=status))
        return json.loads(response.data)

    def test_db_error_is_replaced_for_guest_users(self, app):
        payload = self._response_payload(
            [
                SupersetError(
                    message="Table mydb.myschema.mytable was not found",
                    error_type=SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"engine_name": "BigQuery"},
                )
            ],
            500,
            app,
        )

        assert payload["errors"][0]["message"] == str(GENERIC_ERROR_MESSAGE)
        assert (
            payload["errors"][0]["error_type"]
            == SupersetErrorType.GENERIC_BACKEND_ERROR.value
        )
        assert "engine_name" not in payload["errors"][0]["extra"]

    def test_bare_string_error_is_replaced_for_guest_users(self, app):
        payload = self._response_payload(
            "relation mydb.mytable does not exist", 422, app
        )

        assert payload["error"] == str(GENERIC_ERROR_MESSAGE)

    def test_access_denial_reads_as_a_denial_for_guest_users(self, app: Flask) -> None:
        payload = self._response_payload("Forbidden", 403, app)

        assert payload["error"] == str(GENERIC_ACCESS_MESSAGE)

    def test_not_found_is_replaced_for_guest_users(self, app: Flask) -> None:
        """
        A 404 message is no safer than any other: `warm_up_cache` reports a
        missing table as "Table %(table)s wasn't found in the database %(db)s".
        """
        payload = self._response_payload(
            "Table my_table wasn't found in the database my_db", 404, app
        )

        assert payload["error"] == str(GENERIC_ERROR_MESSAGE)


class TestErrorHandlerNeverTurnsErrorsInto500s:
    """
    The guest-user check runs *inside* the HTTP error handler, which has no
    handler of its own. If resolving the principal raises -- as some Flask-Login
    user loaders do (e.g. a JWT request loader that raises when a request carries
    no valid credential) -- Flask discards the intended status and returns a bare
    500. The check must therefore swallow that failure and keep the real status.
    """

    def _build_app_with_handlers(self) -> Flask:
        # A fresh, minimal Flask app per test: `set_app_error_handlers` can only
        # register handlers before the app has served its first request.
        test_app = Flask(__name__)
        test_app.config["DEBUG"] = False
        Babel(test_app)
        set_app_error_handlers(test_app)

        @test_app.route("/gateway-timeout")
        def gateway_timeout_view() -> FlaskResponse:
            raise GatewayTimeout("upstream took too long")

        return test_app

    def test_gateway_timeout_keeps_its_status_when_principal_cannot_be_resolved(
        self,
    ) -> None:
        client = self._build_app_with_handlers().test_client()

        with patch(
            "superset.security.SupersetSecurityManager.is_guest_user",
            side_effect=RuntimeError("no valid credential on request"),
        ):
            response = client.get("/gateway-timeout")

        # Without the guard the raising loader propagates out of the handler and
        # Flask rewrites this to a bare 500.
        assert response.status_code == 504

    def test_direct_json_error_response_keeps_its_status(self, app: Flask) -> None:
        with (
            app.test_request_context(),
            patch(
                "superset.security.SupersetSecurityManager.is_guest_user",
                side_effect=RuntimeError("no valid credential on request"),
            ),
        ):
            response = cast(
                Response,
                json_error_response("upstream took too long", status=504),
            )

        assert response.status_code == 504
        assert json.loads(response.data)["error"] == "upstream took too long"
