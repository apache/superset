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

from sqlalchemy.orm.session import Session

from superset import db
from superset.connectors.sqla.models import Database, SqlaTable
from superset.daos.dashboard import DashboardDAO, reconcile_position_json
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
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


def _chart_node(node_id: str, chart_id: int, width: int, height: int) -> dict[str, Any]:
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

    dataset = SqlaTable(
        table_name="dangle_table",
        database=Database(database_name="dangle_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    live_chart = Slice(
        slice_name="dangle_live",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    trashed_chart = Slice(
        slice_name="dangle_trashed",
        datasource_id=dataset.id,
        datasource_type="table",
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    dashboard = Dashboard(
        dashboard_title="dangle_dash",
        slices=[live_chart, trashed_chart],
        published=True,
    )
    db.session.add_all([live_chart, trashed_chart, dashboard])
    db.session.flush()
    db.session.expire(dashboard, ["slices"])

    absent_chart_id = 987_654_321
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
    member_ids = {chart.id for chart in dashboard.slices}
    assert live_chart.id in member_ids
    assert trashed_chart.id in member_ids

    # The genuinely-absent reference is repaired to a markdown placeholder,
    # keeping the node id and geometry but dropping the chart reference.
    gone = positions["CHART-gone"]
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

    dataset = SqlaTable(
        table_name="reconcile_table",
        database=Database(database_name="reconcile_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()

    live_chart = Slice(
        slice_name="reconcile_live",
        datasource_id=dataset.id,
        datasource_type="table",
    )
    trashed_chart = Slice(
        slice_name="reconcile_trashed",
        datasource_id=dataset.id,
        datasource_type="table",
        deleted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    db.session.add_all([live_chart, trashed_chart])
    db.session.flush()

    absent_chart_id = 987_654_321
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

    repaired = reconcile_position_json(positions)

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

    dataset = SqlaTable(
        table_name="edge_table",
        database=Database(database_name="edge_db", sqlalchemy_uri="sqlite://"),
    )
    db.session.add(dataset)
    db.session.flush()
    live_chart = Slice(
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

    repaired = reconcile_position_json(positions)

    # Only chartId=0 counts as a dangling reference to repair.
    assert repaired == 1
    assert positions["CHART-live"]["type"] == "CHART"
    assert positions["CHART-zero"]["type"] == "MARKDOWN"
    assert positions["CHART-zero"]["meta"]["code"] == "This chart no longer exists."
    # Malformed nodes are left untouched (ignored, not repaired, not raised).
    assert positions["CHART-bad-meta"]["type"] == "CHART"
    assert positions["CHART-bad-id"]["type"] == "CHART"
