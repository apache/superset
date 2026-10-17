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
from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest

from superset.app import SupersetApp
from superset.dashboards.excel_export.storage import (
    _warn_celery_disabled,
    _warn_partial_storage,
    is_background_export_available,
    is_export_storage_configured,
)

LOGGER = "superset.dashboards.excel_export.storage"


@pytest.fixture(autouse=True)
def _reset_partial_storage_warning() -> Iterator[None]:
    """Each test starts as a fresh process that has not warned yet."""
    _warn_partial_storage.cache_clear()
    _warn_celery_disabled.cache_clear()
    yield
    _warn_partial_storage.cache_clear()
    _warn_celery_disabled.cache_clear()


@pytest.mark.parametrize(
    ("storage", "configured"),
    [
        ({"bucket": "exports-bucket", "backend": MagicMock()}, True),
        ({"bucket": "exports-bucket"}, False),
        ({"bucket": "", "backend": MagicMock()}, False),
        ({"backend": MagicMock()}, False),
        ({}, False),
    ],
)
def test_storage_is_configured_only_with_a_bucket_and_backend(
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    storage: dict[str, Any],
    configured: bool,
) -> None:
    """Exports are queued only when both halves of the storage config are set."""
    monkeypatch.setitem(app.config, "EXPORT_STORAGE", storage)
    assert is_export_storage_configured() is configured


@pytest.mark.parametrize(
    ("storage", "missing_key"),
    [
        ({"bucket": "exports-bucket"}, "backend"),
        ({"bucket": "", "backend": MagicMock()}, "bucket"),
        ({"backend": MagicMock()}, "bucket"),
    ],
)
def test_partial_storage_is_logged_once_naming_the_missing_key(
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    storage: dict[str, Any],
    missing_key: str,
) -> None:
    """A half-configured ``EXPORT_STORAGE`` silently switches exports to direct
    downloads, so the operator gets one warning naming what is missing instead
    of one per page load."""
    monkeypatch.setitem(app.config, "EXPORT_STORAGE", storage)

    with caplog.at_level(logging.WARNING, logger=LOGGER):
        is_export_storage_configured()
        is_export_storage_configured()

    warnings = [record for record in caplog.records if record.name == LOGGER]
    assert len(warnings) == 1
    assert f"EXPORT_STORAGE has no {missing_key}," in warnings[0].getMessage()


@pytest.mark.parametrize(
    "storage",
    [
        pytest.param({"key_prefix": "dashboard-exports/"}, id="default config"),
        pytest.param(
            {"bucket": "exports-bucket", "backend": MagicMock()}, id="complete config"
        ),
    ],
)
def test_complete_or_absent_storage_logs_nothing(
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    storage: dict[str, Any],
) -> None:
    """Leaving storage unset is a supported setup, not a misconfiguration."""
    monkeypatch.setitem(app.config, "EXPORT_STORAGE", storage)

    with caplog.at_level(logging.WARNING, logger=LOGGER):
        is_export_storage_configured()

    assert [record for record in caplog.records if record.name == LOGGER] == []


@pytest.mark.parametrize(
    ("storage", "celery_config", "available"),
    [
        pytest.param(
            {"bucket": "exports-bucket", "backend": MagicMock()},
            MagicMock(),
            True,
            id="storage and celery",
        ),
        pytest.param(
            {"bucket": "exports-bucket", "backend": MagicMock()},
            None,
            False,
            id="celery disabled",
        ),
        pytest.param(
            {"key_prefix": "dashboard-exports/"},
            MagicMock(),
            False,
            id="no storage",
        ),
    ],
)
def test_background_export_needs_storage_and_celery(
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    storage: dict[str, Any],
    celery_config: Any,
    available: bool,
) -> None:
    """Exports are queued only when there is both somewhere to upload them and
    a Celery broker to queue them on."""
    monkeypatch.setitem(app.config, "EXPORT_STORAGE", storage)
    monkeypatch.setitem(app.config, "CELERY_CONFIG", celery_config)
    assert is_background_export_available() is available


def test_disabled_celery_is_logged_once(
    app: SupersetApp,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Storage set with ``CELERY_CONFIG = None`` falls back to direct downloads,
    so the operator gets one warning explaining why nothing is queued."""
    monkeypatch.setitem(
        app.config,
        "EXPORT_STORAGE",
        {"bucket": "exports-bucket", "backend": MagicMock()},
    )
    monkeypatch.setitem(app.config, "CELERY_CONFIG", None)

    with caplog.at_level(logging.WARNING, logger=LOGGER):
        is_background_export_available()
        is_background_export_available()

    warnings = [record for record in caplog.records if record.name == LOGGER]
    assert len(warnings) == 1
    assert "CELERY_CONFIG is None" in warnings[0].getMessage()
