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
from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
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
