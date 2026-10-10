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
from datetime import datetime, timezone
from typing import Any
from unittest.mock import patch

from sqlalchemy import event, inspect
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dashboard import DashboardDAO
from superset.dashboards.filter_scope import derive_metadata_scopes
from superset.models.dashboard import Dashboard
from superset.models.helpers import skip_visibility_filter
from superset.models.slice import Slice
from superset.subjects.models import Subject
from superset.subjects.types import SubjectType
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags


@with_feature_flags(SOFT_DELETE=True)
def test_set_dash_metadata_preserves_soft_deleted_members(
    session: Session,
) -> None:
    """Saving a dashboard must not sever a soft-deleted member chart.

    ``set_dash_metadata`` rebuilds ``dashboard.slices`` wholesale from the
    incoming position data. The soft-delete visibility filter must be
    bypassed for the whole rebuild — the slice-resolution query AND the
    collection assignment:

    - Filtered resolution would silently drop the trashed member from the
      new collection — deleting its ``dashboard_slices`` junction row
      (breaking the restore-reattach contract) and writing ``uuid: None``
      into its position slot.
    - A filtered *baseline* load (the unit of work lazy-loads the existing
      collection when diffing the assignment) would exclude the trashed
      member from the old collection, so the diff treats it as net-new and
      INSERTs a duplicate ``dashboard_slices`` row — an IntegrityError on
      the composite PK on every save of a dashboard containing a trashed
      chart.

    The test reproduces the production shape: SOFT_DELETE enabled (the
    listener actually filters), the collection expired (as with the fresh
    ``find_by_id`` load in the PUT flow), and a flush afterwards so the
    diff's SQL actually hits the composite-PK junction table. It fails on
    either a missing resolution bypass or a query-scoped-only bypass.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dataset = SqlaTable(
        table_name="dash_meta_table",
        database=Database(database_name="dash_meta_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    live_chart = Slice(
        slice_name="live_chart",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    trashed_chart = Slice(
        slice_name="trashed_chart",
        datasource_id=dataset.id,
        datasource_type="table",
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    dashboard = Dashboard(
        dashboard_title="meta_test_dash",
        slices=[live_chart, trashed_chart],
        published=True,
    )
    db.session.add_all([live_chart, trashed_chart, dashboard])
    db.session.flush()

    # Production shape: the PUT flow loads a fresh Dashboard whose
    # ``slices`` collection is unloaded; expiring forces the baseline
    # reload through the visibility listener during the assignment.
    db.session.expire(dashboard, ["slices"])

    positions: dict[str, dict[str, Any]] = {
        "CHART-live": {
            "type": "CHART",
            "id": "CHART-live",
            "children": [],
            "meta": {"chartId": live_chart.id, "width": 4, "height": 50},
        },
        "CHART-trashed": {
            "type": "CHART",
            "id": "CHART-trashed",
            "children": [],
            "meta": {"chartId": trashed_chart.id, "width": 4, "height": 50},
        },
    }

    DashboardDAO.set_dash_metadata(dashboard, {"positions": positions})
    # Flush so the collection diff's SQL reaches the composite-PK junction
    # table — a duplicate INSERT fails here, not at assignment time.
    db.session.flush()

    member_ids = {chart.id for chart in dashboard.slices}
    assert live_chart.id in member_ids
    assert trashed_chart.id in member_ids, (
        "soft-deleted member chart was severed from dashboard.slices; "
        "set_dash_metadata must bypass the visibility filter when "
        "resolving incoming chart ids"
    )
    # And the position slot kept its UUID rather than being nulled.
    assert positions["CHART-trashed"]["meta"]["uuid"] == str(trashed_chart.uuid)


def test_set_dash_metadata_preserves_refresh_frequency(session: Session) -> None:
    """set_dash_metadata must not reset refresh_frequency when absent from data.

    Regression test for #42116: ``data.get("refresh_frequency", 0)`` would
    unconditionally overwrite the existing value with 0 whenever the caller
    did not include ``refresh_frequency`` in the data dict.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dashboard = Dashboard(
        dashboard_title="refresh_test_dash",
        json_metadata=json.dumps({"refresh_frequency": 30}),
    )
    db.session.add(dashboard)
    db.session.flush()

    # Simulate a save that does NOT include refresh_frequency
    # (e.g. changing only the title via the PropertiesModal).
    DashboardDAO.set_dash_metadata(dashboard, {"color_scheme": "superset"})

    md = json.loads(dashboard.json_metadata)
    assert md["refresh_frequency"] == 30, (
        "refresh_frequency should be preserved when not present in data"
    )


def test_set_dash_metadata_updates_refresh_frequency_when_present(
    session: Session,
) -> None:
    """set_dash_metadata must update refresh_frequency when it IS in data."""
    Dashboard.metadata.create_all(session.get_bind())

    dashboard = Dashboard(
        dashboard_title="refresh_test_dash_2",
        json_metadata=json.dumps({"refresh_frequency": 30}),
    )
    db.session.add(dashboard)
    db.session.flush()

    # Simulate a save that explicitly sets refresh_frequency to 0.
    DashboardDAO.set_dash_metadata(
        dashboard, {"refresh_frequency": 0, "color_scheme": "superset"}
    )

    md = json.loads(dashboard.json_metadata)
    assert md["refresh_frequency"] == 0, (
        "refresh_frequency should be updated when present in data"
    )


def _make_dashboard(slug: str, n_charts: int) -> Dashboard:
    """A dashboard with n_charts member charts, each with one editor and viewer."""
    editor = Subject(label=f"editor-{slug}", type=SubjectType.ROLE)
    viewer = Subject(label=f"viewer-{slug}", type=SubjectType.ROLE)
    dashboard = Dashboard(dashboard_title=slug, slug=slug)
    for i in range(n_charts):
        dashboard.slices.append(
            Slice(
                slice_name=f"{slug}-chart-{i}",
                datasource_type="table",
                datasource_id=1,
                viz_type="table",
                editors=[editor],
                viewers=[viewer],
            )
        )
    db.session.add(dashboard)
    db.session.flush()
    return dashboard


def _count_statements(session: Session, fn) -> int:
    """Number of SQL statements fn issues."""
    seen = []

    def before(conn, cursor, statement, params, ctx, many):  # noqa: PLR0913
        seen.append(statement)

    bind = session.get_bind()
    event.listen(bind, "before_cursor_execute", before)
    try:
        fn()
    finally:
        event.remove(bind, "before_cursor_execute", before)
    return len(seen)


def test_prefetch_chart_access_loads_editors_and_viewers(
    session: Session,
) -> None:
    """The per-chart access check reads editors and viewers on every slice.

    Without the prefetch those are two lazy loads per chart, so the dashboard
    GET issues a pair of queries for each member chart it narrows.
    """
    Dashboard.metadata.create_all(session.get_bind())

    editor = Subject(label="editor", type=SubjectType.ROLE)
    viewer = Subject(label="viewer", type=SubjectType.ROLE)
    dashboard = Dashboard(dashboard_title="prefetch", slug="prefetch")
    for i in range(3):
        dashboard.slices.append(
            Slice(
                slice_name=f"chart-{i}",
                datasource_type="table",
                datasource_id=1,
                viz_type="table",
                editors=[editor],
                viewers=[viewer],
            )
        )
    session.add(dashboard)
    session.flush()

    # Drop everything from the identity map so the relationships start unloaded.
    session.expire_all()
    dashboard = session.query(Dashboard).filter_by(slug="prefetch").one()
    assert all("editors" in inspect(slc).unloaded for slc in dashboard.slices)

    # The access check short-circuits for an admin without reading either
    # relationship, so the prefetch is a non-admin path.
    with patch.object(security_manager, "is_admin", return_value=False):
        DashboardDAO.prefetch_chart_access(dashboard)

    for slc in dashboard.slices:
        unloaded = inspect(slc).unloaded
        assert "editors" not in unloaded
        assert "viewers" not in unloaded
        assert [s.label for s in slc.editors] == ["editor"]
        assert [s.label for s in slc.viewers] == ["viewer"]


def test_prefetch_chart_access_does_no_per_chart_work(
    session: Session,
) -> None:
    """Adding charts must not add statements.

    Asserting only that the relationships end up loaded would also pass for an
    implementation that walks the slices and touches each one, which is the 2N
    behaviour this is meant to remove. So count the statements at two sizes and
    require the same number.

    Not literally constant forever: selectinload batches its own IN lists at 500,
    so each relationship adds one statement per 500 charts (1200 charts is 7
    statements, against 2400 before). Both sizes here sit inside the first batch,
    which is what makes the equality check meaningful.
    """
    Dashboard.metadata.create_all(session.get_bind())

    small = _make_dashboard("count-small", 3)
    large = _make_dashboard("count-large", 25)
    session.expire_all()

    with patch.object(security_manager, "is_admin", return_value=False):
        small = session.query(Dashboard).filter_by(slug="count-small").one()
        small_n = _count_statements(
            session, lambda: DashboardDAO.prefetch_chart_access(small)
        )
        large = session.query(Dashboard).filter_by(slug="count-large").one()
        large_n = _count_statements(
            session, lambda: DashboardDAO.prefetch_chart_access(large)
        )

    assert small_n == large_n, (
        f"prefetch scaled with chart count: {small_n} statements for 3 charts, "
        f"{large_n} for 25"
    )
    assert small_n == 3, f"expected slices + editors + viewers, got {small_n}"


def test_prefetch_chart_access_skips_the_query_for_admins(
    session: Session,
) -> None:
    """An admin's access check never reads editors or viewers, so don't prefetch.

    is_editor and is_viewer both return True on is_admin() before touching
    either relationship. Prefetching for an admin would turn a zero-query
    access check into three extra statements.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dashboard = _make_dashboard("admin-skip", 5)
    session.expire_all()
    dashboard = session.query(Dashboard).filter_by(slug="admin-skip").one()

    with patch.object(security_manager, "is_admin", return_value=True):
        n = _count_statements(
            session, lambda: DashboardDAO.prefetch_chart_access(dashboard)
        )

    assert n == 0, f"prefetch issued {n} statements for an admin"


def test_get_charts_for_dashboard_returns_the_prefetched_charts(
    session: Session,
) -> None:
    """The charts endpoint must read editors/viewers without per-chart queries.

    get_charts_for_dashboard looks the dashboard up with its slices unloaded,
    so the prefetched charts and the returned collection have to be the same
    instances. If the method reloaded dashboard.slices after prefetching, the
    weak identity map could drop the prefetched charts and reading their
    editors/viewers would fall back to a query per chart -- the 2N cost this is
    meant to remove.
    """
    Dashboard.metadata.create_all(session.get_bind())

    _make_dashboard("charts-endpoint", 3)
    # Detach everything so the lookup returns a dashboard with slices unloaded,
    # matching the real request path.
    session.expunge_all()
    dashboard = session.query(Dashboard).filter_by(slug="charts-endpoint").one()

    with (
        patch.object(security_manager, "is_admin", return_value=False),
        patch.object(DashboardDAO, "get_by_id_or_slug", return_value=dashboard),
    ):
        charts = DashboardDAO.get_charts_for_dashboard("charts-endpoint")

        def read_relationships() -> None:
            for slc in charts:
                assert [s.label for s in slc.editors] == ["editor-charts-endpoint"]
                assert [s.label for s in slc.viewers] == ["viewer-charts-endpoint"]

        n = _count_statements(session, read_relationships)

    assert len(charts) == 3
    assert n == 0, f"reading the returned charts issued {n} statements"


def test_prefetch_before_the_main_get_access_loop_reads_no_extra_sql(
    session: Session,
) -> None:
    """The dashboard GET narrows ``charts`` with the same per-slice access check.

    ``DashboardApi.get`` prefetches, then keeps only the slices the caller can
    access by reading each one's editors and viewers (superset/dashboards/api.py).
    The /charts test above protects ``get_charts_for_dashboard``; this protects
    the main GET call site, which relies on the prefetch running before the loop.
    If that call were removed or moved after serialization the loop would fall
    back to two lazy loads per chart -- the 2N cost the prefetch removes.
    """
    Dashboard.metadata.create_all(session.get_bind())

    _make_dashboard("main-get", 3)
    # Detach everything so the dashboard comes back with its slices unloaded,
    # matching the request path.
    session.expunge_all()
    dashboard = session.query(Dashboard).filter_by(slug="main-get").one()

    with patch.object(security_manager, "is_admin", return_value=False):
        # ``schema.dump(dash)`` reads ``Dashboard.charts`` and materializes the
        # slices before the prefetch runs; hold the same instances so the loop
        # below reads their relationships rather than reloading the collection.
        slices = list(dashboard.slices)
        DashboardDAO.prefetch_chart_access(dashboard)

        def narrow_like_the_get() -> None:
            # Mirror the api.py loop: read editors/viewers per slice.
            for slc in slices:
                assert [s.label for s in slc.editors] == ["editor-main-get"]
                assert [s.label for s in slc.viewers] == ["viewer-main-get"]

        n = _count_statements(session, narrow_like_the_get)

    assert n == 0, f"the GET access loop issued {n} statements after the prefetch"


def test_set_dash_metadata_malformed_default_filters(session: Session) -> None:
    """set_dash_metadata must not raise on a ``default_filters`` value that is
    not valid JSON.

    ``DashboardJSONMetadataSchema.default_filters`` only checks that the value
    is a string, so malformed JSON reaches ``set_dash_metadata`` via the
    dashboard create/update API and previously escaped as a raw
    ``JSONDecodeError``.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dashboard = Dashboard(dashboard_title="malformed_default_filters_dash")
    db.session.add(dashboard)
    db.session.flush()

    DashboardDAO.set_dash_metadata(
        dashboard, {"positions": {}, "default_filters": "not-json"}
    )

    md = json.loads(dashboard.json_metadata)
    assert md["default_filters"] == "{}"


def _position_with_trapped_chart(
    placed_chart_id: int, trapped_chart_id: int
) -> dict[str, Any]:
    """A layout where a column was dropped into a row nested inside itself."""
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]},
        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "children": ["ROW-a"],
            "parents": ["ROOT_ID"],
        },
        "ROW-a": {
            "id": "ROW-a",
            "type": "ROW",
            "children": ["CHART-placed"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {},
        },
        "CHART-placed": {
            "id": "CHART-placed",
            "type": "CHART",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a"],
            "meta": {"chartId": placed_chart_id, "width": 4, "height": 50},
        },
        "COLUMN-orphan": {
            "id": "COLUMN-orphan",
            "type": "COLUMN",
            "children": ["CHART-trapped", "ROW-orphan"],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a"],
            "meta": {},
        },
        "ROW-orphan": {
            "id": "ROW-orphan",
            "type": "ROW",
            "children": ["COLUMN-orphan"],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a", "COLUMN-orphan"],
            "meta": {},
        },
        "CHART-trapped": {
            "id": "CHART-trapped",
            "type": "CHART",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-a", "COLUMN-orphan"],
            "meta": {"chartId": trapped_chart_id, "width": 4, "height": 50},
        },
    }


def _make_charts(
    session: Session, trapped_deleted: bool = False
) -> tuple[Slice, Slice]:
    Dashboard.metadata.create_all(session.get_bind())
    dataset = SqlaTable(
        table_name="trapped_table",
        database=Database(database_name="trapped_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    placed = Slice(
        slice_name="placed", datasource_id=dataset.id, datasource_type="table"
    )
    trapped = Slice(
        slice_name="trapped",
        datasource_id=dataset.id,
        datasource_type="table",
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc)
        if trapped_deleted
        else None,
    )
    db.session.add_all([placed, trapped])
    db.session.flush()
    return placed, trapped


def test_set_dash_metadata_keeps_cross_filter_config_of_trapped_chart(
    session: Session,
) -> None:
    placed, trapped = _make_charts(session)
    dashboard = Dashboard(dashboard_title="trapped", slices=[placed, trapped])
    db.session.add(dashboard)
    db.session.flush()

    scope = {"rootPath": ["ROOT_ID"], "excluded": [trapped.id, placed.id]}
    DashboardDAO.set_dash_metadata(
        dashboard,
        {
            "positions": _position_with_trapped_chart(placed.id, trapped.id),
            "chart_configuration": {
                str(trapped.id): {
                    "id": trapped.id,
                    "crossFilters": {"scope": scope, "chartsInScope": []},
                }
            },
        },
    )

    derived = derive_metadata_scopes(dashboard, dashboard.params_dict)

    cross_filters = derived["chart_configuration"][str(trapped.id)]["crossFilters"]
    assert cross_filters["scope"] == scope
    assert cross_filters["chartsInScope"] == []


@with_feature_flags(SOFT_DELETE=True)
def test_set_dash_metadata_keeps_archived_trapped_chart_through_resave(
    session: Session,
) -> None:
    placed, trapped = _make_charts(session, trapped_deleted=True)
    dashboard = Dashboard(dashboard_title="trapped", slices=[placed, trapped])
    db.session.add(dashboard)
    db.session.flush()

    DashboardDAO.set_dash_metadata(
        dashboard,
        {"positions": _position_with_trapped_chart(placed.id, trapped.id)},
    )
    db.session.flush()

    # The client re-saves what it loaded; the archived chart is absent from the
    # charts payload, so only its layout entry can carry its membership.
    saved = json.loads(dashboard.position_json)
    assert "COLUMN-orphan" not in saved
    assert "ROW-orphan" not in saved
    assert saved["CHART-trapped"]["parents"][:2] == ["ROOT_ID", "GRID_ID"]

    db.session.expire(dashboard, ["slices"])
    DashboardDAO.set_dash_metadata(dashboard, {"positions": saved})
    db.session.flush()

    with skip_visibility_filter(db.session, Slice):
        db.session.expire(dashboard, ["slices"])
        assert {chart.id for chart in dashboard.slices} == {placed.id, trapped.id}


def _make_dashboard_with_slices(
    session: Session,
    slice_names: list[str] | None = None,
    dashboard_title: str = "original_dash",
) -> tuple[Dashboard, list[Slice]]:
    Dashboard.metadata.create_all(session.get_bind())
    dataset = SqlaTable(
        table_name="dao_test_table",
        database=Database(database_name="dao_test_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    names = slice_names or ["chart_1", "chart_2"]
    slices = [
        Slice(
            slice_name=name,
            datasource_id=dataset.id,
            datasource_type="table",
        )
        for name in names
    ]
    dashboard = Dashboard(
        dashboard_title=dashboard_title,
        slices=slices,
        published=True,
    )
    db.session.add_all([*slices, dashboard])
    db.session.flush()
    return dashboard, slices


def _make_sample_native_filter_metadata(
    slices: list[Slice],
    excluded_slices: list[Slice] | None = None,
    extra_filters: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    positions = {
        f"CHART-{slc.id}": {
            "type": "CHART",
            "id": f"CHART-{slc.id}",
            "children": [],
            "meta": {"chartId": slc.id, "width": 4, "height": 50},
        }
        for slc in slices
    }
    excluded_ids = [s.id for s in excluded_slices] if excluded_slices else []
    filters: list[dict[str, Any]] = [
        {
            "id": "NATIVE_FILTER-1",
            "name": "Filter 1",
            "scope": {"rootPath": ["ROOT_ID"], "excluded": excluded_ids},
            "chartsInScope": [s.id for s in slices],
        }
    ]
    if extra_filters:
        filters.extend(extra_filters)
    return {
        "positions": positions,
        "native_filter_configuration": filters,
    }


def test_copy_dashboard_duplicate_slices_remaps_native_filters(
    session: Session,
) -> None:
    dashboard, (chart1, chart2) = _make_dashboard_with_slices(session)
    json_metadata = _make_sample_native_filter_metadata(
        slices=[chart1, chart2],
        excluded_slices=[chart2],
    )

    copy_data = {
        "dashboard_title": "copied_dash",
        "duplicate_slices": True,
        "json_metadata": json.dumps(json_metadata),
    }

    with (
        patch.object(security_manager, "is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        copied_dash = DashboardDAO.copy_dashboard(dashboard, copy_data)

    copied_slices = {s.slice_name: s.id for s in copied_dash.slices}
    assert len(copied_slices) == 2
    assert copied_slices["chart_1"] != chart1.id
    assert copied_slices["chart_2"] != chart2.id

    copied_metadata = json.loads(copied_dash.json_metadata)
    copied_filters = copied_metadata["native_filter_configuration"]
    assert len(copied_filters) == 1

    assert copied_filters[0]["chartsInScope"] == [
        copied_slices["chart_1"],
        copied_slices["chart_2"],
    ]
    assert copied_filters[0]["scope"]["excluded"] == [copied_slices["chart_2"]]


def test_copy_dashboard_handles_dividers_and_unscoped_filters(
    session: Session,
) -> None:
    dashboard, (chart1, chart2) = _make_dashboard_with_slices(session)
    filters: list[Any] = [
        {"id": "NATIVE_FILTER_DIVIDER-1", "type": "DIVIDER", "title": "Group A"},
        "invalid_filter_entry",
        {
            "id": "NATIVE_FILTER-1",
            "scope": {"rootPath": ["ROOT_ID"], "excluded": [chart1.id]},
            "chartsInScope": [chart1.id, chart2.id],
        },
        {"id": "DIVIDER-2", "type": "DIVIDER"},
    ]
    json_metadata = {
        "positions": {
            f"CHART-{chart1.id}": {
                "type": "CHART",
                "id": f"CHART-{chart1.id}",
                "children": [],
                "meta": {"chartId": chart1.id, "width": 4, "height": 50},
            },
            f"CHART-{chart2.id}": {
                "type": "CHART",
                "id": f"CHART-{chart2.id}",
                "children": [],
                "meta": {"chartId": chart2.id, "width": 4, "height": 50},
            },
        },
        "native_filter_configuration": filters,
    }
    copy_data = {
        "dashboard_title": "copied_dash_with_dividers",
        "duplicate_slices": True,
        "json_metadata": json.dumps(json_metadata),
    }

    with (
        patch.object(security_manager, "is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        copied_dash = DashboardDAO.copy_dashboard(dashboard, copy_data)

    copied_slices = {s.slice_name: s.id for s in copied_dash.slices}
    copied_metadata = json.loads(copied_dash.json_metadata)
    copied_filters = copied_metadata["native_filter_configuration"]

    # Divider preserved untouched
    assert copied_filters[0] == {
        "id": "NATIVE_FILTER_DIVIDER-1",
        "type": "DIVIDER",
        "title": "Group A",
    }
    # Non-dict element preserved untouched
    assert copied_filters[1] == "invalid_filter_entry"
    # Normal native filter remapped
    assert copied_filters[2]["scope"]["excluded"] == [copied_slices["chart_1"]]
    assert copied_filters[2]["chartsInScope"] == [
        copied_slices["chart_1"],
        copied_slices["chart_2"],
    ]
    # Trailing divider preserved untouched
    assert copied_filters[3] == {"id": "DIVIDER-2", "type": "DIVIDER"}


def test_copy_dashboard_remaps_cross_filters_and_chart_configuration(
    session: Session,
) -> None:
    dashboard, (c1, c2, c3) = _make_dashboard_with_slices(
        session, slice_names=["c1", "c2", "c3"]
    )
    json_metadata = {
        "positions": {
            f"CHART-{c.id}": {
                "type": "CHART",
                "id": f"CHART-{c.id}",
                "children": [],
                "meta": {"chartId": c.id, "width": 4, "height": 50},
            }
            for c in (c1, c2, c3)
        },
        "global_chart_configuration": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": [c3.id]},
            "chartsInScope": [c1.id, c2.id],
        },
        "chart_configuration": {
            str(c1.id): {
                "id": c1.id,
                "crossFilters": {
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": [c2.id]},
                    "chartsInScope": [c3.id],
                },
            }
        },
    }
    copy_data = {
        "dashboard_title": "copied_dash_cross_filters",
        "duplicate_slices": True,
        "json_metadata": json.dumps(json_metadata),
    }

    with (
        patch.object(security_manager, "is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        copied_dash = DashboardDAO.copy_dashboard(dashboard, copy_data)

    copied_slices = {s.slice_name: s.id for s in copied_dash.slices}
    copied_metadata = json.loads(copied_dash.json_metadata)

    # Verify global_chart_configuration remapping
    global_cfg = copied_metadata["global_chart_configuration"]
    assert global_cfg["scope"]["excluded"] == [copied_slices["c3"]]
    assert global_cfg["chartsInScope"] == [
        copied_slices["c1"],
        copied_slices["c2"],
    ]

    # Verify chart_configuration key, id, and crossFilters remapping
    new_c1_key = str(copied_slices["c1"])
    assert new_c1_key in copied_metadata["chart_configuration"]
    c1_cfg = copied_metadata["chart_configuration"][new_c1_key]
    assert c1_cfg["id"] == copied_slices["c1"]
    assert c1_cfg["crossFilters"]["scope"]["excluded"] == [copied_slices["c2"]]
    assert c1_cfg["crossFilters"]["chartsInScope"] == [copied_slices["c3"]]


def test_set_dash_metadata_remaps_native_filters_when_slice_ids_provided(
    session: Session,
) -> None:
    dashboard, (chart1, chart2) = _make_dashboard_with_slices(session)
    metadata_payload = {
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-1",
                "scope": {"rootPath": ["ROOT_ID"], "excluded": [chart1.id]},
                "chartsInScope": [chart1.id, chart2.id],
            }
        ],
        "chart_configuration": {
            str(chart1.id): {
                "id": chart1.id,
                "crossFilters": {
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
                    "chartsInScope": [chart2.id],
                },
            }
        },
    }
    old_to_new = {chart1.id: 991, chart2.id: 992}

    DashboardDAO.set_dash_metadata(
        dashboard,
        metadata_payload,
        old_to_new_slice_ids=old_to_new,
    )

    saved_metadata = json.loads(dashboard.json_metadata)
    saved_filter = saved_metadata["native_filter_configuration"][0]
    assert saved_filter["scope"]["excluded"] == [991]
    assert saved_filter["chartsInScope"] == [991, 992]

    saved_chart_cfg = saved_metadata["chart_configuration"]["991"]
    assert saved_chart_cfg["id"] == 991
    assert saved_chart_cfg["crossFilters"]["chartsInScope"] == [992]


def test_issue_44983_consolidated_evidence_gate(session: Session) -> None:
    """Consolidated evidence gate for Issue 44983.

    Verifies end-to-end that duplicating a dashboard with duplicate_slices=True:
    1. Duplicates all slices and registers them to the new dashboard.
    2. Completely remaps native_filter_configuration chartsInScope and scope.excluded.
    3. Leaves visual divider entities and non-dictionary entries uncorrupted.
    4. Remaps global_chart_configuration scope.excluded and chartsInScope.
    5. Remaps chart_configuration keys, chart IDs, and crossFilters scopes.
    6. Preserves the original dashboard and slice references intact.
    """
    dashboard, (c1, c2, c3) = _make_dashboard_with_slices(
        session,
        slice_names=["gate_c1", "gate_c2", "gate_c3"],
        dashboard_title="gate_source_dashboard",
    )
    original_c1_id = c1.id
    original_c2_id = c2.id
    original_c3_id = c3.id

    metadata_payload = {
        "positions": {
            f"CHART-{c.id}": {
                "type": "CHART",
                "id": f"CHART-{c.id}",
                "children": [],
                "meta": {"chartId": c.id, "width": 4, "height": 50},
            }
            for c in (c1, c2, c3)
        },
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-gate",
                "name": "Gate Filter",
                "scope": {
                    "rootPath": ["ROOT_ID"],
                    "excluded": [c2.id],
                    "selectedLayers": [
                        f"chart-{c2.id}-layer-0",
                        f"chart-{c3.id}-layer-1",
                    ],
                },
                "chartsInScope": [c1.id, c2.id, c3.id],
            },
            {
                "id": "NATIVE_FILTER_DIVIDER-gate",
                "type": "DIVIDER",
                "title": "Gate Divider",
            },
        ],
        "chart_customization_config": [
            {
                "id": "CUSTOMIZATION-gate",
                "scope": {
                    "rootPath": ["ROOT_ID"],
                    "excluded": [c1.id],
                    "selectedLayers": [f"chart-{c1.id}-layer-custom"],
                },
                "chartsInScope": [c2.id],
            },
            {
                "id": "CUSTOMIZATION-divider",
                "type": "CHART_CUSTOMIZATION_DIVIDER",
            },
        ],
        "global_chart_configuration": {
            "scope": {"rootPath": ["ROOT_ID"], "excluded": [c3.id]},
            "chartsInScope": [c1.id, c2.id],
        },
        "chart_configuration": {
            str(c1.id): {
                "id": c1.id,
                "crossFilters": {
                    "scope": {"rootPath": ["ROOT_ID"], "excluded": [c2.id]},
                    "chartsInScope": [c3.id],
                },
            }
        },
    }

    copy_data = {
        "dashboard_title": "gate_copied_dashboard",
        "duplicate_slices": True,
        "json_metadata": json.dumps(metadata_payload),
    }

    with (
        patch.object(security_manager, "is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        copied_dashboard = DashboardDAO.copy_dashboard(dashboard, copy_data)

    # 1. Duplicated slices are distinct from originals
    copied_slice_map = {s.slice_name: s.id for s in copied_dashboard.slices}
    assert len(copied_slice_map) == 3
    for gate_key in ("gate_c1", "gate_c2", "gate_c3"):
        assert copied_slice_map[gate_key] not in {
            original_c1_id,
            original_c2_id,
            original_c3_id,
        }

    copied_metadata = json.loads(copied_dashboard.json_metadata)

    # 2. Native filter remapping
    gate_filter = copied_metadata["native_filter_configuration"][0]
    assert gate_filter["scope"]["excluded"] == [copied_slice_map["gate_c2"]]
    assert gate_filter["scope"]["selectedLayers"] == [
        f"chart-{copied_slice_map['gate_c2']}-layer-0",
        f"chart-{copied_slice_map['gate_c3']}-layer-1",
    ]
    assert gate_filter["chartsInScope"] == [
        copied_slice_map["gate_c1"],
        copied_slice_map["gate_c2"],
        copied_slice_map["gate_c3"],
    ]

    # 3. Divider preservation
    gate_divider = copied_metadata["native_filter_configuration"][1]
    assert gate_divider["id"] == "NATIVE_FILTER_DIVIDER-gate"
    assert gate_divider["type"] == "DIVIDER"
    assert "scope" not in gate_divider

    # 3b. Chart customization configuration remapping
    custom_cfg = copied_metadata["chart_customization_config"][0]
    assert custom_cfg["id"] == "CUSTOMIZATION-gate"
    assert custom_cfg["scope"]["excluded"] == [copied_slice_map["gate_c1"]]
    assert custom_cfg["scope"]["selectedLayers"] == [
        f"chart-{copied_slice_map['gate_c1']}-layer-custom"
    ]
    assert custom_cfg["chartsInScope"] == [copied_slice_map["gate_c2"]]

    custom_divider = copied_metadata["chart_customization_config"][1]
    assert custom_divider["id"] == "CUSTOMIZATION-divider"
    assert custom_divider["type"] == "CHART_CUSTOMIZATION_DIVIDER"
    assert "scope" not in custom_divider

    # 4. Global chart configuration remapping
    global_cfg = copied_metadata["global_chart_configuration"]
    assert global_cfg["scope"]["excluded"] == [copied_slice_map["gate_c3"]]
    assert global_cfg["chartsInScope"] == [
        copied_slice_map["gate_c1"],
        copied_slice_map["gate_c2"],
    ]

    # 5. Per-chart configuration remapping
    new_c1_key = str(copied_slice_map["gate_c1"])
    assert new_c1_key in copied_metadata["chart_configuration"]
    chart_cfg = copied_metadata["chart_configuration"][new_c1_key]
    assert chart_cfg["id"] == copied_slice_map["gate_c1"]
    assert chart_cfg["crossFilters"]["scope"]["excluded"] == [
        copied_slice_map["gate_c2"]
    ]
    assert chart_cfg["crossFilters"]["chartsInScope"] == [copied_slice_map["gate_c3"]]

    # 6. Original dashboard slices preserved untouched
    original_slice_ids = {s.id for s in dashboard.slices}
    assert original_slice_ids == {original_c1_id, original_c2_id, original_c3_id}


def test_remap_selected_layers_edge_cases() -> None:
    old_to_new = {10: 100, 20: 200}
    # Test dictionary format
    layers_dict = {
        "chart-10-layer-0": True,
        "chart-20-layer-sub1": False,
        "chart-30-layer-0": "unmapped",
        "custom-key": 123,
    }
    remapped_dict = DashboardDAO._remap_selected_layers(layers_dict, old_to_new)
    assert remapped_dict == {
        "chart-100-layer-0": True,
        "chart-200-layer-sub1": False,
        "chart-30-layer-0": "unmapped",
        "custom-key": 123,
    }

    # Test list format (Superset frontend string[] standard)
    layers_list = [
        "chart-10-layer-0",
        "chart-20-layer-sub1",
        "chart-30-layer-0",
        "custom-key",
    ]
    remapped_list = DashboardDAO._remap_selected_layers(layers_list, old_to_new)
    assert remapped_list == [
        "chart-100-layer-0",
        "chart-200-layer-sub1",
        "chart-30-layer-0",
        "custom-key",
    ]


def test_remap_slice_id_list_edge_cases() -> None:
    old_to_new = {1: 10, 2: 20}
    raw = [1, "2", "3", "invalid", None]
    assert DashboardDAO._remap_slice_id_list(raw, old_to_new) == [
        10,
        20,
        "3",
        "invalid",
        None,
    ]


def test_copy_dashboard_does_not_double_remap_overlapping_ids(
    session: Session,
) -> None:
    dashboard, (c1, c2) = _make_dashboard_with_slices(session)
    # Simulate overlapping IDs where old_to_new_slice_ids has old ID matching new ID
    metadata = {
        "positions": {
            "CHART-1": {"type": "CHART", "meta": {"chartId": c1.id}},
            "CHART-2": {"type": "CHART", "meta": {"chartId": c2.id}},
        },
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-overlap",
                "scope": {
                    "rootPath": ["ROOT_ID"],
                    "excluded": [c1.id],
                    "selectedLayers": [f"chart-{c1.id}-layer-0"],
                },
                "chartsInScope": [c1.id, c2.id],
            }
        ],
    }
    dashboard.json_metadata = json.dumps(metadata)
    dashboard.params = json.dumps(metadata)
    session.commit()

    with (
        patch.object(security_manager, "is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        copied_dash = DashboardDAO.copy_dashboard(
            dashboard,
            {
                "dashboard_title": "Copied Dash",
                "json_metadata": json.dumps(metadata),
                "duplicate_slices": True,
            },
        )
    copied_meta = json.loads(copied_dash.json_metadata)
    copied_filter = copied_meta["native_filter_configuration"][0]
    # Each cloned slice must have a distinct new id; remapped exactly once
    new_slice_ids = [s.id for s in copied_dash.slices]
    assert len(new_slice_ids) == 2
    assert len(set(copied_filter["chartsInScope"])) == 2
    assert set(copied_filter["chartsInScope"]) == set(new_slice_ids)
    copied_c1_id = next(
        s.id for s in copied_dash.slices if s.slice_name == c1.slice_name
    )
    assert copied_filter["scope"]["selectedLayers"] == [
        f"chart-{copied_c1_id}-layer-0"
    ]

