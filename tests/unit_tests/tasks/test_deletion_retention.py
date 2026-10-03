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
is preserved as the disable value, and malformed supplied values defer purge.
"""

import runpy
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, ClassVar
from unittest.mock import ANY, call, MagicMock, patch
from uuid import UUID, uuid4

import pytest
import sqlalchemy as sa
from flask.config import Config
from sqlalchemy.orm import Mapped, mapped_column, registry, Session


@pytest.fixture
def app_config(app_context: None, monkeypatch: pytest.MonkeyPatch) -> Config:
    from flask import current_app

    current_app.config["SOFT_DELETE_RETENTION_DAYS"] = 30
    monkeypatch.setitem(current_app.config, "SOFT_DELETE_RETENTION_DAYS_FUNC", None)
    return current_app.config


def _resolve() -> int:
    from superset.commands.deletion_retention.window import resolve_retention_window

    return resolve_retention_window()


@pytest.mark.parametrize("days", [-1, 0, 30, 180, 360])
def test_host_policy_precedes_shared_override(app_config: Config, days: int) -> None:
    """An installed host policy is authoritative, including disabled/deferred zero."""
    app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: days
    shared: MagicMock
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value", return_value=7
    ) as shared:
        assert _resolve() == days
    shared.assert_not_called()


@pytest.mark.parametrize("value", [None, True, "360", -2, 36501])
def test_invalid_host_policy_defers_without_shared_fallback(
    app_config: Config, value: object
) -> None:
    """Malformed host results must not turn an outage into destructive fallback."""
    app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: value
    shared: MagicMock
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value", return_value=7
    ) as shared:
        assert _resolve() == 0
    shared.assert_not_called()


def test_host_policy_exception_defers_without_payload(
    app_config: Config, caplog: pytest.LogCaptureFixture
) -> None:
    """Callback failure skips purge without logging external error details."""
    app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = MagicMock(
        side_effect=RuntimeError("private-policy-payload")
    )
    shared: MagicMock
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value", return_value=7
    ) as shared:
        assert _resolve() == 0
    shared.assert_not_called()
    assert "host retention policy unavailable" in caplog.text
    assert "private-policy-payload" not in caplog.text


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


@pytest.mark.parametrize("shared", [None, -1])
def test_immediate_window_from_shared_or_config(
    app_config: Config, shared: int | None
) -> None:
    """Both standalone configuration sources preserve immediate eligibility."""
    app_config["SOFT_DELETE_RETENTION_DAYS"] = -1
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=shared,
    ):
        assert _resolve() == -1


@pytest.mark.parametrize("source", ["config", "shared"])
@pytest.mark.parametrize("value", ["oops", "", -2, -3, True, False, 1.5])
def test_malformed_standalone_window_defers_purge(
    app_config: Config, source: str, value: object
) -> None:
    """Malformed supplied windows never fall through to destructive defaults."""
    import superset.tasks.deletion_retention as mod

    app_config["SOFT_DELETE_RETENTION_DAYS"] = value if source == "config" else 30
    app_config["SOFT_DELETE_PURGE_DRY_RUN"] = False
    models: MagicMock
    reconcile: MagicMock
    with (
        patch.object(mod.feature_flag_manager, "is_feature_enabled", return_value=True),
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=value if source == "shared" else None,
        ),
        patch.object(mod, "_soft_delete_models") as models,
        patch.object(mod.audit, "reconcile_pending") as reconcile,
    ):
        assert mod.purge_soft_deleted.run() == {"skipped": 1}
    models.assert_not_called()
    reconcile.assert_not_called()


def test_explicit_none_config_defers_purge(app_config: Config) -> None:
    """Only an absent config setting uses the default retention window."""
    app_config["SOFT_DELETE_RETENTION_DAYS"] = None
    with patch(
        "superset.commands.deletion_retention.window.get_shared_value",
        return_value=None,
    ):
        assert _resolve() == 0


@pytest.mark.parametrize("source", ["config", "shared", "policy"])
@pytest.mark.parametrize("value", [-2, True, "bad", 36501, 30.0])
def test_invalid_window_resolution_is_alertable(
    app_config: Config, source: str, value: object
) -> None:
    """Each invalid resolution emits one distinct counter without purging."""
    from superset.extensions import stats_logger_manager

    app_config["SOFT_DELETE_RETENTION_DAYS"] = value if source == "config" else 30
    if source == "policy":
        app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: value
    stats: MagicMock
    with (
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=value if source == "shared" else None,
        ),
        patch.object(stats_logger_manager.instance, "incr") as stats,
    ):
        assert _resolve() == 0
    stats.assert_called_once_with("deletion_retention.invalid_window")


@pytest.mark.parametrize("source", ["config", "shared", "policy"])
@pytest.mark.parametrize("days", [-1, 0, 30])
def test_valid_window_does_not_emit_invalid_metric(
    app_config: Config, source: str, days: int
) -> None:
    """Intentional disable and immediate eligibility are not misconfigurations."""
    from superset.extensions import stats_logger_manager

    app_config["SOFT_DELETE_RETENTION_DAYS"] = days if source == "config" else 30
    if source == "policy":
        app_config["SOFT_DELETE_RETENTION_DAYS_FUNC"] = lambda: days
    stats: MagicMock
    with (
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=days if source == "shared" else None,
        ),
        patch.object(stats_logger_manager.instance, "incr") as stats,
    ):
        assert _resolve() == days
    stats.assert_not_called()


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


@pytest.mark.parametrize("dry_run", [False, True])
@pytest.mark.parametrize("row_count", [0, 1, 3])
def test_unsupported_model_is_reported_without_scanning(
    app_config: Config,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    dry_run: bool,
    row_count: int,
) -> None:
    """Skip unsupported models once per run, regardless of eligible row count."""
    # avoid app-init regression: model helpers require the app_config fixture first.
    from superset.models.helpers import SoftDeleteMixin
    from superset.tasks import deletion_retention as task

    monkeypatch.setattr(SoftDeleteMixin, "_registered_subclasses", [])
    mapper_registry: registry = registry()

    @mapper_registry.mapped
    class UnsupportedModel(SoftDeleteMixin):
        """A host-style model with the legacy integer scan key but no purge policy."""

        __tablename__: str = "unsupported_purge_test"
        __table__: ClassVar[sa.Table]
        id: Mapped[int] = mapped_column(primary_key=True)
        uuid: Mapped[UUID] = mapped_column(sa.Uuid, default=uuid4)

    engine: sa.Engine = sa.create_engine("sqlite://")
    monkeypatch.setitem(app_config, "SOFT_DELETE_PURGE_DRY_RUN", dry_run)
    try:
        mapper_registry.metadata.create_all(engine)
        session: Session
        with Session(engine) as session:
            if row_count:
                session.execute(
                    sa.insert(UnsupportedModel),
                    [
                        {
                            "id": index + 1,
                            "deleted_at": datetime.now() - timedelta(days=90),
                        }
                        for index in range(row_count)
                    ],
                )
            session.commit()
            scan: MagicMock
            rollback: MagicMock
            write_ahead: MagicMock
            counter: MagicMock
            gauge: MagicMock
            with (
                patch.object(task.db, "session", session),
                patch.object(session, "execute", wraps=session.execute) as scan,
                patch.object(session, "rollback", wraps=session.rollback) as rollback,
                patch.object(task.audit, "reconcile_pending"),
                patch.object(task.audit, "write_ahead") as write_ahead,
                patch.object(task, "resolve_retention_window", return_value=30),
                patch.object(
                    task.feature_flag_manager, "is_feature_enabled", return_value=True
                ),
                patch.object(task.stats_logger_manager.instance, "incr") as counter,
                patch.object(task.stats_logger_manager.instance, "gauge") as gauge,
            ):
                result: dict[str, Any] = task.purge_soft_deleted.run()
            if dry_run:
                assert result["would_purge"] == {}, result
            else:
                assert result["cascade_failures"] == 0, result
                assert result["purged"] == {}, result
                assert result["blocked_by_reference"] == 0, result
            assert result["unsupported_models"] == {"unsupported_purge_test": 1}
            scan.assert_not_called()
            rollback.assert_not_called()
            write_ahead.assert_not_called()
            gauge.assert_not_called()
            counter.assert_called_once_with(
                "deletion_retention.unsupported_models.unsupported_purge_test"
            )
            assert (
                caplog.text.count("skipping unsupported_purge_test: no purge policy")
                == 1
            )
            assert (
                session.scalar(
                    sa.select(sa.func.count()).select_from(UnsupportedModel.__table__)
                )
                == row_count
            )
    finally:
        mapper_registry.dispose()
        engine.dispose()


@pytest.mark.parametrize("dry_run", [False, True])
def test_unsupported_model_does_not_prevent_supported_models_from_purging(
    app_config: Config,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    dry_run: bool,
) -> None:
    """A skipped model must not stop the remaining supported models in the run."""
    # avoid app-init regression: model helpers require the app_config fixture first.
    from superset.models.helpers import SoftDeleteMixin
    from superset.tasks import deletion_retention as task

    supported_models: list[type[SoftDeleteMixin]] = list(task.purge_policy_registry())
    monkeypatch.setattr(SoftDeleteMixin, "_registered_subclasses", supported_models[:])

    class UnsupportedModel(SoftDeleteMixin):
        """An unsupported root that must never reach the row-processing boundary."""

        __tablename__: str = "unsupported_mixed_purge_test"

    # Put the unsupported model first to detect an early return or break.
    monkeypatch.setattr(
        SoftDeleteMixin,
        "_registered_subclasses",
        [UnsupportedModel, *supported_models],
    )
    monkeypatch.setitem(app_config, "SOFT_DELETE_PURGE_DRY_RUN", dry_run)
    purge: MagicMock
    counter: MagicMock
    gauge: MagicMock
    with (
        patch.object(
            task, "_purge_model", return_value=(0, 1, 0, 0) if dry_run else (1, 0, 0, 0)
        ) as purge,
        patch.object(task.audit, "reconcile_pending"),
        patch.object(task, "resolve_retention_window", return_value=30),
        patch.object(
            task.feature_flag_manager, "is_feature_enabled", return_value=True
        ),
        patch.object(task.stats_logger_manager.instance, "incr") as counter,
        patch.object(task.stats_logger_manager.instance, "gauge") as gauge,
    ):
        result: dict[str, Any] = task.purge_soft_deleted.run()

    assert purge.call_count == len(supported_models)
    model: type[SoftDeleteMixin]
    for model in supported_models:
        assert call(model, ANY, dry_run) in purge.call_args_list
    assert result["would_purge" if dry_run else "purged"] == {
        "dashboards": 1,
        "slices": 1,
        "tables": 1,
    }
    outcome: str = "would_purge" if dry_run else "purged"
    assert gauge.call_count == 3
    gauge.assert_has_calls(
        [
            call(f"deletion_retention.{outcome}.dashboards", 1),
            call(f"deletion_retention.{outcome}.slices", 1),
            call(f"deletion_retention.{outcome}.tables", 1),
        ],
        any_order=True,
    )
    assert result["unsupported_models"] == {"unsupported_mixed_purge_test": 1}
    counter.assert_called_once_with(
        "deletion_retention.unsupported_models.unsupported_mixed_purge_test"
    )
    assert (
        caplog.text.count("skipping unsupported_mixed_purge_test: no purge policy") == 1
    )


def test_default_config_purges_for_real_after_the_retention_window() -> None:
    """The shipped defaults make the docs' retention promise true.

    Superseding ``test_default_config_is_safe``: dry-run was the
    introducing release's posture, deliberately opt-in so operators could
    validate ``would_purge`` counts against production first. Purging is
    live by default, and ``SOFT_DELETE_PURGE_DRY_RUN`` is retained as the
    operational lever to put it back. Pinned so a default change is a
    deliberate edit here rather than a silent one.
    """
    from superset import config

    assert config.SOFT_DELETE_RETENTION_DAYS == 30
    assert config.SOFT_DELETE_PURGE_DRY_RUN is False


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


def test_scheduled_purge_fails_closed_when_write_ahead_fails(
    app_context: None,
) -> None:
    """An unauditable scheduled purge must not delete: the entity is
    skipped (counted as a failure) and retried next run."""
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    entity = MagicMock(id=1)
    with (
        patch.object(mod, "_iter_eligible_ids", return_value=[[1]]),
        patch.object(mod, "skip_visibility_filter"),
        patch.object(mod, "entity_uuid", return_value="u-1"),
        patch.object(mod, "dashboard_slice_count", return_value=0),
        patch.object(mod, "cascade_hard_delete") as cascade,
        patch.object(mod.db, "session") as session,
        patch.object(mod.audit, "write_ahead", return_value=None),
    ):
        session.get.return_value = entity
        result: tuple[int, int, int, int] = mod._purge_model(
            Slice, datetime.now(), dry_run=False
        )

    cascade.assert_not_called()
    purged, would, failures, blocked = result
    assert (purged, would, blocked) == (0, 0, 0)
    assert failures == 1


@pytest.mark.parametrize("days", [-1, -2])
def test_immediate_cutoff_and_invalid_skip(days: int) -> None:
    """Immediate eligibility uses now; invalid negatives never start a purge."""
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    now: datetime = datetime(2026, 9, 23, 12, 0)
    clock: MagicMock
    models: MagicMock
    purge: MagicMock
    reconcile: MagicMock
    with (
        patch.object(mod, "datetime") as clock,
        patch.object(mod, "_soft_delete_models", return_value=[Slice]) as models,
        patch.object(mod, "_purge_model", return_value=(0, 0, 0, 0)) as purge,
        patch.object(mod.audit, "reconcile_pending") as reconcile,
    ):
        clock.now.return_value = now
        result: dict[str, Any] = mod._purge_impl(days, dry_run=False)
    if days == -1:
        purge.assert_called_once_with(Slice, now, False)
    else:
        assert result == {"skipped": 1}
        models.assert_not_called()
        purge.assert_not_called()
        reconcile.assert_not_called()


@pytest.mark.parametrize("source", ["config", "shared"])
@pytest.mark.parametrize("days, expected", [(36500, 36500), (36501, 0), (1000000, 0)])
def test_standalone_window_bounds_reach_safe_purge_cutoff(
    app_config: Config, source: str, days: int, expected: int
) -> None:
    """Stored and runtime windows cannot overflow scheduled purge arithmetic."""
    import superset.tasks.deletion_retention as mod
    from superset.models.slice import Slice

    app_config["SOFT_DELETE_RETENTION_DAYS"] = days if source == "config" else 30
    now: datetime = datetime(2026, 9, 23, 12, 0)
    clock: MagicMock
    purge: MagicMock
    with (
        patch(
            "superset.commands.deletion_retention.window.get_shared_value",
            return_value=days if source == "shared" else None,
        ),
        patch.object(mod, "datetime") as clock,
        patch.object(mod, "_soft_delete_models", return_value=[Slice]),
        patch.object(mod, "_purge_model", return_value=(0, 0, 0, 0)) as purge,
        patch.object(mod.audit, "reconcile_pending"),
    ):
        clock.now.return_value = now
        result: dict[str, Any] = mod._purge_impl(_resolve(), dry_run=False)
    if expected == 0:
        assert result == {"skipped": 1}
        purge.assert_not_called()
    else:
        purge.assert_called_once_with(Slice, now - timedelta(days=expected), False)
