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
    "reset_token_expiry_minutes": 30,
    "reset_rate_limit": "5 per 15 minutes",
    "login_rate_limit": "10 per 5 minutes",
    "login_max_failures": 5,
    "login_lockout_duration_minutes": 15,
}

_COMMON_PASSWORDS = frozenset(
    {
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
    overrides = app.config.get("AUTH_DB_CONFIG") or {}
    return {**AUTH_DB_DEFAULTS, **overrides}


def validate_auth_db_password(password: str, cfg: dict[str, Any] | None = None) -> None:
    """
    Enforce AUTH_DB password policy.

    :param password: Candidate password (plaintext).
    :param cfg: Optional merged config; loaded from the current app when omitted.
    :raises marshmallow.ValidationError: When validation fails.
    """
    cfg = cfg if cfg is not None else get_merged_auth_db_config()
    errors: list[str] = []

    min_len = int(cfg.get("password_min_length", AUTH_DB_DEFAULTS["password_min_length"]))
    if len(password) < min_len:
        errors.append(f"Password must be at least {min_len} characters long.")

    if cfg.get("password_require_uppercase", True) and not re.search(r"[A-Z]", password):
        errors.append("Password must contain at least one uppercase letter.")

    if cfg.get("password_require_lowercase", True) and not re.search(r"[a-z]", password):
        errors.append("Password must contain at least one lowercase letter.")

    if cfg.get("password_require_digit", True) and not re.search(r"\d", password):
        errors.append("Password must contain at least one digit.")

    if cfg.get("password_require_special", True) and not any(
        (not c.isalnum() and not c.isspace()) for c in password
    ):
        errors.append(
            "Password must contain at least one special (non-alphanumeric) character."
        )

    if cfg.get("password_common_list_check", True):
        lowered = password.lower().strip()
        if lowered in _COMMON_PASSWORDS:
            errors.append("This password is too common. Choose a stronger password.")

    if errors:
        raise ValidationError({"new_password": errors})
