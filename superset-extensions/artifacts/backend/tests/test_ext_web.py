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
"""The transfer links' settings: their base URL, and their uploads."""

from __future__ import annotations

from typing import Any

import pytest
from flask import Flask
from superset_oss.artifacts.constants import API_BASE_PATH
from superset_oss.artifacts.web import transfer_links

ARTIFACT = "00000000-0000-4000-8000-000000000000"
VERSION = "a" * 64


@pytest.fixture
def config() -> dict[str, Any]:
    return {
        "SECRET_KEY": "a secret key",
        "WEBDRIVER_BASEURL_USER_FRIENDLY": "https://superset.example/",
        "WTF_CSRF_ENABLED": True,
    }


def _links(config: dict[str, Any], *, request: bool = False) -> Any:
    app = Flask(__name__)
    app.config.update(config)
    if request:
        with app.test_request_context(base_url="https://requested.example"):
            return transfer_links()
    with app.app_context():
        return transfer_links()


def test_links_live_under_the_user_facing_url(config: dict[str, Any]) -> None:
    links = _links(config)
    url, _ = links.download(ARTIFACT, VERSION, "7")
    assert url.startswith(f"https://superset.example{API_BASE_PATH}/transfer/")


def test_without_a_user_facing_url_a_request_names_the_host(
    config: dict[str, Any],
) -> None:
    del config["WEBDRIVER_BASEURL_USER_FRIENDLY"]
    assert _links(config) is None
    links = _links(config, request=True)
    url, _ = links.download(ARTIFACT, VERSION, "7")
    assert url.startswith(f"https://requested.example{API_BASE_PATH}/transfer/")


def test_uploads_are_offered_with_csrf_checks_on(config: dict[str, Any]) -> None:
    # The transfer API is exempt by its own setting: no deployment list needed.
    assert _links(config).uploads


def test_no_links_without_a_secret_key(config: dict[str, Any]) -> None:
    config["SECRET_KEY"] = ""
    assert _links(config) is None
