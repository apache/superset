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
"""Archive candidate identity, bounded streaming, and decoration regressions."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

import pytest
import sqlalchemy as sa

from superset.versioning.activity import queries, render
from superset.versioning.activity.kinds import Window
from superset.versioning.lifecycle import CHART_ARCHIVE_KIND
from superset.versioning.schemas import ActivityRecordSchema


@pytest.fixture
def archive_store(monkeypatch: pytest.MonkeyPatch) -> Iterator[SimpleNamespace]:
    """Exercise both streams against real SQL and a metadata-created scope table."""
    from sqlalchemy_continuum import versioning_manager

    import superset
    from superset.versioning import lifecycle_table

    metadata = sa.MetaData()
    changes = queries.version_changes_table.to_metadata(metadata)
    scope = lifecycle_table.version_chart_archive_scope_table.to_metadata(metadata)
    transactions = sa.Table(
        "version_transaction",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("issued_at", sa.DateTime),
        sa.Column("user_id", sa.Integer),
        sa.Column("action_kind", sa.String(32)),
    )
    users = sa.Table(
        "archive_activity_users",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("first_name", sa.String),
        sa.Column("last_name", sa.String),
    )
    monkeypatch.setattr(queries, "version_changes_table", changes)
    monkeypatch.setattr(lifecycle_table, "version_chart_archive_scope_table", scope)
    monkeypatch.setattr(
        versioning_manager, "transaction_cls", SimpleNamespace(__table__=transactions)
    )
    monkeypatch.setattr(
        superset,
        "security_manager",
        SimpleNamespace(user_model=SimpleNamespace(__table__=users)),
    )
    engine = sa.create_engine("sqlite://")
    dashboard_uuid = uuid4()
    chart_uuid = uuid4()
    with engine.begin() as connection:
        metadata.create_all(connection)
        monkeypatch.setattr(
            queries,
            "db",
            SimpleNamespace(session=SimpleNamespace(connection=lambda: connection)),
        )

        def add(
            tx: int, *, archive: bool = True, valid: bool = True, chart_id: int = 7
        ) -> None:
            """Insert a content or scoped archive event with sortable UTC time."""
            connection.execute(
                transactions.insert().values(
                    id=tx, issued_at=datetime(2026, 1, 1) + timedelta(seconds=tx)
                )
            )
            connection.execute(
                changes.insert().values(
                    id=tx,
                    transaction_id=tx,
                    entity_kind="chart",
                    entity_id=chart_id,
                    sequence=0,
                    kind=CHART_ARCHIVE_KIND if archive else "field",
                    operation="announce" if archive else "replace",
                    path=["deleted_at"],
                    to_value={
                        "entity_uuid": str(chart_uuid if valid else uuid4()),
                        "entity_name": f"Chart {tx}",
                    },
                )
            )
            if archive:
                connection.execute(
                    scope.insert().values(
                        id=uuid4(),
                        transaction_id=tx,
                        chart_id=chart_id,
                        chart_uuid=chart_uuid,
                        dashboard_id=9,
                        dashboard_uuid=dashboard_uuid,
                    )
                )

        yield SimpleNamespace(
            connection=connection,
            changes=changes,
            scope=scope,
            add=add,
            dashboard_uuid=dashboard_uuid,
            chart_uuid=chart_uuid,
        )
    engine.dispose()


def test_archive_query_admits_valid_rows_before_applying_ceiling(
    archive_store: SimpleNamespace,
) -> None:
    """Malformed identities cannot consume the budget or hide truncation."""
    for tx in range(1, 4):
        archive_store.add(tx)
    for tx in range(4, 12):
        archive_store.add(tx, valid=False)
    rows, truncated, floor = queries._fetch_dashboard_archive_candidates(
        9, archive_store.dashboard_uuid, None, None, 2
    )
    assert [row["transaction_id"] for row in rows] == [3, 2]
    assert truncated
    assert floor == queries._record_sort_key(rows[-1])
    assert all("scope_chart_uuid" not in row for row in rows)


def test_archive_scope_matches_dashboard_id_and_uuid(
    archive_store: SimpleNamespace,
) -> None:
    """Re-importing a UUID with another ID cannot inherit old dashboard activity."""
    archive_store.add(1)
    for dashboard_id, dashboard_uuid in [
        (10, archive_store.dashboard_uuid),
        (9, uuid4()),
    ]:
        assert queries._fetch_dashboard_archive_candidates(
            dashboard_id, dashboard_uuid, None, None, 2
        ) == ([], False, None)


def test_content_probe_excludes_archives_before_budget(
    archive_store: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    """An arbitrarily long archive/recovery history cannot displace latest content."""
    archive_store.add(1, archive=False)
    archive_store.add(2, archive=False)
    for tx in range(3, 20):
        archive_store.add(tx)
    monkeypatch.setattr(queries, "_MAX_FETCHED_RECORDS", 1)
    records, truncated = queries.fetch_change_records(
        [("Slice", 7, [Window(0, None)])], None, None
    )
    assert [record["transaction_id"] for record in records] == [2]
    assert truncated


def test_archive_stream_has_no_content_window_lower_bound(
    archive_store: SimpleNamespace,
) -> None:
    """An untracked dashboard can show archives without fabricated content."""
    archive_store.add(1)
    rows, truncated = queries.fetch_change_records(
        [], None, None, dashboard_id=9, dashboard_uuid=archive_store.dashboard_uuid
    )
    assert [row["transaction_id"] for row in rows] == [1]
    assert not truncated


def test_archive_and_content_streams_share_highest_truncation_floor(
    archive_store: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Rows older than an exhausted stream's floor never create pagination holes."""
    for tx in (1, 4, 7):
        archive_store.add(tx, archive=False)
    for tx in (2, 3, 5, 6):
        archive_store.add(tx)
    monkeypatch.setattr(queries, "_MAX_FETCHED_RECORDS", 2)
    rows, truncated = queries.fetch_change_records(
        [("Slice", 7, [Window(0, None)])],
        None,
        None,
        dashboard_id=9,
        dashboard_uuid=archive_store.dashboard_uuid,
    )
    assert truncated
    assert [row["transaction_id"] for row in rows] == [7, 6, 5]
    keys = [
        (r["transaction_id"], r["entity_kind"], r["entity_id"], r["sequence"])
        for r in rows
    ]
    assert len(keys) == len(set(keys))


def test_archive_query_time_bounds(archive_store: SimpleNamespace) -> None:
    """The archive stream uses inclusive since and exclusive until bounds."""
    for tx in range(1, 5):
        archive_store.add(tx)
    start = datetime(2026, 1, 1)
    rows, truncated, _ = queries._fetch_dashboard_archive_candidates(
        9,
        archive_store.dashboard_uuid,
        start + timedelta(seconds=2),
        start + timedelta(seconds=4),
        10,
    )
    assert [row["transaction_id"] for row in rows] == [3, 2]
    assert not truncated


def test_missing_scope_table_preserves_content_and_connection(
    archive_store: SimpleNamespace,
) -> None:
    """Missing migration rolls back just the optional read savepoint."""
    archive_store.add(1, archive=False)
    archive_store.scope.drop(archive_store.connection)
    rows, truncated = queries.fetch_change_records(
        [("Slice", 7, [Window(0, None)])],
        None,
        None,
        dashboard_id=9,
        dashboard_uuid=archive_store.dashboard_uuid,
    )
    assert [row["transaction_id"] for row in rows] == [1]
    assert not truncated
    assert archive_store.connection.execute(sa.select(sa.literal(1))).scalar() == 1
    archive_store.scope.create(archive_store.connection)
    archive_store.add(2)
    assert (
        len(
            queries._fetch_dashboard_archive_candidates(
                9, archive_store.dashboard_uuid, None, None, 10
            )[0]
        )
        == 1
    )


@pytest.mark.parametrize(
    "payload", [None, [], {}, {"entity_uuid": 1}, {"entity_uuid": "invalid"}]
)
def test_invalid_archive_identity_never_borrows_live_identity(payload: Any) -> None:
    """Only validated UUID-bearing payloads can identify a historical chart."""
    assert queries.archive_entity_uuid({"to_value": payload}) is None


def test_archive_schema_and_summary_preserve_historical_verb() -> None:
    """Archive headlines remain archives after the chart is recovered."""
    assert ActivityRecordSchema().load({"kind": CHART_ARCHIVE_KIND}) == {
        "kind": CHART_ARCHIVE_KIND
    }
    assert (
        render._build_summary(
            "Slice", {"kind": CHART_ARCHIVE_KIND, "entity_name": "Old name"}
        )
        == "Chart archived: Old name"
    )


def test_archive_payload_name_does_not_use_content_shadow(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Capture-time name wins over a stale shadow or a later rename."""

    def no_lookup(*args: Any) -> None:
        raise AssertionError("Archive must not use content name lookup")

    monkeypatch.setattr(queries, "_resolve_names_for_kind", no_lookup)
    record = {
        "entity_kind": "chart",
        "entity_id": 7,
        "transaction_id": 2,
        "kind": CHART_ARCHIVE_KIND,
        "to_value": {"entity_uuid": str(uuid4()), "entity_name": "Historical name"},
    }
    queries.apply_entity_name_denormalization([record])
    assert record["entity_name"] == "Historical name"


@pytest.mark.parametrize(
    "state", ["active", "soft_deleted", "hard_deleted", "reused", "invalid"]
)
@pytest.mark.parametrize("can_edit", [False, True])
def test_archive_decoration_redacts_deleted_identity_and_protected_detail(
    monkeypatch: pytest.MonkeyPatch,
    state: str,
    can_edit: bool,
) -> None:
    """Historical identity wins, while deletion and editorship govern disclosure."""
    identity = uuid4()
    live_identity = uuid4() if state == "reused" else identity
    monkeypatch.setattr(
        render,
        "check_entity_tombstones",
        lambda _: {
            ("Slice", 7): {
                "deleted": state == "hard_deleted",
                "deletion_state": "soft_deleted" if state == "soft_deleted" else None,
            }
        },
    )
    monkeypatch.setattr(
        render, "_lookup_entity_uuids", lambda *_: {("Slice", 7): live_identity}
    )
    monkeypatch.setattr(render, "resolve_historical_entity_snapshots", lambda _: {})
    monkeypatch.setattr(
        render, "resolve_editorship", lambda _: {("Slice", 7): can_edit}
    )
    monkeypatch.setattr(render, "batch_chart_impacts", lambda *_: {})
    monkeypatch.setattr(render, "impact_for_record", lambda *_: None)
    record = {
        "entity_kind": "chart",
        "entity_id": 7,
        "transaction_id": 2,
        "kind": CHART_ARCHIVE_KIND,
        "entity_name": "Archive-time name",
        "to_value": {"entity_uuid": "invalid" if state == "invalid" else str(identity)},
        "path": ["deleted_at"],
        "from_value": None,
        "changed_by_id": 12,
        "first_name": "Archive",
        "last_name": "Actor",
        "first_tracked_save": False,
    }
    render.apply_record_decoration([record], "Dashboard", 9)
    assert record["source"] == "related"
    assert record["version_uuid"] is None
    assert record["first_tracked_save"] is False
    if state in {"hard_deleted", "reused", "invalid"}:
        assert record["entity_deleted"] is True
        assert record["entity_uuid"] is None
        assert record["entity_name"] == ""
        assert record["summary"] == "(deleted) Chart"
        assert record["to_value"] is None
        assert record["changed_by"] is None
    else:
        assert record["entity_uuid"] == str(identity)
        assert record["summary"] == "Chart archived: Archive-time name"
        assert (record["changed_by"] is not None) is can_edit
        assert (record["to_value"] is not None) is can_edit


@pytest.mark.parametrize("api_kind", ["Slice", "SqlaTable"])
def test_related_visibility_includes_archived_rows_without_bypassing_access(
    capture_session: sa.orm.Session,
    monkeypatch: pytest.MonkeyPatch,
    api_kind: str,
) -> None:
    """History includes archives under read policy without unhiding ordinary reads."""
    from superset.charts.filters import ChartFilter
    from superset.connectors.sqla.models import SqlaTable
    from superset.models import helpers
    from superset.models.core import Database
    from superset.models.slice import Slice
    from superset.versioning.activity import visibility
    from superset.views.base import DatasourceFilter

    model: type[Slice] | type[SqlaTable] = Slice if api_kind == "Slice" else SqlaTable
    access_filter = ChartFilter if api_kind == "Slice" else DatasourceFilter
    name_column = "slice_name" if api_kind == "Slice" else "table_name"
    extra_fields: dict[str, Any] = {}
    if api_kind == "SqlaTable":
        capture_session.execute(
            Database.__table__.insert().values(
                id=900, database_name="Visibility test", sqlalchemy_uri="sqlite://"
            )
        )
        extra_fields["database_id"] = 900
    capture_session.execute(
        model.__table__.insert(),
        [
            {
                "id": entity_id,
                name_column: f"Entity {entity_id}",
                "deleted_at": deleted_at,
                **extra_fields,
            }
            for entity_id, deleted_at in [
                (901, datetime(2026, 1, 1)),
                (902, datetime(2026, 1, 1)),
                (904, None),
            ]
        ],
    )
    monkeypatch.setattr(helpers, "is_feature_enabled", lambda _: True)

    def apply_access(
        self: Any, query: sa.orm.Query[Any], value: Any
    ) -> sa.orm.Query[Any]:
        """Model a read grant for one archived row and one active row."""
        return query.filter(model.id.in_([901, 904]))

    monkeypatch.setattr(access_filter, "apply", apply_access)
    assert visibility._resolve_visibility(
        {(api_kind, entity_id) for entity_id in [901, 902, 903, 904]}
    ) == {
        (api_kind, 901): True,  # readable archive
        (api_kind, 902): False,  # unreadable archive, not a tombstone
        (api_kind, 903): True,  # hard-deleted, redacted by decoration
        (api_kind, 904): True,  # readable active row
    }
    # A per-statement history bypass must never escape into ordinary reads.
    assert capture_session.query(model.id).all() == [(904,)]
