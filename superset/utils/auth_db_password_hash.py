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
from re import Pattern

import bcrypt
from argon2 import PasswordHasher
from argon2.exceptions import Argon2Error
from marshmallow import ValidationError
from werkzeug.security import check_password_hash

from superset.utils.auth_db_password import (
    BCRYPT_MAX_PASSWORD_BYTES,
    get_auth_db_password_hash_algorithm,
)

_BCRYPT_HASH_RE: Pattern[str] = re.compile(r"^\$2[aby]\$\d{2}\$")
_ARGON2_HASH_PREFIX: str = "$argon2"

_argon2_hasher: PasswordHasher = PasswordHasher()

# Precomputed fake hashes used only to balance failed-login timing (see
# ``verify_fake_auth_db_password``). Generated once with the same cost
# parameters ``hash_auth_db_password`` uses (``bcrypt.gensalt()`` default
# rounds, and the shared ``_argon2_hasher`` defaults) so verifying against
# them costs the same as verifying a real bcrypt/argon2 user hash. The
# plaintext behind these hashes is never used or checked.
_FAKE_BCRYPT_HASH: str = "$2b$12$U.woMLPB.Z94fGjO/goHCOwxcdKnwwJb2Efy6.rB5nDZvKVx87FS2"  # noqa: S105
_FAKE_ARGON2_HASH: str = (
    "$argon2id$v=19$m=65536,t=3,p=4$Ujw4S5P275e1ag7wAJjVBg$"  # noqa: S105
    "XkZ94mZLUFad1/7XHnVt6iWwHbcQ/qwDGBUjY2GnEzg"
)
_FAKE_HASH_BY_ALGORITHM: dict[str, str] = {
    "bcrypt": _FAKE_BCRYPT_HASH,
    "argon2": _FAKE_ARGON2_HASH,
}


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
    An explicit ``algorithm`` is normalized (case/whitespace) the same way
    config-derived values are, so direct callers get the same contract as
    ``get_auth_db_password_hash_algorithm``.
    """
    resolved: str = (
        algorithm.strip().lower()
        if algorithm
        else get_auth_db_password_hash_algorithm()
    )
    if resolved == "argon2":
        return _argon2_hasher.hash(password)
    if resolved == "bcrypt":
        try:
            encoded: bytes = password.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ValueError("Password cannot be encoded as UTF-8.") from exc
        if len(encoded) > BCRYPT_MAX_PASSWORD_BYTES:
            raise ValueError(
                f"Password exceeds bcrypt's {BCRYPT_MAX_PASSWORD_BYTES}-byte limit."
            )
        return bcrypt.hashpw(encoded, bcrypt.gensalt()).decode("utf-8")
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
            encoded: bytes = password.encode("utf-8")
        except UnicodeEncodeError:
            return False
        if len(encoded) > BCRYPT_MAX_PASSWORD_BYTES:
            return False
        try:
            return bcrypt.checkpw(
                encoded,
                password_hash.encode("utf-8"),
            )
        except (ValueError, TypeError):
            return False
    if is_argon2_password_hash(password_hash):
        try:
            _argon2_hasher.verify(password_hash, password)
            return True
        except (Argon2Error, TypeError, ValueError):
            return False
    try:
        return check_password_hash(password_hash, password)
    except ValueError:
        return False


def verify_fake_auth_db_password(password: str, algorithm: str | None = None) -> None:
    """
    Run a throwaway password verification to balance failed-login timing.

    Callers use this when a username does not exist or an account is
    inactive, so that branch costs the same as verifying a real user's
    password. Verifies ``password`` against a precomputed fake hash using
    ``algorithm`` (or ``AUTH_DB_CONFIG["password_hash_algorithm"]`` when
    omitted), matching the cost of the ``verify_auth_db_password`` call a
    real user would take. Falls back to bcrypt if ``AUTH_DB_CONFIG`` is
    misconfigured, since this runs on a failed-login path that must not
    raise. The result is intentionally discarded.
    """
    if algorithm is None:
        try:
            algorithm = get_auth_db_password_hash_algorithm()
        except ValidationError:
            algorithm = "bcrypt"
    fake_hash = _FAKE_HASH_BY_ALGORITHM.get(algorithm, _FAKE_BCRYPT_HASH)
    verify_auth_db_password(fake_hash, password)
