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
from sqlalchemy import event, inspect, select
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.commands.dashboard.exceptions import DashboardInvalidError
from superset.commands.dashboard.update import UpdateDashboardCommand
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dashboard import (
    _install_membership_baseline,
    _layout_chart_id,
    DashboardDAO,
    reconcile_position_json,
)
from superset.dashboards.filter_scope import derive_metadata_scopes
from superset.models.dashboard import Dashboard, dashboard_slices
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

    # Production shape: the PUT flow loads the Dashboard through a query,
    # which carries the visibility filter into the lazy load of its
    # ``slices`` baseline. Expiring the collection alone is not enough: an
    # object built in Python carries no filter into its lazy loads.
    dashboard_id: int = dashboard.id
    db.session.expunge(dashboard)
    dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).one()

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
    # An archived chart that has a layout slot is listed once, not twice.
    assert [chart.id for chart in dashboard.slices] == [
        live_chart.id,
        trashed_chart.id,
    ]
    # And the position slot kept its UUID rather than being nulled.
    assert positions["CHART-trashed"]["meta"]["uuid"] == str(trashed_chart.uuid)


@pytest.mark.parametrize("previously_in_layout", [False, True])
@with_feature_flags(SOFT_DELETE=True)
def test_set_dash_metadata_preserves_archived_member_missing_from_layout(
    session: Session, previously_in_layout: bool
) -> None:
    """A layout save keeps omitted archived members but removes omitted live ones."""
    Dashboard.metadata.create_all(session.get_bind())
    live: Slice = Slice(slice_name="layout_member", datasource_type="table")
    archived: Slice = Slice(
        slice_name="archived_member",
        datasource_type="table",
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    removed: Slice = Slice(slice_name="removed_member", datasource_type="table")
    positions: dict[str, dict[str, Any]] = {
        "CHART-live": {"type": "CHART", "meta": {"chartId": None}}
    }
    dashboard: Dashboard = Dashboard(
        dashboard_title="archived_outside_layout", slices=[live, archived, removed]
    )
    db.session.add(dashboard)
    db.session.flush()
    positions["CHART-live"]["meta"]["chartId"] = live.id
    stored_positions: dict[str, dict[str, Any]] = dict(positions)
    if previously_in_layout:
        stored_positions["CHART-archived"] = {
            "type": "CHART",
            "meta": {"chartId": archived.id},
        }
    dashboard.position_json = json.dumps(stored_positions)
    # The layout save runs in a separate transaction from the initial membership.
    db.session.commit()
    dashboard_id: int = dashboard.id
    expected_ids: set[int] = {live.id, archived.id}
    db.session.expunge(dashboard)
    dashboard = db.session.query(Dashboard).filter_by(id=dashboard_id).one()

    DashboardDAO.set_dash_metadata(dashboard, {"positions": positions})
    db.session.flush()

    member_ids: set[int] = set(
        db.session.scalars(
            select(dashboard_slices.c.slice_id).where(
                dashboard_slices.c.dashboard_id == dashboard_id
            )
        )
    )
    assert member_ids == expected_ids
    assert json.loads(dashboard.position_json) == positions


def test_install_membership_baseline_skips_transient_dashboard(
    session: Session,
) -> None:
    """A dashboard with no stored rows keeps its in-memory chart list."""
    Dashboard.metadata.create_all(session.get_bind())
    chart: Slice = Slice(slice_name="transient_chart", datasource_type="table")
    db.session.add(chart)
    db.session.flush()
    dashboard: Dashboard = Dashboard(dashboard_title="transient_dash", slices=[chart])

    _install_membership_baseline(dashboard)

    assert dashboard.slices == [chart]
    assert inspect(dashboard).attrs.slices.history.added == [chart]


def test_install_membership_baseline_keeps_unflushed_change(
    session: Session,
) -> None:
    """A pending change to the chart list is kept, not replaced by the
    stored baseline, when autoflush cannot flush it first."""
    Dashboard.metadata.create_all(session.get_bind())
    kept: Slice = Slice(slice_name="kept_chart", datasource_type="table")
    added: Slice = Slice(slice_name="added_chart", datasource_type="table")
    dashboard: Dashboard = Dashboard(dashboard_title="pending_dash", slices=[kept])
    db.session.add_all([kept, added, dashboard])
    db.session.flush()

    with db.session.no_autoflush:
        dashboard.slices.append(added)
        _install_membership_baseline(dashboard)

    assert dashboard.slices == [kept, added]
    assert inspect(dashboard).attrs.slices.history.added == [added]


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


@pytest.mark.parametrize("duplicate_slices", [False, True])
def test_copy_dashboard_preserves_dynamic_titles_per_occurrence(
    session: Session,
    duplicate_slices: bool,
) -> None:
    """Copying shared or cloned charts retains each layout title and filter ID."""
    dashboard, charts = _make_dashboard_with_slices(session)
    metadata = _make_sample_native_filter_metadata(charts)
    chart = charts[0]
    node = metadata["positions"][f"CHART-{chart.id}"]
    node["meta"].update(
        {
            "sliceNameOverride": "Revenue",
            "dynamicTitle": {
                "template": "{{chart_title}} in {{country}}",
                "tokenMappings": {"country": "NATIVE_FILTER-1"},
            },
        }
    )
    metadata["positions"]["CHART-second-occurrence"] = {
        **node,
        "id": "CHART-second-occurrence",
        "meta": {
            **node["meta"],
            "sliceNameOverride": "Comparison",
            "dynamicTitle": {
                "template": "Comparison for {{country}}",
                "tokenMappings": {"country": "NATIVE_FILTER-1"},
            },
        },
    }
    dashboard.position_json = json.dumps(metadata["positions"])
    source_layout = dashboard.position_json

    with (
        patch.object(security_manager, "is_editor", return_value=True),
        patch("superset.daos.dashboard.g") as mock_g,
    ):
        mock_g.user = None
        copied = DashboardDAO.copy_dashboard(
            dashboard,
            {
                "dashboard_title": "Copied titles",
                "duplicate_slices": duplicate_slices,
                "json_metadata": json.dumps(metadata),
            },
        )

    layout = json.loads(copied.position_json)
    first = layout[f"CHART-{chart.id}"]["meta"]
    second = layout["CHART-second-occurrence"]["meta"]
    assert first["dynamicTitle"] == node["meta"]["dynamicTitle"]
    assert (
        second["dynamicTitle"]
        == metadata["positions"]["CHART-second-occurrence"]["meta"]["dynamicTitle"]
    )
    assert first["sliceNameOverride"] == "Revenue"
    assert second["sliceNameOverride"] == "Comparison"
    assert first["chartId"] == second["chartId"]
    assert (first["chartId"] != chart.id) is duplicate_slices
    assert first["uuid"] == second["uuid"]
    assert (
        json.loads(copied.json_metadata)["native_filter_configuration"][0]["id"]
        == "NATIVE_FILTER-1"
    )
    assert dashboard.position_json == source_layout
    assert chart.slice_name == "chart_1"


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
            {
                "id": "CUSTOMIZATION-legacy",
                "chartId": c3.id,
                "customization": {"name": "Legacy GroupBy", "column": "country"},
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

    custom_legacy = copied_metadata["chart_customization_config"][2]
    assert custom_legacy["id"] == "CUSTOMIZATION-legacy"
    assert custom_legacy["chartId"] == copied_slice_map["gate_c3"]

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
    assert copied_filter["scope"]["selectedLayers"] == [f"chart-{copied_c1_id}-layer-0"]


def test_set_dash_metadata_does_not_double_remap_overlapping_ids(
    session: Session,
) -> None:
    """Driving overlapping ID mappings through set_dash_metadata must not
    remap values twice (e.g. 1 -> 2 -> 3)."""
    dashboard, (_c1, _c2) = _make_dashboard_with_slices(session)
    metadata_payload = {
        "native_filter_configuration": [
            {
                "id": "NATIVE_FILTER-overlap",
                "scope": {
                    "rootPath": ["ROOT_ID"],
                    "excluded": [1],
                    "selectedLayers": ["chart-1-layer-0"],
                },
                "chartsInScope": [1, 2],
            }
        ],
        "chart_customization_config": [
            {
                "id": "LEGACY_CUSTOMIZATION-1",
                "chartId": 1,
                "customization": {"name": "Legacy GroupBy", "column": "country"},
            }
        ],
    }
    old_to_new = {1: 2, 2: 3}

    DashboardDAO.set_dash_metadata(
        dashboard,
        metadata_payload,
        old_to_new_slice_ids=old_to_new,
    )

    saved_metadata = json.loads(dashboard.json_metadata)
    saved_filter = saved_metadata["native_filter_configuration"][0]
    assert saved_filter["chartsInScope"] == [2, 3]
    assert saved_filter["scope"]["excluded"] == [2]
    assert saved_filter["scope"]["selectedLayers"] == ["chart-2-layer-0"]

    saved_legacy_custom = saved_metadata["chart_customization_config"][0]
    assert saved_legacy_custom["chartId"] == 2
