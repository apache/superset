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
"""Password policy helpers for AUTH_DB (database authentication)."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from flask import current_app as app
from marshmallow import ValidationError

# Defaults are merged with ``AUTH_DB_CONFIG`` from Flask config (partial overrides).
AUTH_DB_DEFAULTS: dict[str, Any] = {
    "password_min_length": 12,
    "password_require_uppercase": True,
    "password_require_lowercase": True,
    "password_require_digit": True,
    "password_require_special": True,
    "password_common_list_check": True,
    "password_hash_algorithm": "bcrypt",
    "reset_token_expiry_minutes": 30,
    "reset_rate_limit": "5 per 15 minutes",
    "login_rate_limit": "10 per 5 minutes",
    "login_max_failures": 5,
    "login_lockout_duration_minutes": 15,
}

_PUBLIC_PASSWORD_POLICY_KEYS: tuple[str, ...] = (
    "password_min_length",
    "password_require_uppercase",
    "password_require_lowercase",
    "password_require_digit",
    "password_require_special",
    "password_common_list_check",
)

_SUPPORTED_HASH_ALGORITHMS: frozenset[str] = frozenset({"bcrypt", "argon2"})

# bcrypt silently truncates input beyond this UTF-8 byte limit.
BCRYPT_MAX_PASSWORD_BYTES: int = 72

_COMMON_PASSWORDS: frozenset[str] = frozenset(
    password.lower()
    for password in {
        "password",
        "password1",
        "password123",
        "123456",
        "12345678",
        "123456789",
        "qwerty",
        "abc123",
        "monkey",
        "letmein",
        "trustno1",
        "dragon",
        "baseball",
        "iloveyou",
        "master",
        "sunshine",
        "ashley",
        "bailey",
        "shadow",
        "superman",
        "qazwsx",
        "michael",
        "football",
        "welcome",
        "jesus",
        "ninja",
        "mustang",
        "password1!",
        "admin",
        "admin123",
        "root",
        "toor",
        "guest",
        "p@ssw0rd",
        "Passw0rd",
        "Password1",
        "Password123",
        "Welcome1",
        "Qwerty123",
    }
)


def get_merged_auth_db_config() -> dict[str, Any]:
    """Return ``AUTH_DB_DEFAULTS`` merged with ``AUTH_DB_CONFIG`` from app config."""
    overrides: Any = app.config.get("AUTH_DB_CONFIG") or {}
    if not isinstance(overrides, Mapping):
        raise ValidationError(
            {
                "AUTH_DB_CONFIG": [
                    "Invalid AUTH_DB_CONFIG. Expected a mapping of policy options."
                ]
            }
        )
    return {**AUTH_DB_DEFAULTS, **overrides}


def get_auth_db_login_rate_limit_string() -> str:
    """
    Return the configured AUTH_DB ``login_rate_limit`` string for Flask-Limiter.

    Used for endpoints that verify a password (for example ``PUT /api/v1/me/password``).
    """
    return str(
        get_merged_auth_db_config().get(
            "login_rate_limit", AUTH_DB_DEFAULTS["login_rate_limit"]
        )
    )


def get_public_auth_db_password_policy(
    cfg: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Return non-secret AUTH_DB password policy options for frontend validation UI.
    """
    merged_cfg = cfg if cfg is not None else get_merged_auth_db_config()
    return {
        key: merged_cfg.get(key, AUTH_DB_DEFAULTS[key])
        for key in _PUBLIC_PASSWORD_POLICY_KEYS
    }


def get_auth_db_password_hash_algorithm(cfg: dict[str, Any] | None = None) -> str:
    """
    Return the password hash algorithm for AUTH_DB.

    ``AUTH_DB_CONFIG["password_hash_algorithm"]`` accepts ``bcrypt`` (default)
    or ``argon2``.
    """
    merged_cfg = cfg if cfg is not None else get_merged_auth_db_config()
    raw_algorithm: Any = merged_cfg.get(
        "password_hash_algorithm", AUTH_DB_DEFAULTS["password_hash_algorithm"]
    )
    algorithm = str(raw_algorithm).strip().lower()
    if algorithm not in _SUPPORTED_HASH_ALGORITHMS:
        supported = ", ".join(sorted(_SUPPORTED_HASH_ALGORITHMS))
        raise ValidationError(
            {
                "password_hash_algorithm": [
                    "Invalid AUTH_DB_CONFIG.password_hash_algorithm. "
                    f"Expected one of: {supported}."
                ]
            }
        )
    return algorithm


def get_auth_db_password_hash_method(cfg: dict[str, Any] | None = None) -> str:
    """Backward-compatible alias for :func:`get_auth_db_password_hash_algorithm`."""
    return get_auth_db_password_hash_algorithm(cfg)


def resolve_password_min_length(cfg: dict[str, Any]) -> int:
    """
    Coerce ``password_min_length`` to a non-negative int.

    Falls back to the default for missing or malformed config values so an
    invalid operator setting cannot raise at request time. Mirrors the frontend
    ``resolveAuthDbPasswordMinLength``.
    """
    default = int(AUTH_DB_DEFAULTS["password_min_length"])
    raw = cfg.get("password_min_length", default)
    try:
        min_len = int(raw)
    except (TypeError, ValueError):
        return default
    return max(min_len, 0)


def _password_length_errors(password: str, cfg: dict[str, Any]) -> list[str]:
    min_len = resolve_password_min_length(cfg)
    if len(password) < min_len:
        return [f"Password must be at least {min_len} characters long."]
    return []


def _password_character_errors(password: str, cfg: dict[str, Any]) -> list[str]:
    errors: list[str] = []

    if cfg.get("password_require_uppercase", True) and not re.search(
        r"[A-Z]", password
    ):
        errors.append("Password must contain at least one uppercase letter.")

    if cfg.get("password_require_lowercase", True) and not re.search(
        r"[a-z]", password
    ):
        errors.append("Password must contain at least one lowercase letter.")

    if cfg.get("password_require_digit", True) and not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")

    if cfg.get("password_require_special", True) and not any(
        (not c.isalnum() and not c.isspace()) for c in password
    ):
        errors.append(
            "Password must contain at least one special character "
            "(not a letter, digit, or space)."
        )

    return errors


def _common_password_errors(password: str, cfg: dict[str, Any]) -> list[str]:
    if not cfg.get("password_common_list_check", True):
        return []
    lowered = password.lower().strip()
    if lowered in _COMMON_PASSWORDS:
        return ["This password is too common. Choose a stronger password."]
    return []


def _bcrypt_byte_limit_errors(password: str, cfg: dict[str, Any]) -> list[str]:
    if get_auth_db_password_hash_algorithm(cfg) != "bcrypt":
        return []
    try:
        encoded_length = len(password.encode("utf-8"))
    except UnicodeEncodeError:
        return ["Password cannot be encoded as UTF-8."]
    if encoded_length > BCRYPT_MAX_PASSWORD_BYTES:
        return [
            f"Password must be at most {BCRYPT_MAX_PASSWORD_BYTES} bytes when "
            "using the bcrypt hash algorithm."
        ]
    return []


def validate_auth_db_password(password: str, cfg: dict[str, Any] | None = None) -> None:
    """
    Enforce AUTH_DB password policy.

    :param password: Candidate password (plaintext).
    :param cfg: Optional merged config; loaded from the current app when omitted.
    :raises marshmallow.ValidationError: When validation fails.
    """
    cfg = cfg if cfg is not None else get_merged_auth_db_config()
    errors: list[str] = [
        *_password_length_errors(password, cfg),
        *_password_character_errors(password, cfg),
        *_common_password_errors(password, cfg),
        *_bcrypt_byte_limit_errors(password, cfg),
    ]
    if errors:
        raise ValidationError({"new_password": errors})
