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

"""Unit tests for reading Explore permalinks through get_chart_info."""

import importlib
from collections.abc import Iterator
from contextlib import nullcontext
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from fastmcp import Client, FastMCP
from pydantic import ValidationError

from superset.mcp_service.app import mcp
from superset.mcp_service.chart.schemas import ChartInfo, GetChartInfoRequest
from superset.utils import json

get_chart_info_module = importlib.import_module(
    "superset.mcp_service.chart.tool.get_chart_info"
)

_COMMAND = "superset.commands.explore.permalink.get.GetExplorePermalinkCommand"


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Iterator[None]:
    with patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user:
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield


@pytest.fixture(autouse=True)
def tool_environment() -> Iterator[None]:
    """Neutralize the collaborators get_chart_info needs beyond the permalink."""
    with (
        patch.object(
            get_chart_info_module.event_logger,
            "log_context",
            return_value=nullcontext(),
        ),
        patch.object(
            get_chart_info_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
        patch.object(
            get_chart_info_module,
            "validate_chart_dataset",
            return_value=SimpleNamespace(is_valid=True, warnings=[]),
        ),
        patch("superset.daos.chart.ChartDAO.find_by_id", return_value=Mock()),
    ):
        yield


def _permalink(chart_id: Any = None, **form_data: Any) -> dict[str, Any]:
    form_data = {"viz_type": "pie", "datasource": "7__table", **form_data}
    return {
        "chartId": chart_id,
        "datasourceId": 7,
        "datasourceType": "table",
        "datasource": "7__table",
        "state": {"formData": form_data, "urlParams": None},
    }


def _command_returning(value: Any) -> MagicMock:
    command = MagicMock()
    command.return_value.run.return_value = value
    return command


def _saved_chart(chart_id: int = 12) -> ChartInfo:
    return ChartInfo(
        id=chart_id,
        slice_name="Saved Chart",
        viz_type="table",
        form_data={"viz_type": "table", "datasource": "7__table"},
    )


async def _call(mcp_server: FastMCP, **request: Any) -> dict[str, Any]:
    async with Client(mcp_server) as client:
        response = await client.call_tool("get_chart_info", {"request": request})
    return json.loads(response.content[0].text)


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------


def test_request_accepts_permalink_key_alone() -> None:
    request = GetChartInfoRequest(permalink_key="abc123")
    assert request.permalink_key == "abc123"
    assert request.identifier is None


def test_request_extracts_key_from_permalink_url() -> None:
    request = GetChartInfoRequest(
        permalink_key="https://superset.example.com/explore/p/abc123/"
    )
    assert request.permalink_key == "abc123"


def test_request_rejects_url_that_is_not_an_explore_permalink() -> None:
    with pytest.raises(ValidationError, match="Explore permalink"):
        GetChartInfoRequest(
            permalink_key="https://superset.example.com/superset/dashboard/p/x/"
        )


def test_request_rejects_permalink_key_with_form_data_key() -> None:
    with pytest.raises(ValidationError, match="not both"):
        GetChartInfoRequest(permalink_key="abc123", form_data_key="def456")


def test_request_requires_identifier_form_data_key_or_permalink_key() -> None:
    with pytest.raises(ValidationError, match="permalink_key"):
        GetChartInfoRequest()


# ---------------------------------------------------------------------------
# Tool behavior
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_permalink_without_saved_chart(mcp_server: FastMCP) -> None:
    """A permalink of an Explore session that was never saved as a chart."""
    command = _command_returning(_permalink(chart_id=None))
    with (
        patch(_COMMAND, command),
        patch.object(get_chart_info_module.ModelGetInfoCore, "run_tool") as run_tool,
    ):
        data = await _call(mcp_server, permalink_key="abc123")

    command.assert_called_once_with("abc123")
    run_tool.assert_not_called()
    assert data["viz_type"] == "pie"
    assert data["permalink_key"] == "abc123"
    assert data["is_permalink_state"] is True
    assert data["is_unsaved_state"] is False


@pytest.mark.asyncio
async def test_permalink_without_saved_chart_reports_display_name(
    mcp_server: FastMCP,
) -> None:
    """Same viz_type-derived fields as a permalink merged into a saved chart."""
    with patch(_COMMAND, _command_returning(_permalink(chart_id=None))):
        data = await _call(
            mcp_server,
            permalink_key="abc123",
            select_columns=["viz_type", "chart_type_display_name"],
        )

    assert data["viz_type"] == "pie"
    assert data["chart_type_display_name"] == "Pie Chart"


@pytest.mark.asyncio
async def test_permalink_without_saved_chart_names_its_datasource(
    mcp_server: FastMCP,
) -> None:
    """form_data only carries "<id>__<type>", so the name comes from the ids
    the permalink stores."""
    from superset.connectors.sqla.models import SqlaTable

    # A real model, not a mock: a mock answers to any attribute name.
    dataset = SqlaTable(table_name="orders")
    with (
        patch(_COMMAND, _command_returning(_permalink(chart_id=None))),
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=dataset,
        ) as get_datasource,
    ):
        data = await _call(
            mcp_server,
            permalink_key="abc123",
            select_columns=["datasource_name", "datasource_type"],
        )

    assert data["datasource_name"] == "orders"
    assert data["datasource_type"] == "table"
    assert get_datasource.call_args.kwargs["database_id_or_uuid"] == 7


@pytest.mark.asyncio
async def test_permalink_without_saved_chart_names_its_sql_lab_query(
    mcp_server: FastMCP,
) -> None:
    """Explore opened from SQL Lab results stores a "<id>__query" datasource.

    ``Query`` exposes its label as ``name`` and has no ``datasource_name``.
    """
    from superset.models.sql_lab import Query

    permalink = _permalink(chart_id=None, datasource="5__query")
    permalink.update(datasourceId=5, datasourceType="query", datasource="5__query")
    with (
        patch(_COMMAND, _command_returning(permalink)),
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=Query(tab_name="Untitled Query"),
        ) as get_datasource,
    ):
        data = await _call(
            mcp_server,
            permalink_key="abc123",
            select_columns=["viz_type", "datasource_name", "datasource_type"],
        )

    assert data["viz_type"] == "pie"
    assert data["datasource_name"].startswith("sqllab_untitled_query_")
    assert data["datasource_type"] == "query"
    assert get_datasource.call_args.kwargs["database_id_or_uuid"] == 5


@pytest.mark.asyncio
async def test_permalink_survives_a_deleted_datasource(mcp_server: FastMCP) -> None:
    """The rest of the permalink state is still worth returning."""
    from superset.commands.dataset.exceptions import DatasetNotFoundError

    with (
        patch(_COMMAND, _command_returning(_permalink(chart_id=None))),
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            side_effect=DatasetNotFoundError(),
        ),
    ):
        data = await _call(
            mcp_server,
            permalink_key="abc123",
            select_columns=["viz_type", "datasource_name", "datasource_type"],
        )

    assert data["viz_type"] == "pie"
    assert data["datasource_name"] is None
    assert data["datasource_type"] == "table"


@pytest.mark.asyncio
async def test_permalink_resolves_saved_chart(mcp_server: FastMCP) -> None:
    """Without identifier, the saved chart is looked up from the permalink."""
    with (
        patch(_COMMAND, _command_returning(_permalink(chart_id=12))),
        patch.object(
            get_chart_info_module.ModelGetInfoCore,
            "run_tool",
            return_value=_saved_chart(12),
        ) as run_tool,
    ):
        data = await _call(
            mcp_server,
            permalink_key="abc123",
            select_columns=["id", "viz_type", "form_data", "is_permalink_state"],
        )

    run_tool.assert_called_once_with(12)
    assert data["id"] == 12
    assert data["viz_type"] == "pie"
    assert data["form_data"]["viz_type"] == "pie"
    assert data["is_permalink_state"] is True


@pytest.mark.asyncio
async def test_permalink_string_chart_id_is_normalized(mcp_server: FastMCP) -> None:
    """chartId comes from client-supplied formData.slice_id and may be a string."""
    with (
        patch(_COMMAND, _command_returning(_permalink(chart_id="12"))),
        patch.object(
            get_chart_info_module.ModelGetInfoCore,
            "run_tool",
            return_value=_saved_chart(12),
        ) as run_tool,
    ):
        data = await _call(mcp_server, permalink_key="abc123", identifier=12)

    run_tool.assert_called_once_with(12)
    assert data["is_permalink_state"] is True


@pytest.mark.asyncio
async def test_permalink_of_another_chart_is_rejected(mcp_server: FastMCP) -> None:
    with (
        patch(_COMMAND, _command_returning(_permalink(chart_id=99))),
        patch.object(
            get_chart_info_module.ModelGetInfoCore,
            "run_tool",
            return_value=_saved_chart(12),
        ),
    ):
        data = await _call(mcp_server, permalink_key="abc123", identifier=12)

    assert data["error_type"] == "PermalinkChartMismatch"
    assert "99" in data["error"]


@pytest.mark.asyncio
async def test_unsaved_permalink_is_not_merged_into_a_chart(
    mcp_server: FastMCP,
) -> None:
    with (
        patch(_COMMAND, _command_returning(_permalink(chart_id=None))),
        patch.object(
            get_chart_info_module.ModelGetInfoCore,
            "run_tool",
            return_value=_saved_chart(12),
        ),
    ):
        data = await _call(mcp_server, permalink_key="abc123", identifier=12)

    assert data["error_type"] == "PermalinkChartMismatch"
    assert "unsaved" in data["error"]


@pytest.mark.asyncio
async def test_permalink_access_denied(mcp_server: FastMCP) -> None:
    from superset.commands.chart.exceptions import ChartAccessDeniedError

    command = MagicMock()
    command.return_value.run.side_effect = ChartAccessDeniedError()
    with patch(_COMMAND, command):
        data = await _call(mcp_server, permalink_key="abc123")

    assert data["error_type"] == "PermalinkAccessDenied"


@pytest.mark.asyncio
async def test_permalink_query_access_denied(mcp_server: FastMCP) -> None:
    """SQL Lab queries are checked by raise_for_access, which raises
    SupersetSecurityException rather than a ForbiddenError."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    command = MagicMock()
    command.return_value.run.side_effect = SupersetSecurityException(
        SupersetError(
            message="denied",
            error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )
    with patch(_COMMAND, command):
        data = await _call(mcp_server, permalink_key="abc123")

    assert data["error_type"] == "PermalinkAccessDenied"


@pytest.mark.asyncio
async def test_permalink_query_with_template_error(mcp_server: FastMCP) -> None:
    from superset.exceptions import SupersetTemplateException

    command = MagicMock()
    command.return_value.run.side_effect = SupersetTemplateException(
        "unexpected '}' in {{ secret }}"
    )
    with patch(_COMMAND, command):
        data = await _call(mcp_server, permalink_key="abc123")

    assert data["error_type"] == "InvalidPermalink"
    assert "could not be rendered or parsed" in data["error"]
    assert "secret" not in data["error"]


@pytest.mark.asyncio
async def test_permalink_query_with_unparsable_sql(mcp_server: FastMCP) -> None:
    """raise_for_access parses the query's SQL to find its tables; SQL that
    cannot be parsed raises SupersetParseError, a sibling of the exceptions
    above, which must not escape the tool either."""
    from superset.exceptions import SupersetParseError

    command = MagicMock()
    command.return_value.run.side_effect = SupersetParseError(
        "SELECT FROM secret_table WHERE ((( ;;; )))", highlight="secret_table"
    )
    with patch(_COMMAND, command):
        data = await _call(mcp_server, permalink_key="abc123")

    assert data["error_type"] == "InvalidPermalink"
    assert "could not be rendered or parsed" in data["error"]
    assert "secret_table" not in data["error"]


@pytest.mark.asyncio
async def test_permalink_with_missing_datasource(mcp_server: FastMCP) -> None:
    from superset.commands.exceptions import DatasourceNotFoundValidationError

    command = MagicMock()
    command.return_value.run.side_effect = DatasourceNotFoundValidationError()
    with patch(_COMMAND, command):
        data = await _call(mcp_server, permalink_key="abc123")

    assert data["error_type"] == "InvalidPermalink"


@pytest.mark.asyncio
async def test_invalid_permalink_key(mcp_server: FastMCP) -> None:
    from superset.explore.permalink.exceptions import ExplorePermalinkGetFailedError

    command = MagicMock()
    command.return_value.run.side_effect = ExplorePermalinkGetFailedError()
    with patch(_COMMAND, command):
        data = await _call(mcp_server, permalink_key="not-a-key")

    assert data["error_type"] == "InvalidPermalink"


@pytest.mark.asyncio
async def test_permalink_not_found(mcp_server: FastMCP) -> None:
    with patch(_COMMAND, _command_returning(None)):
        data = await _call(mcp_server, permalink_key="abc123")

    assert data["error_type"] == "NotFound"


@pytest.mark.asyncio
async def test_permalink_refused_for_guest_reads(mcp_server: FastMCP) -> None:
    command = _command_returning(_permalink(chart_id=12))
    with (
        patch(_COMMAND, command),
        patch("superset.mcp_service.guest_scope.is_guest_read", return_value=True),
    ):
        data = await _call(mcp_server, permalink_key="abc123")

    assert data["error_type"] == "PermalinkAccessDenied"
    command.assert_not_called()
