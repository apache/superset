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


import logging
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from pydantic import ValidationError

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.mcp_service.dataset.schemas import GetColumnSampleDataRequest
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    """Mock authentication for all tests."""
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _create_mock_dataset(dataset_id=1, normalize_columns=True):
    """Create a mock dataset with values_for_column support."""
    dataset = MagicMock()
    dataset.id = dataset_id
    dataset.normalize_columns = normalize_columns
    dataset.raise_for_access = MagicMock()
    dataset.values_for_column = MagicMock()
    return dataset


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_success(mock_find, mcp_server):
    """Test successful retrieval of column sample data."""
    dataset = _create_mock_dataset()
    dataset.values_for_column.return_value = ["Male", "Female", "Other"]
    mock_find.return_value = dataset

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 1, "column_name": "gender", "limit": 20}},
        )
        data = json.loads(result.content[0].text)
        assert data["dataset_id"] == 1
        assert data["column_name"] == "gender"
        assert data["values"] == ["Male", "Female", "Other"]
        assert data["count"] == 3
        assert data["truncated"] is False

    dataset.values_for_column.assert_called_once_with(
        column_name="gender",
        limit=21,  # limit + 1 for truncation detection
        denormalize_column=False,  # normalize_columns=True -> denormalize=False
    )


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_truncated(mock_find, mcp_server):
    """Test truncation detection when more values exist than the limit."""
    dataset = _create_mock_dataset()
    # Return 4 values when limit is 3 (tool fetches limit+1=4)
    dataset.values_for_column.return_value = ["A", "B", "C", "D"]
    mock_find.return_value = dataset

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 1, "column_name": "status", "limit": 3}},
        )
        data = json.loads(result.content[0].text)
        assert data["values"] == ["A", "B", "C"]
        assert data["count"] == 3
        assert data["truncated"] is True


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_dataset_not_found(mock_find, mcp_server):
    """Test error when dataset does not exist."""
    mock_find.return_value = None

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 999, "column_name": "gender"}},
        )
        data = json.loads(result.content[0].text)
        assert data["error_type"] == "NotFound"
        assert "999" in data["error"]


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_permission_denied(mock_find, mcp_server):
    """Test error when user lacks permission to access the dataset."""
    dataset = _create_mock_dataset()
    dataset.raise_for_access.side_effect = SupersetSecurityException(
        SupersetError(
            message="Access denied",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    mock_find.return_value = dataset

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 1, "column_name": "gender"}},
        )
        data = json.loads(result.content[0].text)
        assert data["error_type"] == "PermissionDenied"


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_column_not_found(mock_find, mcp_server):
    """Test error when column does not exist in the dataset."""
    dataset = _create_mock_dataset()
    dataset.values_for_column.side_effect = KeyError("nonexistent_col")
    mock_find.return_value = dataset

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 1, "column_name": "nonexistent_col"}},
        )
        data = json.loads(result.content[0].text)
        assert data["error_type"] == "ColumnNotFound"
        assert "nonexistent_col" in data["error"]


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_default_limit(mock_find, mcp_server):
    """Test that omitting limit defaults to 20."""
    dataset = _create_mock_dataset()
    dataset.values_for_column.return_value = list(range(10))
    mock_find.return_value = dataset

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 1, "column_name": "category"}},
        )
        data = json.loads(result.content[0].text)
        assert data["count"] == 10

    # Default limit=20, so fetch_limit should be 21
    dataset.values_for_column.assert_called_once_with(
        column_name="category",
        limit=21,
        denormalize_column=False,
    )


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_denormalize_column(mock_find, mcp_server):
    """Test that denormalize_column is set based on dataset.normalize_columns."""
    dataset = _create_mock_dataset(normalize_columns=False)
    dataset.values_for_column.return_value = ["val1"]
    mock_find.return_value = dataset

    async with Client(mcp_server) as client:
        await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 1, "column_name": "col"}},
        )

    dataset.values_for_column.assert_called_once_with(
        column_name="col",
        limit=21,
        denormalize_column=True,  # normalize_columns=False -> denormalize=True
    )


@patch("superset.daos.dataset.DatasetDAO.find_by_id")
@pytest.mark.asyncio
async def test_get_column_sample_data_with_none_values(mock_find, mcp_server):
    """Test that None values (from NULL columns) are handled correctly."""
    dataset = _create_mock_dataset()
    dataset.values_for_column.return_value = ["Active", None, "Inactive"]
    mock_find.return_value = dataset

    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_column_sample_data",
            {"request": {"dataset_id": 1, "column_name": "status"}},
        )
        data = json.loads(result.content[0].text)
        assert data["values"] == ["Active", None, "Inactive"]
        assert data["count"] == 3


def test_get_column_sample_data_request_limit_validation():
    """Test that Pydantic rejects invalid limit values."""
    with pytest.raises(ValidationError, match="greater than or equal to 1"):
        GetColumnSampleDataRequest(dataset_id=1, column_name="col", limit=0)

    with pytest.raises(ValidationError, match="less than or equal to 100"):
        GetColumnSampleDataRequest(dataset_id=1, column_name="col", limit=101)

    with pytest.raises(ValidationError, match="greater than or equal to 1"):
        GetColumnSampleDataRequest(dataset_id=1, column_name="col", limit=-1)

    # Valid limits should work
    req = GetColumnSampleDataRequest(dataset_id=1, column_name="col", limit=1)
    assert req.limit == 1

    req = GetColumnSampleDataRequest(dataset_id=1, column_name="col", limit=100)
    assert req.limit == 100

    req = GetColumnSampleDataRequest(dataset_id=1, column_name="col")
    assert req.limit == 20
