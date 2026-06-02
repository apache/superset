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
"""Superset password-complexity validator.

Wired in via ``FAB_PASSWORD_COMPLEXITY_VALIDATOR`` (with
``FAB_PASSWORD_COMPLEXITY_ENABLED``). Flask-AppBuilder runs this callable from
both the WTForms password fields (self-registration, user edit, reset password)
and the User REST API, so a single function enforces the policy across all
password-setting flows.

The default policy is a minimum length plus a common-password blocklist —
intentionally less draconian than FAB's built-in ``default_password_complexity``
(which requires 2 uppercase, 1 special, 2 digits, 3 lowercase and length 10).
"""

from __future__ import annotations

from flask import current_app
from flask_appbuilder.exceptions import PasswordComplexityValidationError
from flask_babel import gettext as __

# A small built-in blocklist of the most common/guessable passwords. Operators
# can extend it with AUTH_PASSWORD_COMMON_BLOCKLIST. (A fuller list or a
# Have-I-Been-Pwned k-anonymity check is a possible follow-up.)
COMMON_PASSWORDS: frozenset[str] = frozenset(
    {
        "123456",
        "123456789",
        "12345678",
        "1234567890",
        "12345",
        "111111",
        "123123",
        "000000",
        "password",
        "password1",
        "password123",
        "passw0rd",
        "qwerty",
        "qwerty123",
        "qwertyuiop",
        "abc123",
        "letmein",
        "welcome",
        "welcome1",
        "admin",
        "admin123",
        "administrator",
        "root",
        "superset",
        "changeme",
        "iloveyou",
        "monkey",
        "dragon",
        "sunshine",
        "princess",
        "football",
        "baseball",
        "trustno1",
        "login",
        "master",
        "hello123",
        "secret",
        "default",
    }
)

DEFAULT_MIN_LENGTH = 8


def validate_password_complexity(password: str) -> None:
    """Validate a plaintext password against the configured policy.

    :raises PasswordComplexityValidationError: if the password is too short or
        appears in the common-password blocklist.
    """
    min_length = current_app.config.get("AUTH_PASSWORD_MIN_LENGTH", DEFAULT_MIN_LENGTH)
    if len(password) < min_length:
        raise PasswordComplexityValidationError(
            __(
                "Password must be at least %(min_length)s characters long.",
                min_length=min_length,
            )
        )

    extra = current_app.config.get("AUTH_PASSWORD_COMMON_BLOCKLIST") or []
    blocklist = COMMON_PASSWORDS | {str(item).lower() for item in extra}
    if password.lower() in blocklist:
        raise PasswordComplexityValidationError(
            __("This password is too common; please choose a less guessable one.")
        )
