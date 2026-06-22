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

import pytest
from marshmallow import ValidationError
from werkzeug.security import generate_password_hash

from superset.utils.auth_db_password import (
    get_auth_db_password_hash_algorithm,
    get_auth_db_password_hash_method,
    validate_auth_db_password,
)
from superset.utils.auth_db_password_hash import (
    hash_auth_db_password,
    is_argon2_password_hash,
    is_bcrypt_password_hash,
    verify_auth_db_password,
)

_POLICY = {
    "password_min_length": 12,
    "password_require_uppercase": True,
    "password_require_lowercase": True,
    "password_require_digit": True,
    "password_require_special": True,
    "password_common_list_check": True,
}


def test_validate_auth_db_password_accepts_strong_password() -> None:
    validate_auth_db_password("GoodStr0ng!Pass", _POLICY)


@pytest.mark.parametrize(
    "password",
    [
        "short",
        "nouppercase123!",
        "NOLOWERCASE123!",
        "NoDigitsHere!!!!",
        "NoSpecial123456",
    ],
)
def test_validate_auth_db_password_rejects_weak_passwords(password: str) -> None:
    with pytest.raises(ValidationError):
        validate_auth_db_password(password, _POLICY)


def test_validate_auth_db_password_rejects_common_password() -> None:
    cfg = {
        "password_min_length": 6,
        "password_require_uppercase": False,
        "password_require_lowercase": False,
        "password_require_digit": False,
        "password_require_special": False,
        "password_common_list_check": True,
    }
    with pytest.raises(ValidationError):
        validate_auth_db_password("password", cfg)


def test_validate_auth_db_password_accepts_any_length_when_min_length_is_zero() -> None:
    cfg = {
        "password_min_length": 0,
        "password_require_uppercase": False,
        "password_require_lowercase": False,
        "password_require_digit": False,
        "password_require_special": False,
        "password_common_list_check": False,
    }
    validate_auth_db_password("", cfg)
    validate_auth_db_password("a", cfg)


def test_validate_auth_db_password_rejects_mixed_case_common_password() -> None:
    """Blocklist entries are stored lowercase; mixed-case input must still match."""
    cfg = {
        "password_min_length": 6,
        "password_require_uppercase": False,
        "password_require_lowercase": False,
        "password_require_digit": False,
        "password_require_special": False,
        "password_common_list_check": True,
    }
    with pytest.raises(ValidationError):
        validate_auth_db_password("Passw0rd", cfg)


def test_get_auth_db_password_hash_algorithm_default_bcrypt() -> None:
    assert get_auth_db_password_hash_algorithm({}) == "bcrypt"


@pytest.mark.parametrize(
    "config_value,expected_algorithm",
    [
        ("bcrypt", "bcrypt"),
        ("BCRYPT", "bcrypt"),
        ("argon2", "argon2"),
        (" argon2 ", "argon2"),
    ],
)
def test_get_auth_db_password_hash_algorithm_valid_values(
    config_value: str, expected_algorithm: str
) -> None:
    assert (
        get_auth_db_password_hash_algorithm({"password_hash_algorithm": config_value})
        == expected_algorithm
    )


def test_get_auth_db_password_hash_method_alias() -> None:
    assert get_auth_db_password_hash_method({}) == "bcrypt"


def test_get_auth_db_password_hash_algorithm_rejects_invalid_algorithm() -> None:
    with pytest.raises(ValidationError) as exc:
        get_auth_db_password_hash_algorithm({"password_hash_algorithm": "scrypt"})

    assert "password_hash_algorithm" in exc.value.messages


def test_hash_auth_db_password_default_uses_bcrypt() -> None:
    password_hash = hash_auth_db_password("GoodStr0ng!Pass")
    assert is_bcrypt_password_hash(password_hash)
    assert verify_auth_db_password(password_hash, "GoodStr0ng!Pass")


def test_hash_auth_db_password_argon2() -> None:
    password_hash = hash_auth_db_password("GoodStr0ng!Pass", algorithm="argon2")
    assert is_argon2_password_hash(password_hash)
    assert verify_auth_db_password(password_hash, "GoodStr0ng!Pass")


def test_verify_auth_db_password_supports_legacy_werkzeug_hash() -> None:
    legacy_hash = generate_password_hash("legacy-password", method="scrypt")
    assert verify_auth_db_password(legacy_hash, "legacy-password")
    assert not verify_auth_db_password(legacy_hash, "wrong-password")
