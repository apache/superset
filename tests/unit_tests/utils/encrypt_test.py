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

from unittest.mock import MagicMock

from sqlalchemy import String
from sqlalchemy.engine import make_url
from sqlalchemy_utils.types.encrypted.encrypted_type import AesEngine, AesGcmEngine

from superset.utils.encrypt import (
    EncryptedType,
    ReEncryptStats,
    SecretsMigrator,
    SQLAlchemyUtilsAdapter,
)

SECRET = {"SECRET_KEY": "x" * 32}
SECRET_KEY = "k" * 32
DIALECT = make_url("sqlite://").get_dialect()


def _encrypted_type(engine: type) -> EncryptedType:
    """A standalone EncryptedType for a given engine under SECRET_KEY."""
    return EncryptedType(String(1024), key=lambda: SECRET_KEY, engine=engine)


def _engine_migrator(target_engine: type) -> SecretsMigrator:
    """Build a SecretsMigrator in engine-migration mode without an app context.

    ``__init__`` reads ``current_app`` and the DB dialect, so — like the
    existing row-level tests that override ``_dialect`` — we set the few
    attributes ``_re_encrypt_row`` actually uses directly.
    """
    migrator = SecretsMigrator.__new__(SecretsMigrator)
    migrator._secret_key = SECRET_KEY  # noqa: SLF001
    migrator._target_engine = target_engine  # noqa: SLF001
    # Engine migration keeps the SECRET_KEY; previous key defaults to current.
    migrator._previous_secret_key = SECRET_KEY  # noqa: SLF001
    migrator._dialect = DIALECT  # noqa: SLF001
    return migrator


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


def test_engine_migration_cbc_to_gcm_re_encrypts() -> None:
    """CBC source value is re-encrypted into GCM under the same SECRET_KEY.

    Mirrors the recommended runbook: the migrator runs while the config still
    points at AES-CBC (the column type), re-encrypting into AES-GCM.
    """
    cbc = _encrypted_type(AesEngine)
    ciphertext = cbc.process_bind_param("hunter2", DIALECT)

    migrator = _engine_migrator(AesGcmEngine)
    conn = MagicMock()
    row = {"id": 1, "password": ciphertext}
    stats = ReEncryptStats()

    migrator._re_encrypt_row(  # noqa: SLF001
        conn, row, "dbs", {"password": cbc}, ["id"], stats
    )

    assert stats == ReEncryptStats(re_encrypted=1)
    assert conn.execute.call_count == 1
    new_value = conn.execute.call_args.kwargs["password"]
    # The stored value changed and now decrypts as GCM back to the plaintext.
    assert new_value != ciphertext
    gcm = _encrypted_type(AesGcmEngine)
    assert gcm.process_result_value(new_value, DIALECT) == "hunter2"


def test_engine_migration_idempotent_for_already_target() -> None:
    """A value already in the target (GCM) form is skipped — runs are resumable.

    The column is still configured as CBC (config not yet flipped), but the
    value has already been migrated to GCM, so it must be left untouched.
    """
    gcm_value = _encrypted_type(AesGcmEngine).process_bind_param("hunter2", DIALECT)
    cbc_column = _encrypted_type(AesEngine)

    migrator = _engine_migrator(AesGcmEngine)
    conn = MagicMock()
    row = {"id": 1, "password": gcm_value}
    stats = ReEncryptStats()

    migrator._re_encrypt_row(  # noqa: SLF001
        conn, row, "dbs", {"password": cbc_column}, ["id"], stats
    )

    assert stats == ReEncryptStats(skipped=1)
    assert conn.execute.call_count == 0


def test_engine_migration_reads_cbc_after_config_already_flipped() -> None:
    """CBC source is still migrated when the config was flipped to GCM first.

    If an operator sets the config engine to GCM before running the migrator,
    the column type can no longer read the CBC value; the previous-key (== the
    current key) AES-CBC decryptor recovers it and it is re-encrypted as GCM.
    """
    cbc_value = _encrypted_type(AesEngine).process_bind_param("hunter2", DIALECT)
    gcm_column = _encrypted_type(AesGcmEngine)

    migrator = _engine_migrator(AesGcmEngine)
    conn = MagicMock()
    row = {"id": 1, "password": cbc_value}
    stats = ReEncryptStats()

    migrator._re_encrypt_row(  # noqa: SLF001
        conn, row, "dbs", {"password": gcm_column}, ["id"], stats
    )

    assert stats == ReEncryptStats(re_encrypted=1)
    new_value = conn.execute.call_args.kwargs["password"]
    assert gcm_column.process_result_value(new_value, DIALECT) == "hunter2"


def test_engine_migration_unreadable_value_counts_as_failure() -> None:
    """A value no engine/key can read is a failure, not a silent pass-through."""
    migrator = _engine_migrator(AesGcmEngine)
    conn = MagicMock()
    row = {"id": 1, "password": b"not-valid-ciphertext"}
    stats = ReEncryptStats()

    migrator._re_encrypt_row(  # noqa: SLF001
        conn, row, "dbs", {"password": _encrypted_type(AesEngine)}, ["id"], stats
    )

    assert stats == ReEncryptStats(failed=1)
    assert conn.execute.call_count == 0
