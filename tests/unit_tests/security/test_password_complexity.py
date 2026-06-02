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
from flask import current_app
from flask_appbuilder.exceptions import PasswordComplexityValidationError

from superset.security.password_complexity import validate_password_complexity


def test_validate_password_complexity_accepts_strong_password() -> None:
    # No exception for a sufficiently long, uncommon password.
    validate_password_complexity("a-Good-Long-Passphrase-42")


def test_validate_password_complexity_rejects_short_password() -> None:
    with pytest.raises(PasswordComplexityValidationError):
        validate_password_complexity("short1")  # < 8 chars


def test_validate_password_complexity_rejects_common_password() -> None:
    # Common even though length >= 8.
    with pytest.raises(PasswordComplexityValidationError):
        validate_password_complexity("password123")
    # Case-insensitive.
    with pytest.raises(PasswordComplexityValidationError):
        validate_password_complexity("PASSWORD123")


def test_validate_password_complexity_honors_configured_min_length() -> None:
    original = current_app.config.get("AUTH_PASSWORD_MIN_LENGTH")
    current_app.config["AUTH_PASSWORD_MIN_LENGTH"] = 16
    try:
        with pytest.raises(PasswordComplexityValidationError):
            validate_password_complexity("only12chars!")  # 12 < 16
    finally:
        current_app.config["AUTH_PASSWORD_MIN_LENGTH"] = original


def test_validate_password_complexity_honors_extra_blocklist() -> None:
    original = current_app.config.get("AUTH_PASSWORD_COMMON_BLOCKLIST")
    current_app.config["AUTH_PASSWORD_COMMON_BLOCKLIST"] = ["AcmeCorp2024"]
    try:
        with pytest.raises(PasswordComplexityValidationError):
            validate_password_complexity("acmecorp2024")
    finally:
        current_app.config["AUTH_PASSWORD_COMMON_BLOCKLIST"] = original
