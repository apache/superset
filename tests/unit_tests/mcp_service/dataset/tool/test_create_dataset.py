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

"""Unit tests for create_dataset MCP tool."""

import logging
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.mcp_service.app import mcp
from superset.utils import json

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def _make_mock_dataset(
    dataset_id: int = 42,
    table_name: str = "orders",
    schema: str = "public",
    database_name: str = "main_db",
) -> MagicMock:
    dataset = MagicMock()
    dataset.id = dataset_id
    dataset.table_name = table_name
    dataset.schema = schema
    dataset.description = None
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = f"[{database_name}].[{schema}]"
    dataset.url = f"/tablemodelview/edit/{dataset_id}"
    dataset.database = MagicMock()
    dataset.database.database_name = database_name
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = {}
    dataset.template_params = {}
    dataset.extra = {}
    dataset.uuid = f"dataset-uuid-{dataset_id}"
    dataset.columns = []
    dataset.metrics = []
    return dataset


@pytest.fixture
def mcp_server():
    return mcp


@pytest.fixture(autouse=True)
def mock_auth():
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


class TestCreateDataset:
    """Tests for the create_dataset MCP tool."""

    @patch("superset.commands.dataset.create.CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_success(self, mock_command_class, mcp_server):
        """Happy path: tool creates dataset and returns DatasetInfo."""
        mock_dataset = _make_mock_dataset()
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "public",
                        "table_name": "orders",
                    }
                },
            )

        assert result.content is not None
        data = json.loads(result.content[0].text)
        assert data["id"] == 42
        assert data["table_name"] == "orders"
        assert data["schema"] == "public"

        # Verify the command was called with the right properties
        call_kwargs = mock_command_class.call_args[0][0]
        assert call_kwargs["database"] == 1
        assert call_kwargs["schema"] == "public"
        assert call_kwargs["table_name"] == "orders"
        assert "owners" not in call_kwargs

    @patch("superset.commands.dataset.create.CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_with_owners(self, mock_command_class, mcp_server):
        """Owners list is forwarded to the command when supplied."""
        mock_dataset = _make_mock_dataset()
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 2,
                        "schema": "sales",
                        "table_name": "transactions",
                        "owners": [5, 10],
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["id"] == 42

        call_kwargs = mock_command_class.call_args[0][0]
        assert call_kwargs["owners"] == [5, 10]

    @patch("superset.commands.dataset.create.CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_already_exists(self, mock_command_class, mcp_server):
        """Returns DatasetError when a dataset for the table already exists."""
        from superset.commands.dataset.exceptions import DatasetExistsValidationError
        from superset.sql.parse import Table

        mock_command = MagicMock()
        mock_command.run.side_effect = DatasetExistsValidationError(
            Table("orders", "public", None)
        )
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "public",
                        "table_name": "orders",
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "DatasetExistsError"
        assert "error" in data

    @patch("superset.commands.dataset.create.CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_table_not_found(self, mock_command_class, mcp_server):
        """Returns DatasetError when the physical table does not exist in the DB."""
        from superset.commands.dataset.exceptions import TableNotFoundValidationError
        from superset.sql.parse import Table

        mock_command = MagicMock()
        mock_command.run.side_effect = TableNotFoundValidationError(
            Table("missing_table", "public", None)
        )
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "public",
                        "table_name": "missing_table",
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "TableNotFoundError"

    @patch("superset.commands.dataset.create.CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_unexpected_error(
        self, mock_command_class, mcp_server
    ):
        """Unexpected exceptions are caught and returned as InternalError."""
        mock_command = MagicMock()
        mock_command.run.side_effect = RuntimeError("DB connection lost")
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "public",
                        "table_name": "orders",
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "InternalError"
        assert "DB connection lost" in data["error"]

    @pytest.mark.asyncio
    async def test_create_dataset_missing_required_fields(self, mcp_server):
        """Missing required fields raise a validation error before the tool runs."""
        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "create_dataset",
                    {
                        "request": {
                            # database_id and table_name are omitted intentionally
                            "schema": "public",
                        }
                    },
                )

    @patch("superset.commands.dataset.create.CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_returns_full_dataset_info(
        self, mock_command_class, mcp_server
    ):
        """The returned DatasetInfo includes columns, metrics, and all core fields."""
        mock_dataset = _make_mock_dataset(
            dataset_id=99, table_name="sales", schema="dw"
        )

        col = MagicMock()
        col.column_name = "amount"
        col.verbose_name = "Amount"
        col.type = "NUMERIC"
        col.is_dttm = False
        col.groupby = True
        col.filterable = True
        col.description = "Sale amount"
        mock_dataset.columns = [col]

        metric = MagicMock()
        metric.metric_name = "total_sales"
        metric.verbose_name = "Total Sales"
        metric.expression = "SUM(amount)"
        metric.description = "Sum of amounts"
        metric.d3format = None
        mock_dataset.metrics = [metric]

        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "dw",
                        "table_name": "sales",
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["id"] == 99
        assert data["table_name"] == "sales"
        assert data["schema"] == "dw"
        assert data["is_virtual"] is False
        assert len(data["columns"]) == 1
        assert data["columns"][0]["column_name"] == "amount"
        assert len(data["metrics"]) == 1
        assert data["metrics"][0]["metric_name"] == "total_sales"
