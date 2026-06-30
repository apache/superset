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
"""Unit tests for the deletion-retention window resolution (sc-111185).

Covers FR-PURGE-004/005: shared value overrides env, unset falls back to env,
``0`` is preserved (disable) and never coerced via ``or``, and a malformed
shared value is rejected in favor of the fallback.
"""

from unittest.mock import patch

import pytest


@pytest.fixture
def app_config(app_context):
    from flask import current_app

    current_app.config["SUPERSET_SOFT_DELETE_RETENTION_DAYS"] = 30
    return current_app.config


def _resolve():
    from superset.commands.deletion_retention.window import resolve_retention_window

    return resolve_retention_window()


def test_unset_falls_back_to_env(app_config) -> None:
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=None,
    ):
        assert _resolve() == 30


def test_shared_value_overrides_env(app_config) -> None:
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=7,
    ):
        assert _resolve() == 7


def test_zero_shared_value_is_preserved_not_coerced(app_config) -> None:
    # `0` is a meaningful "disable"; it must survive (never `or`-coerced to 30).
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=0,
    ):
        assert _resolve() == 0


def test_malformed_shared_value_falls_back(app_config) -> None:
    for bad in ("oops", -3, True, 1.5):
        with patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=bad,
        ):
            assert _resolve() == 30


def test_window_zero_disables_the_task(app_context) -> None:
    # FR-PURGE-005: a 0 window short-circuits the purge entirely.
    import superset.tasks.deletion_retention as mod

    with patch.object(mod, "_soft_delete_models") as models:
        result = mod._purge_impl(0, dry_run=False)
    assert result == {"skipped": 1}
    models.assert_not_called()


def test_clock_uses_now_not_utcnow() -> None:
    # FR-PURGE-002 / C6: the cutoff is computed from now(), matching the clock
    # the soft-delete substrate writes deleted_at with — not utcnow().
    import inspect

    import superset.tasks.deletion_retention as mod

    src = inspect.getsource(mod._purge_impl)
    assert "datetime.now()" in src
    assert "datetime.utcnow()" not in src
