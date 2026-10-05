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
"""Chart restore against a concurrent delete of the snapshot's datasource."""

import sqlite3
import tempfile
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy as sa
from flask_appbuilder import Model
from sqlalchemy.orm import Session
from sqlalchemy_continuum import version_class

from superset import security_manager
from superset.app import SupersetApp
from superset.commands.chart.restore_version import RestoreChartVersionCommand
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.core import Database
from superset.models.slice import Slice
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.versioning import restore
from superset.versioning.queries import derive_version_uuid

# A file database, so a second connection can race the restore's transaction.
_DB_PATH: Path = Path(tempfile.mkdtemp()) / "restore_race.db"

pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app", [{"SQLALCHEMY_DATABASE_URI": f"sqlite:///{_DB_PATH}"}], indirect=True
)


@pytest.fixture
def capture_session(app: SupersetApp) -> Iterator[Session]:
    """Keep native listeners while all metadata lives in a disposable file."""
    assert db.engine.url.database == str(_DB_PATH)
    Model.metadata.create_all(db.engine)
    session: Session = db.session()
    yield session
    db.session.remove()
    Model.metadata.drop_all(db.engine)


def test_concurrent_view_delete_cannot_leave_restored_chart_dangling(
    capture_session: Session,
) -> None:
    """sc-123446: a view deleted by another connection right after the
    datasource check must not leave the restored chart pointing at it."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="layer", type="test", configuration="{}"
    )
    capture_session.add(layer)
    capture_session.flush()
    view: SemanticView = SemanticView(
        name="view", semantic_layer_uuid=layer.uuid, configuration="{}"
    )
    capture_session.add(view)
    capture_session.flush()
    chart: Slice = Slice(
        slice_name="semantic chart",
        datasource_type="semantic_view",
        datasource_id=view.id,
        viz_type="table",
    )
    capture_session.add(chart)
    capture_session.commit()
    shadow: Any = version_class(Slice)
    transaction_id: int = capture_session.scalar(
        sa.select(sa.func.max(shadow.transaction_id)).where(shadow.id == chart.id)
    )
    semantic_version: UUID = derive_version_uuid(chart.uuid, transaction_id)
    working: SqlaTable = SqlaTable(
        table_name="working",
        database=Database(database_name="working_db", sqlalchemy_uri="sqlite://"),
    )
    capture_session.add(working)
    capture_session.commit()
    chart.datasource_type = "table"
    chart.datasource_id = working.id
    capture_session.commit()
    chart_uuid: UUID = chart.uuid
    view_id: int = view.id

    check: Any = restore._lock_chart_datasource
    delete_errors: list[sqlite3.OperationalError] = []

    def check_then_race(*args: Any, **kwargs: Any) -> Any:
        result: Any = check(*args, **kwargs)
        other: sqlite3.Connection = sqlite3.connect(_DB_PATH, timeout=0.2)
        try:
            other.execute("DELETE FROM semantic_views WHERE id = ?", (view_id,))
            other.commit()
        except sqlite3.OperationalError as ex:
            delete_errors.append(ex)
        finally:
            other.close()
        return result

    with (
        patch.object(security_manager, "raise_for_editorship"),
        patch.object(restore, "_lock_chart_datasource", check_then_race),
    ):
        RestoreChartVersionCommand(chart_uuid, semantic_version).run()

    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert restored.datasource_type == "semantic_view"
    assert capture_session.get(SemanticView, view_id) is not None
    assert delete_errors, "the concurrent delete must wait for the restore"
    # Lock contention, not some unrelated SQL error.
    assert all(ex.sqlite_errorcode == sqlite3.SQLITE_BUSY for ex in delete_errors)


def test_restore_copies_permissions_of_concurrently_renamed_datasource(
    capture_session: Session,
) -> None:
    """A datasource loaded into the session before another connection renames
    it is re-read under the restore's lock, so the chart gets the current
    permission rather than the stale in-memory one."""
    database: Database = Database(database_name="race_db", sqlalchemy_uri="sqlite://")
    target: SqlaTable = SqlaTable(table_name="before", database=database)
    capture_session.add(target)
    capture_session.commit()
    chart: Slice = Slice(
        slice_name="table chart",
        datasource_type="table",
        datasource_id=target.id,
        viz_type="table",
    )
    capture_session.add(chart)
    capture_session.commit()
    shadow: Any = version_class(Slice)
    transaction_id: int = capture_session.scalar(
        sa.select(sa.func.max(shadow.transaction_id)).where(shadow.id == chart.id)
    )
    target_version: UUID = derive_version_uuid(chart.uuid, transaction_id)
    working: SqlaTable = SqlaTable(table_name="working", database=database)
    capture_session.add(working)
    capture_session.commit()
    chart.datasource_id = working.id
    capture_session.commit()
    chart_uuid: UUID = chart.uuid
    target_id: int = target.id

    # Validation can load the target into the identity map before a rename
    # by another connection commits.
    stale: SqlaTable = capture_session.get(SqlaTable, target_id)
    assert stale.perm == f"[race_db].[before](id:{target_id})"
    renamed_perm: str = f"[race_db].[after](id:{target_id})"
    other: sqlite3.Connection = sqlite3.connect(_DB_PATH)
    try:
        other.execute(
            "UPDATE tables SET table_name = ?, perm = ? WHERE id = ?",
            ("after", renamed_perm, target_id),
        )
        other.commit()
    finally:
        other.close()

    with patch.object(security_manager, "raise_for_editorship"):
        RestoreChartVersionCommand(chart_uuid, target_version).run()

    capture_session.expire_all()
    restored: Slice = capture_session.query(Slice).filter_by(uuid=chart_uuid).one()
    assert restored.datasource_id == target_id
    assert restored.perm == renamed_perm
