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

from superset.utils.auth_db_password import BCRYPT_MAX_PASSWORD_BYTES
from superset.utils.auth_db_password_hash import (
    hash_auth_db_password,
    is_argon2_password_hash,
    is_bcrypt_password_hash,
    verify_auth_db_password,
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
