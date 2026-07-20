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
from unittest.mock import MagicMock

import pytest
from flask import Flask, Response

from superset.charts.data.timing import (
    chart_data_request_timing,
    chart_timing_phase,
)


def create_app(include_server_timing: bool = True) -> Flask:
    app = Flask(__name__)
    app.config.update(
        CHART_DATA_INCLUDE_SERVER_TIMING=include_server_timing,
        STATS_LOGGER=MagicMock(),
    )
    return app


def test_server_timing_is_added_to_successful_json() -> None:
    app = create_app()

    @chart_data_request_timing
    def endpoint() -> Response:
        with chart_timing_phase("context"):
            pass
        with chart_timing_phase("serialize"):
            return Response("{}", status=200, mimetype="application/json")

    with app.app_context():
        response = endpoint()

    header = response.headers["Server-Timing"]
    assert "chart-context;dur=" in header
    assert "chart-serialize;dur=" in header
    assert "chart-total;dur=" in header


def test_server_timing_is_not_added_to_errors_or_files() -> None:
    app = create_app()

    @chart_data_request_timing
    def error_endpoint() -> Response:
        return Response("{}", status=400, mimetype="application/json")

    @chart_data_request_timing
    def file_endpoint() -> Response:
        return Response("value\n", status=200, mimetype="text/csv")

    with app.app_context():
        error_response = error_endpoint()
        file_response = file_endpoint()

    assert "Server-Timing" not in error_response.headers
    assert "Server-Timing" not in file_response.headers


def test_server_timing_respects_configuration() -> None:
    app = create_app(include_server_timing=False)

    @chart_data_request_timing
    def endpoint() -> Response:
        return Response("{}", status=200, mimetype="application/json")

    with app.app_context():
        response = endpoint()

    assert "Server-Timing" not in response.headers


def test_request_metrics_are_emitted_when_endpoint_raises() -> None:
    app = create_app()

    @chart_data_request_timing
    def endpoint() -> Response:
        with chart_timing_phase("query"):
            raise RuntimeError("query failed")

    with app.app_context(), pytest.raises(RuntimeError, match="query failed"):
        endpoint()

    stats_logger = app.config["STATS_LOGGER"]
    assert stats_logger.timing.call_args_list[0].args[0] == "chart-query"
    assert stats_logger.timing.call_args_list[-1].args[0] == "chart-total"


def test_server_timing_uses_fixed_phase_order() -> None:
    app = create_app()

    @chart_data_request_timing
    def endpoint() -> Response:
        with chart_timing_phase("serialize"):
            pass
        with chart_timing_phase("context"):
            pass
        return Response("{}", status=200, mimetype="application/json")

    with app.app_context():
        response = endpoint()

    names = [
        item.split(";", maxsplit=1)[0]
        for item in response.headers["Server-Timing"].split(", ")
    ]
    assert names == ["chart-context", "chart-serialize", "chart-total"]
