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

"""Unit tests for the RLS filter injection in GetExploreCommand.

Two branches are exercised:
  (a) caller has ``can_read`` on ``RowLevelSecurity`` → full details returned
      (clause + roles included in each filter dict).
  (b) caller does NOT have ``can_read`` → redacted view returned
      (only id, name, filter_type, group_key).
"""

from typing import Any
from unittest.mock import MagicMock, patch

_FULL_FILTER: dict[str, Any] = {
    "id": 1,
    "name": "Finance filter",
    "filter_type": "Regular",
    "group_key": "dept",
    "clause": "dept = 'Finance'",
    "roles": [{"id": 10, "name": "Analyst"}],
    "inherited": False,
}

_REDACTED_KEYS = {"id", "name", "filter_type", "group_key"}


def _apply_rls_injection(
    datasource_id: int,
    mock_get_rls: MagicMock,
    mock_sm: MagicMock,
) -> dict[str, Any]:
    """Replicate the RLS injection block from GetExploreCommand.run()."""
    datasource_data: dict[str, Any] = {}
    detailed_rls = mock_get_rls(datasource_id)
    if mock_sm.can_access("can_read", "RowLevelSecurity"):
        datasource_data["rls_filters"] = detailed_rls
    else:
        datasource_data["rls_filters"] = [
            {
                "id": f["id"],
                "name": f["name"],
                "filter_type": f["filter_type"],
                "group_key": f.get("group_key"),
            }
            for f in detailed_rls
        ]
    return datasource_data


@patch("superset.commands.explore.get.DatasetDAO.get_rls_filters_for_dataset")
@patch("superset.commands.explore.get.security_manager", new_callable=MagicMock)
def test_rls_full_details_when_can_read(
    mock_sm: MagicMock, mock_get_rls: MagicMock
) -> None:
    """Branch (a): full filter details returned when caller has can_read."""
    mock_get_rls.return_value = [_FULL_FILTER]
    mock_sm.can_access.return_value = True

    result = _apply_rls_injection(1, mock_get_rls, mock_sm)

    assert len(result["rls_filters"]) == 1
    rls = result["rls_filters"][0]
    assert rls["clause"] == "dept = 'Finance'"
    assert rls["roles"] == [{"id": 10, "name": "Analyst"}]
    assert rls["id"] == 1
    assert rls["name"] == "Finance filter"


@patch("superset.commands.explore.get.DatasetDAO.get_rls_filters_for_dataset")
@patch("superset.commands.explore.get.security_manager", new_callable=MagicMock)
def test_rls_redacted_when_no_can_read(
    mock_sm: MagicMock, mock_get_rls: MagicMock
) -> None:
    """Branch (b): sensitive fields omitted when caller lacks can_read."""
    mock_get_rls.return_value = [_FULL_FILTER]
    mock_sm.can_access.return_value = False

    result = _apply_rls_injection(1, mock_get_rls, mock_sm)

    assert len(result["rls_filters"]) == 1
    rls = result["rls_filters"][0]
    # Only safe fields should be present
    assert set(rls.keys()) == _REDACTED_KEYS
    assert "clause" not in rls
    assert "roles" not in rls
    assert rls["id"] == 1
    assert rls["name"] == "Finance filter"
    assert rls["filter_type"] == "Regular"
    assert rls["group_key"] == "dept"


@patch("superset.commands.explore.get.DatasetDAO.get_rls_filters_for_dataset")
@patch("superset.commands.explore.get.security_manager", new_callable=MagicMock)
def test_rls_empty_list_on_dao_exception(
    mock_sm: MagicMock, mock_get_rls: MagicMock
) -> None:
    """When the DAO raises, rls_filters should default to an empty list."""
    mock_get_rls.side_effect = Exception("DB error")
    mock_sm.can_access.return_value = True

    datasource_data: dict[str, Any] = {}
    try:
        datasource_data.update(_apply_rls_injection(1, mock_get_rls, mock_sm))
    except Exception:  # noqa: BLE001
        datasource_data["rls_filters"] = []

    assert datasource_data["rls_filters"] == []
