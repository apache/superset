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

# Patch at source so lazy imports inside the tool function are intercepted.
_CMD_PATH = "superset.commands.dataset.create.CreateDatasetCommand"
_DAO_PATH = "superset.mcp_service.dataset.tool.create_dataset.DatasetDAO"
_SEC_PATH = "superset.mcp_service.dataset.tool.create_dataset.security_manager"


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
    dataset.certified_by = None
    dataset.certification_details = None
    dataset.changed_by = None
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by = None
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.owners = []
    dataset.is_virtual = False
    dataset.database_id = 1
    dataset.schema_perm = f"[{database_name}].[{schema}]"
    dataset.database = MagicMock()
    dataset.database.database_name = database_name
    dataset.sql = None
    dataset.main_dttm_col = None
    dataset.offset = 0
    dataset.cache_timeout = 0
    dataset.params = None
    dataset.template_params = None
    dataset.extra = None
    dataset.uuid = f"dataset-uuid-{dataset_id}"
    dataset.columns = []
    dataset.metrics = []
    return dataset


@pytest.fixture()
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

    @pytest.fixture(autouse=True)
    def mock_dao_and_security(self):
        """Default: valid database exists and access is granted.

        Patches the pre-command access check so individual tests that only care
        about command behavior don't need to replicate this setup.
        """
        with patch(_DAO_PATH) as mock_dao, patch(_SEC_PATH) as mock_sec:
            mock_dao.get_database_by_id.return_value = MagicMock(
                id=1, database_name="test_db"
            )
            yield mock_dao, mock_sec

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
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

        call_kwargs = mock_command_class.call_args[0][0]
        assert call_kwargs["database"] == 1
        assert call_kwargs["schema"] == "public"
        assert call_kwargs["table_name"] == "orders"
        assert "owners" not in call_kwargs

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
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

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
    async def test_create_dataset_already_exists(self, mock_command_class, mcp_server):
        """Returns DatasetExistsError when a dataset for the table already exists.

        CreateDatasetCommand.validate() wraps DatasetExistsValidationError inside
        DatasetInvalidError, so simulate the real command shape.
        """
        from superset.commands.dataset.exceptions import (
            DatasetExistsValidationError,
            DatasetInvalidError,
        )
        from superset.sql.parse import Table

        exc = DatasetInvalidError()
        exc.append(DatasetExistsValidationError(Table("orders", "public", None)))

        mock_command = MagicMock()
        mock_command.run.side_effect = exc
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

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
    async def test_create_dataset_table_not_found(self, mock_command_class, mcp_server):
        """Returns TableNotFoundError when the physical table does not exist in the DB.

        CreateDatasetCommand.validate() wraps TableNotFoundValidationError inside
        DatasetInvalidError, so simulate the real command shape.
        """
        from superset.commands.dataset.exceptions import (
            DatasetInvalidError,
            TableNotFoundValidationError,
        )
        from superset.sql.parse import Table

        exc = DatasetInvalidError()
        exc.append(TableNotFoundValidationError(Table("missing_table", "public", None)))

        mock_command = MagicMock()
        mock_command.run.side_effect = exc
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

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
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

    @pytest.mark.asyncio()
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

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
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

    @pytest.mark.asyncio()
    async def test_create_dataset_database_not_found(
        self, mock_dao_and_security, mcp_server
    ):
        """Returns DatabaseNotFoundError when the database_id does not exist."""
        mock_dao, _ = mock_dao_and_security
        mock_dao.get_database_by_id.return_value = None

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {"request": {"database_id": 999, "table_name": "orders"}},
            )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "DatabaseNotFoundError"
        assert "999" in data["error"]

    @pytest.mark.asyncio()
    async def test_create_dataset_access_denied(
        self, mock_dao_and_security, mcp_server
    ):
        """Returns AccessDeniedError when the caller lacks table-level access."""
        from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
        from superset.exceptions import SupersetSecurityException

        access_exc = SupersetSecurityException(
            SupersetError(
                message="Access denied",
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
            )
        )
        # Patch _SEC_PATH explicitly inside the test with side_effect pre-configured
        # so the raise_for_access mock is guaranteed to raise during the tool call.
        # The autouse mock_dao_and_security fixture keeps the DAO mock active (database
        # found), and this inner patch overrides the security manager mock only.
        with patch(_SEC_PATH) as mock_sec_override:
            mock_sec_override.raise_for_access.side_effect = access_exc

            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "create_dataset",
                    {"request": {"database_id": 1, "table_name": "secret_table"}},
                )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "AccessDeniedError"

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
    async def test_create_dataset_no_schema(
        self, mock_command_class, mock_dao_and_security, mcp_server
    ):
        """schema is optional; omitting it does not pass it to the command."""
        mock_dataset = _make_mock_dataset()
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {"request": {"database_id": 1, "table_name": "orders"}},
            )

        data = json.loads(result.content[0].text)
        assert data["id"] == 42

        call_kwargs = mock_command_class.call_args[0][0]
        assert "schema" not in call_kwargs

    @patch(_CMD_PATH)
    @pytest.mark.asyncio()
    async def test_create_dataset_with_catalog(
        self, mock_command_class, mock_dao_and_security, mcp_server
    ):
        """catalog is forwarded to CreateDatasetCommand when provided."""
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
                        "table_name": "orders",
                        "catalog": "prod_catalog",
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["id"] == 42

        call_kwargs = mock_command_class.call_args[0][0]
        assert call_kwargs["catalog"] == "prod_catalog"
        assert "schema" not in call_kwargs
