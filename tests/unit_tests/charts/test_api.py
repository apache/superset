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

from superset.charts.api import ChartRestApi
from superset.views.base_api import BaseSupersetModelRestApi


def _make_api() -> ChartRestApi:
    api = ChartRestApi.__new__(ChartRestApi)
    api.class_permission_name = "Chart"
    return api


def test_related_owners_requires_write_permission() -> None:
    """Users with only read access must receive 403 on related/owners."""
    api = _make_api()
    api.response_403 = MagicMock(return_value="forbidden")

    with patch(
        "superset.charts.api.security_manager.can_access",
        return_value=False,
    ) as mock_can_access:
        result = api.related("owners")

    mock_can_access.assert_called_once_with("can_write", "Chart")
    assert result == "forbidden"


def test_related_owners_allowed_for_write_users() -> None:
    """Users with write access can call related/owners."""
    api = _make_api()
    super_related = MagicMock(return_value="ok")

    with (
        patch(
            "superset.charts.api.security_manager.can_access",
            return_value=True,
        ),
        patch.object(BaseSupersetModelRestApi, "related", super_related),
    ):
        result = api.related("owners")

    assert result == "ok"


def test_related_created_by_allows_read_only_users() -> None:
    """created_by and changed_by related fields are not restricted to write users."""
    api = _make_api()
    super_related = MagicMock(return_value="ok")

    with (
        patch(
            "superset.charts.api.security_manager.can_access",
        ) as mock_can_access,
        patch.object(BaseSupersetModelRestApi, "related", super_related),
    ):
        result = api.related("created_by")

    # can_access should NOT be called for non-owners fields
    mock_can_access.assert_not_called()
    assert result == "ok"
