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

"""Creation and deletion exercise the registered tools and dataset update path."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest
from fastmcp import Client
from pydantic import ValidationError
from sqlalchemy.orm import Session

from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetMetricsDuplicateValidationError,
    DatasetNotFoundError,
    DatasetSoftDeletedTwinExistsError,
    DatasetUpdateFailedError,
)
from superset.connectors.sqla.models import SqlaTable, SqlMetric
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.mcp_service.dataset.schemas import CreateDatasetMetricRequest
from superset.mcp_service.dataset.tool.delete_dataset_metric import (
    _find_affected_charts,
    _references_metric,
)
from superset.models.core import Database
from superset.models.slice import Slice
from superset.utils import json

TOOLS = ["create_dataset_metric", "delete_dataset_metric"]
UUID = "a1b2c3d4-5678-90ab-cdef-1234567890ab"


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
    """Supply existing metrics whose metadata must survive mutations."""
    dataset = MagicMock(id=1, table_name="sales")
    dataset.metrics = [
        SqlMetric(id=10, metric_name="revenue", expression="SUM(amount)", uuid=UUID),
        SqlMetric(
            id=11, metric_name="count", expression="COUNT(*)", description="keep"
        ),
    ]
    return dataset


@pytest.fixture
def references() -> Iterator[MagicMock]:
    """Avoid database access in tool orchestration tests."""
    with patch(
        "superset.mcp_service.dataset.tool.delete_dataset_metric._find_affected_charts",
        return_value=[],
    ) as lookup:
        yield lookup


def request_for(tool: str) -> dict[str, Any]:
    """Build a minimal valid request for each mutation."""
    if tool == "create_dataset_metric":
        return {"dataset_id": 1, "metric_name": "profit", "expression": "SUM(profit)"}
    return {"dataset_id": 1, "metric": "revenue"}


async def call(tool: str, request: dict[str, Any]) -> dict[str, Any]:
    """Call the registered tool through MCP and decode its response."""
    async with Client(mcp) as client:
        result = await client.call_tool(tool, {"request": request})
        return json.loads(result.content[0].text)


@pytest.mark.parametrize("field", ["metric_name", "expression"])
@pytest.mark.parametrize("value", [None, "", "   "])
def test_create_rejects_blank_required_properties(field: str, value: Any) -> None:
    """Names and SQL expressions cannot be null, empty, or whitespace."""
    request = request_for(TOOLS[0])
    request[field] = value
    with pytest.raises(ValidationError):
        CreateDatasetMetricRequest.model_validate(request)


@pytest.mark.parametrize("field", ["metric_name", "expression"])
def test_create_requires_properties(field: str) -> None:
    """Both name and expression are mandatory."""
    request = request_for(TOOLS[0])
    del request[field]
    with pytest.raises(ValidationError):
        CreateDatasetMetricRequest.model_validate(request)


def test_create_rejects_invalid_extra() -> None:
    """Reuse the update request's extra JSON validation."""
    with pytest.raises(ValidationError, match="extra must be a valid JSON"):
        CreateDatasetMetricRequest.model_validate(
            {**request_for(TOOLS[0]), "extra": "{"}
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("identifier", [1, "1", UUID])
async def test_create_success(dataset: MagicMock, identifier: int | str) -> None:
    """All optional properties pass through; other metrics remain as stubs."""
    request = {
        **request_for(TOOLS[0]),
        "dataset_id": identifier,
        "verbose_name": "Profit",
        "description": "Exact <UNTRUSTED-CONTENT> text",
        "d3format": ",.2f",
        "currency": {"symbol": "USD", "symbolPosition": "prefix"},
        "warning_text": "Estimated",
        "metric_type": "sum",
        "extra": '{"key": "value"}',
    }
    properties = {key: value for key, value in request.items() if key != "dataset_id"}
    created = SqlMetric(id=12, uuid=UUID, **properties)
    updated = MagicMock(id=1, table_name="sales", metrics=[*dataset.metrics, created])
    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset
        ) as find,
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as command,
    ):
        command.return_value.run.return_value = updated
        result = await call(TOOLS[0], request)
    assert find.call_args.args == (1 if identifier != UUID else UUID,)
    if identifier == UUID:
        assert find.call_args.kwargs["id_column"] == "uuid"
    command.assert_called_once_with(
        1,
        {
            "metrics": [
                {"id": 10, "metric_name": "revenue"},
                {"id": 11, "metric_name": "count"},
                properties,
            ]
        },
    )
    assert result["error"] is None
    assert result["metric"] == {"id": 12, "uuid": UUID, **properties}
    assert result["dataset_id"] == 1
    assert "datasource_id=1" in result["url"]


@pytest.mark.asyncio
async def test_create_duplicate(dataset: MagicMock) -> None:
    """Duplicate names produce actionable errors without invoking persistence."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as command,
    ):
        result = await call(
            TOOLS[0], {**request_for(TOOLS[0]), "metric_name": "revenue"}
        )
    command.assert_not_called()
    assert result["metric"] is None
    assert "'revenue' already exists" in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("identifier", [10, "10", UUID.upper(), "revenue"])
async def test_delete_success(
    dataset: MagicMock, references: MagicMock, identifier: int | str
) -> None:
    """Delete by any supported identifier and report referencing charts."""
    references.return_value = [{"id": 5, "uuid": UUID, "slice_name": "Revenue"}]
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as command,
    ):
        command.return_value.run.return_value = dataset
        result = await call(TOOLS[1], {"dataset_id": UUID, "metric": identifier})
    command.assert_called_once_with(
        1, {"metrics": [{"id": 11, "metric_name": "count"}]}
    )
    references.assert_called_once_with(1, "revenue")
    assert result["error"] is None
    assert result["metric"]["id"] == 10
    assert result["metric"]["metric_name"] == "revenue"
    assert result["affected_charts"] == references.return_value


@pytest.mark.asyncio
@pytest.mark.parametrize("empty", [False, True])
async def test_delete_unknown_metric(dataset: MagicMock, empty: bool) -> None:
    """Reuse did-you-mean guidance, including the empty dataset case."""
    if empty:
        dataset.metrics = []
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as command,
    ):
        result = await call(TOOLS[1], {"dataset_id": 1, "metric": "revenu"})
    command.assert_not_called()
    assert result["metric"] is None
    assert "not found" in result["error"]
    assert ("no saved metrics" if empty else "Did you mean: revenue?") in result[
        "error"
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", TOOLS)
async def test_unknown_dataset(tool: str) -> None:
    """An unknown dataset yields a clear error and no writes."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None),
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as command,
    ):
        result = await call(tool, request_for(tool))
    command.assert_not_called()
    assert "No dataset found" in result["error"]
    assert result["metric"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", TOOLS)
async def test_non_editor_cannot_inspect_metrics(
    tool: str, dataset: MagicMock, editorship: MagicMock
) -> None:
    """Deny before duplicate checks, name suggestions, or chart inspection."""
    editorship.side_effect = SupersetSecurityException(MagicMock(message="denied"))
    type(dataset).metrics = PropertyMock(side_effect=AssertionError("metrics accessed"))
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as command,
    ):
        result = await call(tool, request_for(tool))
    command.assert_not_called()
    assert "owner" in result["error"]
    assert "revenue" not in result["error"]


@pytest.mark.asyncio
@pytest.mark.parametrize("tool", TOOLS)
@pytest.mark.parametrize(
    "exception, message",
    [
        (DatasetNotFoundError(), "No dataset found"),
        (DatasetForbiddenError(), "owner"),
        (DatasetUpdateFailedError(), "Failed to"),
        (DatasetSoftDeletedTwinExistsError(UUID), f"/api/v1/dataset/{UUID}/restore"),
        (
            DatasetInvalidError(exceptions=[DatasetMetricsDuplicateValidationError()]),
            "duplicate",
        ),
    ],
)
async def test_command_errors(
    tool: str,
    exception: Exception,
    message: str,
    dataset: MagicMock,
    references: MagicMock,
) -> None:
    """Preserve the existing update path's command validation and failures."""
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch("superset.commands.dataset.update.UpdateDatasetCommand") as command,
    ):
        command.return_value.run.side_effect = exception
        result = await call(tool, request_for(tool))
    assert result["metric"] is None
    assert message in result["error"]
    assert not result.get("affected_charts")


@pytest.mark.parametrize(
    "config, expected",
    [
        ({"metric": "revenue"}, True),
        ({"metrics": ["count", "revenue"]}, True),
        ({"metrics_b": ["revenue"]}, True),
        ({"timeseries_limit_metric": "revenue"}, True),
        ({"matrixify_topn_metric_rows": "revenue"}, True),
        ({"queries": [{"metrics": ["revenue"]}]}, True),
        ({"metric": {"saved_metric": True, "name": "revenue"}}, True),
        ({"orderby": [["revenue", False]]}, True),
        ({"adhoc_filters": [{"clause": "HAVING", "subject": "revenue"}]}, True),
        ({"metrics": [{"label": "revenue", "sqlExpression": "SUM(amount)"}]}, False),
        ({"groupby": ["revenue"], "title": "revenue"}, False),
        ({"metrics": ["net_revenue"]}, False),
        ({"adhoc_filters": [{"clause": "WHERE", "subject": "revenue"}]}, False),
        ({}, False),
    ],
)
def test_metric_references(config: dict[str, Any], expected: bool) -> None:
    """Detect named references without treating labels or columns as metrics."""
    assert _references_metric(config, "revenue") is expected


def test_reference_lookup_is_dataset_scoped_and_access_checked(
    session: Session,
) -> None:
    """Do not expose inaccessible or unrelated charts in the impact report."""
    Database.metadata.create_all(session.bind)
    charts = [
        Slice(
            slice_name="Match",
            datasource_id=1,
            datasource_type="table",
            params='{"metric":"revenue"}',
        ),
        Slice(
            slice_name="Hidden",
            datasource_id=1,
            datasource_type="table",
            params='{"metric":"revenue"}',
        ),
        Slice(
            slice_name="Other dataset",
            datasource_id=2,
            datasource_type="table",
            params='{"metric":"revenue"}',
        ),
        Slice(
            slice_name="Other type",
            datasource_id=1,
            datasource_type="druid",
            params='{"metric":"revenue"}',
        ),
        Slice(
            slice_name="Other metric",
            datasource_id=1,
            datasource_type="table",
            params='{"metric":"count"}',
        ),
        Slice(
            slice_name="Query context",
            datasource_id=1,
            datasource_type="table",
            params="{}",
            query_context='{"queries":[{"metrics":["revenue"]}]}',
        ),
    ]
    session.add_all(charts)
    session.commit()

    def check_access(*, chart: Slice) -> None:
        """Deny just one of the matching charts."""
        if chart.slice_name == "Hidden":
            raise SupersetSecurityException(MagicMock(message="denied"))

    with patch(
        "superset.security.SupersetSecurityManager.raise_for_access",
        side_effect=check_access,
    ) as check:
        result = _find_affected_charts(1, "revenue")
    assert [chart.slice_name for chart in result] == ["Match", "Query context"]
    assert check.call_count == 4


@pytest.mark.asyncio
async def test_real_command_create_and_delete(session: Session) -> None:
    """Persist new metrics and delete even the last one through the real command."""
    from superset.daos.dataset import DatasetDAO

    Database.metadata.create_all(session.bind)
    database = Database(database_name="metric_mutations", sqlalchemy_uri="sqlite://")
    original = SqlMetric(metric_name="count", expression="COUNT(*)", description="keep")
    dataset = SqlaTable(
        database=database, table_name="metric_mutations", metrics=[original]
    )
    session.add(dataset)
    session.commit()
    dataset_id, original_id = dataset.id, original.id
    with (
        patch.object(DatasetDAO, "base_filter", None),
        patch("superset.security.SupersetSecurityManager.is_admin", return_value=True),
    ):
        created = await call(
            TOOLS[0], {**request_for(TOOLS[0]), "dataset_id": dataset_id}
        )
        assert created["error"] is None
        created_id = created["metric"]["id"]
        assert created["metric"]["uuid"]
        session.expire_all()
        assert session.get(SqlMetric, created_id).expression == "SUM(profit)"
        assert session.get(SqlMetric, original_id).description == "keep"
        for metric_id in [created_id, original_id]:
            deleted = await call(
                TOOLS[1], {"dataset_id": dataset_id, "metric": metric_id}
            )
            assert deleted["error"] is None
            session.expire_all()
            assert session.get(SqlMetric, metric_id) is None
        assert session.get(SqlaTable, dataset_id).metrics == []
