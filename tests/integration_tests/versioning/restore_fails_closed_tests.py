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
from uuid import UUID

import pytest
import sqlalchemy as sa
from flask_appbuilder.security.sqla.models import User
from sqlalchemy_continuum import version_class, versioning_manager

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from superset.versioning.restore import (
    PrunedChildHistoryError,
    restore_version,
    RestoreResult,
)
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _persist_fixture_state() -> None:
    db.session.commit()


def _birth_names() -> SqlaTable:
    dataset: SqlaTable = (
        db.session.query(SqlaTable)
        .filter(SqlaTable.table_name == "birth_names")
        .first()
    )
    assert dataset is not None
    assert dataset.columns
    return dataset


def _latest_parent_tx(dataset: SqlaTable) -> int:
    ver_cls: Any = version_class(SqlaTable)
    return (
        db.session.query(ver_cls.transaction_id)
        .filter(ver_cls.id == dataset.id)
        .order_by(ver_cls.transaction_id.desc())
        .first()
        .transaction_id
    )


def _closed_column_shadow_rows(column_id: int) -> list[Any]:
    shadow: sa.Table = version_class(TableColumn).__table__
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
    shadow: sa.Table = version_class(TableColumn).__table__
    stmt: sa.sql.dml.Delete = sa.delete(shadow).where(shadow.c.id == column_id)
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
        dataset: SqlaTable = _birth_names()
        dataset.description = f"{dataset.description or ''}_v1"
        db.session.commit()
        target_tx: int = _latest_parent_tx(dataset)

        column: TableColumn = dataset.columns[0]
        before: str = column.description
        column.description = f"{column.description or ''}_edited"
        dataset.description = f"{dataset.description}_v2"
        db.session.commit()
        return dataset, column, target_tx, before

    def test_pruned_child_refuses_restore_and_leaves_entity_unchanged(self) -> None:
        """Command-level: the refusal rides the command's own transaction.

        The pruning fixture is COMMITTED (as a real retention pass would
        be) and the test performs no rollback of its own: the durable
        end-state — 422-shaped refusal, entity unchanged — is owned by
        the command's transactional cleanup. (This cannot distinguish
        verify-before-write from a rolled-back partial flush; the
        check-happens-before-any-write ORDERING is pinned by
        test_refusal_happens_before_any_write below.)
        """
        # pylint: disable=import-outside-toplevel
        from superset import security_manager
        from superset.commands.dataset.restore_version import (
            RestoreDatasetVersionCommand,
        )
        from superset.utils.core import override_user
        from superset.versioning.queries import list_versions

        dataset: SqlaTable
        column: TableColumn
        target_tx: int
        dataset, column, target_tx, _ = self._two_version_dataset()
        edited_description: str | None = column.description
        column_count: int = len(dataset.columns)
        dataset_uuid: UUID = dataset.uuid
        column_id: int = column.id

        closed: list[Any] = _closed_column_shadow_rows(column.id)
        assert closed, "the edit should have closed the pre-edit shadow row"
        assert _delete_column_shadow_rows(column.id, closed_only=True) >= 1
        db.session.commit()  # the prune is durable, like a real retention pass

        versions: list[dict[str, Any]] | None = list_versions(
            SqlaTable, dataset_uuid, entity=dataset
        )
        assert versions is not None
        target_entry: dict[str, Any] = next(
            v for v in versions if v["transaction_id"] == target_tx
        )
        admin: User | None = self.get_user("admin") or security_manager.add_user(
            "admin",
            "admin",
            "user",
            "admin@fab.org",
            security_manager.find_role("Admin"),
            password="general",  # noqa: S106 — test-only fixture credential
        )
        with override_user(admin):
            with pytest.raises(PrunedChildHistoryError) as excinfo:
                RestoreDatasetVersionCommand(
                    dataset_uuid, target_entry["version_uuid"]
                ).run()

        assert "pruned" in str(excinfo.value)
        assert "left unchanged" in str(excinfo.value)

        # Fresh reads, no test-owned rollback: the command's transactional
        # cleanup owns the unchanged state.
        db.session.expire_all()
        dataset = _birth_names()
        refreshed: TableColumn | None = db.session.get(TableColumn, column_id)
        assert refreshed is not None
        assert refreshed.description == edited_description
        assert len(dataset.columns) == column_count

    def test_verification_row_locks_block_a_concurrent_prune(self) -> None:
        """H1: the verifier's FOR UPDATE locks hold off the pruner's DELETE
        until the restore's transaction ends — and release with it."""
        # pylint: disable=import-outside-toplevel
        from superset.versioning.restore import _verify_child_history_complete

        dialect: str = db.engine.dialect.name
        if dialect == "sqlite":
            pytest.skip(
                "FOR UPDATE is a no-op on SQLite; there the verifier takes "
                "a BEGIN IMMEDIATE write reservation instead (covered by "
                "test_sqlite_verifier_reserves_the_write_lock)"
            )

        dataset: SqlaTable
        column: TableColumn
        target_tx: int
        dataset, column, target_tx, _ = self._two_version_dataset()
        # Acquire the verification locks inside the session's transaction.
        _verify_child_history_complete(dataset, target_tx)

        shadow: sa.Table = version_class(TableColumn).__table__
        delete_stmt: sa.sql.dml.Delete = sa.delete(shadow).where(
            shadow.c.id == column.id,
            shadow.c.end_transaction_id.isnot(None),
        )
        with db.engine.connect() as conn:
            # Begin FIRST: exec_driver_sql would autobegin and make the
            # later begin() raise InvalidRequestError instead of ever
            # reaching the lock wait. The timeout is set inside the
            # transaction (SET LOCAL reverts with it on Postgres; the
            # MySQL session variable is saved and restored in the finally
            # below, whatever the attempt does, so the pooled connection
            # never leaks a 1s timeout).
            original_timeout: int | None = None
            if dialect == "mysql":
                original_timeout = int(
                    conn.exec_driver_sql(
                        "SELECT @@SESSION.innodb_lock_wait_timeout"
                    ).scalar()
                )
                conn.rollback()  # clear the autobegun read transaction

            def _attempt_locked_delete() -> None:
                with conn.begin():
                    if dialect == "mysql":
                        conn.exec_driver_sql("SET SESSION innodb_lock_wait_timeout = 1")
                    else:
                        conn.exec_driver_sql("SET LOCAL lock_timeout = '1s'")
                    conn.execute(delete_stmt)

            try:
                with pytest.raises(sa.exc.OperationalError) as excinfo:
                    _attempt_locked_delete()
                # Specifically the dialect's lock-wait failure, not some
                # other OperationalError.
                orig: Any = excinfo.value.orig
                if dialect == "mysql":
                    assert orig.args, orig
                    assert orig.args[0] == 1205, orig
                else:
                    assert getattr(orig, "pgcode", None) == "55P03", orig
            finally:
                if dialect == "mysql":
                    try:
                        conn.rollback()
                        conn.exec_driver_sql(
                            f"SET SESSION innodb_lock_wait_timeout = {original_timeout}"
                        )
                    except Exception:  # noqa: BLE001
                        # Cannot prove the session variable was restored:
                        # never return this connection to the pool.
                        conn.invalidate()
                        raise

        # Releasing the verifier's transaction releases the locks: the
        # same DELETE succeeds once unblocked (rolled back to keep the fixture).
        db.session.rollback()
        with db.engine.connect() as conn:
            trans: sa.engine.RootTransaction = conn.begin()
            assert (conn.execute(delete_stmt).rowcount or 0) >= 1
            trans.rollback()

    def test_sqlite_verifier_reserves_the_write_lock(self) -> None:
        """H1 on SQLite: the verifier takes a BEGIN IMMEDIATE reservation
        before its reads, so no other writer can commit between the check
        and the restore's own commit (FOR UPDATE is a no-op there, and
        pysqlite's legacy mode would otherwise hold no transaction at all
        for the SELECT sequence)."""
        # pylint: disable=import-outside-toplevel
        from superset.versioning.restore import _verify_child_history_complete

        if db.engine.dialect.name != "sqlite":
            pytest.skip("exercises the pysqlite write-reservation path")

        dataset: SqlaTable
        column: TableColumn
        target_tx: int
        dataset, column, target_tx, _ = self._two_version_dataset()
        raw: Any = db.session.connection().connection.dbapi_connection
        _verify_child_history_complete(dataset, target_tx)
        assert raw.in_transaction, (
            "the verifier must hold a real SQLite transaction after its "
            "reads — without the BEGIN IMMEDIATE reservation the SELECTs "
            "run autocommit and a prune can land mid-restore"
        )

        # And the reservation actually blocks a concurrent writer.
        shadow: sa.Table = version_class(TableColumn).__table__
        with db.engine.connect() as writer:

            def _attempt_concurrent_delete() -> None:
                with writer.begin():
                    writer.exec_driver_sql("PRAGMA busy_timeout = 300")
                    writer.execute(
                        sa.delete(shadow).where(
                            shadow.c.id == column.id,
                            shadow.c.end_transaction_id.isnot(None),
                        )
                    )

            with pytest.raises(sa.exc.OperationalError):
                _attempt_concurrent_delete()
        db.session.rollback()

    def test_sqlite_snapshot_connection_holds_a_real_read_transaction(
        self,
    ) -> None:
        """M2: on SQLite the snapshot helper must own a REAL read
        transaction — pysqlite's legacy mode emits no BEGIN for SELECTs,
        so without the helper's explicit BEGIN a concurrent writer could
        commit between get_version's parent and child reads. Protection
        shows as either the writer blocking (read lock held) or the
        second read still agreeing with the first (stable snapshot)."""
        if db.engine.dialect.name != "sqlite":
            pytest.skip("exercises the pysqlite legacy-BEGIN recipe")
        # pylint: disable=import-outside-toplevel
        from superset.versioning.queries import _snapshot_read_connection

        self._two_version_dataset()
        db.session.commit()

        shadow: sa.Table = version_class(TableColumn).__table__
        count_stmt: sa.Select[tuple[int]] = sa.select(sa.func.count()).select_from(
            shadow
        )
        with _snapshot_read_connection() as conn:
            first: int | None = conn.execute(count_stmt).scalar()
            assert first
            writer_succeeded: bool = False
            try:
                with db.engine.connect() as writer:
                    with writer.begin():
                        writer.exec_driver_sql("PRAGMA busy_timeout = 500")
                        writer.execute(
                            sa.delete(shadow).where(
                                shadow.c.end_transaction_id.isnot(None)
                            )
                        )
                    writer_succeeded = True
            except sa.exc.OperationalError:
                pass  # blocked by our read lock: the transaction is real
            second: int | None = conn.execute(count_stmt).scalar()
        assert (not writer_succeeded) or first == second, (
            "a concurrent commit changed what the snapshot connection sees "
            "mid-transaction — no real read transaction is being held"
        )

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
        dataset: SqlaTable
        column: TableColumn
        target_tx: int
        before: str
        dataset, column, target_tx, before = self._two_version_dataset()
        assert column.description != before
        parent_target_description: str = dataset.description.removesuffix("_v2")
        assert _delete_column_shadow_rows(column.id, closed_only=True) >= 1

        with patch("superset.versioning.restore._verify_child_history_complete"):
            result: RestoreResult | None = restore_version(
                SqlaTable, dataset.uuid, target_tx, entity=dataset
            )

        assert result is not None
        db.session.flush()
        # Parent reverted to the target state...
        assert dataset.description == parent_target_description
        # ...but the column is GONE from the live set: incomplete write.
        assert db.session.get(TableColumn, column.id) is None
        db.session.rollback()

    def test_intact_history_restores_as_before(self) -> None:
        dataset: SqlaTable
        column: TableColumn
        target_tx: int
        before: str
        dataset, column, target_tx, before = self._two_version_dataset()

        result: RestoreResult | None = restore_version(
            SqlaTable, dataset.uuid, target_tx, entity=dataset
        )

        assert result is not None
        db.session.flush()
        refreshed: TableColumn | None = db.session.get(TableColumn, column.id)
        assert refreshed is not None
        assert refreshed.description == before
        db.session.rollback()

    def test_refusal_happens_before_any_write(self) -> None:
        """M3 remainder: the refusal precedes the write phase entirely.

        Asserted BEFORE any rollback: the write phase (single_flush_scope
        + reverter) is never entered, the ORM has no pending entity
        changes, and parent/column state is untouched — so the guard
        cannot be a rolled-back partial write in disguise.
        The deliberate Core shadow DELETE is pending in this transaction;
        it is not represented by the ORM's session.deleted collection.
        """
        dataset: SqlaTable
        column: TableColumn
        target_tx: int
        dataset, column, target_tx, _ = self._two_version_dataset()
        edited_description: str | None = column.description
        parent_description: str | None = dataset.description
        assert _delete_column_shadow_rows(column.id, closed_only=True) >= 1

        with patch(
            "superset.versioning.restore.single_flush_scope",
            side_effect=AssertionError("write phase entered before refusal"),
        ):
            with pytest.raises(PrunedChildHistoryError):
                restore_version(SqlaTable, dataset.uuid, target_tx, entity=dataset)

        # No rollback yet: ORM pending state must already be clean.
        assert not db.session.new
        assert not db.session.deleted
        dirty: list[Any] = [
            obj for obj in db.session.dirty if db.session.is_modified(obj)
        ]
        assert not dirty
        assert dataset.description == parent_description
        assert column.description == edited_description
        db.session.rollback()

    def test_sqlite_reservation_contention_maps_to_the_command_failure(
        self,
    ) -> None:
        """Reservation contention must surface as the command's failure
        type (→ endpoint 422), not a raw sqlite3.OperationalError: BEGIN
        IMMEDIATE goes through the SQLAlchemy connection so exception
        translation applies, and @transaction wraps only SQLAlchemy
        errors."""
        # pylint: disable=import-outside-toplevel
        from superset import security_manager
        from superset.commands.dataset.exceptions import DatasetUpdateFailedError
        from superset.commands.dataset.restore_version import (
            RestoreDatasetVersionCommand,
        )
        from superset.utils.core import override_user
        from superset.versioning.queries import list_versions

        if db.engine.dialect.name != "sqlite":
            pytest.skip("exercises the SQLite write-reservation contention path")

        dataset: SqlaTable
        target_tx: int
        dataset, _, target_tx, _ = self._two_version_dataset()
        dataset_uuid: UUID = dataset.uuid
        versions: list[dict[str, Any]] | None = list_versions(
            SqlaTable, dataset_uuid, entity=dataset
        )
        assert versions is not None
        target_entry: dict[str, Any] = next(
            v for v in versions if v["transaction_id"] == target_tx
        )
        admin: User | None = self.get_user("admin") or security_manager.add_user(
            "admin",
            "admin",
            "user",
            "admin@fab.org",
            security_manager.find_role("Admin"),
            password="general",  # noqa: S106 — test-only fixture credential
        )
        db.session.commit()  # release this session's own locks first
        # Keep the command's reservation attempt from waiting out the
        # default busy timeout.
        db.session.connection().exec_driver_sql("PRAGMA busy_timeout = 300")

        with db.engine.connect() as writer:
            writer.exec_driver_sql("BEGIN IMMEDIATE")  # hold the write lock
            try:
                with override_user(admin):
                    with pytest.raises(DatasetUpdateFailedError) as excinfo:
                        RestoreDatasetVersionCommand(
                            dataset_uuid, target_entry["version_uuid"]
                        ).run()
            finally:
                writer.rollback()

        # The translated SQLAlchemy error rides the failure's cause chain.
        cause: BaseException | None = excinfo.value.__cause__
        assert isinstance(cause, sa.exc.OperationalError), cause

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
        dataset: SqlaTable = _birth_names()

        added: TableColumn = TableColumn(
            column_name="sc120012_doomed", type="VARCHAR(10)"
        )
        dataset.columns.append(added)
        dataset.description = f"{dataset.description or ''}_with_doomed"
        db.session.commit()
        target_tx: int = _latest_parent_tx(dataset)
        added_id: int = added.id

        db.session.delete(added)
        dataset.description = f"{dataset.description}_doomed_gone"
        db.session.commit()

        # Prune the ENTIRE chain (insert row, closed rows, delete row).
        assert _delete_column_shadow_rows(added_id, closed_only=False) >= 1

        result: RestoreResult | None = restore_version(
            SqlaTable, dataset.uuid, target_tx, entity=dataset
        )

        assert result is not None
        db.session.flush()
        # The column existed at target_tx but is NOT restored — the
        # documented fail-open residual.
        assert all(col.id != added_id for col in dataset.columns)
        db.session.rollback()

    def test_foreign_id_reuse_does_not_refuse_the_restore(self) -> None:
        """#44251 CI regression: a deleted column whose integer id was
        recycled to ANOTHER dataset closes this parent's terminal DELETE
        shadow at the foreign INSERT's tx (Continuum's validity strategy
        closes by pk across parents). The verifier must read that closure
        as provable absence — not as a pruned re-birth — or every restore
        of the original dataset refuses forever after routine id reuse
        (SQLite reuses freed ids; MySQL reuses max(id)+1 after the top
        row is deleted)."""
        dataset: SqlaTable
        column: TableColumn
        target_tx: int
        dataset, column, target_tx, _ = self._two_version_dataset()

        # Remove a column and take a post-delete snapshot point.
        removed_id: int = dataset.columns[-1].id
        db.session.delete(dataset.columns[-1])
        dataset.description = f"{dataset.description}_col_removed"
        db.session.commit()
        dataset.description = f"{dataset.description}_snapshot"
        db.session.commit()
        target_tx = _latest_parent_tx(dataset)

        # Simulate the id being recycled to another dataset: close this
        # parent's terminal DELETE row at a foreign tx and plant the
        # foreign parent's surviving INSERT row at exactly that tx —
        # the shape Continuum's cross-parent validity closure produces.
        shadow: sa.Table = version_class(TableColumn).__table__
        tx_tbl: sa.Table = versioning_manager.transaction_cls.__table__
        foreign_tx: int = db.session.execute(
            tx_tbl.insert().values(issued_at=sa.func.now(), user_id=None)
        ).inserted_primary_key[0]
        db.session.execute(
            sa.update(shadow)
            .where(
                shadow.c.id == removed_id,
                shadow.c.table_id == dataset.id,
                shadow.c.operation_type == 2,
            )
            .values(end_transaction_id=foreign_tx)
        )
        db.session.execute(
            shadow.insert().values(
                id=removed_id,
                table_id=dataset.id + 999_999,  # a different parent
                column_name="recycled",
                transaction_id=foreign_tx,
                end_transaction_id=None,
                operation_type=0,
            )
        )
        db.session.commit()

        # Target AFTER the foreign closer, so the deleted child's interval
        # no longer covers it. Remove the foreign incarnation as a purge
        # would: the original parent's proof must not require a witness.
        dataset.description = f"{dataset.description}_after_foreign_closer"
        db.session.commit()
        target_tx = _latest_parent_tx(dataset)
        assert target_tx > foreign_tx
        db.session.execute(
            sa.delete(shadow).where(
                shadow.c.id == removed_id,
                shadow.c.table_id == dataset.id + 999_999,
            )
        )
        db.session.commit()

        result: RestoreResult | None = restore_version(
            SqlaTable, dataset.uuid, target_tx, entity=dataset
        )

        assert result is not None
        db.session.flush()
        assert all(child.id != removed_id for child in dataset.columns)
        db.session.rollback()
