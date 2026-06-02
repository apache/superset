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

from sqlalchemy import String
from sqlalchemy_utils.types.encrypted.encrypted_type import AesEngine, AesGcmEngine

from superset.utils.encrypt import SQLAlchemyUtilsAdapter

SECRET = {"SECRET_KEY": "x" * 32}


def test_default_engine_is_aes_cbc() -> None:
    """Without config, the adapter keeps the historical AES-CBC engine."""
    field = SQLAlchemyUtilsAdapter().create(SECRET, String(128))
    assert isinstance(field.engine, AesEngine)


def test_aes_gcm_engine_selected_by_config() -> None:
    """SQLALCHEMY_ENCRYPTED_FIELD_ENGINE='aes-gcm' selects authenticated AES-GCM."""
    field = SQLAlchemyUtilsAdapter().create(
        {**SECRET, "SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": "aes-gcm"},
        String(128),
    )
    assert isinstance(field.engine, AesGcmEngine)


def test_unknown_engine_falls_back_to_aes_cbc() -> None:
    """An unrecognized engine name falls back to the safe historical default."""
    field = SQLAlchemyUtilsAdapter().create(
        {**SECRET, "SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": "bogus"},
        String(128),
    )
    assert isinstance(field.engine, AesEngine)


def test_explicit_engine_kwarg_takes_precedence() -> None:
    """An explicit engine kwarg overrides the config (used by the migrator)."""
    field = SQLAlchemyUtilsAdapter().create(
        {**SECRET, "SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": "aes-gcm"},
        String(128),
        engine=AesEngine,
    )
    assert isinstance(field.engine, AesEngine)
