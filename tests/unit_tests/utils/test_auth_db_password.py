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

from superset.utils.auth_db_password import validate_auth_db_password

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
