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
"""sc-120050: real-database proof for the FOR SHARE validator read.

The statement-shape pins live in
tests/unit_tests/versioning/test_version_info_locking.py; the MySQL
REPEATABLE READ staleness itself cannot flip on Postgres (READ COMMITTED
takes a fresh snapshot per statement) and needs an interleaved read view
to reproduce on MySQL, so -- mirroring the honest-scope precedent of the
entity-lock fix -- these tests prove the locking read executes correctly
against a real backend and agrees with the plain read on the quiet path.
"""

import pytest

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
    def _versioned_chart(self) -> Slice:
        """A chart with at least one version row (a real committed save)."""
        chart = db.session.query(Slice).filter(Slice.slice_name == "Boys").one()
        chart.description = "sc-120050 probe"
        db.session.commit()
        return chart

    def test_for_share_read_agrees_with_plain_read_on_quiet_path(self) -> None:
        """Without concurrent writers both reads name the same live row,
        and the FOR SHARE clause executes on the real backend (the
        dialect-syntax half of the guard the unit pins cannot cover)."""
        chart = self._versioned_chart()
        try:
            plain = VersionDAO.current_live_transaction_id(Slice, chart.id, chart.uuid)
            locked = VersionDAO.current_live_transaction_id_for_share(
                Slice, chart.id, chart.uuid
            )
            assert plain is not None
            assert locked == plain

            info = current_entity_version_info(
                Slice, chart.id, chart.uuid, lock_for_stale_check=True
            )
            assert info.transaction_id == plain
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).get(chart.id)
            chart.description = None
            db.session.commit()
