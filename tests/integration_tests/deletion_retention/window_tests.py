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

from typing import Any
from unittest.mock import patch

from flask import current_app

from superset.commands.deletion_retention.window import resolve_retention_window
from superset.key_value.shared_entries import get_shared_value, upsert_shared_value
from superset.key_value.types import SharedKey
from superset.models.slice import Slice
from superset.tasks.deletion_retention import _purge_impl, purge_soft_deleted
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME

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
                {"SOFT_DELETE_PURGE_DRY_RUN": False},
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


class TestRetentionWindowInBootstrap(DeletionRetentionTestBase):
    """The client bootstrap must carry the *effective* window, not the config
    seed, so the delete-confirmation modal cannot promise a recovery period
    the purge task will not honour."""

    def tearDown(self) -> None:
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

    def _conf(self) -> dict[str, Any]:
        from superset.views.base import cached_common_bootstrap_data

        # Deliberately the ``.uncached`` body rather than
        # common_bootstrap_payload(): the wrapper memoizes for 60s on
        # (user_id, locale) alone, and every test here is the same admin in the
        # same locale. Going through the cache, the first test's payload would
        # be served to the rest -- the branches under test all live *inside*
        # the memoized body and would never be re-evaluated. Clearing the cache
        # per test would also work where a cache backend is reachable, but ties
        # these assertions to Redis being up; calling the body directly is what
        # is actually under test.
        self.login(ADMIN_USERNAME)
        with self.client.application.test_request_context("/"):
            from flask import g

            user = self.get_user(ADMIN_USERNAME)
            g.user = user
            return cached_common_bootstrap_data.uncached(user.id, "en")["conf"]

    @with_feature_flags(SOFT_DELETE=True)
    def test_bootstrap_reports_the_runtime_override_not_the_config_seed(self) -> None:
        """A window set at runtime is what the UI is told."""
        upsert_shared_value(SharedKey.SOFT_DELETE_RETENTION_DAYS, 7)
        assert current_app.config["SOFT_DELETE_RETENTION_DAYS"] != 7

        assert self._conf()["SOFT_DELETE_RETENTION_DAYS"] == 7

    @with_feature_flags(SOFT_DELETE=True)
    def test_bootstrap_falls_back_to_config_when_no_override(self) -> None:
        assert (
            self._conf()["SOFT_DELETE_RETENTION_DAYS"]
            == current_app.config["SOFT_DELETE_RETENTION_DAYS"]
        )

    @with_feature_flags(SOFT_DELETE=False)
    def test_bootstrap_omits_the_window_when_the_feature_is_off(self) -> None:
        """No deployment pays for a lookup it cannot use."""
        assert "SOFT_DELETE_RETENTION_DAYS" not in self._conf()

    @with_feature_flags(SOFT_DELETE=True)
    def test_the_phantom_config_key_is_gone(self) -> None:
        """The key that never existed must not reappear: it silently produced
        None, which the UI read as 'no recovery window'."""
        assert "SUPERSET_SOFT_DELETE_RETENTION_DAYS" not in self._conf()
