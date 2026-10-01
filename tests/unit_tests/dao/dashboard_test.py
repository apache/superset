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

import pytest
from sqlalchemy import event, inspect
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.commands.dashboard.exceptions import DashboardInvalidError
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dashboard import (
    _layout_chart_id,
    DashboardDAO,
    reconcile_position_json,
)
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


def _chart_node(node_id: str, chart_id: Any, width: int, height: int) -> dict[str, Any]:
    """Build a chart layout node with the supplied identity and dimensions."""
    return {
        "type": "CHART",
        "id": node_id,
        "children": [],
        "meta": {"chartId": chart_id, "width": width, "height": height},
    }


@with_feature_flags(SOFT_DELETE=True)
def test_set_dash_metadata_repairs_dangling_chart_tiles(session: Session) -> None:
    """A layout node referencing a chart absent from every Slice row (hard-
    deleted / never existed) is swapped for a markdown placeholder on save,
    while live AND soft-deleted members keep their CHART node and uuid.

    sc-115325. Keys the dangling check on ``chartId ∉ uuid_map`` (resolved with
    the visibility filter bypassed), so a soft-deleted member is preserved and
    only a genuinely-absent reference is repaired. Reverting the repair leaves
    the dangling node a CHART with ``meta.uuid = None``, failing the MARKDOWN
    assertion below.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dataset: SqlaTable = SqlaTable(
        table_name="dangle_table",
        database=Database(database_name="dangle_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    live_chart: Slice = Slice(
        slice_name="dangle_live",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    trashed_chart: Slice = Slice(
        slice_name="dangle_trashed",
        datasource_id=dataset.id,
        datasource_type="table",
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    dashboard: Dashboard = Dashboard(
        dashboard_title="dangle_dash",
        slices=[live_chart, trashed_chart],
        published=True,
    )
    db.session.add_all([live_chart, trashed_chart, dashboard])
    db.session.flush()
    db.session.expire(dashboard, ["slices"])

    absent_chart_id: int = 987_654_321
    positions: dict[str, dict[str, Any]] = {
        "CHART-live": _chart_node("CHART-live", live_chart.id, 4, 50),
        "CHART-trashed": _chart_node("CHART-trashed", trashed_chart.id, 4, 50),
        "CHART-gone": _chart_node("CHART-gone", absent_chart_id, 6, 30),
    }

    DashboardDAO.set_dash_metadata(dashboard, {"positions": positions})
    db.session.flush()

    # Live and soft-deleted members keep their CHART node + uuid.
    assert positions["CHART-live"]["type"] == "CHART"
    assert positions["CHART-live"]["meta"]["uuid"] == str(live_chart.uuid)
    assert positions["CHART-trashed"]["type"] == "CHART"
    assert positions["CHART-trashed"]["meta"]["uuid"] == str(trashed_chart.uuid)
    member_ids: set[int] = {chart.id for chart in dashboard.slices}
    assert live_chart.id in member_ids
    assert trashed_chart.id in member_ids

    # The genuinely-absent reference is repaired to a markdown placeholder,
    # keeping the node id and geometry but dropping the chart reference.
    gone: dict[str, Any] = positions["CHART-gone"]
    assert gone["type"] == "MARKDOWN", gone
    assert gone["meta"]["code"] == "This chart no longer exists."
    assert gone["meta"]["width"] == 6
    assert gone["meta"]["height"] == 30
    assert "chartId" not in gone["meta"]
    assert "uuid" not in gone["meta"]
    assert absent_chart_id not in member_ids


@with_feature_flags(SOFT_DELETE=True)
def test_reconcile_position_json_repairs_only_absent_charts(session: Session) -> None:
    """The raw ``position_json`` PUT path (``reconcile_position_json``) repairs
    a node whose chart no longer exists, leaves live and soft-deleted charts'
    CHART nodes untouched, and does not disturb non-chart layout nodes.

    sc-115325 — the second write path, which has no ``uuid_map`` to reuse and
    resolves membership itself with the soft-delete filter bypassed.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dataset: SqlaTable = SqlaTable(
        table_name="reconcile_table",
        database=Database(database_name="reconcile_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    live_chart: Slice = Slice(
        slice_name="reconcile_live",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    trashed_chart: Slice = Slice(
        slice_name="reconcile_trashed",
        datasource_id=dataset.id,
        datasource_type="table",
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    db.session.add_all([live_chart, trashed_chart])
    db.session.flush()

    absent_chart_id: int = 987_654_321
    positions: dict[str, dict[str, Any]] = {
        "CHART-live": _chart_node("CHART-live", live_chart.id, 4, 50),
        "CHART-trashed": _chart_node("CHART-trashed", trashed_chart.id, 4, 50),
        "CHART-gone": _chart_node("CHART-gone", absent_chart_id, 6, 30),
        "ROW-1": {
            "type": "ROW",
            "id": "ROW-1",
            "children": ["CHART-live", "CHART-trashed", "CHART-gone"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
    }

    repaired: int = reconcile_position_json(positions)

    assert repaired == 1
    assert positions["CHART-live"]["type"] == "CHART"
    assert positions["CHART-trashed"]["type"] == "CHART"  # soft-deleted preserved
    assert positions["CHART-gone"]["type"] == "MARKDOWN", positions["CHART-gone"]
    assert positions["CHART-gone"]["meta"]["code"] == "This chart no longer exists."
    # Non-chart nodes are left alone; the row still references the same slot id.
    assert positions["ROW-1"]["type"] == "ROW"
    assert "CHART-gone" in positions["ROW-1"]["children"]


def test_reconcile_position_json_ignores_non_dict_layout() -> None:
    """A ``position_json`` that is valid JSON but not an object (``"[]"``,
    ``"null"``, a scalar) reaches ``reconcile_position_json`` as a non-dict —
    the PUT schema only validates parseability. It must be left untouched and
    return 0, not raise (sc-115325 python-review regression guard: the old
    ``json.dumps(json.loads(...))`` round-trip accepted any JSON value)."""
    non_dict_layouts: list[Any] = [[], None, 5, "just a string"]
    payload: Any
    for payload in non_dict_layouts:
        assert reconcile_position_json(payload) == 0


@with_feature_flags(SOFT_DELETE=True)
def test_reconcile_position_json_handles_edge_and_malformed_nodes(
    session: Session,
) -> None:
    """``chartId == 0`` is a real-but-absent reference (no Slice has id 0) and
    is repaired to a placeholder; malformed nodes — a non-dict ``meta`` or a
    non-int ``chartId`` — are ignored, not crashed (sc-115325 python-review:
    ``position_json`` is only validated as parseable JSON)."""
    Dashboard.metadata.create_all(session.get_bind())

    dataset: SqlaTable = SqlaTable(
        table_name="edge_table",
        database=Database(database_name="edge_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    live_chart: Slice = Slice(
        slice_name="edge_live",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    db.session.add(live_chart)
    db.session.flush()

    positions: dict[str, Any] = {
        "CHART-live": _chart_node("CHART-live", live_chart.id, 4, 50),
        "CHART-zero": _chart_node("CHART-zero", 0, 4, 50),
        "CHART-bad-meta": {
            "type": "CHART",
            "id": "CHART-bad-meta",
            "children": [],
            "meta": "not-a-dict",
        },
        "CHART-bad-id": {
            "type": "CHART",
            "id": "CHART-bad-id",
            "children": [],
            "meta": {"chartId": [1], "width": 4, "height": 50},
        },
    }

    repaired: int = reconcile_position_json(positions)

    # Only chartId=0 counts as a dangling reference to repair.
    assert repaired == 1
    assert positions["CHART-live"]["type"] == "CHART"
    assert positions["CHART-zero"]["type"] == "MARKDOWN"
    assert positions["CHART-zero"]["meta"]["code"] == "This chart no longer exists."
    # Malformed nodes are left untouched (ignored, not repaired, not raised).
    assert positions["CHART-bad-meta"]["type"] == "CHART"
    assert positions["CHART-bad-id"]["type"] == "CHART"


@pytest.mark.parametrize(
    "chart_id, expected",
    [
        (7, 7),
        (0, 0),  # real-but-absent reference, not "missing"
        (7.0, 7),  # integral float (JSON round-trip / import)
        ("7", 7),  # digit string (legacy data)
        (" 7 ", 7),  # whitespace-padded digit string
        ("²", None),  # a digit that int() cannot parse
        ("٧", 7),  # decimal Unicode digits are valid integers
        (7.5, None),  # fractional float is not an id
        ("7a", None),  # non-digit string
        ("-1", None),  # sign is not a digit; no Slice has a negative id
        (True, None),  # bool is an int subclass but never a chart id
        ([1], None),
        (None, None),
    ],
)
def test_layout_chart_id_coerces_numeric_forms_only(
    chart_id: Any, expected: int | None
) -> None:
    """Numeric *forms* of a chartId (integral float, digit string) resolve to
    the int — legacy/imported layouts carry them and the pre-reconcile code
    accepted them — while fractional floats, non-digit strings, and bools stay
    ``None`` (fitzee review on #44028: returning ``None`` for ``123.0`` or
    ``"123"`` would silently unlink a live chart AND skip its repair)."""
    node: dict[str, Any] = {
        "type": "CHART",
        "id": "CHART-x",
        "meta": {"chartId": chart_id},
    }
    assert _layout_chart_id(node) == expected


def test_reconcile_position_json_keeps_live_chart_referenced_in_numeric_form(
    session: Session,
) -> None:
    """A live chart referenced as ``123.0`` or ``"123"`` is recognised as that
    chart — left as a CHART tile, not repaired — while an ABSENT id in the same
    forms is still repaired. This is the regression fitzee flagged: dropping
    numeric forms would exclude a real chart from the membership rebuild (unlink
    on save) and, with no id to resolve, never convert it to a placeholder — a
    permanent orphan tile."""
    Dashboard.metadata.create_all(session.get_bind())

    dataset: SqlaTable = SqlaTable(
        table_name="numeric_form_table",
        database=Database(database_name="numeric_form_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    live_chart: Slice = Slice(
        slice_name="numeric_form_live",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    db.session.add(live_chart)
    db.session.flush()

    positions: dict[str, Any] = {
        "CHART-float": _chart_node("CHART-float", float(live_chart.id), 4, 50),
        "CHART-str": _chart_node("CHART-str", str(live_chart.id), 4, 50),
        "CHART-absent-float": _chart_node("CHART-absent-float", 0.0, 4, 50),
        "CHART-absent-str": _chart_node("CHART-absent-str", "0", 4, 50),
    }

    repaired: int = reconcile_position_json(positions)

    assert repaired == 2
    # Live chart in either numeric form: recognised, kept as a CHART tile.
    assert positions["CHART-float"]["type"] == "CHART"
    assert positions["CHART-str"]["type"] == "CHART"
    # Absent id in either numeric form: still repaired.
    assert positions["CHART-absent-float"]["type"] == "MARKDOWN"
    assert positions["CHART-absent-str"]["type"] == "MARKDOWN"


def test_set_dash_metadata_keeps_a_member_referenced_in_numeric_form(
    session: Session,
) -> None:
    """A live member referenced as ``123.0`` or ``"123"`` survives the wholesale
    ``dashboard.slices`` rebuild, keeps its CHART tile, and gets a real uuid.

    This is the membership half of the fitzee regression on #44028: the repair
    path is covered by
    ``test_reconcile_position_json_keeps_live_chart_referenced_in_numeric_form``,
    but the silent *unlink* happens here — a node dropped from ``slice_ids``
    loses its ``dashboard_slices`` junction row on the next save, and with no
    id to resolve it is never repaired either, leaving a permanent orphan tile.
    Reverting the float/digit-string coercion in ``_layout_chart_id`` makes the
    save raise instead (both nodes read as malformed), so this test bites.
    """
    Dashboard.metadata.create_all(session.get_bind())

    dataset: SqlaTable = SqlaTable(
        table_name="numeric_member_table",
        database=Database(
            database_name="numeric_member_db", sqlalchemy_uri="sqlite://"
        ),
    )
    db.session.add(dataset)
    db.session.flush()
    as_float: Slice = Slice(
        slice_name="numeric_member_float",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    as_string: Slice = Slice(
        slice_name="numeric_member_string",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    dashboard: Dashboard = Dashboard(
        dashboard_title="numeric member", slug="numeric-member"
    )
    dashboard.slices = [as_float, as_string]
    db.session.add_all([as_float, as_string, dashboard])
    db.session.flush()

    positions: dict[str, Any] = {
        "CHART-float": _chart_node("CHART-float", float(as_float.id), 4, 50),
        "CHART-str": _chart_node("CHART-str", str(as_string.id), 4, 50),
    }

    DashboardDAO.set_dash_metadata(dashboard, {"positions": positions})
    # Flush so the collection diff's SQL reaches ``dashboard_slices`` — the
    # unlink is a junction-row DELETE, which an in-memory assertion alone
    # would not witness.
    db.session.flush()

    # Neither member was unlinked by the wholesale rebuild.
    assert {chart.id for chart in dashboard.slices} == {as_float.id, as_string.id}
    # Neither tile was orphaned or turned into a placeholder.
    assert positions["CHART-float"]["type"] == "CHART"
    assert positions["CHART-str"]["type"] == "CHART"
    # Both resolved to a real chart, so both carry a uuid rather than ``None``.
    assert positions["CHART-float"]["meta"]["uuid"] == str(as_float.uuid)
    assert positions["CHART-str"]["meta"]["uuid"] == str(as_string.uuid)


@pytest.mark.parametrize(
    "invalid_meta",
    [
        {"chartId": [1]},
        {"chartId": True},
        {"chartId": 1.25},
        {"chartId": "unreadable"},
        None,
        [],
        "invalid",
    ],
)
def test_set_dash_metadata_rejects_a_malformed_chart_node_instead_of_detaching(
    session: Session,
    invalid_meta: object,
) -> None:
    """A CHART node whose chartId cannot be resolved fails the save with a
    422-shaped error naming the slot — it is NOT skipped, because the
    membership rebuild is wholesale and skipping it would silently detach the
    chart it references. Existing memberships are untouched by the refusal.
    (codeant on #44028; the pre-reconcile code failed this save with a 500.)"""
    Dashboard.metadata.create_all(session.get_bind())

    dataset: SqlaTable = SqlaTable(
        table_name="malformed_table",
        database=Database(database_name="malformed_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    member: Slice = Slice(
        slice_name="malformed_member",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    dashboard: Dashboard = Dashboard(dashboard_title="malformed", slug="malformed")
    dashboard.slices = [member]
    db.session.add_all([member, dashboard])
    db.session.flush()

    positions: dict[str, Any] = {
        "CHART-ok": _chart_node("CHART-ok", member.id, 4, 50),
        "CHART-bad": {
            "type": "CHART",
            "id": "CHART-bad",
            "children": [],
            "meta": invalid_meta,
        },
    }

    excinfo: pytest.ExceptionInfo[DashboardInvalidError]
    with pytest.raises(DashboardInvalidError) as excinfo:
        DashboardDAO.set_dash_metadata(dashboard, {"positions": positions})

    assert "CHART-bad" in str(excinfo.value.normalized_messages())
    # The refusal did not touch membership.
    assert {chart.id for chart in dashboard.slices} == {member.id}


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


@pytest.mark.parametrize(
    "meta", [{"chartId": None, "width": 4, "height": 50}, {"width": 4, "height": 50}]
)
def test_reconcile_empty_chart_slot_without_resolvable_ids(
    meta: dict[str, object],
) -> None:
    """An all-empty layout needs no lookup and retains its slot geometry."""
    node: dict[str, object] = {
        "type": "CHART",
        "id": "CHART-empty",
        "children": [],
        "parents": ["ROW-a"],
        "meta": meta,
    }
    positions: dict[str, object] = {"CHART-empty": node}
    assert reconcile_position_json(positions) == 1
    assert positions["CHART-empty"] == {
        **node,
        "type": "MARKDOWN",
        "meta": {"width": 4, "height": 50, "code": "This chart no longer exists."},
    }


def _save_review_layout(
    dashboard: Dashboard, positions: dict[str, Any], field: str
) -> None:
    """Exercise either update payload after the separately tested access validation."""
    payload: dict[str, Any] = (
        {"positions": positions} if field == "json_metadata" else positions
    )
    command: UpdateDashboardCommand = UpdateDashboardCommand(
        dashboard.id, {field: json.dumps(payload)}
    )
    command._model = dashboard  # noqa: SLF001
    with patch.object(command, "validate"):
        command.run()
    db.session.flush()
    db.session.expire(dashboard, ["position_json"])


@pytest.mark.parametrize("field", ["json_metadata", "position_json"])
@pytest.mark.parametrize("duplicate_id", [987654321, "987654321", 987654321.0])
def test_save_deduplicates_missing_chart_before_placeholder_conversion(
    session: Session, field: str, duplicate_id: int | str | float
) -> None:
    """A detached duplicate must not be rescued as a second missing-chart tile."""
    Dashboard.metadata.create_all(session.get_bind())
    dashboard: Dashboard = Dashboard(dashboard_title="missing duplicate", slices=[])
    db.session.add(dashboard)
    db.session.flush()
    positions: dict[str, Any] = _position_with_trapped_chart(987654321, 987654321)
    positions["CHART-trapped"]["meta"]["chartId"] = duplicate_id

    _save_review_layout(dashboard, positions, field)

    saved: dict[str, Any] = json.loads(dashboard.position_json)
    placeholders: list[str] = [
        key
        for key, node in saved.items()
        if isinstance(node, dict) and node.get("type") == "MARKDOWN"
    ]
    assert placeholders == ["CHART-placed"]
    assert saved["CHART-placed"]["meta"]["code"] == "This chart no longer exists."
    assert "CHART-trapped" not in saved
    assert dashboard.slices == []


@pytest.mark.parametrize("field", ["json_metadata", "position_json"])
@pytest.mark.parametrize("numeric_form", ["string", "float"])
def test_save_normalizes_chart_ids_for_native_and_cross_filter_scopes(
    session: Session, field: str, numeric_form: str
) -> None:
    """Saved IDs must be integers usable by both filter-scope readers."""
    placed: Slice
    trapped: Slice
    placed, trapped = _make_charts(session)
    dashboard: Dashboard = Dashboard(
        dashboard_title="numeric scopes", slices=[placed, trapped]
    )
    db.session.add(dashboard)
    db.session.flush()
    positions: dict[str, Any] = _position_with_trapped_chart(placed.id, trapped.id)
    positions["CHART-trapped"]["meta"]["chartId"] = (
        str(trapped.id) if numeric_form == "string" else float(trapped.id)
    )
    scope: dict[str, Any] = {"rootPath": ["ROOT_ID"], "excluded": []}
    dashboard.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {"id": "NATIVE_FILTER-test", "scope": scope}
            ],
            "chart_configuration": {
                str(placed.id): {"id": placed.id, "crossFilters": {"scope": scope}}
            },
        }
    )

    _save_review_layout(dashboard, positions, field)

    saved: dict[str, Any] = json.loads(dashboard.position_json)
    derived: dict[str, Any] = derive_metadata_scopes(dashboard, dashboard.params_dict)
    assert type(saved["CHART-trapped"]["meta"]["chartId"]) is int
    assert saved["CHART-trapped"]["meta"]["chartId"] == trapped.id
    assert {chart.id for chart in dashboard.slices} == {placed.id, trapped.id}
    assert trapped.id in derived["native_filter_configuration"][0]["chartsInScope"]
    assert (
        trapped.id
        in derived["chart_configuration"][str(placed.id)]["crossFilters"][
            "chartsInScope"
        ]
    )


@pytest.mark.parametrize("field", ["json_metadata", "position_json"])
@pytest.mark.parametrize("missing_id", [False, True])
def test_save_preserves_detached_empty_copy_slot(
    session: Session, field: str, missing_id: bool
) -> None:
    """An empty legacy slot has no chart identity to deduplicate or discard."""
    Dashboard.metadata.create_all(session.get_bind())
    dashboard: Dashboard = Dashboard(dashboard_title="empty legacy slot", slices=[])
    db.session.add(dashboard)
    db.session.flush()
    positions: dict[str, Any] = _position_with_trapped_chart(987654321, 987654322)
    positions["CHART-trapped"]["meta"]["chartId"] = None
    if missing_id:
        del positions["CHART-trapped"]["meta"]["chartId"]

    _save_review_layout(dashboard, positions, field)

    saved: dict[str, Any] = json.loads(dashboard.position_json)
    assert saved["CHART-trapped"]["type"] == "MARKDOWN"
    assert saved["CHART-trapped"]["meta"] == {
        "width": 4,
        "height": 50,
        "code": "This chart no longer exists.",
    }
    assert saved["CHART-trapped"]["parents"][:2] == ["ROOT_ID", "GRID_ID"]
