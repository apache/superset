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
from unittest.mock import MagicMock, patch

import pytest
from flask import current_app, request as flask_request

from superset.charts.api import ChartRestApi


def _make_api() -> ChartRestApi:
    api = ChartRestApi.__new__(ChartRestApi)
    api.class_permission_name = "Chart"
    return api


@pytest.mark.parametrize("column_name", ["owners"])
def test_ensure_owners_write_access_blocks_read_only_users(
    column_name: str,
) -> None:
    """Users without write access receive 403 when requesting the owners field."""
    api = _make_api()
    api.response_403 = MagicMock(return_value="forbidden")

    with current_app.test_request_context(f"/api/v1/chart/related/{column_name}"):
        flask_request.view_args = {"column_name": column_name}
        with patch(
            "superset.charts.api.security_manager.can_access",
            return_value=False,
        ) as mock_can_access:
            result = api.ensure_owners_write_access()

    mock_can_access.assert_called_once_with("can_write", "Chart")
    assert result == "forbidden"


def test_ensure_owners_write_access_allows_write_users() -> None:
    """Users with write access receive None (request proceeds normally)."""
    api = _make_api()

    with current_app.test_request_context("/api/v1/chart/related/owners"):
        flask_request.view_args = {"column_name": "owners"}
        with patch(
            "superset.charts.api.security_manager.can_access",
            return_value=True,
        ):
            result = api.ensure_owners_write_access()

    assert result is None


@pytest.mark.parametrize("column_name", ["created_by", "changed_by"])
def test_ensure_owners_write_access_skips_non_owners_fields(
    column_name: str,
) -> None:
    """Non-owners related fields bypass the write-access check entirely."""
    api = _make_api()

    with current_app.test_request_context(f"/api/v1/chart/related/{column_name}"):
        flask_request.view_args = {"column_name": column_name}
        with patch(
            "superset.charts.api.security_manager.can_access",
        ) as mock_can_access:
            result = api.ensure_owners_write_access()

    mock_can_access.assert_not_called()
    assert result is None
