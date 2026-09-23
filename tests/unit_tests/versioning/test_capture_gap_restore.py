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
"""Restore snapshots captured after an uncaptured child or membership change."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import patch
from uuid import UUID

import pytest
import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import Session
from sqlalchemy_continuum import version_class, versioning_manager
from sqlalchemy_continuum.operation import Operation

from superset import security_manager
from superset.app import SupersetApp
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.commands.dataset.restore_version import RestoreDatasetVersionCommand
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.extensions import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.versioning.queries import derive_version_uuid

pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app", [{"SQLALCHEMY_DATABASE_URI": "sqlite://"}], indirect=True
)


@pytest.fixture
def capture_session(app: SupersetApp) -> Iterator[Session]:
    """Keep native listeners while all metadata lives in disposable SQLite."""
    assert db.engine.url.get_backend_name() == "sqlite"
    assert not db.engine.url.database
    Model.metadata.create_all(db.engine)
    session: Session = db.session()
    yield session
    db.session.remove()
    Model.metadata.drop_all(db.engine)


def latest_version(session: Session, entity: Any) -> UUID:
    """Resolve the latest persisted parent snapshot through its public UUID."""
    shadow: Any = version_class(type(entity))
    transaction_id: int = session.scalar(
        sa.select(sa.func.max(shadow.transaction_id)).where(shadow.id == entity.id)
    )
    return derive_version_uuid(entity.uuid, transaction_id)


def test_no_gap_parent_save_does_not_add_child_history(
    capture_session: Session,
) -> None:
    """A parent-only save leaves UUID and currency child snapshots unchanged."""
    column: TableColumn = TableColumn(column_name="code", type="STRING")
    metric: SqlMetric = SqlMetric(
        metric_name="total",
        expression="SUM(amount)",
        currency={"symbol": "USD", "symbolPosition": "prefix"},
    )
    dataset: SqlaTable = SqlaTable(
        table_name="original",
        database=Database(database_name="private", sqlalchemy_uri="sqlite://"),
        columns=[column],
        metrics=[metric],
    )
    capture_session.add(dataset)
    capture_session.commit()
    assert column.uuid is not None
    assert metric.uuid is not None
    assert metric.currency == {"symbol": "USD", "symbolPosition": "prefix"}
    column_shadow: Any = version_class(TableColumn)
    metric_shadow: Any = version_class(SqlMetric)
    assert list(
        capture_session.scalars(
            sa.select(column_shadow.uuid).where(column_shadow.id == column.id)
        )
    ) == [column.uuid]
    assert list(
        capture_session.scalars(
            sa.select(metric_shadow.uuid).where(metric_shadow.id == metric.id)
        )
    ) == [metric.uuid]
    assert list(
        capture_session.scalars(
            sa.select(metric_shadow.currency).where(metric_shadow.id == metric.id)
        )
    ) == [metric.currency]

    dataset.table_name = "parent-only change"
    capture_session.commit()
    parent_shadow: Any = version_class(SqlaTable)
    transaction_id: int = capture_session.scalar(
        sa.select(sa.func.max(parent_shadow.transaction_id)).where(
            parent_shadow.id == dataset.id
        )
    )
    child_model: type[Model]
    for child_model in (TableColumn, SqlMetric):
        child_shadow: Any = version_class(child_model)
        assert (
            capture_session.scalar(
                sa.select(sa.func.count())
                .select_from(child_shadow)
                .where(child_shadow.transaction_id == transaction_id)
            )
            == 0
        )


@pytest.mark.parametrize("gap", ["add", "edit", "remove"])
def test_dataset_restores_complete_post_gap_snapshot(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    gap: str,
) -> None:
    """A resumed parent snapshot includes the actual column and metric state."""
    policy: dict[str, bool] = {"enabled": True}
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda s: policy["enabled"]
    )
    dataset: SqlaTable = SqlaTable(
        table_name="original",
        database=Database(database_name="private", sqlalchemy_uri="sqlite://"),
    )
    dataset.columns = [TableColumn(column_name="original", type="STRING")]
    dataset.metrics = [SqlMetric(metric_name="original", expression="COUNT(*)")]
    capture_session.add(dataset)
    capture_session.commit()
    policy["enabled"] = False
    if gap == "add":
        dataset.columns.append(TableColumn(column_name="gap", type="STRING"))
        dataset.metrics.append(SqlMetric(metric_name="gap", expression="SUM(1)"))
    elif gap == "edit":
        dataset.columns[0].verbose_name = "gap label"
        dataset.metrics[0].expression = "SUM(2)"
    else:
        dataset.columns = []
        dataset.metrics = []
    capture_session.commit()
    expected_columns: list[tuple[str, str | None]] = sorted(
        (column.column_name, column.verbose_name) for column in dataset.columns
    )
    expected_metrics: list[tuple[str, str]] = sorted(
        (metric.metric_name, metric.expression) for metric in dataset.metrics
    )
    policy["enabled"] = True
    dataset.table_name = "resumed snapshot"
    capture_session.commit()
    target: UUID = latest_version(capture_session, dataset)
    # Later captured edits must not make an earlier incomplete snapshot appear safe.
    dataset.columns.append(TableColumn(column_name="later", type="INT"))
    dataset.metrics.append(SqlMetric(metric_name="later", expression="SUM(3)"))
    dataset.table_name = "later"
    capture_session.commit()
    with patch.object(security_manager, "raise_for_editorship"):
        RestoreDatasetVersionCommand(dataset.uuid, target).run()
    capture_session.expire_all()
    assert dataset.table_name == "resumed snapshot"
    assert (
        sorted((c.column_name, c.verbose_name) for c in dataset.columns)
        == expected_columns
    )
    assert (
        sorted((m.metric_name, m.expression) for m in dataset.metrics)
        == expected_metrics
    )
    transaction: Any = versioning_manager.transaction_cls
    assert (
        capture_session.scalar(
            sa.select(transaction.action_kind).order_by(transaction.id.desc()).limit(1)
        )
        == "restore"
    )


@pytest.mark.parametrize("gap", ["add", "remove"])
def test_dashboard_restores_complete_post_gap_membership(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    gap: str,
) -> None:
    """Snapshot membership reflects denied attaches and detaches, not chart content."""
    policy: dict[str, bool] = {"enabled": True}
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda s: policy["enabled"]
    )
    chart: Slice = Slice(slice_name="original", viz_type="table", params="{}")
    dashboard: Dashboard = Dashboard(dashboard_title="original")
    if gap == "remove":
        dashboard.slices = [chart]
    capture_session.add_all([chart, dashboard])
    capture_session.commit()
    policy["enabled"] = False
    dashboard.slices = [chart] if gap == "add" else []
    capture_session.commit()
    expected_ids: list[int] = [chart.id] if gap == "add" else []
    policy["enabled"] = True
    dashboard.dashboard_title = "resumed snapshot"
    capture_session.commit()
    target: UUID = latest_version(capture_session, dashboard)
    chart.slice_name = "later chart content"
    dashboard.dashboard_title = "later"
    capture_session.commit()
    with patch.object(security_manager, "raise_for_editorship"):
        RestoreDashboardVersionCommand(dashboard.uuid, target).run()
    capture_session.expire_all()
    assert [c.id for c in dashboard.slices] == expected_ids
    assert chart.slice_name == "later chart content"


def test_restore_legitimately_removes_later_children(
    capture_session: Session,
) -> None:
    """A complete older snapshot must still remove children born after its target."""
    dataset: SqlaTable = SqlaTable(
        table_name="original",
        database=Database(database_name="private", sqlalchemy_uri="sqlite://"),
    )
    capture_session.add(dataset)
    capture_session.commit()
    target: UUID = latest_version(capture_session, dataset)
    dataset.columns.append(TableColumn(column_name="later", type="INT"))
    dataset.metrics.append(SqlMetric(metric_name="later", expression="COUNT(*)"))
    capture_session.commit()
    with patch.object(security_manager, "raise_for_editorship"):
        RestoreDatasetVersionCommand(dataset.uuid, target).run()
    capture_session.expire_all()
    assert dataset.columns == []
    assert dataset.metrics == []


def test_resume_multiple_flushes_and_rollback(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Final snapshot sees the final child state; rollback leaves history intact."""
    from tests.unit_tests.versioning.test_runtime_capture import history_counts

    policy: dict[str, bool] = {"enabled": True}
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda s: policy["enabled"]
    )
    dataset: SqlaTable = SqlaTable(
        table_name="original",
        database=Database(database_name="private", sqlalchemy_uri="sqlite://"),
    )
    capture_session.add(dataset)
    capture_session.commit()
    target_before_gap: UUID = latest_version(capture_session, dataset)
    policy["enabled"] = False
    column: TableColumn = TableColumn(column_name="gap", type="INT")
    dataset.columns.append(column)
    capture_session.commit()
    policy["enabled"] = True
    before: dict[str, int] = history_counts(capture_session)
    dataset.table_name = "rolled back"
    capture_session.flush()
    column.verbose_name = "rolled back label"
    capture_session.flush()
    capture_session.rollback()
    assert history_counts(capture_session) == before
    dataset.table_name = "resumed"
    capture_session.flush()
    column.verbose_name = "final label"
    capture_session.flush()
    capture_session.commit()
    target: UUID = latest_version(capture_session, dataset)
    before = history_counts(capture_session)
    capture_session.commit()
    assert history_counts(capture_session) == before
    dataset.table_name = "later"
    capture_session.commit()
    with patch.object(security_manager, "raise_for_editorship"):
        RestoreDatasetVersionCommand(dataset.uuid, target).run()
    assert [(c.column_name, c.verbose_name) for c in dataset.columns] == [
        ("gap", "final label")
    ]
    with patch.object(security_manager, "raise_for_editorship"):
        RestoreDatasetVersionCommand(dataset.uuid, target_before_gap).run()
    assert dataset.columns == []


def test_gap_state_not_misattributed_as_new_child_edit(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reconciliation follows audit construction instead of inventing gap events."""
    from superset.versioning.changes.table import version_changes_table

    policy: dict[str, bool] = {"enabled": True}
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda s: policy["enabled"]
    )
    dataset: SqlaTable = SqlaTable(
        table_name="original",
        database=Database(database_name="private", sqlalchemy_uri="sqlite://"),
    )
    capture_session.add(dataset)
    capture_session.commit()
    policy["enabled"] = False
    dataset.columns.append(TableColumn(column_name="gap", type="INT"))
    capture_session.commit()
    policy["enabled"] = True
    dataset.table_name = "resumed"
    capture_session.commit()
    shadow: Any = version_class(SqlaTable)
    transaction_id: int = capture_session.scalar(
        sa.select(sa.func.max(shadow.transaction_id)).where(shadow.id == dataset.id)
    )
    kinds: list[str] = list(
        capture_session.scalars(
            sa.select(version_changes_table.c.kind).where(
                version_changes_table.c.transaction_id == transaction_id
            )
        )
    )
    assert kinds
    assert all("column" not in kind for kind in kinds)
    child_shadow: Any = version_class(TableColumn)
    assert (
        capture_session.scalar(
            sa.select(sa.func.count())
            .select_from(child_shadow)
            .where(child_shadow.transaction_id == transaction_id)
        )
        == 1
    )


def test_reconciliation_failure_rolls_back_parent_save(
    capture_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A failed completeness write cannot commit a misleading parent snapshot."""
    from tests.unit_tests.versioning.test_runtime_capture import history_counts

    dashboard: Dashboard = Dashboard(dashboard_title="original")
    capture_session.add(dashboard)
    capture_session.commit()
    before: dict[str, int] = history_counts(capture_session)
    dashboard.dashboard_title = "must roll back"
    with patch(
        "superset.versioning.snapshot._reconcile_membership",
        side_effect=RuntimeError("injected reconciliation failure"),
    ):
        with pytest.raises(RuntimeError, match="injected reconciliation failure"):
            capture_session.commit()
    capture_session.rollback()
    assert dashboard.dashboard_title == "original"
    assert history_counts(capture_session) == before


def test_post_gap_reattach_across_flushes(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A resumed save records a gap-detached chart reattached after a flush."""
    policy: dict[str, bool] = {"enabled": True}
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda s: policy["enabled"]
    )
    chart: Slice = Slice(slice_name="original", viz_type="table", params="{}")
    dashboard: Dashboard = Dashboard(dashboard_title="original", slices=[chart])
    capture_session.add(dashboard)
    capture_session.commit()
    policy["enabled"] = False
    dashboard.slices = []
    capture_session.commit()
    policy["enabled"] = True
    dashboard.dashboard_title = "resumed"
    capture_session.flush()
    dashboard.slices = [chart]
    capture_session.flush()
    capture_session.commit()
    target: UUID = latest_version(capture_session, dashboard)
    dashboard.dashboard_title = "later"
    dashboard.slices = []
    capture_session.commit()
    capture_session.expire(dashboard, ["slices"])
    assert dashboard.slices == []
    with patch.object(security_manager, "raise_for_editorship"):
        RestoreDashboardVersionCommand(dashboard.uuid, target).run()
    capture_session.expire(dashboard, ["slices"])
    assert dashboard.slices == [chart]


def test_commit_reconciles_native_detach_with_same_transaction_reattach(
    capture_session: Session,
) -> None:
    """Commit reconciliation replaces a native DELETE when the final link exists."""
    chart: Slice = Slice(slice_name="original", viz_type="table", params="{}")
    dashboard: Dashboard = Dashboard(dashboard_title="original", slices=[chart])
    capture_session.add(dashboard)
    capture_session.commit()

    dashboard.dashboard_title = "target"
    capture_session.flush()
    dashboard.slices = []
    capture_session.flush()
    parent_shadow: Any = version_class(Dashboard)
    transaction_id: int = capture_session.scalar(
        sa.select(sa.func.max(parent_shadow.transaction_id)).where(
            parent_shadow.id == dashboard.id
        )
    )
    membership_shadow: sa.Table = parent_shadow.__table__.metadata.tables[
        "dashboard_slices_version"
    ]
    membership_rows: list[int] = list(
        capture_session.scalars(
            sa.select(membership_shadow.c.operation_type).where(
                membership_shadow.c.dashboard_id == dashboard.id,
                membership_shadow.c.slice_id == chart.id,
                membership_shadow.c.transaction_id == transaction_id,
            )
        )
    )
    assert membership_rows == [Operation.DELETE]
    # SQLite create_all uses (dashboard_id, slice_id, transaction_id) as this
    # shadow's PK, so a second native association version collides on flush.
    # Alembic-migrated PostgreSQL uses (dashboard_id, slice_id, transaction_id,
    # operation_type); a native detach/reattach probe passed there. Use Core
    # here to exercise reconciliation's existing-row replacement at commit.
    membership_live: sa.Table = parent_shadow.__table__.metadata.tables[
        "dashboard_slices"
    ]
    capture_session.execute(
        membership_live.insert().values(dashboard_id=dashboard.id, slice_id=chart.id)
    )
    # Core association tracking leaves a pending Continuum operation, but the
    # final ORM flush is clean, so it does not write a second shadow row.
    assert not capture_session.dirty
    assert not capture_session.new
    capture_session.commit()
    assert list(
        capture_session.scalars(
            sa.select(membership_shadow.c.operation_type).where(
                membership_shadow.c.dashboard_id == dashboard.id,
                membership_shadow.c.slice_id == chart.id,
                membership_shadow.c.transaction_id == transaction_id,
            )
        )
    ) == [Operation.INSERT]

    target: UUID = latest_version(capture_session, dashboard)
    capture_session.expire(dashboard, ["slices"])
    assert dashboard.slices == [chart]
    dashboard.dashboard_title = "later"
    dashboard.slices = []
    capture_session.commit()
    capture_session.expire(dashboard, ["slices"])
    assert dashboard.slices == []
    with patch.object(security_manager, "raise_for_editorship"):
        RestoreDashboardVersionCommand(dashboard.uuid, target).run()
    capture_session.expire(dashboard, ["slices"])
    assert dashboard.slices == [chart]
