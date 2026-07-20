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

from unittest.mock import patch

import pytest
from marshmallow import ValidationError

from superset.utils.auth_db_password import BCRYPT_MAX_PASSWORD_BYTES
from superset.utils.auth_db_password_hash import (
    _FAKE_HASH_BY_ALGORITHM,
    hash_auth_db_password,
    is_argon2_password_hash,
    is_bcrypt_password_hash,
    verify_auth_db_password,
    verify_fake_auth_db_password,
)


def test_bcrypt_hash_round_trip() -> None:
    password_hash = hash_auth_db_password("AnotherStr0ng!Pass", algorithm="bcrypt")
    assert is_bcrypt_password_hash(password_hash)
    assert verify_auth_db_password(password_hash, "AnotherStr0ng!Pass")
    assert not verify_auth_db_password(password_hash, "wrong")


def test_argon2_hash_round_trip() -> None:
    password_hash = hash_auth_db_password("AnotherStr0ng!Pass", algorithm="argon2")
    assert is_argon2_password_hash(password_hash)
    assert verify_auth_db_password(password_hash, "AnotherStr0ng!Pass")
    assert not verify_auth_db_password(password_hash, "wrong")


@pytest.mark.parametrize(
    "algorithm,expected_check",
    [
        ("BCRYPT", is_bcrypt_password_hash),
        (" bcrypt ", is_bcrypt_password_hash),
        ("Argon2", is_argon2_password_hash),
        (" ARGON2 ", is_argon2_password_hash),
    ],
)
def test_hash_auth_db_password_normalizes_explicit_algorithm(
    algorithm: str, expected_check
) -> None:
    """An explicit ``algorithm`` argument must be normalized the same way
    config-derived values are, so callers passing mixed-case/whitespace values
    (e.g. "BCRYPT") don't hit ``Unsupported AUTH_DB hash algorithm``."""
    password_hash = hash_auth_db_password("AnotherStr0ng!Pass", algorithm=algorithm)
    assert expected_check(password_hash)


def test_verify_rejects_empty_hash() -> None:
    assert not verify_auth_db_password("", "password")


def test_verify_rejects_malformed_argon2_hash() -> None:
    """Corrupted argon2 hashes must fail verification, not raise."""
    garbage_hash = "$argon2id$v=19$m=65536,t=3,p=4$garbage$garbage"
    assert is_argon2_password_hash(garbage_hash)
    assert not verify_auth_db_password(garbage_hash, "password")


def test_bcrypt_hash_rejects_password_over_max_bytes() -> None:
    with pytest.raises(ValueError, match="72-byte"):
        hash_auth_db_password("a" * (BCRYPT_MAX_PASSWORD_BYTES + 1), algorithm="bcrypt")


def test_bcrypt_hash_rejects_unencodable_password() -> None:
    with pytest.raises(ValueError, match="cannot be encoded as UTF-8"):
        hash_auth_db_password("\ud800", algorithm="bcrypt")


def test_bcrypt_verify_rejects_unencodable_password() -> None:
    password_hash = hash_auth_db_password("AnotherStr0ng!Pass", algorithm="bcrypt")
    assert not verify_auth_db_password(password_hash, "\ud800")


def test_bcrypt_verify_rejects_password_over_max_bytes() -> None:
    password_hash = hash_auth_db_password("AnotherStr0ng!Pass", algorithm="bcrypt")
    long_password = "a" * (BCRYPT_MAX_PASSWORD_BYTES + 1)
    assert not verify_auth_db_password(password_hash, long_password)


def test_bcrypt_verify_rejects_distinct_passwords_equal_after_truncation() -> None:
    base = "a" * BCRYPT_MAX_PASSWORD_BYTES
    password_hash = hash_auth_db_password(base, algorithm="bcrypt")
    assert verify_auth_db_password(password_hash, base)
    assert not verify_auth_db_password(password_hash, base + "extra")


def test_fake_hash_never_verifies() -> None:
    """The precomputed fake hashes always fail verification; only their cost
    matters, never their outcome."""
    for fake_hash in _FAKE_HASH_BY_ALGORITHM.values():
        assert not verify_auth_db_password(fake_hash, "whatever the attacker typed")


@pytest.mark.parametrize("algorithm", ["bcrypt", "argon2"])
def test_verify_fake_auth_db_password_uses_matching_algorithm(
    algorithm: str,
) -> None:
    """The fake-check path must verify through the same algorithm family a real
    user of that algorithm would use, so cost stays comparable either way."""
    with (
        patch(
            "superset.utils.auth_db_password_hash.verify_auth_db_password"
        ) as mock_verify,
    ):
        verify_fake_auth_db_password("attacker-supplied-password", algorithm=algorithm)

    mock_verify.assert_called_once()
    called_hash, called_password = mock_verify.call_args.args
    assert called_password == "attacker-supplied-password"  # noqa: S105
    if algorithm == "bcrypt":
        assert is_bcrypt_password_hash(called_hash)
    else:
        assert is_argon2_password_hash(called_hash)


def test_verify_fake_auth_db_password_matches_real_hash_format() -> None:
    """Whatever hash format `hash_auth_db_password` produces for an algorithm,
    the fake check for that same algorithm must use the same format, so a
    real user and a nonexistent user run through the same cost function."""
    for algorithm in ("bcrypt", "argon2"):
        real_hash = hash_auth_db_password("SomeStr0ng!Pass", algorithm=algorithm)
        fake_hash = _FAKE_HASH_BY_ALGORITHM[algorithm]
        assert is_bcrypt_password_hash(real_hash) == is_bcrypt_password_hash(fake_hash)
        assert is_argon2_password_hash(real_hash) == is_argon2_password_hash(fake_hash)


def test_verify_fake_auth_db_password_defaults_to_bcrypt_on_invalid_config() -> None:
    """A misconfigured AUTH_DB_CONFIG must not raise on the failed-login path;
    the fake check falls back to bcrypt instead."""
    with patch(
        "superset.utils.auth_db_password_hash.get_auth_db_password_hash_algorithm",
        side_effect=ValidationError("bad config"),
    ):
        # Must not raise.
        verify_fake_auth_db_password("attacker-supplied-password")


def test_verify_fake_auth_db_password_reads_configured_algorithm_when_omitted() -> None:
    """When ``algorithm`` is omitted, the configured AUTH_DB algorithm is used."""
    with (
        patch(
            "superset.utils.auth_db_password_hash.get_auth_db_password_hash_algorithm",
            return_value="argon2",
        ),
        patch(
            "superset.utils.auth_db_password_hash.verify_auth_db_password"
        ) as mock_verify,
    ):
        verify_fake_auth_db_password("attacker-supplied-password")

    called_hash, _ = mock_verify.call_args.args
    assert is_argon2_password_hash(called_hash)
