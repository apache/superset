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
"""Tests for the BaseRestoreCommand contract.

Concrete entity restore commands (chart, dashboard, dataset) live in
the entity-rollout PRs and have their own test files. These tests
exercise the base class directly so the contract is pinned at the
infrastructure level.
"""

from __future__ import annotations

from datetime import datetime
from typing import ClassVar
from unittest.mock import MagicMock, patch

from flask import g

from superset.commands.restore import BaseRestoreCommand
from superset.models.helpers import SKIP_VISIBILITY_FILTER, SoftDeleteMixin


class _NotFoundError(Exception):
    """Synthetic exception for tests."""


class _ForbiddenError(Exception):
    """Synthetic exception for tests."""


def _make_command(model: object) -> BaseRestoreCommand[SoftDeleteMixin]:
    """Build a concrete BaseRestoreCommand subclass against a mock DAO."""
    dao_mock = MagicMock()
    dao_mock.find_by_id.return_value = model

    class _SyntheticRestoreCommand(BaseRestoreCommand[SoftDeleteMixin]):
        dao: ClassVar[MagicMock] = dao_mock
        not_found_exc: ClassVar[type[Exception]] = _NotFoundError
        forbidden_exc: ClassVar[type[Exception]] = _ForbiddenError

    return _SyntheticRestoreCommand("uuid-1")


def test_validate_opts_request_out_of_visibility_filter_during_ownership_check(
    app_context: None,
) -> None:
    """``raise_for_ownership`` re-queries the resource internally; the
    re-query is filtered by the global soft-delete listener and would
    return ``None`` for a soft-deleted row. ``validate`` must therefore
    set ``g.skip_visibility_filter = True`` for the scope of the
    security check so the internal re-query sees the row, and must
    restore the previous value when done.
    """
    captured: list[bool] = []

    def fake_raise_for_ownership(_resource: object) -> None:
        captured.append(getattr(g, SKIP_VISIBILITY_FILTER, False))

    model = MagicMock()
    model.deleted_at = datetime(2026, 1, 1)

    with patch("superset.commands.restore.security_manager") as mock_sec:
        mock_sec.raise_for_ownership = fake_raise_for_ownership

        # Pre-condition: the request has not opted out of the filter.
        assert getattr(g, SKIP_VISIBILITY_FILTER, False) is False

        _make_command(model).validate()

        # During the security check, the flag was True.
        assert captured == [True]

        # Post-condition: the flag is restored to its previous value.
        assert getattr(g, SKIP_VISIBILITY_FILTER, False) is False


def test_validate_restores_previous_skip_flag_value(app_context: None) -> None:
    """If the caller already set ``g.skip_visibility_filter = True`` (e.g.,
    a list-endpoint rison filter is active), ``validate`` must restore
    that same value after the security check, not unconditionally clear
    it.
    """
    model = MagicMock()
    model.deleted_at = datetime(2026, 1, 1)

    setattr(g, SKIP_VISIBILITY_FILTER, True)
    try:
        with patch("superset.commands.restore.security_manager") as mock_sec:
            mock_sec.raise_for_ownership = MagicMock(return_value=None)
            _make_command(model).validate()
        # Caller's flag value preserved.
        assert getattr(g, SKIP_VISIBILITY_FILTER, False) is True
    finally:
        setattr(g, SKIP_VISIBILITY_FILTER, False)


def test_validate_restores_skip_flag_even_when_ownership_check_raises(
    app_context: None,
) -> None:
    """If ``raise_for_ownership`` raises, the ``finally`` block must still
    restore the previous flag value so a denied restore does not leave
    the rest of the request bypassing the filter.
    """
    from superset.exceptions import SupersetSecurityException

    model = MagicMock()
    model.deleted_at = datetime(2026, 1, 1)

    def reject_ownership(_resource: object) -> None:
        raise SupersetSecurityException(MagicMock())

    with patch("superset.commands.restore.security_manager") as mock_sec:
        mock_sec.raise_for_ownership = reject_ownership
        try:
            _make_command(model).validate()
        except _ForbiddenError:
            pass
        else:
            raise AssertionError("expected _ForbiddenError to be raised")

    # Flag restored despite the exception path.
    assert getattr(g, SKIP_VISIBILITY_FILTER, False) is False
