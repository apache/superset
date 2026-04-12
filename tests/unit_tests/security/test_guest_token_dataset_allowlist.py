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
"""Tests for the optional dataset allowlist in guest tokens.

Covers token creation (JWT claims), schema deserialization, and the access
enforcement gate inside raise_for_access().
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from superset.exceptions import SupersetSecurityException
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestUser,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_guest_user(datasets: list[int] | None = None) -> GuestUser:
    """Build a GuestUser whose token optionally carries a datasets allowlist."""
    token: GuestToken = {
        "user": {},
        "resources": [{"type": GuestTokenResourceType.DASHBOARD, "id": "dash-uuid"}],
        "rls_rules": [],
        "iat": 0,
        "exp": 9999999999,
    }
    if datasets is not None:
        token["datasets"] = datasets
    return GuestUser(token=token, roles=[])


def _make_datasource(dataset_id: int) -> MagicMock:
    """Return a minimal datasource mock with a numeric id."""
    ds = MagicMock()
    ds.id = dataset_id
    ds.perm = "datasource_access"
    return ds


# ---------------------------------------------------------------------------
# create_guest_access_token — JWT claims
# ---------------------------------------------------------------------------


def test_create_guest_access_token_without_datasets_omits_claim() -> None:
    """When datasets=None the JWT must not contain a datasets key."""
    from superset.security.manager import SupersetSecurityManager

    sm = MagicMock(spec=SupersetSecurityManager)
    sm._get_current_epoch_time.return_value = 0
    sm._get_guest_token_jwt_audience.return_value = "superset"
    sm.pyjwt_for_guest_token = MagicMock()

    with patch(
        "superset.security.manager.get_conf",
        return_value={
            "GUEST_TOKEN_JWT_SECRET": "secret",
            "GUEST_TOKEN_JWT_ALGO": "HS256",
            "GUEST_TOKEN_JWT_EXP_SECONDS": 300,
        },
    ):
        SupersetSecurityManager.create_guest_access_token(
            sm, user={}, resources=[], rls=[], datasets=None
        )

    _, call_kwargs = sm.pyjwt_for_guest_token.encode.call_args
    claims = sm.pyjwt_for_guest_token.encode.call_args[0][0]
    assert "datasets" not in claims


def test_create_guest_access_token_with_datasets_includes_claim() -> None:
    """When datasets is provided the JWT must include the datasets claim."""
    from superset.security.manager import SupersetSecurityManager

    sm = MagicMock(spec=SupersetSecurityManager)
    sm._get_current_epoch_time.return_value = 0
    sm._get_guest_token_jwt_audience.return_value = "superset"
    sm.pyjwt_for_guest_token = MagicMock()

    with patch(
        "superset.security.manager.get_conf",
        return_value={
            "GUEST_TOKEN_JWT_SECRET": "secret",
            "GUEST_TOKEN_JWT_ALGO": "HS256",
            "GUEST_TOKEN_JWT_EXP_SECONDS": 300,
        },
    ):
        SupersetSecurityManager.create_guest_access_token(
            sm, user={}, resources=[], rls=[], datasets=[7, 8]
        )

    claims = sm.pyjwt_for_guest_token.encode.call_args[0][0]
    assert claims["datasets"] == [7, 8]


# ---------------------------------------------------------------------------
# raise_for_access — dataset allowlist enforcement
# ---------------------------------------------------------------------------


def _sm_for_access_test(guest_user: GuestUser) -> MagicMock:
    """Build a security-manager mock wired to grant basic datasource access
    through the guest path so only the allowlist gate is exercised."""
    from superset.security.manager import SupersetSecurityManager

    sm = MagicMock(spec=SupersetSecurityManager)
    sm.is_guest_user.return_value = True
    sm.get_current_guest_user_if_guest.return_value = guest_user
    # Make every upstream access check pass so we isolate the allowlist check.
    sm.can_access_schema.return_value = True
    return sm


def test_raise_for_access_no_datasets_claim_allows_any_datasource() -> None:
    """A token without a datasets claim must allow all datasources (backward compat)."""
    from superset.security.manager import SupersetSecurityManager

    guest_user = _make_guest_user(datasets=None)
    sm = _sm_for_access_test(guest_user)
    datasource = _make_datasource(dataset_id=99)

    # can_access_schema returns True so the main block does not raise,
    # then we hit our allowlist check — with no claim it must not raise either.
    SupersetSecurityManager.raise_for_access(sm, datasource=datasource)  # no exception


def test_raise_for_access_datasets_claim_allows_listed_datasource() -> None:
    """A token with datasets=[7, 8] must allow datasource id=7."""
    from superset.security.manager import SupersetSecurityManager

    guest_user = _make_guest_user(datasets=[7, 8])
    sm = _sm_for_access_test(guest_user)
    datasource = _make_datasource(dataset_id=7)

    SupersetSecurityManager.raise_for_access(sm, datasource=datasource)  # no exception


def test_raise_for_access_datasets_claim_blocks_unlisted_datasource() -> None:
    """A token with datasets=[7, 8] must block datasource id=99."""
    from superset.security.manager import SupersetSecurityManager

    guest_user = _make_guest_user(datasets=[7, 8])
    sm = _sm_for_access_test(guest_user)
    datasource = _make_datasource(dataset_id=99)

    with pytest.raises(SupersetSecurityException):
        SupersetSecurityManager.raise_for_access(sm, datasource=datasource)


def test_raise_for_access_empty_datasets_list_blocks_all() -> None:
    """An explicit empty allowlist (datasets=[]) must block every datasource."""
    from superset.security.manager import SupersetSecurityManager

    guest_user = _make_guest_user(datasets=[])
    sm = _sm_for_access_test(guest_user)
    datasource = _make_datasource(dataset_id=7)

    with pytest.raises(SupersetSecurityException):
        SupersetSecurityManager.raise_for_access(sm, datasource=datasource)


# ---------------------------------------------------------------------------
# GuestTokenCreateSchema — datasets field
# ---------------------------------------------------------------------------


def test_guest_token_create_schema_datasets_optional() -> None:
    """datasets is optional — a payload without it must load successfully."""
    from superset.security.api import GuestTokenCreateSchema

    schema = GuestTokenCreateSchema()
    result = schema.load({"resources": [{"type": "dashboard", "id": "abc"}], "rls": []})
    assert result.get("datasets") is None


def test_guest_token_create_schema_datasets_accepted() -> None:
    """datasets=[7, 8] must load and be present in the result."""
    from superset.security.api import GuestTokenCreateSchema

    schema = GuestTokenCreateSchema()
    result = schema.load(
        {
            "resources": [{"type": "dashboard", "id": "abc"}],
            "rls": [],
            "datasets": [7, 8],
        }
    )
    assert result["datasets"] == [7, 8]
