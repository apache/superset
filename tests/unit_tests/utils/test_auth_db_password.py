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

import re
from pathlib import Path

import pytest
from marshmallow import ValidationError
from werkzeug.security import generate_password_hash

from superset.utils.auth_db_password import (
    _COMMON_PASSWORDS,
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
    """A password meeting every policy rule passes validation."""
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
    """Passwords missing a required rule are rejected."""
    with pytest.raises(ValidationError):
        validate_auth_db_password(password, _POLICY)


def test_common_passwords_stay_in_sync_with_frontend() -> None:
    """Frontend blocklist must match ``_COMMON_PASSWORDS`` (no client/server drift)."""
    ts_path = (
        Path(__file__).resolve().parents[3]
        / "superset-frontend/src/utils/generateAuthDbPassword.ts"
    )
    ts_source = ts_path.read_text(encoding="utf-8")
    match = re.search(
        r"export const AUTH_DB_COMMON_PASSWORDS = new Set\(\s*\[([\s\S]*?)\]\.map",
        ts_source,
    )
    assert match is not None
    frontend_passwords = {
        token.lower() for token in re.findall(r"'([^']*)'", match.group(1))
    }
    assert frontend_passwords
    assert frontend_passwords == set(_COMMON_PASSWORDS)


def test_validate_auth_db_password_rejects_common_password() -> None:
    """A password on the common-password blocklist is rejected."""
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
    """A zero minimum length disables the length check, allowing empty input."""
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


def test_validate_auth_db_password_rejects_bcrypt_password_over_max_bytes() -> None:
    """bcrypt truncates beyond 72 UTF-8 bytes; reject longer passwords explicitly."""
    cfg = {
        "password_min_length": 0,
        "password_require_uppercase": False,
        "password_require_lowercase": False,
        "password_require_digit": False,
        "password_require_special": False,
        "password_common_list_check": False,
        "password_hash_algorithm": "bcrypt",
    }
    with pytest.raises(ValidationError):
        validate_auth_db_password("a" * 73, cfg)


def test_validate_auth_db_password_rejects_unencodable_password() -> None:
    cfg = {
        "password_min_length": 0,
        "password_require_uppercase": False,
        "password_require_lowercase": False,
        "password_require_digit": False,
        "password_require_special": False,
        "password_common_list_check": False,
        "password_hash_algorithm": "bcrypt",
    }
    with pytest.raises(ValidationError, match="cannot be encoded as UTF-8"):
        validate_auth_db_password("\ud800", cfg)


def test_validate_auth_db_password_allows_long_password_for_argon2() -> None:
    """Argon2 has no bcrypt-style byte cap; long passwords remain valid."""
    cfg = {
        "password_min_length": 0,
        "password_require_uppercase": False,
        "password_require_lowercase": False,
        "password_require_digit": False,
        "password_require_special": False,
        "password_common_list_check": False,
        "password_hash_algorithm": "argon2",
    }
    validate_auth_db_password("a" * 100, cfg)


def test_get_auth_db_password_hash_algorithm_default_bcrypt() -> None:
    """An empty config defaults the hash algorithm to bcrypt."""
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
    """Valid algorithm values are normalized (case/whitespace) to the canonical name."""
    assert (
        get_auth_db_password_hash_algorithm({"password_hash_algorithm": config_value})
        == expected_algorithm
    )


def test_get_auth_db_password_hash_method_alias() -> None:
    """The hash-method alias resolves to the same default as the algorithm getter."""
    assert get_auth_db_password_hash_method({}) == "bcrypt"


def test_get_auth_db_password_hash_algorithm_rejects_invalid_algorithm() -> None:
    """An unsupported algorithm name raises a validation error."""
    with pytest.raises(ValidationError) as exc:
        get_auth_db_password_hash_algorithm({"password_hash_algorithm": "scrypt"})

    assert "password_hash_algorithm" in exc.value.messages


def test_hash_auth_db_password_default_uses_bcrypt() -> None:
    """Hashing without an explicit algorithm produces a verifiable bcrypt hash."""
    password_hash = hash_auth_db_password("GoodStr0ng!Pass")
    assert is_bcrypt_password_hash(password_hash)
    assert verify_auth_db_password(password_hash, "GoodStr0ng!Pass")


def test_hash_auth_db_password_argon2() -> None:
    """Hashing with the argon2 algorithm produces a verifiable argon2 hash."""
    password_hash = hash_auth_db_password("GoodStr0ng!Pass", algorithm="argon2")
    assert is_argon2_password_hash(password_hash)
    assert verify_auth_db_password(password_hash, "GoodStr0ng!Pass")


def test_verify_auth_db_password_supports_legacy_werkzeug_hash() -> None:
    """Legacy Werkzeug (scrypt) hashes remain verifiable for backward compatibility."""
    legacy_hash = generate_password_hash("legacy-password", method="scrypt")
    assert verify_auth_db_password(legacy_hash, "legacy-password")
    assert not verify_auth_db_password(legacy_hash, "wrong-password")
