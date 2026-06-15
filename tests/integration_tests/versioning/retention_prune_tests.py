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
"""Integration coverage for version-history retention pruning.

Exercises ``superset.tasks.version_history_retention`` end-to-end against
a real database: that an aged-out transaction's shadow rows are pruned
while the live row is always preserved, and that the SERIALIZABLE pass
retries on transient serialization failures and gives up after the cap.
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.models.dashboard import Dashboard
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _get_version_rows(dashboard: Dashboard) -> list[Any]:
    ver_cls = version_class(Dashboard)
    return (
        db.session.query(ver_cls)
        .filter(ver_cls.id == dashboard.id)
        .order_by(ver_cls.transaction_id.asc())
        .all()
    )


def _persist_fixture_state() -> None:
    """Force the fixture's pending INSERTs to commit in their own transaction.

    The birth_names fixture stages charts and the dashboard via session.add()
    but does not commit. Without this, the test's first commit batches the
    INSERTs and UPDATEs into the same Continuum transaction, causing the
    existing version row to be updated in place instead of a new one being
    created.
    """
    db.session.commit()


class TestDashboardVersionRetention(SupersetTestCase):
    """Retention pruning drops shadow rows older than
    ``SUPERSET_VERSION_HISTORY_RETENTION_DAYS`` while preserving live rows."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_retention_prunes_old_rows(self) -> None:
        """``prune_old_versions`` removes shadow rows whose owning
        ``version_transaction.issued_at`` is older than the retention
        window, while preserving the live row and the baseline."""
        from datetime import datetime, timedelta

        import sqlalchemy as sa

        from superset.extensions import db as _db
        from superset.tasks.version_history_retention import (
            _prune_old_versions_impl,
        )

        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None

        original_title = dashboard.dashboard_title

        try:
            # Force a few saves so we have ≥ 2 closed shadow rows plus
            # a baseline plus the live row.
            for i in range(3):
                dashboard.dashboard_title = f"USA Births Names retention test {i}"
                db.session.commit()

            rows_before = _get_version_rows(dashboard)
            assert len(rows_before) >= 3, "Expected at least 3 version rows"

            # Backdate every version_transaction row by 100 days so the
            # prune sees them as old. Skip baseline+live rows; the prune
            # itself preserves them.
            from sqlalchemy_continuum import versioning_manager

            tx_table = versioning_manager.transaction_cls.__table__
            with _db.engine.begin() as conn:
                conn.execute(
                    sa.update(tx_table).values(
                        issued_at=datetime.utcnow() - timedelta(days=100)
                    )
                )

            stats = _prune_old_versions_impl(retention_days=30)
            assert stats.get("pruned_transactions", 0) >= 1, stats

            rows_after = _get_version_rows(dashboard)
            # Live row must still exist (this is the only preservation rule)
            live_rows = [r for r in rows_after if r.end_transaction_id is None]
            assert len(live_rows) >= 1, "Live row must never be pruned"
            # Some rows should have been pruned. Closed historical rows —
            # including the synthetic baseline (operation_type=0) — are
            # subject to retention like everything else.
            assert len(rows_after) < len(rows_before), (
                f"Expected fewer rows after prune; before={len(rows_before)} "
                f"after={len(rows_after)}"
            )

        finally:
            dashboard.dashboard_title = original_title
            db.session.commit()

    def test_retention_retries_on_serialization_failure(self) -> None:
        """A transient ``OperationalError`` from the SERIALIZABLE pass
        triggers an inline retry; the prune completes on the second
        attempt and the stats dict records the retry count."""
        from datetime import datetime, timedelta
        from unittest.mock import patch

        import sqlalchemy as sa
        from sqlalchemy.exc import OperationalError

        from superset.tasks import version_history_retention
        from superset.tasks.version_history_retention import (
            _prune_old_versions_impl,
        )

        # Backdate transactions so the prune has work to do.
        _persist_fixture_state()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        original_title = dashboard.dashboard_title
        try:
            for i in range(3):
                dashboard.dashboard_title = f"USA Births Names retry test {i}"
                db.session.commit()

            from sqlalchemy_continuum import versioning_manager

            tx_table = versioning_manager.transaction_cls.__table__
            from superset.extensions import db as _db

            with _db.engine.begin() as conn:
                conn.execute(
                    sa.update(tx_table).values(
                        issued_at=datetime.utcnow() - timedelta(days=100)
                    )
                )

            original_run = version_history_retention._run_prune_pass
            calls: list[int] = []

            def flaky_run(*args: Any, **kwargs: Any) -> dict[str, Any]:
                calls.append(1)
                if len(calls) == 1:
                    raise OperationalError(
                        "SELECT 1", {}, Exception("could not serialize access")
                    )
                return original_run(*args, **kwargs)

            with patch.object(
                version_history_retention, "_run_prune_pass", side_effect=flaky_run
            ):
                # Patch sleep so the test doesn't actually wait through
                # the backoff.
                with patch.object(version_history_retention.time, "sleep"):
                    stats = _prune_old_versions_impl(retention_days=30)

            assert len(calls) == 2, (
                f"Expected 2 _run_prune_pass calls (1 failure + 1 retry), "
                f"got {len(calls)}"
            )
            assert stats.get("retried") == 1, stats
            assert stats.get("pruned_transactions", 0) >= 1, stats
        finally:
            dashboard.dashboard_title = original_title
            db.session.commit()

    def test_retention_gives_up_after_max_attempts(self) -> None:
        """When every attempt hits ``OperationalError``, the function
        re-raises after the retry cap so the outer Celery wrapper logs
        + returns ``{"error": 1}``."""
        from unittest.mock import patch

        from sqlalchemy.exc import OperationalError

        from superset.tasks import version_history_retention
        from superset.tasks.version_history_retention import (
            _MAX_RETRY_ATTEMPTS,
            _prune_old_versions_impl,
        )

        def always_fail(*args: Any, **kwargs: Any) -> dict[str, Any]:
            raise OperationalError(
                "SELECT 1", {}, Exception("could not serialize access")
            )

        call_count = 0

        def counting_fail(*args: Any, **kwargs: Any) -> dict[str, Any]:
            nonlocal call_count
            call_count += 1
            return always_fail(*args, **kwargs)

        with patch.object(
            version_history_retention,
            "_run_prune_pass",
            side_effect=counting_fail,
        ):
            with patch.object(version_history_retention.time, "sleep"):
                with pytest.raises(OperationalError):
                    _prune_old_versions_impl(retention_days=30)

        assert call_count == _MAX_RETRY_ATTEMPTS, (
            f"Expected exactly {_MAX_RETRY_ATTEMPTS} attempts; got {call_count}"
        )
