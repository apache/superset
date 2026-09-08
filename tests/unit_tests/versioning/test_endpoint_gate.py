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

"""SC-120001: the version/activity endpoint families are EDIT-gated.

The shared preflight (``resolve_endpoint_path_entity``) must enforce
object-level editorship (``raise_for_editorship``) — never the read gate
(``raise_for_access``) — per the sc-103156 SIP decision: the full change
log is for principals who may alter the entity, matching the UI's
edit-gated menu and the restore command's gate. These unit pins are the
environment-independent half of the control; the integration role matrix
(versions_api_tests / activity_view_tests) exercises it over HTTP.
"""

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.versioning import api_helpers
from superset.versioning.api_helpers import (
    PathEntityResponseError,
    resolve_endpoint_path_entity,
)

_UUID = "8b8c9f00-0000-4000-8000-000000000001"


def _api() -> MagicMock:
    api = MagicMock()
    api.response_400.return_value = "resp-400"
    api.response_403.return_value = "resp-403"
    api.response_404.return_value = "resp-404"
    return api


def test_preflight_enforces_editorship_not_read_access(
    mocker: MockerFixture, app_context: None
) -> None:
    """The preflight consults only the editorship gate.

    The read gate must never run. (Reverted-gate control: restoring the
    read gate fails the not-called assertion.)"""
    entity = SimpleNamespace(id=1)
    mocker.patch.object(
        api_helpers.VersionDAO, "find_active_by_uuid", return_value=entity
    )
    # Explicit MagicMock: the module attribute is a werkzeug LocalProxy,
    # whose attribute forwarding fools unittest.mock's async detection —
    # a bare patch creates an AsyncMock whose calls return un-awaited
    # coroutines, so raising side_effects never fire on this synchronous
    # path.
    sm = MagicMock()
    sm.is_guest_user.return_value = False
    mocker.patch.object(api_helpers, "security_manager", sm)

    resolved, _ = resolve_endpoint_path_entity(_api(), Dashboard, _UUID)

    assert resolved is entity
    sm.raise_for_editorship.assert_called_once_with(entity)
    sm.raise_for_access.assert_not_called()


def test_preflight_maps_editorship_refusal_to_403(
    mocker: MockerFixture, app_context: None
) -> None:
    """A non-editor principal gets the 403 response, nothing else. The
    security manager is stubbed with a plain object whose gate raises the
    real exception type — and whose read gate raises AssertionError if
    consulted, doubling as a not-called pin on the refusal path. (A bare
    ``mocker.patch.object`` here would yield an AsyncMock — see the
    LocalProxy note in the sibling test.)"""
    entity = SimpleNamespace(id=1)
    mocker.patch.object(
        api_helpers.VersionDAO, "find_active_by_uuid", return_value=entity
    )

    def _deny(_entity: Any) -> None:
        raise SupersetSecurityException(MagicMock())

    def _read_gate_must_not_run(**_kwargs: Any) -> None:
        raise AssertionError("read gate must not be consulted")

    mocker.patch.object(
        api_helpers,
        "security_manager",
        SimpleNamespace(
            is_guest_user=lambda: False,
            raise_for_editorship=_deny,
            raise_for_access=_read_gate_must_not_run,
        ),
    )

    with pytest.raises(PathEntityResponseError) as exc:
        resolve_endpoint_path_entity(_api(), Dashboard, _UUID)

    assert exc.value.response == "resp-403"


def test_preflight_fails_closed_for_unwired_models(
    mocker: MockerFixture, app_context: None
) -> None:
    """Unwired models fail closed before any parsing or database work.

    The allowlist compares class IDENTITY: an unrelated class that
    happens to be NAMED like a wired model must not slip through, and
    the DAO is never consulted for it."""

    class Slice:  # same __name__ as the wired model, different class
        pass

    dao = mocker.patch.object(
        api_helpers.VersionDAO,
        "find_active_by_uuid",
        return_value=SimpleNamespace(id=1),
    )
    mocker.patch.object(api_helpers, "security_manager")

    with pytest.raises(LookupError):
        resolve_endpoint_path_entity(_api(), Slice, _UUID)

    dao.assert_not_called()


def test_preflight_denies_guest_principals_outright(
    mocker: MockerFixture, app_context: None
) -> None:
    """Guest principals are refused before any editorship evaluation.

    A guest's ROLE subjects feed ``is_editor``, so a role subject granted
    editorship would otherwise admit every guest holding that role — the
    M10 case. Neither gate may even be consulted."""
    entity = SimpleNamespace(id=1)
    mocker.patch.object(
        api_helpers.VersionDAO, "find_active_by_uuid", return_value=entity
    )

    def _gate_must_not_run(*_args: Any, **_kwargs: Any) -> None:
        raise AssertionError("no gate may run for a guest principal")

    mocker.patch.object(
        api_helpers,
        "security_manager",
        SimpleNamespace(
            is_guest_user=lambda: True,
            raise_for_editorship=_gate_must_not_run,
            raise_for_access=_gate_must_not_run,
        ),
    )

    with pytest.raises(PathEntityResponseError) as exc:
        resolve_endpoint_path_entity(_api(), Dashboard, _UUID)

    assert exc.value.response == "resp-403"
