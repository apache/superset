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

"""The CSP sources an extension may declare, and the stub the host replaces."""

from __future__ import annotations

import pytest
from superset_core.extensions.csp import (
    add_csp_sources,
    CSP_DIRECTIVES,
    csp_source_problem,
)


@pytest.mark.parametrize(
    "source",
    [
        "https://sandbox.example",
        "https://*.sandbox.example",
        "https://sandbox.example/",
        "https://sandbox.example:8443",
        "https://sandbox.example:*",
        "http://localhost:9001",
        "http://127.0.0.1:9001",
        "wss://events.example.com",
        "HTTPS://Sandbox.Example",
    ],
)
def test_a_source_that_names_one_site_is_accepted(source: str) -> None:
    for directive in CSP_DIRECTIVES:
        assert csp_source_problem(directive, source) is None


@pytest.mark.parametrize(
    "source",
    [
        "*",
        "https://*",
        "https:",
        "data:",
        "blob:",
        "'self'",
        "'none'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "'strict-dynamic'",
        "'nonce-abc123'",
        "'sha256-abc123='",
        "sandbox.example",
        "*.sandbox.example",
        "https://sandbox.example/frames/",
        "https://sandbox.example; script-src *",
        "https://sandbox.example, *",
        "https://sandbox.example *",
        "https://*.*.example",
        "",
    ],
)
def test_a_source_wider_than_one_site_is_refused(source: str) -> None:
    assert csp_source_problem("frame-src", source) is not None


def test_only_network_schemes_are_accepted() -> None:
    assert csp_source_problem("frame-src", "ftp://files.example") == (
        "a source's scheme is one of http, https, ws, wss"
    )
    assert csp_source_problem("frame-src", "javascript://sandbox.example")


@pytest.mark.parametrize(
    "directive",
    [
        "default-src",
        "script-src",
        "script-src-elem",
        "object-src",
        "frame-ancestors",
        "form-action",
        "base-uri",
        "child-src",
        "Frame-Src",
        "report-uri",
    ],
)
def test_extensions_add_to_the_fetch_directives_they_need_only(
    directive: str,
) -> None:
    problem = csp_source_problem(directive, "https://sandbox.example")
    assert problem is not None
    assert "frame-src" in problem


def test_a_source_is_a_string() -> None:
    assert csp_source_problem("frame-src", None) == "a source is a string"  # type: ignore[arg-type]


def test_the_host_supplies_add_csp_sources() -> None:
    with pytest.raises(NotImplementedError, match="replaced during Superset startup"):
        add_csp_sources(lambda: {"frame-src": ["https://sandbox.example"]})
