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
"""Persisted saves through the real baseline, Continuum and change listeners."""

from collections.abc import Iterator
from itertools import chain, repeat
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import Session, SessionTransaction
from sqlalchemy_continuum import version_class

from superset.app import SupersetApp
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
    """Create only disposable in-memory tables; retain native listener wiring."""
    assert db.engine.url.get_backend_name() == "sqlite"
    assert not db.engine.url.database
    Model.metadata.create_all(db.engine)
    session: Session = db.session()
    yield session
    db.session.remove()
    Model.metadata.drop_all(db.engine)


def history_counts(session: Session) -> dict[str, int]:
    """Count every shadow, association, transaction and semantic-change table."""
    return {
        table.name: session.scalar(sa.select(sa.func.count()).select_from(table))
        for table in Model.metadata.tables.values()
        if table.name.endswith("_version")
        or table.name in {"version_transaction", "version_changes"}
    }


@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize(
    "model,field",
    [(Slice, "slice_name"), (Dashboard, "dashboard_title"), (SqlaTable, "table_name")],
)
def test_runtime_capture_new_and_edited_save(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    model: type[Model],
    field: str,
    enabled: bool,
) -> None:
    """Denied new/edit saves persist live state without any history writes."""
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: enabled
    )
    database: Database = Database(database_name="private", sqlalchemy_uri="sqlite://")
    capture_session.add(database)
    capture_session.commit()
    entity: Any = model(**{field: "created"})
    if model is SqlaTable:
        entity.database = database
    if model is Slice:
        entity.viz_type = "table"
        entity.params = "{}"
    before: dict[str, int] = history_counts(capture_session)
    capture_session.add(entity)
    capture_session.commit()
    setattr(entity, field, "edited")
    capture_session.flush()
    setattr(entity, field, "final")
    capture_session.commit()
    capture_session.expire_all()
    assert getattr(capture_session.get(model, entity.id), field) == "final"
    if enabled:
        assert capture_session.query(version_class(model)).count() == 2
    else:
        assert history_counts(capture_session) == before


def test_capture_reenable_relations_and_rollback(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Denied association statements and rolled-back edits cannot leak forward."""
    policy: dict[str, bool] = {"enabled": True}
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: policy["enabled"]
    )
    chart: Slice = Slice(slice_name="original", viz_type="table", params="{}")
    dashboard: Dashboard = Dashboard(dashboard_title="original")
    capture_session.add_all([chart, dashboard])
    capture_session.commit()
    before: dict[str, int] = history_counts(capture_session)
    policy["enabled"] = False
    dashboard.slices.append(chart)
    chart.slice_name = "skipped"
    capture_session.flush()
    dashboard.dashboard_title = "skipped twice"
    capture_session.flush()
    capture_session.commit()
    assert dashboard.slices == [chart]
    assert history_counts(capture_session) == before
    chart.slice_name = "rolled back"
    capture_session.flush()
    capture_session.rollback()
    assert chart.slice_name == "skipped"
    policy["enabled"] = True
    chart.slice_name = "captured again"
    capture_session.commit()
    after: dict[str, int] = history_counts(capture_session)
    assert after["slices_version"] == before["slices_version"] + 1
    assert after["dashboard_slices_version"] == before["dashboard_slices_version"]
    assert after["dashboards_version"] == before["dashboards_version"]
    shadow: Any = version_class(Slice)
    assert [
        row.slice_name
        for row in capture_session.query(shadow).order_by(shadow.transaction_id)
    ] == ["original", "captured again"]


def test_denied_import_style_child_writes_leave_no_capture_intent(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Children and import action metadata follow the same non-request policy."""
    from superset.versioning.changes.listener import ACTION_KIND_KEY

    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: False
    )
    database: Database = Database(database_name="private", sqlalchemy_uri="sqlite://")
    dataset: SqlaTable = SqlaTable(table_name="imported", database=database)
    dataset.columns = [TableColumn(column_name="first", type="STRING")]
    dataset.metrics = [SqlMetric(metric_name="count", expression="COUNT(*)")]
    capture_session.info[ACTION_KIND_KEY] = "import"
    capture_session.add(dataset)
    capture_session.flush()
    dataset.columns.append(TableColumn(column_name="second", type="STRING"))
    capture_session.commit()
    assert len(dataset.columns) == 2
    assert len(dataset.metrics) == 1
    assert not any(history_counts(capture_session).values())
    assert ACTION_KIND_KEY not in capture_session.info
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: True
    )
    dataset.table_name = "enabled"
    capture_session.commit()
    assert history_counts(capture_session)["tables_version"] == 2


def test_first_enabled_edit_uses_current_baseline(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Re-enable records the existing pre-edit baseline, not skipped edit events."""
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: False
    )
    dashboard: Dashboard = Dashboard(dashboard_title="uncaptured creation")
    capture_session.add(dashboard)
    capture_session.commit()
    dashboard.dashboard_title = "last uncaptured state"
    capture_session.commit()
    assert not any(history_counts(capture_session).values())
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: True
    )
    dashboard.dashboard_title = "captured edit"
    capture_session.commit()
    shadow: Any = version_class(Dashboard)
    assert [
        row.dashboard_title
        for row in capture_session.query(shadow).order_by(shadow.transaction_id)
    ] == ["last uncaptured state", "captured edit"]


def test_runtime_denial_refuses_restore_before_mutation(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An authorized request cannot perform a restore when capture is denied."""
    from uuid import uuid4

    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.commands.dashboard.restore_version import (
        RestoreDashboardVersionCommand,
    )

    dashboard: Dashboard = Dashboard(dashboard_title="preserved")
    capture_session.add(dashboard)
    capture_session.commit()
    before: dict[str, int] = history_counts(capture_session)
    monkeypatch.setitem(
        app.config, "VERSIONING_CAPTURE_PREDICATE", lambda session: False
    )
    with pytest.raises(DashboardNotFoundError):
        RestoreDashboardVersionCommand(dashboard.uuid, uuid4()).run()
    assert dashboard.dashboard_title == "preserved"
    assert history_counts(capture_session) == before


@pytest.mark.parametrize("existing_transaction", [False, True])
@pytest.mark.parametrize("initially_enabled", [False, True])
def test_restore_capture_decision_covers_persisted_mutation(
    capture_session: Session,
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    existing_transaction: bool,
    initially_enabled: bool,
) -> None:
    """A restore binds its first capture decision before policy can change."""
    from superset import security_manager
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.commands.dashboard.restore_version import (
        RestoreDashboardVersionCommand,
    )

    dashboard: Dashboard = Dashboard(dashboard_title="original")
    capture_session.add(dashboard)
    capture_session.commit()
    entity_uuid: UUID = dashboard.uuid
    shadow: Any = version_class(Dashboard)
    transaction_id: int = capture_session.scalar(
        sa.select(shadow.transaction_id).where(shadow.id == dashboard.id)
    )
    target_uuid: UUID = derive_version_uuid(entity_uuid, transaction_id)
    dashboard.dashboard_title = "edited"
    capture_session.commit()
    before: dict[str, int] = history_counts(capture_session)
    db.session.remove()
    session: Session = db.session()
    assert session.get_transaction() is None
    if existing_transaction:
        session.begin()

    # Model the host contract: memoize only for a real transaction; a policy
    # change after the first decision must not authorize an untracked restore.
    decisions: Iterator[bool] = chain(
        [initially_enabled], repeat(not initially_enabled)
    )
    memo: dict[SessionTransaction, bool] = {}

    def predicate(active_session: Session) -> bool:
        assert active_session is session
        transaction: SessionTransaction | None = active_session.get_transaction()
        if transaction is None:
            return next(decisions)
        if transaction not in memo:
            memo[transaction] = next(decisions)
        return memo[transaction]

    from superset.versioning.utils import capture_enabled

    monkeypatch.setitem(app.config, "VERSIONING_CAPTURE_PREDICATE", predicate)
    capture_gate: MagicMock
    with (
        patch.object(security_manager, "raise_for_editorship"),
        patch(
            "superset.commands.version_restore.capture_enabled", wraps=capture_enabled
        ) as capture_gate,
    ):
        if initially_enabled:
            RestoreDashboardVersionCommand(entity_uuid, target_uuid).run()
        else:
            with pytest.raises(DashboardNotFoundError):
                RestoreDashboardVersionCommand(entity_uuid, target_uuid).run()
    capture_gate.assert_called_once_with(session)
    # Both commit and denial/rollback leave no command-owned transaction open.
    assert session.get_transaction() is None
    db.session.remove()
    session = db.session()
    assert session.scalar(
        sa.select(Dashboard.dashboard_title).where(Dashboard.uuid == entity_uuid)
    ) == ("original" if initially_enabled else "edited")
    after: dict[str, int] = history_counts(session)
    if initially_enabled:
        assert after["dashboards_version"] == before["dashboards_version"] + 1
        assert after["version_transaction"] == before["version_transaction"] + 1
        assert after["version_changes"] > before["version_changes"]
    else:
        assert after == before
