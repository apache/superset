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
"""Unit coverage for ``restore_version_endpoint``'s exception → HTTP mapping.

The endpoint body is generic over the per-entity command's exception
triplet. These tests pin that the shared externally-managed refusal is
mapped to a 403 *with* the contracted message, that it is not swallowed
by any of the triplet's ``except`` clauses for any entity type, and that
the pre-existing 404 / 403 / 422 mappings are untouched.
"""

from __future__ import annotations

from importlib import import_module
from typing import Any, ClassVar
from unittest.mock import MagicMock
from uuid import UUID

import pytest

from superset.commands.chart.exceptions import ChartUpdateFailedError
from superset.commands.exceptions import ExternallyManagedRestoreError
from superset.utils.decorators import on_error
from superset.versioning.api_helpers import restore_version_endpoint

_ENTITY_UUID = "00000000-0000-0000-0000-000000000001"
_VERSION_UUID = "00000000-0000-0000-0000-000000000002"
_CONTRACT_MESSAGE = "Version restore is unavailable for externally managed entities."


class _NotFoundError(Exception):
    pass


class _ForbiddenError(Exception):
    pass


class _FailedError(Exception):
    pass


def _command_raising(exc: Exception) -> type[Any]:
    """A stand-in command class whose ``run()`` raises *exc*."""

    class _Command:
        not_found_exc: ClassVar[type[Exception]] = _NotFoundError
        forbidden_exc: ClassVar[type[Exception]] = _ForbiddenError
        failed_exc: ClassVar[type[Exception]] = _FailedError

        def __init__(self, entity_uuid: UUID, version_uuid: UUID) -> None:
            self.entity_uuid = entity_uuid
            self.version_uuid = version_uuid

        def run(self) -> Any:
            raise exc

    return _Command


def _fab_like_api() -> MagicMock:
    """Stub with Flask-AppBuilder's response-helper shapes: the fixed-body
    helpers return their canned message, ``response`` echoes its kwargs."""
    api = MagicMock()
    api.response.side_effect = lambda code, **kw: ("response", code, kw)
    api.response_403.return_value = ("response_403", 403, {"message": "Forbidden"})
    api.response_404.return_value = ("response_404", 404, {"message": "Not found"})
    api.response_422.side_effect = lambda message=None: ("response_422", 422, message)
    return api


def _call(api: MagicMock, command_cls: type[Any]) -> Any:
    return restore_version_endpoint(
        api, MagicMock(__name__="Slice"), command_cls, _ENTITY_UUID, _VERSION_UUID
    )


def test_externally_managed_maps_to_403_with_contract_message() -> None:
    """The policy refusal goes through ``api.response(403, message=…)`` — the
    only helper that can carry a message — never the fixed-body 403."""
    api = _fab_like_api()

    result = _call(api, _command_raising(ExternallyManagedRestoreError()))

    assert result == ("response", 403, {"message": _CONTRACT_MESSAGE})
    api.response_403.assert_not_called()


def test_policy_and_permission_403_bodies_differ() -> None:
    """FR-004: a caller can tell 'externally managed' from 'not permitted'
    by the body alone. FAB's ``response_403()`` always says ``Forbidden``."""
    api = _fab_like_api()

    policy = _call(api, _command_raising(ExternallyManagedRestoreError()))
    permission = _call(api, _command_raising(_ForbiddenError()))

    assert policy[1] == permission[1] == 403
    assert policy[2]["message"] != permission[2]["message"]
    assert permission == ("response_403", 403, {"message": "Forbidden"})


@pytest.mark.parametrize(
    "command_path",
    [
        "superset.commands.chart.restore_version.RestoreChartVersionCommand",
        "superset.commands.dashboard.restore_version.RestoreDashboardVersionCommand",
        "superset.commands.dataset.restore_version.RestoreDatasetVersionCommand",
    ],
)
def test_shared_exception_is_not_caught_by_any_entity_triplet(
    command_path: str,
) -> None:
    """Pins the contract's inheritance constraint against the *real*
    per-entity commands, so a future re-parenting of the exception (or of
    a triplet class) fails here instead of silently turning the refusal
    into a bare 403 / 404 / 422."""
    module_path, _, name = command_path.rpartition(".")
    command_cls = getattr(import_module(module_path), name)

    triplet = (
        command_cls.not_found_exc,
        command_cls.forbidden_exc,
        command_cls.failed_exc,
    )
    assert not issubclass(ExternallyManagedRestoreError, triplet)


def test_transaction_on_error_passes_shared_exception_through() -> None:
    """The command's ``@transaction(on_error=partial(on_error,
    reraise=failed_exc))`` converts only ``SQLAlchemyError``; the policy
    exception must be re-raised as itself, or it would surface as 422."""
    original = ExternallyManagedRestoreError()

    with pytest.raises(ExternallyManagedRestoreError) as excinfo:
        on_error(original, reraise=ChartUpdateFailedError)

    assert excinfo.value is original


def test_existing_mappings_are_unchanged() -> None:
    """FR-006: the 404 / 403 / 422 rows of the response matrix are exactly
    what they were before the policy row was added."""
    api = _fab_like_api()

    assert _call(api, _command_raising(_NotFoundError())) == (
        "response_404",
        404,
        {"message": "Not found"},
    )
    assert _call(api, _command_raising(_ForbiddenError())) == (
        "response_403",
        403,
        {"message": "Forbidden"},
    )
    assert _call(api, _command_raising(_FailedError("boom"))) == (
        "response_422",
        422,
        "boom",
    )
