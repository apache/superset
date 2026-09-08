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
"""sc-120014: the conditional-write lock refreshes the entity it locks.

Two-transaction behavioral proof for the ``lock_entity_for_update`` fix
(mechanism documented on the helper itself). The staleness is
*object-level* -- SQLAlchemy never refreshes an already-loaded entity from
a later plain SELECT -- so the first test fails before the fix on every
backend it runs on, not only on MySQL/InnoDB REPEATABLE READ where the
underlying row read is stale too; the second test is a quiet-path control.
SQLite is skipped: a second writer connection deadlocks against the open
read transaction instead of modelling a concurrent request. The
dialect-independent statement-shape pin lives in
tests/unit_tests/versioning/test_lock_entity.py.
"""

import gc
import weakref

import pytest
import sqlalchemy as sa

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.versioning.api_helpers import lock_entity_for_update
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _write_description_out_of_band(dataset_id: int, value: str | None) -> None:
    """Commit a description change through a second connection.

    A separate engine-level transaction stands in for the concurrent
    request: it commits between this session's entity load and its lock,
    exactly the window the fix closes. Core UPDATE (not ORM) so the write
    is invisible to the scoped session until something re-reads the row.
    """
    with db.engine.begin() as conn:
        conn.execute(
            sa.update(SqlaTable.__table__)
            .where(SqlaTable.__table__.c.id == dataset_id)
            .values(description=value)
        )


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestConditionalWriteLockRefresh(SupersetTestCase):
    """The locking read must surface concurrently committed state."""

    def _dataset(self) -> SqlaTable:
        return (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .one()
        )

    def _skip_on_sqlite(self) -> None:
        # SQLite serialises writers at the file level: the out-of-band
        # engine transaction would deadlock against this session's open
        # read transaction rather than model a concurrent request.
        if db.session.get_bind().dialect.name == "sqlite":
            pytest.skip("two-connection interleave is not expressible on SQLite")

    def test_lock_refreshes_entity_to_concurrently_committed_state(self) -> None:
        """A concurrent commit becomes visible once the lock is taken.

        A commit landing between the entity load and the lock must show on
        the loaded entity afterwards.

        Pre-fix, the id-only lock left ``dataset.description`` at the value
        loaded before the concurrent commit, and the update command's diff
        ran against that stale state — the silent-lost-update window this
        pins shut. The command path is exercised too: ``DatasetDAO.find_by_id``
        must hand back the refreshed identity-map instance rather than
        re-hydrating from a (possibly stale) plain read.
        """
        self._skip_on_sqlite()
        dataset = self._dataset()
        dataset_id = dataset.id
        original = dataset.description
        assert original != "committed by a concurrent request"

        try:
            _write_description_out_of_band(
                dataset_id, "committed by a concurrent request"
            )

            lock_entity_for_update(SqlaTable, dataset_id)

            assert dataset.description == "committed by a concurrent request"
            # Pins the coupling the fix relies on: BaseDAO._query only
            # re-hydrates under force_fetch, so the command's lookup returns
            # the refreshed object. If DatasetDAO ever flips force_fetch,
            # this catches the fix being silently undone.
            fetched = DatasetDAO.find_by_id(dataset_id)
            assert fetched is dataset
            assert fetched.description == "committed by a concurrent request"
        finally:
            # Release the row lock before restoring out-of-band.
            db.session.rollback()
            _write_description_out_of_band(dataset_id, original)

    def test_locked_entity_must_be_held_by_the_caller(self) -> None:
        """The helper returns the entity, and the caller must keep it alive.

        Two halves, mirroring the production PUT path (which loads nothing
        before the lock): held, the returned reference makes the command's
        ``DatasetDAO.find_by_id`` hand back the very same refreshed
        instance; discarded, the object is weakly referenced by the
        identity map and is collectible -- after which find_by_id would
        re-hydrate from a plain read (on MySQL REPEATABLE READ: the
        pre-lock snapshot), silently undoing the fix. That is why
        ``datasets/api.py`` binds the return value.
        """
        self._skip_on_sqlite()
        dataset_id = (
            db.session.query(SqlaTable.id)
            .filter(SqlaTable.table_name == "birth_names")
            .scalar()
        )

        try:
            locked = lock_entity_for_update(SqlaTable, dataset_id)
            assert locked is not None
            fetched = DatasetDAO.find_by_id(dataset_id)
            assert fetched is locked
        finally:
            db.session.rollback()

        try:
            still_held = lock_entity_for_update(SqlaTable, dataset_id)
            tracker = weakref.ref(still_held)
            del still_held, locked, fetched
            gc.collect()
            assert tracker() is None, (
                "locked entity survived without a caller-held reference; "
                "if SQLAlchemy starts pinning it, the hold-the-return "
                "contract (and this test) can be retired"
            )
        finally:
            db.session.rollback()

    def test_lock_is_a_no_op_refresh_without_concurrent_writes(self) -> None:
        """Quiet-path control: no interleaved commit, no observable change.

        The refresh only surfaces state that actually changed underneath
        the session; without a concurrent writer the entity is untouched
        and nothing is dirtied.
        """
        self._skip_on_sqlite()
        dataset = self._dataset()
        dataset_id = dataset.id
        original = dataset.description

        try:
            lock_entity_for_update(SqlaTable, dataset_id)

            assert dataset.description == original
            assert not db.session.dirty
        finally:
            db.session.rollback()
