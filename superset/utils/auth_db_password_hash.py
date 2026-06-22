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
"""Hash and verify AUTH_DB passwords using bcrypt or argon2."""

from __future__ import annotations

import re

import bcrypt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHash, VerifyMismatchError
from werkzeug.security import check_password_hash

from superset.utils.auth_db_password import get_auth_db_password_hash_algorithm

_BCRYPT_HASH_RE = re.compile(r"^\$2[aby]\$\d{2}\$")
_ARGON2_HASH_PREFIX = "$argon2"

_argon2_hasher = PasswordHasher()


def is_bcrypt_password_hash(password_hash: str) -> bool:
    """Return True when ``password_hash`` uses the bcrypt wire format."""
    return bool(_BCRYPT_HASH_RE.match(password_hash))


def is_argon2_password_hash(password_hash: str) -> bool:
    """Return True when ``password_hash`` uses the argon2 wire format."""
    return password_hash.startswith(_ARGON2_HASH_PREFIX)


def hash_auth_db_password(password: str, algorithm: str | None = None) -> str:
    """
    Hash a plaintext password for AUTH_DB storage.

    Uses ``AUTH_DB_CONFIG["password_hash_algorithm"]`` when ``algorithm`` is omitted.
    """
    resolved = algorithm or get_auth_db_password_hash_algorithm()
    if resolved == "argon2":
        return _argon2_hasher.hash(password)
    if resolved == "bcrypt":
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    raise ValueError(f"Unsupported AUTH_DB hash algorithm: {resolved}")


def verify_auth_db_password(password_hash: str, password: str) -> bool:
    """
    Verify a candidate password against a stored hash.

    Supports bcrypt, argon2, and legacy Werkzeug hashes (for example scrypt, pbkdf2)
    so existing users can log in until they rotate their password.
    """
    if not password_hash:
        return False
    if is_bcrypt_password_hash(password_hash):
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"),
                password_hash.encode("utf-8"),
            )
        except (ValueError, TypeError):
            return False
    if is_argon2_password_hash(password_hash):
        try:
            _argon2_hasher.verify(password_hash, password)
            return True
        except (VerifyMismatchError, InvalidHash):
            return False
    return check_password_hash(password_hash, password)
