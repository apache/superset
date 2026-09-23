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

import pytest
from flask import current_app

from superset.tasks.subscription import get_request_tab_id, principal_channel


def test_principal_channel_derivation() -> None:
    assert principal_channel(5, None) == "user:5"
    assert principal_channel(None, "guest:abc") == "guest:abc"
    assert principal_channel(None, None) is None


def test_get_request_tab_id_from_json_body() -> None:
    with current_app.test_request_context(
        "/api/v1/chart/data", json={"tab_id": "tab-7"}
    ):
        assert get_request_tab_id() == "tab-7"


def test_get_request_tab_id_from_query_arg() -> None:
    with current_app.test_request_context("/api/v1/chart/data?tab_id=tab-7"):
        assert get_request_tab_id() == "tab-7"


def test_get_request_tab_id_none_outside_request_context() -> None:
    assert get_request_tab_id() is None


@pytest.mark.parametrize(
    "value",
    [
        "",  # empty
        "a" * 65,  # too long
        "tab id",  # space
        "tab/../etc",  # path traversal chars
        "tab:evil",  # colon (would split a routing key)
        "tab\nid",  # newline
        "táb",  # non-ascii
    ],
)
def test_get_request_tab_id_rejects_invalid(value: str) -> None:
    # An out-of-bound/ill-formed tab id is dropped (falls back to principal-grain),
    # never flowing into routing keys, private props, channels, logs, or URLs.
    with current_app.test_request_context("/api/v1/chart/data", json={"tab_id": value}):
        assert get_request_tab_id() is None


def test_get_request_tab_id_accepts_full_allowed_charset() -> None:
    value = "Ab9_-" * 12  # 60 chars, within the 64 cap
    with current_app.test_request_context("/api/v1/chart/data", json={"tab_id": value}):
        assert get_request_tab_id() == value
