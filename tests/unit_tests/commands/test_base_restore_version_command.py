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
"""Unit tests for ``BaseRestoreVersionCommand.validate`` (version restore).

Exercises the shared ``validate()`` through each of the three concrete
commands so the contract is pinned against the real subclasses (and their real
``forbidden_exc`` types), guarding against a subclass overriding it. This is
the *version* restore command (revert to a past version), distinct from the
soft-delete recovery command covered in ``test_base_restore_command.py``. The
real-model / real-endpoint 403 is exercised end-to-end in the per-entity
``version_restore_tests.py`` integration suites (e.g.
``tests/integration_tests/charts/version_restore_tests.py``).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest

from superset.commands.chart.restore_version import RestoreChartVersionCommand
from superset.commands.dashboard.restore_version import RestoreDashboardVersionCommand
from superset.commands.dataset.restore_version import RestoreDatasetVersionCommand
from superset.commands.version_restore import BaseRestoreVersionCommand

_COMMAND_CLASSES = [
    RestoreChartVersionCommand,
    RestoreDashboardVersionCommand,
    RestoreDatasetVersionCommand,
]


@contextmanager
def _validate_context(entity: MagicMock) -> Iterator[None]:
    """Patch the base command's collaborators so ``validate()`` reaches the
    is_managed_externally guard: capture is on, the entity is found, and the
    editorship check passes. What varies between tests is only the entity's
    ``is_managed_externally`` value.
    """
    with (
        patch("superset.commands.version_restore.capture_enabled", return_value=True),
        patch(
            "superset.commands.version_restore.find_active_by_uuid",
            return_value=entity,
        ),
        patch("superset.commands.version_restore.security_manager") as mock_sec,
    ):
        mock_sec.raise_for_editorship = MagicMock(return_value=None)
        yield


@contextmanager
def _locking_query(result_entity: MagicMock) -> Iterator[None]:
    """Stub the FOR UPDATE row-lock read in ``_do_restore``.

    Before dispatching to the restore engine, ``_do_restore`` reloads the
    entity with a pessimistic-locking query that binds ``entity.id`` as a
    SQL parameter. The mocked entity carries a ``MagicMock`` id that cannot
    bind, so the tests would die on a ``ProgrammingError`` before ever
    reaching the patched ``restore_version``. The locking query's own SQL is
    exercised end-to-end in ``test_restore_version_concurrency.py``; here it
    just needs to hand back *result_entity* so the pipeline continues.
    """
    with patch("superset.commands.version_restore.db.session.query") as mock_query:
        lock_read = mock_query.return_value.populate_existing()
        lock_read = lock_read.enable_eagerloads()
        lock_read = lock_read.filter_by()
        lock_read = lock_read.with_for_update()
        lock_read.one_or_none.return_value = result_entity
        yield


@pytest.mark.parametrize("command_cls", _COMMAND_CLASSES)
def test_validate_refuses_externally_managed_entity(
    command_cls: type[BaseRestoreVersionCommand], app_context: None
) -> None:
    """sc-115616: version restore is withheld server-side from externally
    managed entities — an otherwise-authorized editor must not be able to
    bypass the browser gate by calling the endpoint directly. Each concrete
    command raises its own ``forbidden_exc`` (mapped to HTTP 403)."""
    entity = MagicMock()
    entity.is_managed_externally = True
    cmd = command_cls(uuid4(), uuid4())

    with _validate_context(entity):
        with pytest.raises(command_cls.forbidden_exc):
            cmd.validate()


@pytest.mark.parametrize("command_cls", _COMMAND_CLASSES)
def test_validate_returns_entity_when_not_managed_externally(
    command_cls: type[BaseRestoreVersionCommand], app_context: None
) -> None:
    """The reverted-fix control: an editable, non-externally-managed entity
    passes validation and is returned to ``run()``. Removing the guard would
    make the refusal test above pass here too, so this pins that the guard is
    what rejects the managed case."""
    entity = MagicMock()
    entity.is_managed_externally = False
    cmd = command_cls(uuid4(), uuid4())

    with _validate_context(entity):
        assert cmd.validate() is entity


@pytest.mark.parametrize("command_cls", _COMMAND_CLASSES)
def test_registry_lookup_error_maps_to_failed_exc(
    command_cls: type[BaseRestoreVersionCommand],
) -> None:
    """The engine's fail-closed registry LookupError maps to failed_exc.

    ``restore_version`` raises LookupError for a model missing from
    ``_RESTORE_RELATIONS``; without ``catches`` widened past the
    SQLAlchemyError default that surfaced as a raw 500 instead of the
    intended fail-closed 422 (sc-115326).
    """
    entity = MagicMock(is_managed_externally=False)
    lookup = LookupError("No restore relations registered for 'Widget'")
    with (
        _validate_context(entity),
        _locking_query(entity),
        patch(
            "superset.commands.version_restore.resolve_version",
            return_value=(0, 123),
        ),
        patch(
            "superset.commands.version_restore.restore_version",
            side_effect=lookup,
        ),
    ):
        with pytest.raises(command_cls.failed_exc) as excinfo:
            command_cls(uuid4(), uuid4()).run()

    assert excinfo.value.__cause__ is lookup


@pytest.mark.parametrize("command_cls", _COMMAND_CLASSES)
def test_other_exceptions_still_pass_through_untranslated(
    command_cls: type[BaseRestoreVersionCommand],
) -> None:
    """The catches tuple stays narrow: an arbitrary non-SQLAlchemy error
    propagates as itself — the endpoint maps such types explicitly."""
    entity = MagicMock(is_managed_externally=False)
    with (
        _validate_context(entity),
        _locking_query(entity),
        patch(
            "superset.commands.version_restore.resolve_version",
            return_value=(0, 123),
        ),
        patch(
            "superset.commands.version_restore.restore_version",
            side_effect=RuntimeError("boom"),
        ),
    ):
        with pytest.raises(RuntimeError):
            command_cls(uuid4(), uuid4()).run()
