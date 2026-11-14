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

"""Calculated column tools exercised through MCP and the dataset commands."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from fastmcp import Client
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from superset.commands.dataset.columns.exceptions import (
    DatasetColumnDeleteFailedError,
    DatasetColumnForbiddenError,
    DatasetColumnNotFoundError,
)
from superset.commands.dataset.exceptions import (
    DatasetColumnsDuplicateValidationError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetNotFoundError,
    DatasetSoftDeletedTwinExistsError,
    DatasetUpdateFailedError,
)
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.mcp_service.dataset.schemas import (
    CreateDatasetColumnRequest,
    DeleteDatasetColumnRequest,
    UpdateDatasetColumnRequest,
)
from superset.mcp_service.dataset.tool.delete_dataset_column import (
    _order_by_column,
    _references_column,
)
from superset.models.core import Database
from superset.utils import json

CREATE, UPDATE, DELETE = (
    "create_dataset_column",
    "update_dataset_column",
    "delete_dataset_column",
)
TOOLS = [CREATE, UPDATE, DELETE]
UUID = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
UPDATE_COMMAND = "superset.commands.dataset.update.UpdateDatasetCommand"
DELETE_COMMAND = "superset.commands.dataset.columns.delete.DeleteDatasetColumnCommand"
REFERENCES = (
    "superset.mcp_service.dataset.tool.delete_dataset_column._find_affected_charts"
)


@pytest.fixture
def session_engine() -> Engine:
    """Let the tool worker thread use the ``session`` built by this test."""
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[None]:
    """Authenticate an MCP caller without testing authentication itself."""
    with patch("superset.mcp_service.auth.get_user_from_request") as get_user:
        get_user.return_value = MagicMock(id=1, username="admin")
        yield


@pytest.fixture(autouse=True)
def editorship() -> Iterator[MagicMock]:
    """Permit editorship except in tests explicitly denying it."""
    with patch(
        "superset.security.SupersetSecurityManager.raise_for_editorship"
    ) as check:
        yield check


@pytest.fixture
def dataset() -> MagicMock:
    """A dataset with one physical and one calculated column."""
    dataset = MagicMock(id=1, table_name="sales")
    dataset.columns = [
        TableColumn(id=20, column_name="amount", type="DOUBLE"),
        TableColumn(
            id=21,
            column_name="order_size",
            expression="CASE WHEN amount > 100 THEN 'large' ELSE 'small' END",
            type="VARCHAR",
            uuid=UUID,
        ),
    ]
    return dataset


@pytest.fixture
def references() -> Iterator[MagicMock]:
    """Avoid database access in tool orchestration tests."""
    with patch(REFERENCES, return_value=[]) as lookup:
        yield lookup


def request_for(tool: str) -> dict[str, Any]:
    """Build a minimal valid request for each tool."""
    if tool == CREATE:
        return {
            "dataset_id": 1,
            "column_name": "double_amount",
            "expression": "amount * 2",
        }
    if tool == UPDATE:
        return {"dataset_id": 1, "column": "order_size", "verbose_name": "Size"}
    return {"dataset_id": 1, "column": "order_size"}


async def call(tool: str, request: dict[str, Any]) -> dict[str, Any]:
    """Call the registered tool through MCP and decode its response."""
    async with Client(mcp) as client:
        result = await client.call_tool(tool, {"request": request})
        return json.loads(result.content[0].text)


@pytest.mark.parametrize("field", ["column_name", "expression"])
@pytest.mark.parametrize("value", [None, "", "   "])
def test_create_rejects_blank_required_properties(field: str, value: Any) -> None:
    """Names and SQL expressions cannot be null, empty, or whitespace."""
    request = {**request_for(CREATE), field: value}
    with pytest.raises(ValidationError):
        CreateDatasetColumnRequest.model_validate(request)


@pytest.mark.parametrize("field", ["column_name", "expression"])
def test_create_requires_properties(field: str) -> None:
    """Both name and expression are mandatory."""
    request = request_for(CREATE)
    del request[field]
    with pytest.raises(ValidationError):
        CreateDatasetColumnRequest.model_validate(request)


def test_rejects_invalid_python_date_format() -> None:
    """Date formats are checked before the request reaches the command."""
    with pytest.raises(ValidationError, match="python_date_format"):
        CreateDatasetColumnRequest.model_validate(
            {**request_for(CREATE), "python_date_format": "not a format"}
        )
    request = CreateDatasetColumnRequest.model_validate(
        {**request_for(CREATE), "python_date_format": "epoch_ms"}
    )
    assert request.python_date_format == "epoch_ms"


def test_update_requires_a_property() -> None:
    """An update with nothing to change is rejected."""
    with pytest.raises(ValidationError, match="At least one column property"):
        UpdateDatasetColumnRequest.model_validate({"dataset_id": 1, "column": 21})


def test_update_rejects_clearing_expression() -> None:
    """Clearing an expression is a delete, not an update."""
    with pytest.raises(ValidationError, match="delete_dataset_column"):
        UpdateDatasetColumnRequest.model_validate(
            {"dataset_id": 1, "column": 21, "expression": None}
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("identifier", [1, "1", UUID])
async def test_create_success(dataset: MagicMock, identifier: int | str) -> None:
    """Optional properties pass through as one additive column write."""
    request = {
        **request_for(CREATE),
        "dataset_id": identifier,
        "verbose_name": "Double amount",
        "description": "Exact <UNTRUSTED-CONTENT> text",
        "type": "DOUBLE",
        "is_dttm": False,
        "groupby": True,
        "filterable": False,
    }
    properties = {key: value for key, value in request.items() if key != "dataset_id"}
    created = TableColumn(id=22, uuid=UUID, **properties)
    updated = MagicMock(id=1, table_name="sales", columns=[*dataset.columns, created])
    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset
        ) as find,
        patch(UPDATE_COMMAND) as command,
    ):
        command.return_value.run.return_value = updated
        result = await call(CREATE, request)
    assert find.call_args.args == (1 if identifier != UUID else UUID,)
    command.assert_called_once_with(
        1, {"columns": [properties]}, preserve_existing_columns=True
    )
    assert result["error"] is None
    assert result["column"]["id"] == 22
    assert result["column"]["expression"] == "amount * 2"
    assert result["column"]["is_calculated"] is True
    assert result["column"]["filterable"] is False
    assert "datasource_id=1" in result["url"]


@pytest.mark.asyncio
async def test_create_duplicate(dataset: MagicMock) -> None:
    """Duplicate names produce actionable errors without invoking persistence."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as command,
    ):
        result = await call(CREATE, {**request_for(CREATE), "column_name": "amount"})
    command.assert_not_called()
    assert result["column"] is None
    assert "'amount' already exists" in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("identifier", [21, "21", UUID.upper(), "order_size"])
async def test_update_success(dataset: MagicMock, identifier: int | str) -> None:
    """Only the target column, with only the requested changes, is sent."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as command,
    ):
        command.return_value.run.return_value = dataset
        result = await call(
            UPDATE,
            {
                "dataset_id": 1,
                "column": identifier,
                "column_name": "size_bucket",
                "expression": "CASE WHEN amount > 500 THEN 'large' END",
            },
        )
    command.assert_called_once_with(
        1,
        {
            "columns": [
                {
                    "id": 21,
                    "column_name": "size_bucket",
                    "expression": "CASE WHEN amount > 500 THEN 'large' END",
                }
            ]
        },
        preserve_existing_columns=True,
    )
    assert result["error"] is None
    assert result["updated_properties"] == ["column_name", "expression"]
    assert result["column"]["id"] == 21


@pytest.mark.asyncio
async def test_update_physical_column_display_properties(dataset: MagicMock) -> None:
    """Physical columns accept label and behaviour changes."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as command,
    ):
        command.return_value.run.return_value = dataset
        result = await call(
            UPDATE,
            {"dataset_id": 1, "column": "amount", "verbose_name": "Amount ($)"},
        )
    command.assert_called_once()
    assert result["error"] is None
    assert result["column"]["is_calculated"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "change", [{"column_name": "amt"}, {"expression": "amount / 100"}]
)
async def test_update_rejects_physical_identity_changes(
    dataset: MagicMock, change: dict[str, str]
) -> None:
    """Renaming a physical column or giving it an expression would break it."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as command,
    ):
        result = await call(UPDATE, {"dataset_id": 1, "column": "amount", **change})
    command.assert_not_called()
    assert "physical column" in result["error"]


@pytest.mark.asyncio
async def test_update_rename_collision(dataset: MagicMock) -> None:
    """Renaming onto another column's name is refused up front."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as command,
    ):
        result = await call(
            UPDATE,
            {"dataset_id": 1, "column": "order_size", "column_name": "amount"},
        )
    command.assert_not_called()
    assert "'amount' already exists" in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", [UPDATE, DELETE])
@pytest.mark.parametrize("empty", [False, True])
async def test_unknown_column(tool: str, dataset: MagicMock, empty: bool) -> None:
    """Reuse did-you-mean guidance, including the empty dataset case."""
    if empty:
        dataset.columns = []
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as update,
        patch(DELETE_COMMAND) as delete,
    ):
        result = await call(tool, {**request_for(tool), "column": "order_siz"})
    update.assert_not_called()
    delete.assert_not_called()
    assert result["column"] is None
    assert ("no columns" if empty else "Did you mean: order_size?") in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("identifier", [21, UUID, "order_size"])
async def test_delete_success(
    dataset: MagicMock, references: MagicMock, identifier: int | str
) -> None:
    """Delete only the target column and report referencing charts."""
    references.return_value = [{"id": 5, "uuid": UUID, "slice_name": "Sizes"}]
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(DELETE_COMMAND) as command,
    ):
        result = await call(DELETE, {"dataset_id": 1, "column": identifier})
    command.assert_called_once_with(1, 21)
    command.return_value.run.assert_called_once_with()
    assert references.call_args.args == (1, "order_size")
    assert references.call_args.kwargs["is_reference"] is _references_column
    assert result["error"] is None
    assert result["column"]["column_name"] == "order_size"
    assert result["affected_charts"] == references.return_value


@pytest.mark.asyncio
async def test_delete_rejects_expanded_nested_field(
    dataset: MagicMock, references: MagicMock
) -> None:
    """An expanded nested field carries an expression but is still physical."""
    dataset.columns.append(
        TableColumn(
            id=22,
            column_name="meta.uuid",
            expression='"meta"."uuid"',
            type="VARCHAR",
        )
    )
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(DELETE_COMMAND) as command,
    ):
        result = await call(DELETE, {"dataset_id": 1, "column": "meta.uuid"})
    command.assert_not_called()
    assert "physical column" in result["error"]


@pytest.mark.asyncio
async def test_delete_rejects_physical_column(
    dataset: MagicMock, references: MagicMock
) -> None:
    """Physical columns are managed by syncing the dataset, not deleted here."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(DELETE_COMMAND) as command,
    ):
        result = await call(DELETE, {"dataset_id": 1, "column": "amount"})
    command.assert_not_called()
    references.assert_not_called()
    assert "physical column" in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", TOOLS)
async def test_unknown_dataset(tool: str) -> None:
    """An unknown dataset yields a clear error and no writes."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None),
        patch(UPDATE_COMMAND) as update,
        patch(DELETE_COMMAND) as delete,
    ):
        result = await call(tool, request_for(tool))
    update.assert_not_called()
    delete.assert_not_called()
    assert "No dataset found" in result["error"]
    assert result["column"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", TOOLS)
async def test_non_editor_cannot_inspect_columns(
    tool: str, dataset: MagicMock, editorship: MagicMock
) -> None:
    """Deny before duplicate checks, name suggestions, or chart inspection."""
    editorship.side_effect = SupersetSecurityException(MagicMock(message="denied"))
    type(dataset).columns = PropertyMock(side_effect=AssertionError("columns read"))
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as update,
        patch(DELETE_COMMAND) as delete,
    ):
        result = await call(tool, request_for(tool))
    update.assert_not_called()
    delete.assert_not_called()
    assert "owner" in result["error"]
    assert "order_size" not in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", [CREATE, UPDATE])
@pytest.mark.parametrize(
    "exception, message",
    [
        (DatasetNotFoundError(), "No dataset found"),
        (DatasetForbiddenError(), "owner"),
        (DatasetUpdateFailedError(), "Failed to"),
        (DatasetSoftDeletedTwinExistsError(UUID), f"/api/v1/dataset/{UUID}/restore"),
        (
            DatasetInvalidError(exceptions=[DatasetColumnsDuplicateValidationError()]),
            "duplicate",
        ),
    ],
)
async def test_update_command_errors(
    tool: str, exception: Exception, message: str, dataset: MagicMock
) -> None:
    """Surface the dataset update command's validation and failures."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(UPDATE_COMMAND) as command,
    ):
        command.return_value.run.side_effect = exception
        result = await call(tool, request_for(tool))
    assert result["column"] is None
    assert message in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "exception, message",
    [
        (DatasetColumnNotFoundError(), "not found"),
        (DatasetColumnForbiddenError(), "owner"),
        (DatasetColumnDeleteFailedError(), "Failed to delete column"),
    ],
)
async def test_delete_command_errors(
    exception: Exception, message: str, dataset: MagicMock, references: MagicMock
) -> None:
    """Surface the column delete command's failures."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(DELETE_COMMAND) as command,
    ):
        command.return_value.run.side_effect = exception
        result = await call(DELETE, request_for(DELETE))
    assert result["column"] is None
    assert message in result["error"]
    assert not result.get("affected_charts")


@pytest.mark.parametrize(
    "config, expected",
    [
        ({"groupby": ["region", "order_size"]}, True),
        ({"columns": ["order_size"]}, True),
        ({"x_axis": "order_size"}, True),
        ({"granularity_sqla": "order_size"}, True),
        ({"all_columns": ["order_size"]}, True),
        ({"series": "order_size"}, True),
        (
            {"adhoc_filters": [{"expressionType": "SIMPLE", "subject": "order_size"}]},
            True,
        ),
        ({"queries": [{"filters": [{"col": "order_size", "op": "=="}]}]}, True),
        ({"queries": [{"columns": ["order_size"]}]}, True),
        ({"metrics": [{"column": {"column_name": "order_size"}}]}, True),
        (
            {"adhoc_filters": [{"expressionType": "SQL", "subject": "order_size"}]},
            False,
        ),
        ({"metrics": ["order_size"], "slice_name": "order_size"}, False),
        ({"groupby": ["order_size_v2"]}, False),
        ({"groupby_b": ["order_size"]}, True),
        ({"column": "order_size"}, True),
        ({"start_time": "order_size"}, True),
        ({"end_time": "order_size"}, True),
        ({"y_axis": "order_size"}, True),
        ({"tooltip_columns": ["order_size"]}, True),
        ({"source": "order_size", "target": "other"}, True),
        ({"dimension": "order_size"}, True),
        ({"granularity_sqla_b": "order_size"}, True),
        ({"spatial": {"latCol": "order_size", "lonCol": "lon"}}, True),
        ({"order_by_cols": ['["order_size", true]']}, True),
        ({"order_by_cols": ['["order_size_v2", false]']}, False),
        ({}, False),
    ],
)
def test_column_references(config: dict[str, Any], expected: bool) -> None:
    """Detect references by column name, not names elsewhere in the config."""
    assert _references_column(config, "order_size") is expected


def _make_dataset(session: Session, name: str) -> tuple[SqlaTable, TableColumn]:
    """Persist a dataset with one physical column."""
    Database.metadata.create_all(session.bind)
    database = Database(database_name=name, sqlalchemy_uri="sqlite://")
    physical = TableColumn(column_name="amount", type="DOUBLE")
    dataset = SqlaTable(database=database, table_name=name, columns=[physical])
    session.add(dataset)
    session.commit()
    return dataset, physical


@pytest.mark.asyncio
async def test_real_commands_create_update_delete(session: Session) -> None:
    """Persist a calculated column, edit it, and delete it via the real commands."""
    from superset.daos.dataset import DatasetDAO

    dataset, physical = _make_dataset(session, "column_mutations")
    dataset_id, physical_id = dataset.id, physical.id
    with (
        patch.object(DatasetDAO, "base_filter", None),
        patch("superset.security.SupersetSecurityManager.is_admin", return_value=True),
        patch(REFERENCES, return_value=[]),
    ):
        created = await call(CREATE, {**request_for(CREATE), "dataset_id": dataset_id})
        assert created["error"] is None
        column_id = created["column"]["id"]
        assert created["column"]["uuid"]
        session.expire_all()
        assert session.get(TableColumn, column_id).expression == "amount * 2"

        updated = await call(
            UPDATE,
            {
                "dataset_id": dataset_id,
                "column": column_id,
                "expression": "amount * 3",
                "verbose_name": "Triple",
            },
        )
        assert updated["error"] is None
        session.expire_all()
        stored = session.get(TableColumn, column_id)
        assert (stored.expression, stored.verbose_name) == ("amount * 3", "Triple")
        assert stored.column_name == "double_amount"

        deleted = await call(DELETE, {"dataset_id": dataset_id, "column": column_id})
        assert deleted["error"] is None
        session.expire_all()
        assert session.get(TableColumn, column_id) is None
        assert session.get(TableColumn, physical_id) is not None


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", [CREATE, UPDATE])
async def test_writes_preserve_column_changes_after_lookup(
    session: Session, tool: str
) -> None:
    """A concurrent addition and rename must survive the column write."""
    from superset.daos.dataset import DatasetDAO

    dataset, physical = _make_dataset(session, f"concurrent_{tool}")
    target = TableColumn(column_name="order_size", expression="amount > 100")
    dataset.columns.append(target)
    session.commit()
    dataset_id, physical_id = dataset.id, physical.id
    find_by_id = DatasetDAO.find_by_id
    lookup_count = 0
    added = TableColumn(column_name="concurrent", expression="amount + 1")

    def find_with_concurrent_change(*args: Any, **kwargs: Any) -> SqlaTable | None:
        """Commit another writer's changes between tool lookup and validation."""
        nonlocal lookup_count
        lookup_count += 1
        if lookup_count == 2:
            physical.verbose_name = "changed elsewhere"
            dataset.columns.append(added)
            session.commit()
        return find_by_id(*args, **kwargs)

    request = (
        {**request_for(CREATE), "dataset_id": dataset_id}
        if tool == CREATE
        else {"dataset_id": dataset_id, "column": "order_size", "verbose_name": "Size"}
    )
    with (
        patch.object(DatasetDAO, "base_filter", None),
        patch.object(DatasetDAO, "find_by_id", side_effect=find_with_concurrent_change),
        patch("superset.security.SupersetSecurityManager.is_admin", return_value=True),
    ):
        result = await call(tool, request)
    assert result["error"] is None
    session.expire_all()
    assert session.get(TableColumn, physical_id).verbose_name == "changed elsewhere"
    names = {
        column.column_name for column in session.get(SqlaTable, dataset_id).columns
    }
    expected = {"amount", "order_size", "concurrent"}
    assert names == (expected | {"double_amount"} if tool == CREATE else expected)


@pytest.mark.parametrize(
    "model, payload",
    [
        (UpdateDatasetColumnRequest, {"dataset_id": True, "column": 1, "type": "INT"}),
        (UpdateDatasetColumnRequest, {"dataset_id": 1, "column": True, "type": "INT"}),
        (DeleteDatasetColumnRequest, {"dataset_id": True, "column": 1}),
        (DeleteDatasetColumnRequest, {"dataset_id": 1, "column": True}),
    ],
)
def test_boolean_identifiers_rejected(model, payload):
    with pytest.raises(ValidationError):
        model.model_validate(payload)


@pytest.mark.parametrize("flag", ["groupby", "filterable"])
def test_null_flags_rejected(flag):
    with pytest.raises(ValidationError):
        UpdateDatasetColumnRequest.model_validate(
            {"dataset_id": 1, "column": 1, flag: None}
        )


def test_order_by_column_survives_deeply_nested_json():
    nested = "[" * 100000 + "]" * 100000
    assert _order_by_column(nested) == nested
