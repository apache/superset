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
"""sc-120012: a dataset restore FAILS CLOSED when retention pruned needed
child (column/metric) shadow rows, instead of persisting an incomplete
column set. Pruning is simulated the way ``_delete_for_transactions``
does it: deleting the closed child shadow row directly."""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from sqlalchemy_continuum import version_class

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from superset.versioning.restore import PrunedChildHistoryError, restore_version
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _persist_fixture_state() -> None:
    db.session.commit()


def _birth_names() -> SqlaTable:
    dataset = (
        db.session.query(SqlaTable)
        .filter(SqlaTable.table_name == "birth_names")
        .first()
    )
    assert dataset is not None
    assert dataset.columns
    return dataset


def _latest_parent_tx(dataset: SqlaTable) -> int:
    ver_cls = version_class(SqlaTable)
    return (
        db.session.query(ver_cls.transaction_id)
        .filter(ver_cls.id == dataset.id)
        .order_by(ver_cls.transaction_id.desc())
        .first()
        .transaction_id
    )


def _closed_column_shadow_rows(column_id: int) -> list[Any]:
    shadow = version_class(TableColumn).__table__
    return (
        db.session.execute(
            sa.select(shadow.c.transaction_id).where(
                shadow.c.id == column_id,
                shadow.c.end_transaction_id.isnot(None),
            )
        )
        .scalars()
        .all()
    )


def _delete_column_shadow_rows(column_id: int, *, closed_only: bool) -> int:
    """Simulate retention pruning a column's shadow rows."""
    shadow = version_class(TableColumn).__table__
    stmt = sa.delete(shadow).where(shadow.c.id == column_id)
    if closed_only:
        stmt = stmt.where(shadow.c.end_transaction_id.isnot(None))
    return db.session.execute(stmt).rowcount


class TestRestoreFailsClosedOnPrunedChildHistory(SupersetTestCase):
    @pytest.fixture(autouse=True)
    def _load_data(  # noqa: F811, PT004
        self,
        load_birth_names_dashboard_with_slices: Any,  # noqa: F811
    ) -> None:
        pass

    def _two_version_dataset(self) -> tuple[SqlaTable, TableColumn, int, str]:
        """Dataset with a parent version at T and a column edit after T.

        Returns (dataset, edited column, target_tx T, the column's
        pre-edit description). At T the column's pre-edit shadow row is
        the one valid; the post-T edit closes it.
        """
        _persist_fixture_state()
        dataset = _birth_names()
        dataset.description = f"{dataset.description or ''}_v1"
        db.session.commit()
        target_tx = _latest_parent_tx(dataset)

        column = dataset.columns[0]
        before = column.description
        column.description = f"{column.description or ''}_edited"
        dataset.description = f"{dataset.description}_v2"
        db.session.commit()
        return dataset, column, target_tx, before

    def test_pruned_child_refuses_restore_and_leaves_entity_unchanged(self) -> None:
        dataset, column, target_tx, _ = self._two_version_dataset()
        edited_description = column.description
        column_count = len(dataset.columns)

        closed = _closed_column_shadow_rows(column.id)
        assert closed, "the edit should have closed the pre-edit shadow row"
        assert _delete_column_shadow_rows(column.id, closed_only=True) >= 1

        with pytest.raises(PrunedChildHistoryError) as excinfo:
            restore_version(SqlaTable, dataset.uuid, target_tx, entity=dataset)

        assert "pruned" in str(excinfo.value)
        assert "left unchanged" in str(excinfo.value)
        db.session.rollback()
        dataset = _birth_names()
        refreshed = db.session.get(TableColumn, column.id)
        assert refreshed is not None
        assert refreshed.description == edited_description
        assert len(dataset.columns) == column_count

    def test_control_without_guard_the_partial_write_happens(self) -> None:
        """CONTROL: with the guard removed, the incomplete write proceeds.

        Proves the guard is load-bearing. With the column's valid-at-T
        shadow row pruned, Continuum's reverter finds no child version at
        the target and DELETES the live column outright: the restore
        silently persists a dataset one column short — the exact durable
        partial write the fail-closed decision forbids (the
        intact-history test proves the same restore reverts the column
        in place when its history survives).
        """
        dataset, column, target_tx, before = self._two_version_dataset()
        assert column.description != before
        parent_target_description = dataset.description.removesuffix("_v2")
        assert _delete_column_shadow_rows(column.id, closed_only=True) >= 1

        with patch("superset.versioning.restore._verify_child_history_complete"):
            result = restore_version(SqlaTable, dataset.uuid, target_tx, entity=dataset)

        assert result is not None
        db.session.flush()
        # Parent reverted to the target state...
        assert dataset.description == parent_target_description
        # ...but the column is GONE from the live set: incomplete write.
        assert db.session.get(TableColumn, column.id) is None
        db.session.rollback()

    def test_intact_history_restores_as_before(self) -> None:
        dataset, column, target_tx, before = self._two_version_dataset()

        result = restore_version(SqlaTable, dataset.uuid, target_tx, entity=dataset)

        assert result is not None
        db.session.flush()
        refreshed = db.session.get(TableColumn, column.id)
        assert refreshed is not None
        assert refreshed.description == before
        db.session.rollback()

    def test_documented_limitation_fully_pruned_deleted_child_fails_open(
        self,
    ) -> None:
        """PINS A DOCUMENTED LIMITATION, NOT A REQUIREMENT (sc-120012).

        A column deleted after the target whose ENTIRE shadow chain —
        including its closing DELETE row — was pruned leaves no surviving
        evidence, so the guard cannot detect it and the restore proceeds
        without that column. The deferred part (b) (retention preserving
        the dependency closure of restorable parents) is expected to turn
        this test RED — when it does, invert it into the requirement.
        """
        _persist_fixture_state()
        dataset = _birth_names()

        added = TableColumn(column_name="sc120012_doomed", type="VARCHAR(10)")
        dataset.columns.append(added)
        dataset.description = f"{dataset.description or ''}_with_doomed"
        db.session.commit()
        target_tx = _latest_parent_tx(dataset)
        added_id = added.id

        db.session.delete(added)
        dataset.description = f"{dataset.description}_doomed_gone"
        db.session.commit()

        # Prune the ENTIRE chain (insert row, closed rows, delete row).
        assert _delete_column_shadow_rows(added_id, closed_only=False) >= 1

        result = restore_version(SqlaTable, dataset.uuid, target_tx, entity=dataset)

        assert result is not None
        db.session.flush()
        # The column existed at target_tx but is NOT restored — the
        # documented fail-open residual.
        assert all(col.id != added_id for col in dataset.columns)
        db.session.rollback()
