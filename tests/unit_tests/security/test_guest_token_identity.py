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

import pytest

from superset.security.guest_token import (
    GUEST_TOKEN_IDENTITY_MAX_LENGTH,
    GuestTokenUser,
    validate_guest_token_identity,
)


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


@pytest.mark.parametrize("field", ["username", "first_name", "last_name"])
@pytest.mark.parametrize(
    "value",
    [
        "line-one\nline-two",
        "carriage\rreturn",
        "tab\tseparated",
        "trailing-newline\n",
        "null\x00byte",
    ],
)
def test_control_characters_are_rejected(field: str, value: str) -> None:
    with pytest.raises(ValueError, match="invalid characters"):
        validate_guest_token_identity(_identity(field, value))


@pytest.mark.parametrize("field", ["username", "first_name", "last_name"])
def test_overlong_value_is_rejected(field: str) -> None:
    with pytest.raises(ValueError, match="maximum length"):
        validate_guest_token_identity(
            _identity(field, "x" * (GUEST_TOKEN_IDENTITY_MAX_LENGTH + 1))
        )


def test_value_at_maximum_length_is_accepted() -> None:
    validate_guest_token_identity({"username": "x" * GUEST_TOKEN_IDENTITY_MAX_LENGTH})


@pytest.mark.parametrize("field", ["username", "first_name", "last_name"])
def test_non_string_value_is_rejected(field: str) -> None:
    with pytest.raises(ValueError, match="must be a string"):
        validate_guest_token_identity(_identity(field, 123))
