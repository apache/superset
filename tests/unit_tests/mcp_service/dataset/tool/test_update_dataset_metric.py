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

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastmcp import Client, FastMCP
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.dataset.schemas import UpdateDatasetMetricRequest
from superset.mcp_service.utils.sanitization import (
    LLM_CONTEXT_CLOSE_DELIMITER,
    LLM_CONTEXT_OPEN_DELIMITER,
)
from superset.utils import json


def _wrapped(value: str) -> str:
    return f"{LLM_CONTEXT_OPEN_DELIMITER}\n{value}\n{LLM_CONTEXT_CLOSE_DELIMITER}"


@pytest.fixture
def mcp_server() -> FastMCP:
    """Provide the shared FastMCP app instance for the in-process test client."""
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[MagicMock]:
    """Mock authentication for all tests."""
    from unittest.mock import Mock

    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


@pytest.fixture(autouse=True)
def allow_ownership() -> Iterator[MagicMock]:
    """Let ownership checks pass by default; override to simulate a non-owner.

    Patches the security manager class method (rather than the module-level
    proxy) so it resolves without an app context, as in CI.
    """
    with patch(
        "superset.security.SupersetSecurityManager.raise_for_editorship",
        return_value=None,
    ) as mock_raise:
        yield mock_raise


def make_metric(
    metric_id: int = 10,
    metric_name: str = "count",
    uuid: str = "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    **overrides: Any,
) -> SimpleNamespace:
    """Build a stand-in SqlMetric with all serialized attributes populated."""
    metric = SimpleNamespace(
        id=metric_id,
        uuid=uuid,
        metric_name=metric_name,
        verbose_name=None,
        expression="COUNT(*)",
        description=None,
        d3format=None,
        metric_type=None,
        currency=None,
        warning_text=None,
    )
    for key, value in overrides.items():
        setattr(metric, key, value)
    return metric


def make_dataset(
    dataset_id: int = 1, metrics: list[SimpleNamespace] | None = None
) -> MagicMock:
    """Build a stand-in SqlaTable exposing an id, table_name, and metrics."""
    dataset = MagicMock()
    dataset.id = dataset_id
    dataset.table_name = "my_table"
    dataset.metrics = metrics if metrics is not None else [make_metric()]
    return dataset


# ---------------------------------------------------------------------------
# Request schema validation
# ---------------------------------------------------------------------------


def test_request_requires_at_least_one_property() -> None:
    with pytest.raises(ValidationError, match="At least one metric property"):
        UpdateDatasetMetricRequest(dataset_id=1, metric="count")


def test_request_rejects_empty_expression() -> None:
    with pytest.raises(ValidationError, match="expression cannot be empty"):
        UpdateDatasetMetricRequest(dataset_id=1, metric="count", expression="   ")


def test_request_rejects_null_metric_name() -> None:
    with pytest.raises(ValidationError, match="metric_name cannot be empty"):
        UpdateDatasetMetricRequest(dataset_id=1, metric="count", metric_name=None)


def test_request_updates_only_includes_provided_properties() -> None:
    request = UpdateDatasetMetricRequest.model_validate(
        {"dataset_id": 1, "metric": "count", "expression": "COUNT(1)"}
    )
    assert request.updates() == {"expression": "COUNT(1)"}


def test_request_updates_keeps_explicit_nulls() -> None:
    request = UpdateDatasetMetricRequest.model_validate(
        {"dataset_id": 1, "metric": "count", "description": None, "d3format": ",.2f"}
    )
    assert request.updates() == {"description": None, "d3format": ",.2f"}


def test_request_rejects_invalid_extra_json() -> None:
    with pytest.raises(ValidationError, match="extra must be a valid JSON"):
        UpdateDatasetMetricRequest(dataset_id=1, metric="count", extra="{not json")


def test_request_accepts_valid_extra_json() -> None:
    request = UpdateDatasetMetricRequest.model_validate(
        {"dataset_id": 1, "metric": "count", "extra": '{"warning_markdown": "hi"}'}
    )
    assert request.updates() == {"extra": '{"warning_markdown": "hi"}'}


def test_request_updates_dumps_nested_currency() -> None:
    request = UpdateDatasetMetricRequest.model_validate(
        {
            "dataset_id": 1,
            "metric": 10,
            "currency": {"symbol": "USD", "symbolPosition": "prefix"},
        }
    )
    assert request.updates() == {
        "currency": {"symbol": "USD", "symbolPosition": "prefix"}
    }


# ---------------------------------------------------------------------------
# Tool behavior
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_dataset_metric_success(mcp_server: FastMCP) -> None:
    """Happy path: only the target metric is changed, others sent as stubs."""
    target = make_metric(metric_id=10, metric_name="count")
    other = make_metric(
        metric_id=11,
        metric_name="sum_revenue",
        uuid="b2c3d4e5-6789-01bc-def0-234567890abc",
        expression="SUM(revenue)",
    )
    dataset = make_dataset(dataset_id=1, metrics=[target, other])

    updated_target = make_metric(
        metric_id=10, metric_name="count", expression="COUNT(1)", d3format=",d"
    )
    updated_dataset = make_dataset(dataset_id=1, metrics=[updated_target, other])

    mock_command = MagicMock()
    mock_command.run.return_value = updated_dataset

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=dataset,
        ),
        patch(
            "superset.commands.dataset.update.UpdateDatasetCommand",
            return_value=mock_command,
        ) as command_cls,
        patch(
            "superset.mcp_service.utils.url_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 1,
                        "metric": "count",
                        "expression": "COUNT(1)",
                        "d3format": ",d",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    command_cls.assert_called_once_with(
        1,
        {
            "metrics": [
                {
                    "id": 10,
                    "metric_name": "count",
                    "expression": "COUNT(1)",
                    "d3format": ",d",
                },
                {"id": 11, "metric_name": "sum_revenue"},
            ]
        },
    )
    assert data["error"] is None
    assert data["dataset_id"] == 1
    assert data["dataset_name"] == "my_table"
    assert data["updated_properties"] == ["d3format", "expression"]
    assert data["metric"]["id"] == 10
    assert data["metric"]["expression"] == _wrapped("COUNT(1)")
    assert data["metric"]["d3format"] == ",d"
    assert "datasource_id=1" in data["url"]


@pytest.mark.asyncio
async def test_update_dataset_metric_returns_extra(mcp_server: FastMCP) -> None:
    """`extra` is an updatable property, so it is echoed back in the response."""
    dataset = make_dataset(dataset_id=1, metrics=[make_metric(metric_id=10)])
    updated = make_dataset(
        dataset_id=1,
        metrics=[make_metric(metric_id=10, extra='{"warning_markdown": "note"}')],
    )
    mock_command = MagicMock()
    mock_command.run.return_value = updated

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=dataset,
        ),
        patch(
            "superset.commands.dataset.update.UpdateDatasetCommand",
            return_value=mock_command,
        ),
        patch(
            "superset.mcp_service.utils.url_utils.get_superset_base_url",
            return_value="http://localhost:8088",
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 1,
                        "metric": 10,
                        "extra": '{"warning_markdown": "note"}',
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["error"] is None
    assert data["updated_properties"] == ["extra"]
    assert data["metric"]["extra"] == _wrapped('{"warning_markdown": "note"}')


@pytest.mark.asyncio
async def test_update_dataset_metric_by_id_and_uuid(mcp_server: FastMCP) -> None:
    """The metric can be addressed by numeric ID (also as string) or UUID."""
    target = make_metric(metric_id=10, metric_name="count")
    dataset = make_dataset(dataset_id=1, metrics=[target])

    mock_command = MagicMock()
    mock_command.run.return_value = dataset

    for identifier in (10, "10", "A1B2C3D4-5678-90ab-cdef-1234567890ab"):
        mock_command.reset_mock()
        with (
            patch(
                "superset.daos.dataset.DatasetDAO.find_by_id",
                return_value=dataset,
            ),
            patch(
                "superset.commands.dataset.update.UpdateDatasetCommand",
                return_value=mock_command,
            ),
            patch(
                "superset.mcp_service.utils.url_utils.get_superset_base_url",
                return_value="http://localhost:8088",
            ),
        ):
            async with Client(mcp_server) as client:
                result = await client.call_tool(
                    "update_dataset_metric",
                    {
                        "request": {
                            "dataset_id": 1,
                            "metric": identifier,
                            "verbose_name": "Count",
                        }
                    },
                )
                data = json.loads(result.content[0].text)

        assert data["error"] is None, identifier
        mock_command.run.assert_called_once()


@pytest.mark.asyncio
async def test_update_dataset_metric_not_found_suggests_names(
    mcp_server: FastMCP,
) -> None:
    dataset = make_dataset(
        dataset_id=1, metrics=[make_metric(metric_id=10, metric_name="sum_revenue")]
    )

    with patch(
        "superset.daos.dataset.DatasetDAO.find_by_id",
        return_value=dataset,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 1,
                        "metric": "sum_revenu",
                        "expression": "SUM(net_revenue)",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["metric"] is None
    assert "not found" in data["error"]
    assert "sum_revenue" in data["error"]


@pytest.mark.asyncio
async def test_update_dataset_metric_not_found_escapes_names(
    mcp_server: FastMCP,
) -> None:
    """Metric names in the not-found error are escaped like the success path."""
    from superset.mcp_service.utils.sanitization import (
        LLM_CONTEXT_ESCAPED_OPEN_DELIMITER,
    )

    hostile_name = f"{LLM_CONTEXT_OPEN_DELIMITER}evil"
    dataset = make_dataset(
        dataset_id=1, metrics=[make_metric(metric_id=10, metric_name=hostile_name)]
    )

    with patch(
        "superset.daos.dataset.DatasetDAO.find_by_id",
        return_value=dataset,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 1,
                        "metric": "missing",
                        "expression": "COUNT(1)",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["metric"] is None
    assert LLM_CONTEXT_OPEN_DELIMITER not in data["error"]
    assert LLM_CONTEXT_ESCAPED_OPEN_DELIMITER in data["error"]


@pytest.mark.asyncio
async def test_update_dataset_metric_dataset_not_found(mcp_server: FastMCP) -> None:
    with patch(
        "superset.daos.dataset.DatasetDAO.find_by_id",
        return_value=None,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 999,
                        "metric": "count",
                        "description": "desc",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["metric"] is None
    assert "No dataset found" in data["error"]


@pytest.mark.asyncio
async def test_update_dataset_metric_forbidden_non_owner(
    mcp_server: FastMCP, allow_ownership: MagicMock
) -> None:
    """A non-owner is rejected before the metric list is inspected, so the
    error cannot be used to enumerate metric names."""
    from superset.exceptions import SupersetSecurityException

    allow_ownership.side_effect = SupersetSecurityException(
        MagicMock(message="not an owner")
    )

    dataset = make_dataset(
        dataset_id=1,
        metrics=[make_metric(metric_id=10, metric_name="secret_metric")],
    )
    mock_command = MagicMock()

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=dataset,
        ),
        patch(
            "superset.commands.dataset.update.UpdateDatasetCommand",
            return_value=mock_command,
        ) as command_cls,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 1,
                        "metric": "does_not_exist",
                        "expression": "COUNT(1)",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["metric"] is None
    assert "owner" in data["error"]
    # No metric names leak, and the command is never constructed/run.
    assert "secret_metric" not in data["error"]
    command_cls.assert_not_called()


@pytest.mark.asyncio
async def test_update_dataset_metric_invalid_error(mcp_server: FastMCP) -> None:
    """Validation failures (e.g. duplicate name) surface as error responses."""
    from superset.commands.dataset.exceptions import (
        DatasetInvalidError,
        DatasetMetricsDuplicateValidationError,
    )

    invalid_exc = DatasetInvalidError()
    invalid_exc.append(DatasetMetricsDuplicateValidationError())

    dataset = make_dataset()
    mock_command = MagicMock()
    mock_command.run.side_effect = invalid_exc

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=dataset,
        ),
        patch(
            "superset.commands.dataset.update.UpdateDatasetCommand",
            return_value=mock_command,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 1,
                        "metric": "count",
                        "metric_name": "sum_revenue",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["metric"] is None
    assert data["error"] is not None


@pytest.mark.asyncio
async def test_update_dataset_metric_update_failed(mcp_server: FastMCP) -> None:
    """A persistence failure surfaces as a "Failed to update" error response."""
    from superset.commands.dataset.exceptions import DatasetUpdateFailedError

    dataset = make_dataset()
    mock_command = MagicMock()
    mock_command.run.side_effect = DatasetUpdateFailedError()

    with (
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=dataset,
        ),
        patch(
            "superset.commands.dataset.update.UpdateDatasetCommand",
            return_value=mock_command,
        ),
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "update_dataset_metric",
                {
                    "request": {
                        "dataset_id": 1,
                        "metric": "count",
                        "expression": "COUNT(1)",
                    }
                },
            )
            data = json.loads(result.content[0].text)

    assert data["metric"] is None
    assert "Failed to update" in data["error"]
