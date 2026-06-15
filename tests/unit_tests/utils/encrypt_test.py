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

from unittest import mock
from unittest.mock import MagicMock

import pytest
from sqlalchemy import String
from sqlalchemy.engine import make_url
from sqlalchemy_utils.types.encrypted.encrypted_type import AesEngine, AesGcmEngine

from superset.utils.encrypt import (
    EncryptedType,
    ReEncryptStats,
    resolve_encryption_engine,
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


def test_unknown_engine_raises_fail_closed() -> None:
    """An unrecognized engine name fails closed at field construction.

    Silently falling back to unauthenticated AES-CBC would let an operator who
    typo'd the engine believe they had authenticated encryption — and, after a
    GCM migration, write new secrets as CBC into a GCM database. The error must
    not leak the configured value (it shares the config namespace as SECRET_KEY)
    but must list the valid engines so a typo is diagnosable.
    """
    with pytest.raises(
        ValueError, match="Unrecognized SQLALCHEMY_ENCRYPTED_FIELD_ENGINE"
    ) as exc_info:
        SQLAlchemyUtilsAdapter().create(
            {**SECRET, "SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": "bogus"},
            String(128),
        )
    message = str(exc_info.value)
    assert "bogus" not in message
    assert "aes" in message
    assert "aes-gcm" in message


def test_empty_engine_value_raises_fail_closed() -> None:
    """A present-but-empty engine value fails closed instead of defaulting.

    Only an *absent* key falls back to AES-CBC. An empty string (e.g. a
    blanked-out env var) must not silently degrade to unauthenticated CBC after
    a GCM migration — it routes through the same fail-closed resolver as any
    other unrecognized value.
    """
    with pytest.raises(
        ValueError, match="Unrecognized SQLALCHEMY_ENCRYPTED_FIELD_ENGINE"
    ):
        SQLAlchemyUtilsAdapter().create(
            {**SECRET, "SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": ""},
            String(128),
        )


def test_non_string_engine_value_raises_fail_closed() -> None:
    """A non-string engine value (e.g. ``None``) fails closed, not with an
    ``AttributeError``.

    A custom config override could set the engine to a non-string. That must
    take the same controlled ``ValueError`` path as any unrecognized value
    rather than raising ``AttributeError`` when the resolver normalizes it.
    """
    with pytest.raises(
        ValueError, match="Unrecognized SQLALCHEMY_ENCRYPTED_FIELD_ENGINE"
    ):
        resolve_encryption_engine(None)


def test_engine_name_is_normalized() -> None:
    """Engine names are case/separator-normalized to match the CLI's Choice."""
    for name in ("AES-GCM", "aes_gcm", " Aes-Gcm "):
        field = SQLAlchemyUtilsAdapter().create(
            {**SECRET, "SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": name},
            String(128),
        )
        assert isinstance(field.engine, AesGcmEngine)


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


def test_engine_migration_gcm_to_cbc_rolls_back() -> None:
    """GCM source value is rolled back to CBC under the same SECRET_KEY.

    The reverse of the forward migration (``--engine aes``). The idempotency
    fast-path decrypts in the *target* form first; since the target here is
    unauthenticated AES-CBC, this guards against it mis-reading the AES-GCM
    ciphertext and wrongly skipping the value instead of re-encrypting it.
    """
    gcm_value = _encrypted_type(AesGcmEngine).process_bind_param("hunter2", DIALECT)
    gcm_column = _encrypted_type(AesGcmEngine)

    migrator = _engine_migrator(AesEngine)
    conn = MagicMock()
    row = {"id": 1, "password": gcm_value}
    stats = ReEncryptStats()

    migrator._re_encrypt_row(  # noqa: SLF001
        conn, row, "dbs", {"password": gcm_column}, ["id"], stats
    )

    assert stats == ReEncryptStats(re_encrypted=1)
    new_value = conn.execute.call_args.kwargs["password"]
    assert new_value != gcm_value
    # The rolled-back value now decrypts as AES-CBC back to the plaintext.
    assert _encrypted_type(AesEngine).process_result_value(new_value, DIALECT) == (
        "hunter2"
    )


def test_rollback_authenticated_probe_wins_over_spurious_cbc_skip() -> None:
    """Rolling back to unauthenticated CBC must re-encrypt a provably-GCM value,
    never skip it — even if the unauthenticated target decrypt coincidentally
    succeeds. The authenticated (GCM) interpretation must win.

    The coincidental CBC-decrypt-of-a-GCM-blob can't be crafted deterministically
    (it's a ~2^-128 event), so this pins the *ordering invariant* instead: force
    the target (CBC) read to "succeed", and assert the value is still re-encrypted
    because the authenticated probe is consulted first and wins. Without the
    guard this row would be wrongly counted as ``skipped``.
    """
    gcm_value = _encrypted_type(AesGcmEngine).process_bind_param("hunter2", DIALECT)
    cbc_column = _encrypted_type(AesEngine)

    migrator = _engine_migrator(AesEngine)  # target = unauthenticated CBC (rollback)

    # Simulate the spurious case: the unauthenticated CBC target read "succeeds"
    # even though the value is really GCM.
    spurious_target = MagicMock()
    spurious_target.engine = AesEngine()
    spurious_target.underlying_type = cbc_column.underlying_type
    spurious_target.process_result_value.return_value = "garbage"
    spurious_target.process_bind_param.return_value = b"new-cbc-ciphertext"

    conn = MagicMock()
    row = {"id": 1, "password": gcm_value}
    stats = ReEncryptStats()

    with mock.patch.object(migrator, "_target_type", return_value=spurious_target):
        migrator._re_encrypt_row(  # noqa: SLF001
            conn, row, "dbs", {"password": cbc_column}, ["id"], stats
        )

    # Re-encrypted, NOT skipped: the GCM authenticator beat the spurious CBC read.
    assert stats == ReEncryptStats(re_encrypted=1)
    assert spurious_target.process_bind_param.call_count == 1


def test_combined_key_rotation_and_engine_migration() -> None:
    """Old-key AES-CBC value → current-key AES-GCM in a single run.

    Exercises the combined mode (``--previous_secret_key`` + ``--engine``): the
    source ciphertext is CBC under the *previous* key, and must be recovered and
    re-encrypted as GCM under the *current* key. This is the mode most likely to
    regress, since each single-mode test pins only the other's variable.
    """
    old_key = "o" * 32
    cbc_old = EncryptedType(String(1024), key=lambda: old_key, engine=AesEngine)
    old_value = cbc_old.process_bind_param("hunter2", DIALECT)
    cbc_column = _encrypted_type(AesEngine)

    migrator = _engine_migrator(AesGcmEngine)
    migrator._previous_secret_key = old_key  # noqa: SLF001  # rotate key too

    conn = MagicMock()
    row = {"id": 1, "password": old_value}
    stats = ReEncryptStats()

    migrator._re_encrypt_row(  # noqa: SLF001
        conn, row, "dbs", {"password": cbc_column}, ["id"], stats
    )

    assert stats == ReEncryptStats(re_encrypted=1)
    new_value = conn.execute.call_args.kwargs["password"]
    # The migrated value decrypts as GCM under the *current* key.
    assert _encrypted_type(AesGcmEngine).process_result_value(new_value, DIALECT) == (
        "hunter2"
    )


def _key_rotation_migrator(previous_secret_key: str) -> SecretsMigrator:
    """Build a SecretsMigrator in key-rotation mode without an app context.

    Like ``_engine_migrator`` but with no target engine: values are decrypted
    under ``previous_secret_key`` and re-encrypted under the current key using
    the column's own engine.
    """
    migrator = SecretsMigrator.__new__(SecretsMigrator)
    migrator._secret_key = SECRET_KEY  # noqa: SLF001
    migrator._target_engine = None  # noqa: SLF001
    migrator._previous_secret_key = previous_secret_key  # noqa: SLF001
    migrator._dialect = DIALECT  # noqa: SLF001
    return migrator


def test_key_rotation_for_aes_gcm_column() -> None:
    """SECRET_KEY rotation works for an AES-GCM column.

    The previous-key fallback must use the column's AES-GCM engine, otherwise
    GCM ciphertext written under the old key cannot be decrypted and the
    rotation rolls back.
    """
    old_key = "o" * 32
    gcm_old = EncryptedType(String(1024), key=lambda: old_key, engine=AesGcmEngine)
    old_value = gcm_old.process_bind_param("hunter2", DIALECT)
    gcm_column = _encrypted_type(AesGcmEngine)

    migrator = _key_rotation_migrator(previous_secret_key=old_key)
    conn = MagicMock()
    row = {"id": 1, "password": old_value}
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
