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

"""
Unit tests for mcp_core reusable core classes.

Focused on the ModelGetInfoCore title-based fallback that resolves
slug-like identifiers (e.g. "world-banks-data") to dashboards whose
slug column is empty but whose title matches.
"""

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from pydantic import BaseModel

from superset.mcp_service.mcp_core import _slugify, ModelGetInfoCore


class _FakeOutput(BaseModel):
    id: int
    title: str


class _FakeError(BaseModel):
    error: str
    error_type: str
    timestamp: datetime


class _Unset:
    """Sentinel meaning "DAO has no title_column attribute at all"."""


@pytest.fixture(autouse=True)
def _patch_id_or_slug_filter():
    """id_or_slug_filter is called inside _find_object's slug branch, but its
    return value is only used by SQLAlchemy internals we've mocked away —
    we just need it to not blow up."""
    with patch("superset.models.dashboard.id_or_slug_filter", return_value=MagicMock()):
        yield


def _make_dashboard(id_: int, title: str, slug: str = "") -> MagicMock:
    dashboard = MagicMock()
    dashboard.id = id_
    dashboard.dashboard_title = title
    dashboard.slug = slug
    return dashboard


def _build_core(
    *,
    supports_slug: bool = True,
    title_column: str | None = "dashboard_title",
    dao_title_column: str | None | type[_Unset] = None,
) -> tuple[ModelGetInfoCore, MagicMock]:
    """Build a core with configurable title-column wiring.

    - `title_column` is the explicit override passed into the core.
    - `dao_title_column` simulates the DAO's class attribute; defaults
      to None so we rely on the explicit override in most tests.
    """
    dao_class = MagicMock()
    # getattr(model_class, "dashboard_title") needs to return a truthy column
    # so the fallback proceeds past its guard.
    dao_class.model_cls = MagicMock(dashboard_title=MagicMock())
    dao_class.find_by_id.return_value = None
    # MagicMock auto-vivifies attrs, so explicitly control title_column.
    if dao_title_column is _Unset:
        del dao_class.title_column
    else:
        dao_class.title_column = dao_title_column

    def serializer(obj: MagicMock) -> _FakeOutput:
        return _FakeOutput(id=obj.id, title=obj.dashboard_title)

    core = ModelGetInfoCore(
        dao_class=dao_class,
        output_schema=_FakeOutput,
        error_schema=_FakeError,
        serializer=serializer,
        supports_slug=supports_slug,
        title_column_name=title_column,
    )
    return core, dao_class


def _install_base_filtered_query(
    core: ModelGetInfoCore,
    *,
    slug_result: MagicMock | None,
    title_rows: list[MagicMock],
) -> MagicMock:
    """Replace _base_filtered_query with a two-call mock.

    The slug branch calls `.filter(...).one_or_none()`; the title branch
    calls `.all()`. Returning a fresh MagicMock on each invocation keeps
    those paths independent.
    """
    slug_query = MagicMock()
    slug_query.filter.return_value = slug_query
    slug_query.one_or_none.return_value = slug_result

    title_query = MagicMock()
    title_query.all.return_value = title_rows

    mock = MagicMock(side_effect=[slug_query, title_query])
    core._base_filtered_query = mock  # type: ignore[method-assign]
    return mock


def test_slugify_matches_agent_guesses() -> None:
    """Agents slugify titles by lowercasing and hyphenating non-alphanumerics."""
    assert _slugify("World Bank's Data") == "world-banks-data"
    assert _slugify("  Multiple   Spaces  ") == "multiple-spaces"
    assert _slugify("!!!") == ""


def test_title_fallback_resolves_dashboard_with_empty_slug() -> None:
    """Regression: slug lookup must not silently fail when slug is empty."""
    core, _ = _build_core()
    dashboard = _make_dashboard(id_=2, title="World Bank's Data", slug="")
    _install_base_filtered_query(core, slug_result=None, title_rows=[dashboard])

    result = core.run_tool("world-banks-data")

    assert isinstance(result, _FakeOutput)
    assert result.id == 2
    assert result.title == "World Bank's Data"


def test_title_fallback_ambiguous_picks_first_and_warns(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Two dashboards slugify to the same identifier — pick the first, warn."""
    core, _ = _build_core()
    dash_a = _make_dashboard(id_=2, title="World Bank's Data")
    dash_b = _make_dashboard(id_=7, title="World Banks Data")
    _install_base_filtered_query(core, slug_result=None, title_rows=[dash_a, dash_b])

    with caplog.at_level("WARNING"):
        result = core.run_tool("world-banks-data")

    assert isinstance(result, _FakeOutput)
    assert result.id == 2  # first match wins
    assert any("matched 2 rows" in rec.message for rec in caplog.records)


def test_not_found_error_when_no_title_match() -> None:
    """No slug, no title, no slugified-title match — plain not_found."""
    core, _ = _build_core()
    _install_base_filtered_query(core, slug_result=None, title_rows=[])

    result = core.run_tool("does-not-exist")

    assert isinstance(result, _FakeError)
    assert result.error_type == "not_found"


def test_title_fallback_respects_base_filter_rbac() -> None:
    """_base_filtered_query applies the DAO's base_filter before scanning.

    Regression guard: without base_filter, slugified-title lookups could
    return dashboards the current user is not allowed to access. The
    fallback must only see rows the base_filter has already vetted.
    """
    core, dao_class = _build_core()
    allowed = _make_dashboard(id_=2, title="World Bank's Data", slug="")

    filtered_query = MagicMock()
    filtered_query.all.return_value = [allowed]
    # DAO.base_filter(...)(...).apply(...) returns a filtered query that only
    # yields `allowed`. The "forbidden" row (id=9, title slugifies the same)
    # would resolve via fallback if base_filter were skipped — by omitting it
    # from filtered_query.all(), we prove the fallback honors RBAC.
    base_filter_instance = MagicMock()
    base_filter_instance.apply.return_value = filtered_query
    dao_class.base_filter = MagicMock(return_value=base_filter_instance)

    raw_query = MagicMock()
    raw_query.filter.return_value = raw_query
    raw_query.one_or_none.return_value = None
    filtered_query.filter.return_value = filtered_query
    filtered_query.one_or_none.return_value = None
    filtered_query.options.return_value = filtered_query

    with (
        patch("superset.mcp_service.mcp_core.db") as mock_db,
        patch("superset.mcp_service.mcp_core.SQLAInterface") as mock_interface,
    ):
        mock_db.session.query.return_value = raw_query
        mock_interface.return_value = MagicMock()

        result = core.run_tool("world-banks-data")

    # RBAC honored: `forbidden` never made it into the scan.
    assert isinstance(result, _FakeOutput)
    assert result.id == 2
    dao_class.base_filter.assert_called()


def test_title_fallback_disabled_returns_not_found() -> None:
    """When neither override nor DAO provides a title column, no fallback."""
    core, _ = _build_core(
        supports_slug=False, title_column=None, dao_title_column=_Unset
    )

    result = core.run_tool("anything")

    assert isinstance(result, _FakeError)
    assert result.error_type == "not_found"


def test_title_column_defaults_from_dao_attribute() -> None:
    """No explicit override → core picks up DAO.title_column."""
    core, _ = _build_core(title_column=None, dao_title_column="dashboard_title")
    assert core.title_column_name == "dashboard_title"


def test_explicit_title_column_overrides_dao_attribute() -> None:
    """Explicit override beats the DAO default."""
    core, _ = _build_core(title_column="custom_col", dao_title_column="dashboard_title")
    assert core.title_column_name == "custom_col"


@pytest.mark.parametrize(
    "identifier,expected_slug",
    [
        ("World Bank's Data", "world-banks-data"),
        ("multi  space", "multi-space"),
        ("leading--and--trailing--", "leading-and-trailing"),
    ],
)
def test_slugify_handles_edge_cases(identifier: str, expected_slug: str) -> None:
    assert _slugify(identifier) == expected_slug
