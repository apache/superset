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
from typing import cast

import pytest
import sshtunnel
from flask import Flask, Response
from flask_babel import Babel

from superset.errors import SupersetErrorType
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.views.error_handling import handle_api_exception, set_app_error_handlers


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
