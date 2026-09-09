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
"""Unit coverage for ``BaseRestoreVersionCommand.validate()``'s gate chain.

The engine itself is covered in ``test_restore.py`` and end-to-end in the
per-entity integration suites. Here we pin the command's *policy* gate
with mocks: an externally managed entity is refused after — never
before — the editorship check, the flag is read fresh on every request,
and the refusal fires before any version is resolved or written.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.exceptions import (
    ExternallyManagedRestoreError,
    ForbiddenError,
)
from superset.commands.version_restore import BaseRestoreVersionCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException

_ENTITY_UUID = UUID("00000000-0000-0000-0000-000000000001")
_VERSION_UUID = UUID("00000000-0000-0000-0000-000000000002")

_MODULE = "superset.commands.version_restore"


class _NotFoundError(Exception):
    pass


class _ForbiddenError(Exception):
    pass


class _FailedError(Exception):
    pass


class _Command(BaseRestoreVersionCommand):
    """Minimal concrete subclass — the base owns the whole workflow."""

    model_cls = MagicMock(__name__="Slice")
    not_found_exc = _NotFoundError
    forbidden_exc = _ForbiddenError
    failed_exc = _FailedError


def _entity(*, managed: bool) -> MagicMock:
    entity = MagicMock()
    entity.is_managed_externally = managed
    return entity


def _not_an_editor() -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message="not an editor",
            error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


@patch(f"{_MODULE}.security_manager", new_callable=MagicMock)
@patch(f"{_MODULE}.find_active_by_uuid")
@patch(f"{_MODULE}.capture_enabled", return_value=True)
def test_validate_refuses_externally_managed_entity_for_editor(
    mock_capture, mock_find, mock_security
) -> None:
    """An editor of an externally managed entity is refused with the
    shared policy exception, not the permission one."""
    mock_find.return_value = _entity(managed=True)
    mock_security.raise_for_editorship.return_value = None

    with pytest.raises(ExternallyManagedRestoreError):
        _Command(_ENTITY_UUID, _VERSION_UUID).validate()

    mock_security.raise_for_editorship.assert_called_once()


@patch(f"{_MODULE}.security_manager", new_callable=MagicMock)
@patch(f"{_MODULE}.find_active_by_uuid")
@patch(f"{_MODULE}.capture_enabled", return_value=True)
def test_validate_evaluates_permission_before_policy(
    mock_capture, mock_find, mock_security
) -> None:
    """A non-editor of an externally managed entity sees the permission
    denial, so external management is never disclosed to someone with no
    rights to the entity."""
    mock_find.return_value = _entity(managed=True)
    mock_security.raise_for_editorship.side_effect = _not_an_editor()

    with pytest.raises(_ForbiddenError):
        _Command(_ENTITY_UUID, _VERSION_UUID).validate()


@patch(f"{_MODULE}.security_manager", new_callable=MagicMock)
@patch(f"{_MODULE}.find_active_by_uuid")
@patch(f"{_MODULE}.capture_enabled", return_value=True)
def test_validate_passes_unmanaged_entity_through(
    mock_capture, mock_find, mock_security
) -> None:
    """The gate is inert for an ordinary entity: validate returns it."""
    entity = _entity(managed=False)
    mock_find.return_value = entity
    mock_security.raise_for_editorship.return_value = None

    assert _Command(_ENTITY_UUID, _VERSION_UUID).validate() is entity


@patch(f"{_MODULE}.security_manager", new_callable=MagicMock)
@patch(f"{_MODULE}.find_active_by_uuid")
@patch(f"{_MODULE}.capture_enabled", return_value=True)
def test_validate_reads_flag_per_request(
    mock_capture, mock_find, mock_security
) -> None:
    """The flag is read from the freshly loaded entity on every call, so an
    entity that becomes externally managed between two requests is refused
    on the second without any cached state."""
    mock_security.raise_for_editorship.return_value = None
    command = _Command(_ENTITY_UUID, _VERSION_UUID)

    mock_find.return_value = _entity(managed=False)
    command.validate()

    mock_find.return_value = _entity(managed=True)
    with pytest.raises(ExternallyManagedRestoreError):
        command.validate()


@patch(f"{_MODULE}.restore_version")
@patch(f"{_MODULE}.resolve_version")
@patch(f"{_MODULE}.security_manager", new_callable=MagicMock)
@patch(f"{_MODULE}.find_active_by_uuid")
@patch(f"{_MODULE}.capture_enabled", return_value=True)
def test_refusal_precedes_version_resolution_and_restore(
    mock_capture, mock_find, mock_security, mock_resolve, mock_restore
) -> None:
    """The refusal fires before the target version is even resolved, so
    nothing is written and a would-be no-op restore (target == current)
    is refused exactly like any other."""
    mock_find.return_value = _entity(managed=True)
    mock_security.raise_for_editorship.return_value = None

    with pytest.raises(ExternallyManagedRestoreError):
        _Command(_ENTITY_UUID, _VERSION_UUID)._do_restore()

    mock_resolve.assert_not_called()
    mock_restore.assert_not_called()


@patch(f"{_MODULE}.security_manager", new_callable=MagicMock)
@patch(f"{_MODULE}.find_active_by_uuid")
@patch(f"{_MODULE}.capture_enabled", return_value=True)
def test_run_propagates_refusal_through_transaction_wrapper(
    mock_capture, mock_find, mock_security
) -> None:
    """``run()`` wraps ``_do_restore`` in ``@transaction(on_error=…)``, whose
    handler converts only ``SQLAlchemyError`` into ``failed_exc``. The policy
    exception must come out the other side unchanged — not as a 422."""
    mock_find.return_value = _entity(managed=True)
    mock_security.raise_for_editorship.return_value = None

    with pytest.raises(ExternallyManagedRestoreError) as excinfo:
        _Command(_ENTITY_UUID, _VERSION_UUID).run()

    assert type(excinfo.value) is ExternallyManagedRestoreError


def test_exception_shape_matches_contract() -> None:
    """One shared exception: a 403 ``ForbiddenError`` sibling with the
    contracted message, and not something the transaction wrapper would
    convert."""
    assert issubclass(ExternallyManagedRestoreError, ForbiddenError)
    assert not issubclass(ExternallyManagedRestoreError, SQLAlchemyError)
    assert ExternallyManagedRestoreError.status == 403
    assert (
        ExternallyManagedRestoreError().message
        == "Version restore is unavailable for externally managed entities."
    )
