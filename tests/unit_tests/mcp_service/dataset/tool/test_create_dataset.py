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

import importlib
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from superset.commands.dataset.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetCreateFailedError,
    DatasetDataAccessIsNotAllowed,
    DatasetExistsValidationError,
    DatasetInvalidError,
    TableNotFoundValidationError,
)
from superset.mcp_service.app import mcp
from superset.sql.parse import Table
from superset.utils import json

# Use importlib to get the module object directly, bypassing the __init__.py
# attribute binding that shadows the module name with the exported function.
# This ensures patch.object resolves to the module in all Python versions.
create_dataset_module = importlib.import_module(
    "superset.mcp_service.dataset.tool.create_dataset"
)


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
    dataset.changed_by_name = "admin"
    dataset.changed_on = None
    dataset.changed_on_humanized = None
    dataset.created_by_name = "admin"
    dataset.created_on = None
    dataset.created_on_humanized = None
    dataset.tags = []
    dataset.editors = []
    dataset.is_virtual = False
    dataset.is_favorite = None
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

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_success(self, mock_command_class, mcp_server) -> None:
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
        assert "editors" not in call_kwargs

    @patch.object(create_dataset_module, "get_or_create_user_subject")
    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_with_editors(
        self, mock_command_class, mock_get_subject, mcp_server
    ) -> None:
        """Editor user IDs are converted to subject IDs before creation."""
        mock_dataset = _make_mock_dataset()
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command
        mock_get_subject.side_effect = [
            MagicMock(id=50),
            MagicMock(id=100),
        ]

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 2,
                        "schema": "sales",
                        "table_name": "transactions",
                        "editors": [5, 10],
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["id"] == 42

        call_kwargs = mock_command_class.call_args[0][0]
        assert call_kwargs["editors"] == [50, 100]

    @pytest.mark.asyncio
    async def test_create_dataset_rejects_owners(self, mcp_server) -> None:
        """The legacy owners field is not part of the create_dataset contract."""
        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
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

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_already_exists(
        self, mock_command_class, mcp_server
    ) -> None:
        """Returns DatasetExistsError when the table is already registered.

        CreateDatasetCommand.validate() wraps DatasetExistsValidationError inside
        DatasetInvalidError.  The tool must inspect get_list_classnames() to surface
        the typed error response.
        """
        mock_command = MagicMock()
        mock_command.run.side_effect = DatasetInvalidError(
            exceptions=[DatasetExistsValidationError(Table("orders", "public", None))]
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

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_table_not_found(
        self, mock_command_class, mcp_server
    ) -> None:
        """Returns TableNotFoundError when the physical table does not exist in the DB.

        CreateDatasetCommand.validate() wraps TableNotFoundValidationError inside
        DatasetInvalidError.  The tool must inspect get_list_classnames() to surface
        the typed error response.
        """
        mock_command = MagicMock()
        mock_command.run.side_effect = DatasetInvalidError(
            exceptions=[
                TableNotFoundValidationError(Table("missing_table", "public", None))
            ]
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

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_with_catalog(
        self, mock_command_class, mcp_server
    ) -> None:
        """Catalog field is normalized and forwarded to the command when supplied."""
        mock_dataset = _make_mock_dataset()
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "catalog": "  hive  ",
                        "schema": "default",
                        "table_name": "events",
                    }
                },
            )

        call_kwargs = mock_command_class.call_args[0][0]
        assert call_kwargs["catalog"] == "hive"

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_invalid_error(
        self, mock_command_class, mcp_server
    ) -> None:
        """DatasetInvalidError is returned as ValidationError type."""
        mock_command = MagicMock()
        mock_command.run.side_effect = DatasetInvalidError()
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
        assert data["error_type"] == "ValidationError"
        assert "error" in data

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_create_failed_error(
        self, mock_command_class, mcp_server
    ) -> None:
        """DatasetCreateFailedError is returned as CreateFailedError type."""
        mock_command = MagicMock()
        mock_command.run.side_effect = DatasetCreateFailedError()
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
        assert data["error_type"] == "CreateFailedError"
        assert "Dataset creation failed" in data["error"]

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_database_not_found(
        self, mock_command_class, mcp_server
    ) -> None:
        """Returns DatabaseNotFoundError when CreateDatasetCommand raises it."""
        mock_command = MagicMock()
        mock_command.run.side_effect = DatasetInvalidError(
            exceptions=[DatabaseNotFoundValidationError()]
        )
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 999,
                        "table_name": "orders",
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "DatabaseNotFoundError"
        assert "Database not found" in data["error"]

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_access_denied(
        self, mock_command_class, mcp_server
    ) -> None:
        """Returns AccessDeniedError when CreateDatasetCommand raises it."""
        mock_command = MagicMock()
        mock_command.run.side_effect = DatasetInvalidError(
            exceptions=[DatasetDataAccessIsNotAllowed("Access is Denied")]
        )
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "secret",
                        "table_name": "restricted_table",
                    }
                },
            )

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "AccessDeniedError"
        assert "Access denied" in data["error"]

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_unexpected_error(
        self, mock_command_class, mcp_server
    ) -> None:
        """Unexpected exceptions are re-raised as ToolError (handled by middleware)."""
        mock_command = MagicMock()
        mock_command.run.side_effect = RuntimeError("DB connection lost")
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            with pytest.raises(ToolError):
                await client.call_tool(
                    "create_dataset",
                    {
                        "request": {
                            "database_id": 1,
                            "schema": "public",
                            "table_name": "orders",
                        }
                    },
                )

    @pytest.mark.asyncio
    async def test_create_dataset_missing_required_fields(self, mcp_server) -> None:
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

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_returns_full_dataset_info(
        self, mock_command_class, mcp_server
    ) -> None:
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

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_table_name_whitespace_normalized(
        self, mock_command_class, mcp_server
    ) -> None:
        """Whitespace in table_name is stripped before forwarding to the command."""
        mock_dataset = _make_mock_dataset()
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "public",
                        "table_name": "  orders  ",
                    }
                },
            )

        call_kwargs = mock_command_class.call_args[0][0]
        assert call_kwargs["table_name"] == "orders"

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_blank_schema_normalized_to_none(
        self, mock_command_class, mcp_server
    ) -> None:
        """Blank schema string is treated as absent: not forwarded to the command."""
        mock_dataset = _make_mock_dataset(schema="")
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "schema": "",
                        "table_name": "orders",
                    }
                },
            )

        call_kwargs = mock_command_class.call_args[0][0]
        assert "schema" not in call_kwargs

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @pytest.mark.asyncio
    async def test_create_dataset_blank_catalog_normalized_to_none(
        self, mock_command_class, mcp_server
    ) -> None:
        """Blank catalog string is treated as absent: not forwarded to the command."""
        mock_dataset = _make_mock_dataset()
        mock_command = MagicMock()
        mock_command.run.return_value = mock_dataset
        mock_command_class.return_value = mock_command

        async with Client(mcp_server) as client:
            await client.call_tool(
                "create_dataset",
                {
                    "request": {
                        "database_id": 1,
                        "catalog": "",
                        "table_name": "orders",
                    }
                },
            )

        call_kwargs = mock_command_class.call_args[0][0]
        assert "catalog" not in call_kwargs

    @pytest.mark.asyncio
    async def test_create_dataset_non_string_namespace_rejected(
        self, mcp_server
    ) -> None:
        """Non-string schema/catalog values fail validation, not silently dropped."""
        async with Client(mcp_server) as client:
            for field, value in (("schema", 123), ("catalog", {"name": "hive"})):
                with pytest.raises(ToolError):
                    await client.call_tool(
                        "create_dataset",
                        {
                            "request": {
                                "database_id": 1,
                                "table_name": "orders",
                                field: value,
                            }
                        },
                    )

    @patch.object(create_dataset_module, "CreateDatasetCommand")
    @patch.object(create_dataset_module, "serialize_dataset_object", return_value=None)
    @pytest.mark.asyncio
    async def test_create_dataset_when_serialize_returns_none(
        self, mock_serialize, mock_command_class, mcp_server
    ) -> None:
        """Returns SerializationError when serialize_dataset_object returns None."""
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

        data = json.loads(result.content[0].text)
        assert data["error_type"] == "SerializationError"
