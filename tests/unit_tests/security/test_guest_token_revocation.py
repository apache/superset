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

from typing import Any
from unittest.mock import MagicMock, patch

from superset.security.manager import SupersetSecurityManager

_DASHBOARD_RESOURCE = {"type": "dashboard", "id": "abc-uuid"}


def _token(iat: int) -> dict[str, Any]:
    return {"type": "guest", "iat": iat, "resources": [_DASHBOARD_RESOURCE]}


def _embedded(revoked_before) -> MagicMock:
    embedded = MagicMock()
    embedded.guest_token_revoked_before = revoked_before
    return embedded


def test_guest_token_not_revoked_when_no_revocation_set() -> None:
    with patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=_embedded(None),
    ):
        assert SupersetSecurityManager._is_guest_token_revoked(_token(1000)) is False


def test_guest_token_revoked_when_issued_before_revocation() -> None:
    with patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=_embedded(2000),
    ):
        # Token issued at 1000, revocation at 2000 -> revoked.
        assert SupersetSecurityManager._is_guest_token_revoked(_token(1000)) is True


def test_guest_token_valid_when_issued_after_revocation() -> None:
    with patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=_embedded(2000),
    ):
        # Token issued at 3000, after the revocation cutoff -> still valid.
        assert SupersetSecurityManager._is_guest_token_revoked(_token(3000)) is False


def test_guest_token_without_iat_is_revoked_when_cutoff_set() -> None:
    # A token lacking ``iat`` cannot prove it predates the cutoff, so it
    # fails closed and is treated as revoked when a cutoff is configured.
    token = {"type": "guest", "resources": [_DASHBOARD_RESOURCE]}
    with patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=_embedded(2000),
    ):
        assert SupersetSecurityManager._is_guest_token_revoked(token) is True


def test_guest_token_without_iat_is_not_revoked_when_no_cutoff() -> None:
    token = {"type": "guest", "resources": [_DASHBOARD_RESOURCE]}
    with patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=_embedded(None),
    ):
        assert SupersetSecurityManager._is_guest_token_revoked(token) is False


def test_guest_token_revoked_via_legacy_dashboard_id_resource() -> None:
    # During the UUID migration a dashboard resource id may be a legacy
    # dashboard id rather than an embedded UUID. In that case the embedded
    # config is resolved via Dashboard.get(...).embedded, and its revocation
    # cutoff must still be honored.
    dashboard = MagicMock()
    dashboard.embedded = [_embedded(2000)]
    with (
        patch(
            "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
            return_value=None,
        ),
        patch(
            "superset.models.dashboard.Dashboard.get",
            return_value=dashboard,
        ),
    ):
        assert SupersetSecurityManager._is_guest_token_revoked(_token(1000)) is True


def test_guest_token_not_revoked_when_resource_unresolvable() -> None:
    # If neither an embedded config nor a dashboard resolves, there is no
    # cutoff to enforce and the token is treated as not revoked.
    with (
        patch(
            "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
            return_value=None,
        ),
        patch(
            "superset.models.dashboard.Dashboard.get",
            return_value=None,
        ),
    ):
        assert SupersetSecurityManager._is_guest_token_revoked(_token(1000)) is False


def _manager() -> SupersetSecurityManager:
    # Build an instance without running the (heavy) FAB __init__: we only
    # exercise revoke_guest_token_access, which depends on nothing but
    # _get_current_epoch_time and the EmbeddedDashboardDAO lookup.
    return SupersetSecurityManager.__new__(SupersetSecurityManager)


def test_revoke_guest_token_access_uses_explicit_before() -> None:
    embedded = _embedded(None)
    with patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=embedded,
    ):
        _manager().revoke_guest_token_access("abc-uuid", before=1234)
    assert embedded.guest_token_revoked_before == 1234


def test_revoke_guest_token_access_defaults_to_ceil_of_now() -> None:
    embedded = _embedded(None)
    manager = _manager()
    with (
        patch(
            "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
            return_value=embedded,
        ),
        patch.object(manager, "_get_current_epoch_time", return_value=1000.25),
    ):
        manager.revoke_guest_token_access("abc-uuid")
    # Cutoff is rounded up so fractional-``iat`` tokens issued in the same
    # second are reliably revoked (fails closed).
    assert embedded.guest_token_revoked_before == 1001


def test_revoke_guest_token_access_noop_when_embedded_missing() -> None:
    with patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=None,
    ):
        # Should simply return without raising when the UUID does not resolve.
        _manager().revoke_guest_token_access("missing-uuid")
