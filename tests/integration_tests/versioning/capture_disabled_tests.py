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

When capture is off, a real save MUST write **zero** ``version_transaction``
rows, **zero** ``*_version`` shadow rows, and **zero** ``version_changes``
records — Continuum is wired at import (``make_versioned()``), so the gate
has to make every write path inert.

This test toggles ``versioning_manager.options['versioning']`` — the single
master switch that Continuum's row-creating path (``make_versions``) and the
custom baseline listener both gate on — rather than detaching/re-attaching
Continuum's listeners. Flipping the option produces the identical zero-rows
result without mutating the process-global SQLAlchemy listener *registration*
or *ordering*; an earlier version detached and re-attached the listeners,
which reordered Continuum's ``before_flush`` relative to the custom listeners
and leaked broken capture state into other tests sharing the process.

The production off-path (``init_versioning`` with
``ENABLE_VERSIONING_CAPTURE=False``) both flips this option off *and* detaches
the listeners as belt-and-suspenders; that detach is covered structurally by
``tests/unit_tests/initialization_test.py::TestInitVersioning``. Here we prove
the behavioral contract (off → nothing written) and, via the capture-on
control, that the assertions are not vacuously true.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

import pytest
import sqlalchemy as sa
from sqlalchemy_continuum import version_class, versioning_manager

from superset.extensions import db
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


def _version_changes_count() -> int:
    """Total rows in the ``version_changes`` table — the custom diff records,
    distinct from Continuum's shadow rows. Proves the full capture pipeline
    (not just Continuum) ran."""
    return (
        db.session.execute(sa.text("SELECT COUNT(*) FROM version_changes")).scalar()
        or 0
    )


@contextmanager
def _capture_disabled() -> Iterator[None]:
    """Disable version capture for the duration of the block by flipping the
    Continuum master switch off, restoring it on exit.

    This is the same option both ``make_versions`` (Continuum's row writer)
    and the baseline listener gate on, so within the block every save is
    inert. Restoring it in ``finally`` keeps the suite (which runs with
    capture on) unaffected — and because we never touch listener
    registration, there is no global ordering to corrupt for other tests.
    """
    previous = versioning_manager.options["versioning"]
    versioning_manager.options["versioning"] = False
    try:
        yield
    finally:
        versioning_manager.options["versioning"] = previous


class TestVersioningCaptureDisabled(SupersetTestCase):
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_capture_off_writes_no_version_or_transaction_rows(self) -> None:
        """With capture off, a real content change MUST write neither a shadow
        row, a ``version_transaction`` row, nor a ``version_changes`` record."""
        db.session.commit()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        assert chart is not None
        chart_id = chart.id

        self.login(ADMIN_USERNAME)

        try:
            with _capture_disabled():
                tx_before = _transaction_row_count()
                ver_before = _slice_version_count(chart_id)
                changes_before = _version_changes_count()

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
                assert _version_changes_count() == changes_before, (
                    "capture off MUST write zero version_changes records"
                )
        finally:
            # Restore the chart name (capture is back on outside the block).
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls"})

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_control_capture_on_writes_version_and_change_rows(self) -> None:
        """Control: with capture on (the suite default), the same edit DOES
        mint a shadow row AND a ``version_changes`` record — proving the
        disabled-path assertions are not vacuously true and that the full
        capture pipeline (Continuum shadow rows + the custom change-record
        listener) runs end-to-end, not just Continuum's own writes."""
        db.session.commit()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        if chart is None:  # birth_names fixture not loaded for this test
            pytest.skip("Boys slice not present")
        chart_id = chart.id

        self.login(ADMIN_USERNAME)
        # ``>`` rather than ``== before + 1``: the first edit to a not-yet-
        # versioned entity also mints a synthetic baseline shadow row.
        ver_before = _slice_version_count(chart_id)
        changes_before = _version_changes_count()
        try:
            rv = self.client.put(
                f"/api/v1/chart/{chart_id}",
                json={"slice_name": "capture-on-renamed"},
            )
            assert rv.status_code == 200, rv.data
            db.session.expire_all()
            assert _slice_version_count(chart_id) > ver_before, (
                "capture on MUST write at least one shadow row"
            )
            assert _version_changes_count() > changes_before, (
                "capture on MUST write at least one version_changes record"
            )
        finally:
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Boys"})
