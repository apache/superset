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
"""sc-120050: real-database proof for the locked validator read.

The statement-shape pins live in
tests/unit_tests/versioning/test_version_info_locking.py. These tests
prove the locking read executes correctly against a real backend,
agrees with the plain read on the quiet path, resolves the no-live-row
case the way the unversioned token path expects, and -- the pins that
actually exercise the bug -- that an interleaved competing commit is
INVISIBLE to the plain snapshot read while the locking read sees it, so
a stale If-Match token is accepted by the old path and rejected by the
new one.

The interleaved pins force REPEATABLE READ on the request session:
MySQL's staleness cannot flip under READ COMMITTED (a fresh snapshot per
statement), and CI pins the MySQL server to RC (``bashlib.sh``), so
without forcing it here a mutant that dropped ``with_for_update()``
would pass every lane. MySQL-only: PostgreSQL's RR raises a
serialization failure for a locking read of a concurrently updated row
instead of returning it -- a different, also-safe outcome.
"""

from uuid import UUID

import pytest
import sqlalchemy as sa
from sqlalchemy_continuum import version_class, versioning_manager
from sqlalchemy_continuum.operation import Operation

from superset import db
from superset.daos.version import VersionDAO
from superset.models.slice import Slice
from superset.utils.dates import naive_utcnow
from superset.versioning.api_helpers import (
    concurrency_token_from,
    current_entity_version_info,
    EntityVersionInfo,
)
from superset.versioning.baseline import CONTINUUM_BOOKKEEPING_COLUMNS
from superset.versioning.etag import raise_for_stale_write, StaleEntityError
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.test_app import app


def _commit_competing_version_out_of_band(
    chart_id: int, template: dict[str, object] | None = None
) -> int:
    """Commit a new live version row through a SECOND connection.

    Stands in for the concurrent request that wins the race: a separate
    engine-level transaction closes the current live shadow row and
    opens a new one, which is exactly the shape Continuum commits on a
    save. Core SQL (not the ORM) so the write is invisible to the
    request session until something re-reads -- and under REPEATABLE
    READ, a plain re-read does not see it at all.

    *template* supplies the content columns when no live shadow row
    survives (the zero-history transition); otherwise the current live
    row is copied.
    """
    ver_tbl: sa.Table = version_class(Slice).__table__
    tx_tbl: sa.Table = versioning_manager.transaction_cls.__table__
    with db.engine.begin() as conn:
        new_tx: int = conn.execute(
            tx_tbl.insert().values(issued_at=naive_utcnow(), user_id=None)
        ).inserted_primary_key[0]
        content: dict[str, object]
        if template is None:
            live: sa.RowMapping | None = (
                conn.execute(
                    sa.select(ver_tbl).where(
                        ver_tbl.c.id == chart_id,
                        ver_tbl.c.end_transaction_id.is_(None),
                    )
                )
                .mappings()
                .first()
            )
            assert live is not None, "fixture must leave a live shadow row"
            content = dict(live)
            conn.execute(
                sa.update(ver_tbl)
                .where(
                    ver_tbl.c.id == chart_id,
                    ver_tbl.c.end_transaction_id.is_(None),
                )
                .values(end_transaction_id=new_tx)
            )
        else:
            content = dict(template)
        conn.execute(
            ver_tbl.insert().values(
                **{
                    key: value
                    for key, value in content.items()
                    if key not in CONTINUUM_BOOKKEEPING_COLUMNS
                },
                transaction_id=new_tx,
                end_transaction_id=None,
                operation_type=Operation.UPDATE,
            )
        )
    return new_tx


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestConditionalTokenLockingRead(SupersetTestCase):
    def _versioned_chart(self) -> tuple[Slice, str | None]:
        """A chart with at least one version row (a real committed save)."""
        chart: Slice = db.session.query(Slice).filter(Slice.slice_name == "Boys").one()
        # The example fixture stages INSERTs; commit them before the UPDATE
        # so the version under test represents a separate committed save.
        db.session.commit()
        original: str | None = chart.description
        chart.description = "sc-120050 probe"
        db.session.commit()
        return chart, original

    def _restore(self, chart_id: int, original: str | None) -> None:
        db.session.rollback()
        chart: Slice | None = db.session.get(Slice, chart_id)
        assert chart is not None
        chart.description = original
        db.session.commit()

    def test_locked_read_agrees_with_plain_read_on_quiet_path(self) -> None:
        """Without concurrent writers both reads name the same live row,
        and the locking clause executes on the real backend (the
        dialect-syntax half of the guard the unit pins cannot cover)."""
        chart: Slice
        original: str | None
        chart, original = self._versioned_chart()
        try:
            plain: int | None = VersionDAO.current_live_transaction_id(
                Slice, chart.id, chart.uuid
            )
            locked: int | None = VersionDAO.current_live_transaction_id_locked(
                Slice, chart.id, chart.uuid
            )
            assert plain is not None
            assert locked == plain

            info: EntityVersionInfo = current_entity_version_info(
                Slice, chart.id, chart.uuid, lock_for_stale_check=True
            )
            assert info.transaction_id == plain
        finally:
            self._restore(chart.id, original)

    def test_no_live_row_resolves_to_none_under_lock(self) -> None:
        """The zero-live-row branch (lazy baselines) stays well-behaved.

        An entity whose version rows are gone (or never existed --
        baselines are written lazily) must yield None from the locked
        read, so current_entity_version_info reports no version_uuid and
        the guard falls back to the unversioned token, exactly as the
        plain path does. This is also the branch where MySQL takes a gap
        lock (see current_live_transaction_id_locked's residual note).
        """
        chart: Slice
        original: str | None
        chart, original = self._versioned_chart()
        try:
            db.session.execute(
                sa.text("DELETE FROM slices_version WHERE id = :id"),
                {"id": chart.id},
            )
            db.session.commit()

            locked: int | None = VersionDAO.current_live_transaction_id_locked(
                Slice, chart.id, chart.uuid
            )
            assert locked is None

            info: EntityVersionInfo = current_entity_version_info(
                Slice, chart.id, chart.uuid, lock_for_stale_check=True
            )
            assert info.version_uuid is None
            assert info.entity_uuid == chart.uuid
        finally:
            self._restore(chart.id, original)

    def _skip_unless_mysql(self) -> None:
        """The staleness under test is MySQL-REPEATABLE-READ-specific."""
        if db.session.get_bind().dialect.name != "mysql":
            pytest.skip("interleaved snapshot staleness is MySQL-RR-specific")

    def _force_repeatable_read(self) -> None:
        """Open a fresh REPEATABLE READ transaction on the request session.

        CI pins the MySQL server itself to READ COMMITTED
        (``bashlib.sh``), so the isolation has to be forced per-session
        or the pin proves nothing. Call this only when nothing is pending
        on the session: the rollback that starts the new transaction
        would otherwise discard uncommitted fixture state (the
        birth_names fixture stages its rows without committing).
        """
        db.session.rollback()
        db.session.connection(execution_options={"isolation_level": "REPEATABLE READ"})

    def test_locking_read_sees_the_interleaved_commit_the_snapshot_misses(
        self,
    ) -> None:
        """The bug, end to end: v1's token must not survive v2's commit.

        Writer A commits a competing version between this request's read
        view opening and its validator read. Under REPEATABLE READ the
        plain read is served from the pre-commit snapshot and still
        names v1 -- so the client's stale If-Match token MATCHES and the
        update proceeds, silently clobbering A (the lost update this PR
        exists to stop). The locking read is snapshot-exempt, derives
        v2's token, and the same stale token is rejected.
        """
        self._skip_unless_mysql()
        # v1 is committed BEFORE the read view opens: the fixture's rows
        # and this save must both be visible to the snapshot the test
        # then pins.
        chart: Slice
        original: str | None
        chart, original = self._versioned_chart()
        chart_id: int = chart.id
        chart_uuid: UUID = chart.uuid
        try:
            self._force_repeatable_read()
            # Opening the read view: this first consistent read is what
            # MySQL pins every later plain read in the transaction to.
            v1: int | None = VersionDAO.current_live_transaction_id(
                Slice, chart_id, chart_uuid
            )
            assert v1 is not None
            stale_info: EntityVersionInfo = current_entity_version_info(
                Slice, chart_id, chart_uuid
            )
            stale_token: str | None = concurrency_token_from(stale_info)
            assert stale_token is not None

            v2: int = _commit_competing_version_out_of_band(chart_id)
            assert v2 != v1

            # The snapshot has not moved...
            assert (
                VersionDAO.current_live_transaction_id(Slice, chart_id, chart_uuid)
                == v1
            ), "plain read left REPEATABLE READ; the pin below proves nothing"
            # ...but the locking read is exempt from it.
            assert (
                VersionDAO.current_live_transaction_id_locked(
                    Slice, chart_id, chart_uuid
                )
                == v2
            )

            fresh_info: EntityVersionInfo = current_entity_version_info(
                Slice, chart_id, chart_uuid, lock_for_stale_check=True
            )
            fresh_token: str | None = concurrency_token_from(fresh_info)
            assert fresh_token is not None
            assert fresh_token != stale_token

            # The client replays the token it read before A committed.
            with app.test_request_context(headers={"If-Match": f'"{stale_token}"'}):
                # Pre-PR path: accepted, and A's version is overwritten.
                raise_for_stale_write(stale_token)
                # Post-PR path: the locked validator rejects it.
                with pytest.raises(StaleEntityError):
                    raise_for_stale_write(fresh_token)
        finally:
            self._restore(chart_id, original)

    def test_first_version_transition_under_forced_repeatable_read(self) -> None:
        """Zero-history → first version: the same exemption must hold.

        The entity starts with no live version row (baselines are
        written lazily), so the request's snapshot resolves the
        unversioned token. Writer A then commits the entity's FIRST
        version row -- the branch where MySQL takes a gap lock on the
        empty range. The plain read still reports nothing; the locking
        read must surface the new row, so the unversioned token stops
        being accepted.
        """
        self._skip_unless_mysql()
        chart: Slice
        original: str | None
        chart, original = self._versioned_chart()
        chart_id: int = chart.id
        chart_uuid: UUID = chart.uuid
        ver_tbl: sa.Table = version_class(Slice).__table__
        try:
            template: sa.RowMapping | None = (
                db.session.execute(
                    sa.select(ver_tbl).where(
                        ver_tbl.c.id == chart_id,
                        ver_tbl.c.end_transaction_id.is_(None),
                    )
                )
                .mappings()
                .first()
            )
            assert template is not None
            content: dict[str, object] = dict(template)
            db.session.execute(
                sa.text("DELETE FROM slices_version WHERE id = :id"), {"id": chart_id}
            )
            db.session.commit()
            self._force_repeatable_read()

            assert (
                VersionDAO.current_live_transaction_id(Slice, chart_id, chart_uuid)
                is None
            )
            unversioned_info: EntityVersionInfo = current_entity_version_info(
                Slice, chart_id, chart_uuid
            )
            unversioned_token: str | None = concurrency_token_from(unversioned_info)
            assert unversioned_token is not None

            first_tx: int = _commit_competing_version_out_of_band(
                chart_id, template=content
            )

            assert (
                VersionDAO.current_live_transaction_id(Slice, chart_id, chart_uuid)
                is None
            ), "plain read left REPEATABLE READ; the pin below proves nothing"
            assert (
                VersionDAO.current_live_transaction_id_locked(
                    Slice, chart_id, chart_uuid
                )
                == first_tx
            )

            fresh_info: EntityVersionInfo = current_entity_version_info(
                Slice, chart_id, chart_uuid, lock_for_stale_check=True
            )
            fresh_token: str | None = concurrency_token_from(fresh_info)
            assert fresh_token is not None
            assert fresh_token != unversioned_token
            with app.test_request_context(
                headers={"If-Match": f'"{unversioned_token}"'}
            ):
                with pytest.raises(StaleEntityError):
                    raise_for_stale_write(fresh_token)
        finally:
            self._restore(chart_id, original)
