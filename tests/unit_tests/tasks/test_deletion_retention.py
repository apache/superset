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
"""Unit tests for deletion-retention configuration and window resolution.

The shared value overrides config, an unset value falls back to config, ``0``
is preserved as the disable value, and malformed shared values use the fallback.
"""

import runpy
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask.config import Config


@pytest.fixture
def app_config(app_context: None) -> Config:
    from flask import current_app

    current_app.config["SUPERSET_SOFT_DELETE_RETENTION_DAYS"] = 30
    return current_app.config


def _resolve() -> int:
    from superset.commands.deletion_retention.window import resolve_retention_window

    return resolve_retention_window()


def test_unset_falls_back_to_config(app_config: Config) -> None:
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=None,
    ):
        assert _resolve() == 30


def test_shared_value_overrides_config(app_config: Config) -> None:
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=7,
    ):
        assert _resolve() == 7


def test_zero_shared_value_is_preserved_not_coerced(app_config: Config) -> None:
    # `0` is a meaningful "disable"; it must survive (never `or`-coerced to 30).
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=0,
    ):
        assert _resolve() == 0


def test_malformed_shared_value_falls_back(app_config: Config) -> None:
    for bad in ("oops", -3, True, 1.5):
        with patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=bad,
        ):
            assert _resolve() == 30


@pytest.mark.parametrize("configured", ["oops", -3, True, None])
def test_malformed_config_value_falls_back(
    app_config: Config, configured: object
) -> None:
    app_config["SUPERSET_SOFT_DELETE_RETENTION_DAYS"] = configured
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=None,
    ):
        assert _resolve() == 30


def test_window_zero_disables_the_task(app_context: None) -> None:
    # A zero window short-circuits the purge entirely.
    import superset.tasks.deletion_retention as mod

    with patch.object(mod, "_soft_delete_models") as models:
        result = mod._purge_impl(0, dry_run=False)
    assert result == {"skipped": 1}
    models.assert_not_called()


def test_clock_uses_now_not_utcnow() -> None:
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    now = datetime(2026, 7, 13, 12, 0)
    with (
        patch.object(mod, "datetime") as clock,
        patch.object(mod, "_soft_delete_models", return_value=[Slice]),
        patch.object(mod, "_purge_model", return_value=(0, 0, 0, 0)) as purge,
        patch.object(mod.audit, "reconcile_pending"),
    ):
        clock.now.return_value = now
        mod._purge_impl(30, dry_run=False)

    purge.assert_called_once_with(Slice, now - timedelta(days=30), False)


def test_default_config_is_safe() -> None:
    from superset import config

    assert config.SUPERSET_SOFT_DELETE_RETENTION_DAYS == 30
    assert config.SUPERSET_SOFT_DELETE_PURGE_DRY_RUN is True


def test_default_celery_config_registers_daily_purge() -> None:
    from superset import config

    assert "superset.tasks.deletion_retention" in config.CeleryConfig.imports
    entry: dict[str, Any] = config.CeleryConfig.beat_schedule[
        "deletion_retention.purge_soft_deleted"
    ]
    assert entry["task"] == "deletion_retention.purge_soft_deleted"
    assert entry["schedule"].minute == {0}
    assert entry["schedule"].hour == {0}


def test_docker_celery_config_registers_daily_purge() -> None:
    config_path = Path(__file__).parents[3] / "docker/pythonpath_dev/superset_config.py"
    with patch("flask_caching.backends.filesystemcache.FileSystemCache"):
        docker_config: dict[str, Any] = runpy.run_path(str(config_path))
    celery_config: type[Any] = docker_config["CeleryConfig"]

    assert "superset.tasks.deletion_retention" in celery_config.imports
    entry: dict[str, Any] = celery_config.beat_schedule[
        "deletion_retention.purge_soft_deleted"
    ]
    assert entry["task"] == "deletion_retention.purge_soft_deleted"
    assert entry["schedule"].minute == {0}
    assert entry["schedule"].hour == {0}


def test_purge_suppression_is_session_scoped() -> None:
    from superset.commands.deletion_retention.purge_cascade import (
        suppress_purge_association_versions,
    )

    existing = object()
    purge_statement = object()
    unit_of_work = MagicMock()
    unit_of_work.pending_statements = [existing]
    manager = MagicMock()
    manager.options = {"versioning": True, "native_versioning": False}
    manager.unit_of_work.return_value = unit_of_work
    session = MagicMock()

    with patch("sqlalchemy_continuum.versioning_manager", manager):
        with suppress_purge_association_versions(session):
            assert manager.options["versioning"] is True
            unit_of_work.pending_statements.append(purge_statement)

    assert unit_of_work.pending_statements == [existing]
    manager.unit_of_work.assert_called_once_with(session)


def test_purge_model_counts_only_committed_deletions(app_context: None) -> None:
    import superset.tasks.deletion_retention as mod
    from superset.commands.deletion_retention.purge_cascade import CascadeResult
    from superset.models.slice import Slice

    lost_race: CascadeResult = CascadeResult(
        purged=False, entity_type="chart", entity_uuid="lost-race"
    )
    with (
        patch.object(mod, "_iter_eligible_ids", return_value=[[1]]),
        patch.object(mod, "_purge_one", return_value=lost_race),
    ):
        result: tuple[int, int, int, int] = mod._purge_model(
            Slice, datetime.now(), dry_run=False
        )

    assert result == (0, 0, 0, 0)
