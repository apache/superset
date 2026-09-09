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
tests/unit_tests/versioning/test_version_info_locking.py; the MySQL
REPEATABLE READ staleness itself cannot flip on Postgres (READ COMMITTED
takes a fresh snapshot per statement) and needs an interleaved read view
to reproduce on MySQL. So -- the same honest-scope approach the sibling
entity-lock PRs take -- these tests prove the locking read executes
correctly against a real backend, agrees with the plain read on the
quiet path, and resolves the no-live-row case the way the unversioned
token path expects.
"""

import pytest
import sqlalchemy as sa

from superset import db
from superset.daos.version import VersionDAO
from superset.models.slice import Slice
from superset.versioning.api_helpers import current_entity_version_info
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestConditionalTokenLockingRead(SupersetTestCase):
    def _versioned_chart(self) -> tuple[Slice, str | None]:
        """A chart with at least one version row (a real committed save)."""
        chart = db.session.query(Slice).filter(Slice.slice_name == "Boys").one()
        original = chart.description
        chart.description = "sc-120050 probe"
        db.session.commit()
        return chart, original

    def _restore(self, chart_id: int, original: str | None) -> None:
        db.session.rollback()
        chart = db.session.get(Slice, chart_id)
        assert chart is not None
        chart.description = original
        db.session.commit()

    def test_locked_read_agrees_with_plain_read_on_quiet_path(self) -> None:
        """Without concurrent writers both reads name the same live row,
        and the locking clause executes on the real backend (the
        dialect-syntax half of the guard the unit pins cannot cover)."""
        chart, original = self._versioned_chart()
        try:
            plain = VersionDAO.current_live_transaction_id(Slice, chart.id, chart.uuid)
            locked = VersionDAO.current_live_transaction_id_locked(
                Slice, chart.id, chart.uuid
            )
            assert plain is not None
            assert locked == plain

            info = current_entity_version_info(
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
        chart, original = self._versioned_chart()
        try:
            db.session.execute(
                sa.text("DELETE FROM slices_version WHERE id = :id"),
                {"id": chart.id},
            )
            db.session.commit()

            locked = VersionDAO.current_live_transaction_id_locked(
                Slice, chart.id, chart.uuid
            )
            assert locked is None

            info = current_entity_version_info(
                Slice, chart.id, chart.uuid, lock_for_stale_check=True
            )
            assert info.version_uuid is None
            assert info.entity_uuid == chart.uuid
        finally:
            self._restore(chart.id, original)
