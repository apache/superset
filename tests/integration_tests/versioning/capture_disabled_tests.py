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
"""Behavioral proof for the versioning kill-switch / dark-launch contract.

``ENABLE_VERSIONING_CAPTURE=False`` MUST cause a real save to write
**zero** ``version_transaction`` rows and **zero** ``*_version`` shadow
rows — Continuum is wired at import (``make_versioned()``), so suppressing
only the custom listeners would leave Continuum's own listeners minting
empty transaction rows on every flush. ``init_versioning`` detaches those
via ``_remove_continuum_write_listeners()``; this test pins that the
*behavioral* result is genuinely nothing-written (the structural unit test
in ``initialization_test.py`` mocks the detach; this exercises it for real).

This is the acceptance gate for shipping versioning dark in the
base-infra rollout PR.
"""

from __future__ import annotations

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Mapper, Session
from sqlalchemy_continuum import version_class, versioning_manager

from superset.extensions import db
from superset.initialization import SupersetAppInitializer
from superset.models.slice import Slice
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _transaction_row_count() -> int:
    """Total rows in the shared ``version_transaction`` table."""
    return db.session.query(versioning_manager.transaction_cls).count()


def _slice_version_count(slice_id: int) -> int:
    ver_cls = version_class(Slice)
    return db.session.query(ver_cls).filter(ver_cls.id == slice_id).count()


def _reattach_continuum_write_listeners() -> None:
    """Inverse of ``init_versioning._remove_continuum_write_listeners`` so this
    test restores process-global SQLAlchemy event state for the rest of the
    suite. Idempotent on a representative listener."""
    if sa.event.contains(Mapper, "after_insert", versioning_manager.track_inserts):
        return  # already attached
    versioning_manager.track_operations(Mapper)
    versioning_manager.track_session(Session)
    sa.event.listen(
        Engine, "before_execute", versioning_manager.track_association_operations
    )
    sa.event.listen(Engine, "rollback", versioning_manager.clear_connection)
    sa.event.listen(
        Engine,
        "set_connection_execution_options",
        versioning_manager.track_cloned_connections,
    )


class TestVersioningCaptureDisabled(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_capture_off_writes_no_version_or_transaction_rows(self) -> None:
        """With Continuum's write listeners detached (the capture-off path),
        a real content change MUST write neither a shadow row nor a
        ``version_transaction`` row."""
        db.session.commit()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        assert chart is not None
        chart_id = chart.id

        self.login(ADMIN_USERNAME)

        # Simulate the ENABLE_VERSIONING_CAPTURE=False branch of init_versioning.
        SupersetAppInitializer._remove_continuum_write_listeners()
        try:
            tx_before = _transaction_row_count()
            ver_before = _slice_version_count(chart_id)

            rv = self.client.put(
                f"/api/v1/chart/{chart_id}",
                json={"slice_name": "capture-off-renamed"},
            )
            assert rv.status_code == 200, rv.data
            db.session.expire_all()

            assert _transaction_row_count() == tx_before, (
                "capture off MUST write zero version_transaction rows "
                f"(before={tx_before}, after={_transaction_row_count()})"
            )
            assert _slice_version_count(chart_id) == ver_before, (
                "capture off MUST write zero shadow rows "
                f"(before={ver_before}, after={_slice_version_count(chart_id)})"
            )
        finally:
            # Restore the chart and re-attach Continuum so the rest of the
            # suite runs with capture on.
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls"})
            _reattach_continuum_write_listeners()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_control_capture_on_does_write_a_version_row(self) -> None:
        """Control: with capture on (the suite default), the same edit DOES
        mint a shadow + transaction row — proves the disabled-path assertion
        above is not vacuously true."""
        db.session.commit()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        if chart is None:  # birth_names fixture not loaded for this test
            pytest.skip("Boys slice not present")
        chart_id = chart.id

        self.login(ADMIN_USERNAME)
        _reattach_continuum_write_listeners()  # ensure attached
        ver_before = _slice_version_count(chart_id)
        try:
            rv = self.client.put(
                f"/api/v1/chart/{chart_id}",
                json={"slice_name": "capture-on-renamed"},
            )
            assert rv.status_code == 200, rv.data
            db.session.expire_all()
            assert _slice_version_count(chart_id) == ver_before + 1
        finally:
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Boys"})
