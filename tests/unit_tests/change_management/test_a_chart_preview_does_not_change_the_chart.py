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
"""``get_chart_preview`` never writes to the chart it previews (A1).

The tool lays the Explore cache's unsaved ``params`` and ``viz_type`` over
the chart so the preview matches what the person sees. It did that by
assigning them to the live ``Slice``. The assignment was never meant to be
saved, but a dirty object in the request's session is written by whatever
commits next, and ``DBEventLogger.log`` commits: it runs on every
``event_logger.log_context`` step of this tool, and ``DBEventLogger`` is the
default ``EVENT_LOGGER``.

So a principal holding only ``can_read Chart`` rewrote a saved chart --
credited to them, with no change request and no version -- and did it even
when the call went on to return an error. Nothing in the review gate could
see it: no command ran, only a flush.

These tests run the tool against a real session and the real
``DBEventLogger``, because that is the whole mechanism. With the logger
swapped for a stdout one the old code left the chart alone, which is how the
commit was isolated as the vector; a mock of the session would hide it.
"""

from __future__ import annotations

import importlib
from typing import Any

import pytest
from sqlalchemy import text
from sqlalchemy.orm.session import Session

from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartPreview,
    GetChartPreviewRequest,
)
from superset.utils import json as utils_json
from superset.utils.log import DBEventLogger

SAVED_PARAMS = utils_json.dumps({"viz_type": "table", "metrics": ["count"]})
UNSAVED_PARAMS = utils_json.dumps(
    {"viz_type": "pie", "metrics": ["sum__num"], "groupby": ["gender"]}
)

preview_module = importlib.import_module(
    "superset.mcp_service.chart.tool.get_chart_preview"
)


class _Context:
    """The slice of the FastMCP ``Context`` the tool calls."""

    async def debug(self, *args: Any, **kwargs: Any) -> None: ...
    async def error(self, *args: Any, **kwargs: Any) -> None: ...
    async def info(self, *args: Any, **kwargs: Any) -> None: ...
    async def report_progress(self, *args: Any, **kwargs: Any) -> None: ...
    async def warning(self, *args: Any, **kwargs: Any) -> None: ...


@pytest.fixture
def saved_chart(
    app: Any, app_context: None, session: Session, monkeypatch: pytest.MonkeyPatch
) -> Any:
    """A committed chart, reachable through the tool, with the real logger."""
    from superset.models.core import Log
    from superset.models.slice import Slice

    Slice.metadata.create_all(session.get_bind())
    Log.metadata.create_all(session.get_bind())
    chart = Slice(
        slice_name="Live chart",
        viz_type="table",
        datasource_type="table",
        datasource_id=1,
        params=SAVED_PARAMS,
    )
    session.add(chart)
    session.commit()

    monkeypatch.setattr(preview_module, "find_chart_by_identifier", lambda _: chart)
    monkeypatch.setattr(
        preview_module,
        "validate_chart_dataset",
        lambda *a, **k: type(
            "Valid", (), {"is_valid": True, "warnings": [], "error": None}
        )(),
    )
    # The default EVENT_LOGGER, whose log() commits the session.
    monkeypatch.setattr(preview_module, "event_logger", DBEventLogger())
    monkeypatch.setattr(
        "superset.commands.explore.form_data.get.GetFormDataCommand.__init__",
        lambda self, params: None,
    )
    monkeypatch.setattr(
        "superset.commands.explore.form_data.get.GetFormDataCommand.run",
        lambda self: UNSAVED_PARAMS,
    )
    return chart


def _stored(session: Session, chart_id: int) -> tuple[str, str]:
    """What is in the table, not what the identity map remembers."""
    session.expire_all()
    row = session.execute(
        text("SELECT viz_type, params FROM slices WHERE id = :id"), {"id": chart_id}
    ).one()
    return row[0], row[1]


def _request() -> GetChartPreviewRequest:
    return GetChartPreviewRequest(
        identifier=1, form_data_key="unsaved-state", format="url"
    )


@pytest.mark.asyncio
async def test_a_preview_over_unsaved_state_leaves_the_chart_as_saved(
    saved_chart: Any, session: Session
) -> None:
    result = await preview_module._get_chart_preview_internal(_request(), _Context())

    assert isinstance(result, ChartPreview)
    assert _stored(session, saved_chart.id) == ("table", SAVED_PARAMS)
    assert saved_chart.viz_type == "table"
    assert saved_chart.params == SAVED_PARAMS


@pytest.mark.asyncio
async def test_the_preview_still_shows_the_unsaved_state(
    saved_chart: Any, session: Session
) -> None:
    """Not touching the chart must not mean ignoring the cache."""
    result = await preview_module._get_chart_preview_internal(_request(), _Context())

    assert isinstance(result, ChartPreview)
    assert result.chart_type == "pie"


@pytest.mark.asyncio
async def test_a_preview_that_returns_an_error_leaves_the_chart_as_saved(
    saved_chart: Any, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The reproduction was on a call that returned an error."""
    monkeypatch.setattr(
        preview_module.PreviewFormatGenerator,
        "generate",
        lambda self: ChartError(error="no data", error_type="InternalError"),
    )

    result = await preview_module._get_chart_preview_internal(_request(), _Context())

    assert isinstance(result, ChartError)
    assert _stored(session, saved_chart.id) == ("table", SAVED_PARAMS)


@pytest.mark.asyncio
async def test_a_preview_that_raises_leaves_the_chart_as_saved(
    saved_chart: Any, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    def explode(self: Any) -> None:
        raise ValueError("render failed")

    monkeypatch.setattr(preview_module.PreviewFormatGenerator, "generate", explode)

    result = await preview_module._get_chart_preview_internal(_request(), _Context())

    assert isinstance(result, ChartError)
    assert _stored(session, saved_chart.id) == ("table", SAVED_PARAMS)


@pytest.mark.asyncio
async def test_unparseable_cached_state_leaves_the_chart_as_saved(
    saved_chart: Any, session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The old code assigned ``params`` before it parsed them."""
    monkeypatch.setattr(
        "superset.commands.explore.form_data.get.GetFormDataCommand.run",
        lambda self: "{not json",
    )

    await preview_module._get_chart_preview_internal(_request(), _Context())

    assert _stored(session, saved_chart.id) == ("table", SAVED_PARAMS)


@pytest.mark.asyncio
async def test_a_preview_leaves_nothing_dirty_in_the_session(
    saved_chart: Any, session: Session
) -> None:
    """The invariant behind all of the above: nothing is left to flush."""
    await preview_module._get_chart_preview_internal(_request(), _Context())

    assert not session.dirty
    assert not session.new
    assert not session.deleted


def test_the_unsaved_view_refuses_writes(saved_chart: Any) -> None:
    """A stray assignment must fail here, not become a silent edit."""
    view = preview_module._UnsavedChartView(saved_chart, params=UNSAVED_PARAMS)

    with pytest.raises(AttributeError, match="read-only"):
        view.viz_type = "pie"
    with pytest.raises(AttributeError, match="read-only"):
        view.params = "{}"


def test_the_unsaved_view_reads_through_to_the_chart(saved_chart: Any) -> None:
    """Guest-access and query-context code read these off the chart."""
    view = preview_module._UnsavedChartView(saved_chart, params=UNSAVED_PARAMS)

    assert view.params == UNSAVED_PARAMS
    assert view.viz_type == "table"
    assert view.id == saved_chart.id
    assert view.dashboards == []
