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
"""Validation of the identity strings carried in a guest token's user claim."""

from typing import Any, cast
from unittest.mock import patch

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.extensions import appbuilder
from superset.security.guest_token import (
    GUEST_TOKEN_IDENTITY_FIELDS,
    GUEST_TOKEN_IDENTITY_MAX_LENGTH,
    GuestTokenIdentityError,
    GuestTokenResources,
    GuestTokenResourceType,
    GuestTokenUser,
    validate_guest_token_identity,
)
from superset.security.manager import SupersetSecurityManager

RESOURCES: GuestTokenResources = [
    {"type": GuestTokenResourceType.DASHBOARD, "id": "some-uuid"}
]


def _identity(field: str, value: Any) -> GuestTokenUser:
    """A single-field user claim, keyed dynamically for parametrized tests."""
    return cast(GuestTokenUser, {field: value})


def test_plain_identity_is_accepted() -> None:
    validate_guest_token_identity(
        {"username": "user@example.com", "first_name": "Ada", "last_name": "Lovelace"}
    )


def test_missing_fields_are_accepted() -> None:
    # every identity field is optional; absence must not raise
    validate_guest_token_identity({})
    validate_guest_token_identity({"username": "only-username"})


def test_missing_user_claim_is_accepted() -> None:
    validate_guest_token_identity(None)


def test_non_object_user_claim_is_rejected() -> None:
    with pytest.raises(ValueError, match="must be an object"):
        validate_guest_token_identity(cast(GuestTokenUser, "user@example.com"))


@pytest.mark.parametrize("field", GUEST_TOKEN_IDENTITY_FIELDS)
@pytest.mark.parametrize(
    "value",
    [
        "line-one\nline-two",
        "carriage\rreturn",
        "tab\tseparated",
        "trailing-newline\n",
        "null\x00byte",
        "line\u2028separator",
        "paragraph\u2029separator",
    ],
)
def test_control_characters_are_rejected(field: str, value: str) -> None:
    with pytest.raises(ValueError, match="invalid characters"):
        validate_guest_token_identity(_identity(field, value))


@pytest.mark.parametrize("field", GUEST_TOKEN_IDENTITY_FIELDS)
def test_overlong_value_is_rejected(field: str) -> None:
    with pytest.raises(ValueError, match="maximum length"):
        validate_guest_token_identity(
            _identity(field, "x" * (GUEST_TOKEN_IDENTITY_MAX_LENGTH + 1))
        )


def test_value_at_maximum_length_is_accepted() -> None:
    validate_guest_token_identity({"username": "x" * GUEST_TOKEN_IDENTITY_MAX_LENGTH})


@pytest.mark.parametrize("field", GUEST_TOKEN_IDENTITY_FIELDS)
def test_non_string_value_is_rejected(field: str) -> None:
    with pytest.raises(ValueError, match="must be a string"):
        validate_guest_token_identity(_identity(field, 123))


def test_mint_rejects_invalid_identity(app_context: None) -> None:
    sm = SupersetSecurityManager(appbuilder)
    with pytest.raises(GuestTokenIdentityError):
        sm.create_guest_access_token({"username": "bob\nalice"}, RESOURCES, [])


def _guest_request(mocker: MockerFixture, raw_token: bytes) -> Any:
    request = mocker.MagicMock()
    request.headers = {current_app.config["GUEST_TOKEN_HEADER_NAME"]: raw_token}
    request.form = {}
    return request


@pytest.mark.parametrize(
    "username",
    ["x" * (GUEST_TOKEN_IDENTITY_MAX_LENGTH + 1), "trailing-newline\n"],
    ids=["overlong", "trailing-newline"],
)
def test_invalid_identity_rejected_through_request_flow(
    mocker: MockerFixture, app_context: None, username: str
) -> None:
    """A token minted without identity validation no longer resolves to a guest."""
    sm = SupersetSecurityManager(appbuilder)
    # Stand in for a token minted before identity validation existed.
    with patch("superset.security.manager.validate_guest_token_identity"):
        raw_token = sm.create_guest_access_token({"username": username}, RESOURCES, [])

    assert sm.get_guest_user_from_request(_guest_request(mocker, raw_token)) is None


def test_valid_identity_resolves_through_request_flow(
    mocker: MockerFixture, app_context: None
) -> None:
    sm = SupersetSecurityManager(appbuilder)
    raw_token = sm.create_guest_access_token({"username": "guest"}, RESOURCES, [])

    guest_user = sm.get_guest_user_from_request(_guest_request(mocker, raw_token))
    assert guest_user is not None
    assert guest_user.username == "guest"
