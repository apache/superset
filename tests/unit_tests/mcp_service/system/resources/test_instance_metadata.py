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

"""Tests for the instance://metadata MCP resource."""

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client

from superset.mcp_service.app import mcp
from superset.mcp_service.system.schemas import FeatureAvailability, InstanceInfo
from superset.mcp_service.system.tool.get_instance_info import _instance_info_core
from superset.utils import json

INSTANCE_METADATA_URI = "instance://metadata"


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[Mock]:
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.fixture(autouse=True)
def can_view() -> bool:
    """Whether the mocked user may inspect data model metadata."""
    return True


@pytest.fixture(autouse=True)
def mock_data_access(can_view: bool) -> Iterator[tuple[Mock, Mock]]:
    """Avoid hitting the metadata database while generating the resource."""
    dataset = SimpleNamespace(
        id=7,
        table_name="orders",
        schema="public",
        database_id=3,
        changed_on=None,
    )
    database = SimpleNamespace(id=3, database_name="examples", backend="sqlite")
    with (
        patch(
            "superset.mcp_service.mcp_core.InstanceInfoCore._calculate_basic_counts",
            return_value={"total_datasets": 7, "total_databases": 3},
        ),
        patch(
            "superset.mcp_service.mcp_core.InstanceInfoCore"
            "._calculate_time_based_metrics",
            return_value={},
        ),
        patch(
            "superset.daos.dataset.DatasetDAO.find_all", return_value=[dataset]
        ) as find_datasets,
        patch(
            "superset.daos.database.DatabaseDAO.find_all", return_value=[database]
        ) as find_databases,
        patch(
            "superset.mcp_service.privacy.user_can_view_data_model_metadata",
            return_value=can_view,
        ),
    ):
        yield find_datasets, find_databases


async def _read_metadata() -> dict[str, Any]:
    async with Client(mcp) as client:
        result = await client.read_resource(INSTANCE_METADATA_URI)
    return json.loads(result[0].text)


@pytest.mark.asyncio
async def test_instance_metadata_resource_returns_valid_payload() -> None:
    data = await _read_metadata()

    assert "error" not in data
    # The resource intentionally drops an empty popular_content block, so restore
    # it before validating the payload against the full InstanceInfo schema.
    InstanceInfo.model_validate(
        {"popular_content": {"top_tags": [], "top_creators": []}, **data}
    )
    assert FeatureAvailability.model_validate(data["feature_availability"])
    assert data["instance_summary"]["total_datasets"] == 7
    assert data["instance_summary"]["total_databases"] == 3
    assert data["data_model_metadata_redacted"] is False
    assert data["available_datasets"] == [
        {"id": 7, "table_name": "orders", "schema": "public", "database_id": 3}
    ]
    assert data["available_databases"] == [
        {"id": 3, "database_name": "examples", "backend": "sqlite"}
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("can_view", [False])
async def test_instance_metadata_resource_redacts_data_model_metadata(
    mock_data_access: tuple[Mock, Mock],
) -> None:
    """Principals without data model access must not see dataset/database info."""
    find_datasets, find_databases = mock_data_access

    data = await _read_metadata()

    assert "error" not in data
    assert data["data_model_metadata_redacted"] is True
    assert data["instance_summary"]["total_datasets"] == 0
    assert data["instance_summary"]["total_databases"] == 0
    assert data["database_breakdown"]["by_type"] == {}
    assert data["available_datasets"] == []
    assert data["available_databases"] == []
    find_datasets.assert_not_called()
    find_databases.assert_not_called()
    assert "accessible_menus" in data["feature_availability"]


def test_resource_and_tool_share_metric_calculators() -> None:
    """The tool and resource must compute the same set of InstanceInfo metrics."""
    from superset.mcp_service.system.system_utils import (
        INSTANCE_INFO_METRIC_CALCULATORS,
    )

    assert _instance_info_core.metric_calculators is INSTANCE_INFO_METRIC_CALCULATORS
