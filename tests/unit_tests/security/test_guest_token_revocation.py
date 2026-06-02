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


def test_guest_token_without_iat_is_not_revoked() -> None:
    token = {"type": "guest", "resources": [_DASHBOARD_RESOURCE]}
    assert SupersetSecurityManager._is_guest_token_revoked(token) is False
