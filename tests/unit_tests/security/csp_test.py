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
from unittest.mock import patch

import pytest
from flask import Response

from superset.security import csp as csp_module
from superset.security.csp import (
    apply_runtime_csp_allowlist,
    is_valid_csp_directive,
    is_valid_csp_origin,
    merge_allowlist_into_csp,
)


@pytest.mark.parametrize(
    "origin",
    [
        "https://example.com",
        "http://example.com",
        "https://example.com:8443",
        "http://localhost:9000",
    ],
)
def test_is_valid_csp_origin_accepts_bare_origins(origin: str) -> None:
    assert is_valid_csp_origin(origin) is True


@pytest.mark.parametrize(
    "origin",
    [
        "",
        "example.com",  # missing scheme
        "ftp://example.com",  # disallowed scheme
        "https://*.example.com",  # wildcard
        "https://example.com/path",  # path
        "https://example.com?q=1",  # query
        "https://example.com#frag",  # fragment
        "https://user:pw@example.com",  # credentials
        "javascript:alert(1)",  # non-network scheme
        "https://example.com ",  # whitespace
    ],
)
def test_is_valid_csp_origin_rejects_unsafe_values(origin: str) -> None:
    assert is_valid_csp_origin(origin) is False


def test_is_valid_csp_directive() -> None:
    assert is_valid_csp_directive("frame-src") is True
    assert is_valid_csp_directive("img-src") is True
    # script-src is intentionally not allowlistable
    assert is_valid_csp_directive("script-src") is False
    assert is_valid_csp_directive("nonsense") is False


def test_merge_seeds_a_missing_directive_with_self() -> None:
    base = "default-src 'self'; img-src 'self' data:"
    merged = merge_allowlist_into_csp(base, {"frame-src": ["https://maps.example"]})
    assert "frame-src 'self' https://maps.example" in merged
    # existing directives are preserved
    assert "default-src 'self'" in merged
    assert "img-src 'self' data:" in merged


def test_merge_appends_to_existing_directive_without_duplicates() -> None:
    base = "default-src 'self'; img-src 'self' data:"
    merged = merge_allowlist_into_csp(
        base, {"img-src": ["https://cdn.example", "data:"]}
    )
    assert "https://cdn.example" in merged
    # the already-present 'data:' source is not duplicated
    assert merged.count("data:") == 1


def test_merge_is_a_noop_for_empty_additions() -> None:
    base = "default-src 'self'"
    assert merge_allowlist_into_csp(base, {}) == base


CSP_HEADER = "Content-Security-Policy"


def _response_with_csp() -> Response:
    response = Response()
    response.headers[CSP_HEADER] = "default-src 'self'"
    return response


def test_apply_runtime_csp_allowlist_noop_when_flag_disabled() -> None:
    with patch.object(
        csp_module.feature_flag_manager, "is_feature_enabled", return_value=False
    ):
        response = _response_with_csp()
        apply_runtime_csp_allowlist(response)
        assert response.headers[CSP_HEADER] == "default-src 'self'"


def test_apply_runtime_csp_allowlist_noop_when_allowlist_empty() -> None:
    with (
        patch.object(
            csp_module.feature_flag_manager,
            "is_feature_enabled",
            return_value=True,
        ),
        patch.object(csp_module.csp_allowlist_cache, "get", return_value={}),
    ):
        response = _response_with_csp()
        apply_runtime_csp_allowlist(response)
        assert response.headers[CSP_HEADER] == "default-src 'self'"


def test_apply_runtime_csp_allowlist_merges_when_enabled() -> None:
    with (
        patch.object(
            csp_module.feature_flag_manager,
            "is_feature_enabled",
            return_value=True,
        ),
        patch.object(
            csp_module.csp_allowlist_cache,
            "get",
            return_value={"frame-src": ["https://embed.example"]},
        ),
    ):
        response = _response_with_csp()
        apply_runtime_csp_allowlist(response)
        assert "frame-src 'self' https://embed.example" in response.headers[CSP_HEADER]


def test_apply_runtime_csp_allowlist_skips_response_without_header() -> None:
    with (
        patch.object(
            csp_module.feature_flag_manager,
            "is_feature_enabled",
            return_value=True,
        ),
        patch.object(
            csp_module.csp_allowlist_cache,
            "get",
            return_value={"frame-src": ["https://embed.example"]},
        ),
    ):
        response = Response()  # no CSP header set
        apply_runtime_csp_allowlist(response)
        assert CSP_HEADER not in response.headers
