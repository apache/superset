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
from typing import Any, Callable

import pytest
from pytest_mock import MockerFixture
from werkzeug.test import Client

from superset.utils.profiler import SupersetProfiler


def simple_app(
    environ: dict[str, Any], start_response: Callable[..., Any]
) -> list[bytes]:
    """A trivial WSGI app used as the wrapped application under test."""
    start_response("200 OK", [("Content-Type", "text/plain")])
    return [b"hello world"]


def test_profiler_passthrough_without_instrument_flag() -> None:
    """
    Without ``?_instrument=1`` the middleware must transparently return the
    wrapped app's response and not invoke pyinstrument at all.
    """
    client = Client(SupersetProfiler(simple_app))
    response = client.get("/")

    assert response.status_code == 200
    assert response.data == b"hello world"


def test_profiler_returns_html_when_instrumented() -> None:
    """
    With ``?_instrument=1`` the middleware profiles the wrapped call and
    returns an HTML report. This exercises the three pyinstrument API
    surfaces ``SupersetProfiler`` depends on -- ``Profiler(interval=...)``,
    the context-manager protocol, and ``output_html()`` -- so a breaking
    change in any of them (e.g. across a major pyinstrument bump) fails here
    instead of silently breaking the profiling endpoint in production.
    """
    client = Client(SupersetProfiler(simple_app, interval=0.001))
    response = client.get("/?_instrument=1")

    assert response.status_code == 200
    assert response.mimetype == "text/html"
    body = response.data.decode("utf-8").lower()
    # pyinstrument's HTML renderer emits a full HTML document.
    assert "<html" in body


def test_profiler_raises_when_pyinstrument_missing(mocker: MockerFixture) -> None:
    """
    When pyinstrument is not installed the instrumented path must fail loudly
    rather than silently skip profiling.
    """
    mocker.patch("superset.utils.profiler.Profiler", None)
    client = Client(SupersetProfiler(simple_app))

    with pytest.raises(Exception, match="pyinstrument is not installed"):
        client.get("/?_instrument=1")
