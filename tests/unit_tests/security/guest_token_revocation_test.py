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
from typing import Any, cast

from flask import current_app
from pytest_mock import MockerFixture

from superset.extensions import appbuilder
from superset.security.guest_token import (
    GUEST_TOKEN_REVOCATION_CLAIM,
    GuestTokenResources,
    GuestTokenResourceType,
    GuestTokenRlsRule,
    GuestTokenUser,
)
from superset.security.manager import SupersetSecurityManager

USER: GuestTokenUser = {"username": "guest"}
RESOURCES: GuestTokenResources = [
    {"type": GuestTokenResourceType.DASHBOARD, "id": "some-uuid"}
]
RLS: list[GuestTokenRlsRule] = []


def _decode(sm: SupersetSecurityManager, raw_token: bytes) -> dict[str, Any]:
    # PyJWT returns a str at runtime, though the helper is typed as bytes.
    return sm.parse_jwt_guest_token(cast(str, raw_token))


def test_minted_token_carries_revocation_claim_when_enabled(
    mocker: MockerFixture, app_context: None
) -> None:
    """A token minted with revocation enabled carries the current version."""
    sm = SupersetSecurityManager(appbuilder)
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = True
    mocker.patch(
        "superset.security.manager.get_current_guest_token_revocation_version",
        return_value=3,
    )

    raw_token = sm.create_guest_access_token(USER, RESOURCES, RLS)
    decoded = _decode(sm, raw_token)
    assert decoded[GUEST_TOKEN_REVOCATION_CLAIM] == 3


def test_minted_token_uses_default_version_when_disabled(
    mocker: MockerFixture, app_context: None
) -> None:
    """When revocation is disabled, the metadata store is not consulted."""
    sm = SupersetSecurityManager(appbuilder)
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = False
    read_version = mocker.patch(
        "superset.security.manager.get_current_guest_token_revocation_version",
    )

    raw_token = sm.create_guest_access_token(USER, RESOURCES, RLS)
    decoded = _decode(sm, raw_token)
    assert decoded[GUEST_TOKEN_REVOCATION_CLAIM] == 0
    read_version.assert_not_called()


def test_token_not_revoked_when_feature_disabled(
    mocker: MockerFixture, app_context: None
) -> None:
    """With the feature off, even an old-versioned token is never revoked."""
    sm = SupersetSecurityManager(appbuilder)
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = False
    # Even if the stored version is high, disabled => never revoked.
    mocker.patch(
        "superset.security.manager.get_current_guest_token_revocation_version",
        return_value=99,
    )
    assert sm._is_guest_token_revoked({GUEST_TOKEN_REVOCATION_CLAIM: 0}) is False


def test_legacy_token_without_claim_valid_by_default(
    mocker: MockerFixture, app_context: None
) -> None:
    """A pre-feature token (no claim) is valid until version is bumped above 0."""
    sm = SupersetSecurityManager(appbuilder)
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = True
    mocker.patch(
        "superset.security.manager.get_current_guest_token_revocation_version",
        return_value=0,
    )
    # No revocation claim at all (legacy token).
    assert sm._is_guest_token_revoked({"user": USER}) is False


def test_legacy_token_revoked_after_bump(
    mocker: MockerFixture, app_context: None
) -> None:
    """Once the expected version is bumped, legacy (v0) tokens are rejected."""
    sm = SupersetSecurityManager(appbuilder)
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = True
    mocker.patch(
        "superset.security.manager.get_current_guest_token_revocation_version",
        return_value=1,
    )
    assert sm._is_guest_token_revoked({"user": USER}) is True


def test_current_versioned_token_not_revoked(
    mocker: MockerFixture, app_context: None
) -> None:
    """A token minted at the current version is accepted."""
    sm = SupersetSecurityManager(appbuilder)
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = True
    mocker.patch(
        "superset.security.manager.get_current_guest_token_revocation_version",
        return_value=2,
    )
    assert sm._is_guest_token_revoked({GUEST_TOKEN_REVOCATION_CLAIM: 2}) is False
    assert sm._is_guest_token_revoked({GUEST_TOKEN_REVOCATION_CLAIM: 3}) is False


def test_malformed_claim_treated_as_default(
    mocker: MockerFixture, app_context: None
) -> None:
    """A non-integer claim falls back to the default version (0)."""
    sm = SupersetSecurityManager(appbuilder)
    current_app.config["GUEST_TOKEN_REVOCATION_ENABLED"] = True
    mocker.patch(
        "superset.security.manager.get_current_guest_token_revocation_version",
        return_value=1,
    )
    assert sm._is_guest_token_revoked({GUEST_TOKEN_REVOCATION_CLAIM: "oops"}) is True


def test_bump_increments_stored_version(mocker: MockerFixture) -> None:
    """bump_guest_token_revocation_version reads, increments and persists."""
    # pylint: disable=import-outside-toplevel
    import superset.security.guest_token as gt

    mocker.patch.object(
        gt, "get_current_guest_token_revocation_version", return_value=4
    )
    upsert = mocker.patch("superset.key_value.shared_entries.upsert_shared_value")

    new_version = gt.bump_guest_token_revocation_version()

    assert new_version == 5
    upsert.assert_called_once()
    args = upsert.call_args.args
    assert args[1] == 5


def test_get_version_defaults_when_missing(mocker: MockerFixture) -> None:
    """A missing metadata entry yields the default version 0."""
    # pylint: disable=import-outside-toplevel
    import superset.security.guest_token as gt

    mocker.patch(
        "superset.key_value.shared_entries.get_shared_value", return_value=None
    )
    assert gt.get_current_guest_token_revocation_version() == 0
