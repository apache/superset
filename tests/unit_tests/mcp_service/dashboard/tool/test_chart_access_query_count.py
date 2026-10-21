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

"""Chart access checks read permission relationships at most once per chart."""

import importlib
import inspect
from collections.abc import Iterator
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from superset import security_manager
from superset.mcp_service.chart.chart_utils import DatasetValidationResult
from superset.mcp_service.dashboard.schemas import (
    GenerateDashboardRequest,
    GenerateDashboardResponse,
)
from superset.mcp_service.dashboard.tool.generate_dashboard import generate_dashboard
from superset.models.slice import Slice
from superset.subjects.models import chart_editors, chart_viewers, Subject

# The package re-exports the tool function under the module's name.
tool_module = importlib.import_module(
    "superset.mcp_service.dashboard.tool.generate_dashboard"
)


@pytest.fixture
def session_engine() -> Iterator[Engine]:
    """Let the tool's worker thread use the isolated in-memory test database."""
    engine: Engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("chart_count", [1, 5, 20])
@pytest.mark.parametrize("access", ["admin", "editor", "viewer", "denied"])
async def test_generate_dashboard_chart_access_relationship_reads(
    session: Session,
    mocker: MockerFixture,
    chart_count: int,
    access: str,
) -> None:
    """Real permission checks decide access without re-reading relationships later.

    The layout step runs for real, after the validation log context commits and
    expires the charts, so a loader option that re-selects the relationships on
    refresh is counted here.
    """
    Slice.metadata.create_all(session.get_bind())
    session.execute(
        Subject.__table__.insert(),
        [
            {"id": 1, "label": "reader", "type": 1},
            {"id": 2, "label": "other", "type": 1},
        ],
    )
    chart_ids: list[int] = list(range(1, chart_count + 1))
    session.execute(
        Slice.__table__.insert(),
        [{"id": chart_id, "slice_name": f"Chart {chart_id}"} for chart_id in chart_ids],
    )
    session.execute(
        chart_editors.insert(),
        [
            {"chart_id": chart_id, "subject_id": 1 if access == "editor" else 2}
            for chart_id in chart_ids
        ],
    )
    session.execute(
        chart_viewers.insert(),
        [
            {
                "chart_id": chart_id,
                "subject_id": 2
                if access == "denied" and chart_id == chart_count
                else 1,
            }
            for chart_id in chart_ids
        ],
    )
    mocker.patch.object(security_manager, "is_admin", return_value=access == "admin")
    mocker.patch.object(security_manager, "is_guest_user", return_value=False)
    mocker.patch("superset.security.manager.get_user_id", return_value=1)
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[1])
    mocker.patch(
        "superset.security.manager.get_extra_editor_subject_ids", return_value=[]
    )
    mocker.patch(
        "superset.mcp_service.auth.check_chart_data_access",
        return_value=DatasetValidationResult(
            is_valid=True, dataset_id=1, dataset_name="allowed", warnings=[], error=None
        ),
    )
    build_layout = tool_module._create_dashboard_layout

    def layout_then_stop(charts: list[Slice]) -> None:
        """Read the charts as the real layout step does, then stop the tool."""
        build_layout(charts)
        raise RuntimeError("access checks completed")

    layout: MagicMock = mocker.patch.object(
        tool_module, "_create_dashboard_layout", side_effect=layout_then_stop
    )
    statements: list[str] = []

    def record_sql(
        connection: Connection,
        cursor: object,
        statement: str,
        parameters: object,
        context: object,
        executemany: bool,
    ) -> None:
        """Count only chart permission relationship reads, not fixture setup."""
        if "chart_editors" in statement or "chart_viewers" in statement:
            statements.append(statement)

    event.listen(session.get_bind(), "before_cursor_execute", record_sql)
    try:
        request: GenerateDashboardRequest = GenerateDashboardRequest(
            chart_ids=chart_ids
        )
        if access == "denied":
            response: GenerateDashboardResponse = await inspect.unwrap(
                generate_dashboard
            )(request, AsyncMock())
            assert (
                response.error
                == f"You don't have permission to access chart {chart_count}."
            )
            layout.assert_not_called()
        else:
            with pytest.raises(RuntimeError, match="access checks completed"):
                await inspect.unwrap(generate_dashboard)(request, AsyncMock())
            layout.assert_called_once()
    finally:
        event.remove(session.get_bind(), "before_cursor_execute", record_sql)

    # Admins never read the relationships; editors read only editors; viewers
    # and the denied caller read editors and viewers once per checked chart.
    per_chart = {"admin": 0, "editor": 1, "viewer": 2, "denied": 2}[access]
    assert len(statements) <= per_chart * chart_count, (
        f"{chart_count} charts: {len(statements)} relationship SELECTs"
    )
