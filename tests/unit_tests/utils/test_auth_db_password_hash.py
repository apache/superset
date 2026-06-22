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
