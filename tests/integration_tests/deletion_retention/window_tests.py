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
"""Integration coverage for the per-workspace retention window."""

from __future__ import annotations

from unittest.mock import patch

from flask import current_app

from superset.commands.deletion_retention.window import resolve_retention_window
from superset.key_value.shared_entries import get_shared_value, upsert_shared_value
from superset.key_value.types import SharedKey
from superset.models.slice import Slice
from superset.tasks.deletion_retention import _purge_impl, purge_soft_deleted

from ._base import DeletionRetentionTestBase


class TestRetentionWindow(DeletionRetentionTestBase):
    def tearDown(self) -> None:
        # clear any shared window value this test set so the env default is
        # restored for other tests
        from uuid import uuid3

        from superset import db
        from superset.daos.key_value import KeyValueDAO
        from superset.key_value.shared_entries import RESOURCE
        from superset.key_value.utils import get_uuid_namespace

        try:
            KeyValueDAO.delete_entry(
                RESOURCE,
                uuid3(get_uuid_namespace(""), SharedKey.SOFT_DELETE_RETENTION_DAYS),
            )
            db.session.commit()
        except Exception:  # pylint: disable=broad-except
            db.session.rollback()
        super().tearDown()

    def test_shared_value_overrides_env_and_is_used_by_task(self) -> None:
        """A per-workspace shared value takes
        precedence over the env default and is honored by the purge."""
        upsert_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS, 10)
        assert resolve_retention_window() == 10

        # 20 days old: still inside the env default (30) but past the 10-day
        # per-workspace override, so the override is what gets it purged
        chart = self.make_chart("c")
        chart_id = chart.id
        self.soft_delete(chart, days_ago=20)

        with (
            patch(
                "superset.tasks.deletion_retention.feature_flag_manager."
                "is_feature_enabled",
                return_value=True,
            ),
            patch.dict(
                current_app.config,
                {"SUPERSET_SOFT_DELETE_PURGE_DRY_RUN": False},
            ),
        ):
            result: dict[str, object] = purge_soft_deleted.run()

        assert result["purged"] == {"slices": 1}
        assert not self.exists(Slice, chart_id)

    def test_upsert_is_idempotent(self) -> None:
        """Re-setting the window via upsert does not raise and keeps the
        latest value (the CLI uses upsert, not the non-idempotent set)."""
        upsert_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS, 15)
        upsert_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS, 20)
        assert get_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS) == 20
        assert resolve_retention_window() == 20

    def test_zero_disables(self) -> None:
        """A zero shared value disables the time-based purge."""
        upsert_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS, 0)
        chart = self.make_chart("c")
        chart_id = chart.id
        self.soft_delete(chart, days_ago=90)

        assert _purge_impl(resolve_retention_window(), dry_run=False) == {"skipped": 1}
        assert self.exists(Slice, chart_id)
