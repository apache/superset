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

from superset.charts.api import ChartRestApi


def _make_api() -> ChartRestApi:
    """Create a minimally-initialized ChartRestApi for unit tests.

    Bypasses ``__init__`` to avoid Flask app-context requirements while still
    setting the attributes exercised by the access-check helpers under test.
    """
    api = ChartRestApi.__new__(ChartRestApi)
    api.class_permission_name = "Chart"
    return api


@pytest.mark.parametrize("column_name", ["owners"])
def test_pre_related_check_blocks_read_only_users(
    column_name: str,
) -> None:
    """Users without all-datasource access receive 403 on owners lookup."""
    api = _make_api()
    api.response_403 = MagicMock(return_value="forbidden")

    with patch(
        "superset.charts.api.security_manager.can_access_all_datasources",
        return_value=False,
    ):
        result = api._pre_related_check(column_name)

    assert result == "forbidden"


def test_pre_related_check_allows_privileged_users() -> None:
    """Users with all-datasource access (Alpha/Admin) receive None."""
    api = _make_api()

    with patch(
        "superset.charts.api.security_manager.can_access_all_datasources",
        return_value=True,
    ):
        result = api._pre_related_check("owners")

    assert result is None


@pytest.mark.parametrize("column_name", ["created_by", "changed_by"])
def test_pre_related_check_skips_non_owners_fields(
    column_name: str,
) -> None:
    """Non-owners related fields bypass the write-access check entirely."""
    api = _make_api()

    with patch(
        "superset.charts.api.security_manager.can_access_all_datasources",
    ) as mock_check:
        result = api._pre_related_check(column_name)

    mock_check.assert_not_called()
    assert result is None
