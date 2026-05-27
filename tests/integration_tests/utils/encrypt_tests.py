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
from typing import Any, Optional

import pytest
from sqlalchemy import String, TypeDecorator
from sqlalchemy_utils import EncryptedType
from sqlalchemy_utils.types.encrypted.encrypted_type import StringEncryptedType

from superset.extensions import encrypted_field_factory
from superset.utils.encrypt import (
    AbstractEncryptedFieldAdapter,
    ReEncryptStats,
    SecretsMigrator,
    SQLAlchemyUtilsAdapter,
)
from tests.integration_tests.base_tests import SupersetTestCase


class CustomEncFieldAdapter(AbstractEncryptedFieldAdapter):
    def create(
        self,
        app_config: Optional[dict[str, Any]],
        *args: list[Any],
        **kwargs: Optional[dict[str, Any]],
    ) -> TypeDecorator:
        if app_config:
            return StringEncryptedType(*args, app_config["SECRET_KEY"], **kwargs)
        else:
            raise Exception("Missing app_config kwarg")


class EncryptedFieldTest(SupersetTestCase):
    def setUp(self) -> None:
        self.app.config["SQLALCHEMY_ENCRYPTED_FIELD_TYPE_ADAPTER"] = (
            SQLAlchemyUtilsAdapter
        )
        encrypted_field_factory.init_app(self.app)

        super().setUp()

    def test_create_field(self):
        field = encrypted_field_factory.create(String(1024))
        assert isinstance(field, EncryptedType)
        assert callable(field.key)
        assert self.app.config["SECRET_KEY"] == field.key()

    def test_custom_adapter(self):
        self.app.config["SQLALCHEMY_ENCRYPTED_FIELD_TYPE_ADAPTER"] = (
            CustomEncFieldAdapter
        )
        encrypted_field_factory.init_app(self.app)
        field = encrypted_field_factory.create(String(1024))
        assert isinstance(field, StringEncryptedType)
        assert not isinstance(field, EncryptedType)
        assert field.__created_by_enc_field_adapter__
        assert self.app.config["SECRET_KEY"] == field.key

    def test_ensure_encrypted_field_factory_is_used(self):
        """
        Ensure that the EncryptedFieldFactory is used everywhere
        that an encrypted field is needed.
        :return:
        """
        from superset.extensions import encrypted_field_factory

        migrator = SecretsMigrator("")
        encrypted_fields = migrator.discover_encrypted_fields()
        for table_name, (_table, cols) in encrypted_fields.items():
            for col_name, field in cols.items():
                if not encrypted_field_factory.created_by_enc_field_factory(field):
                    self.fail(
                        f"The encrypted column [{col_name}]"
                        f" in the table [{table_name}]"
                        " was not created using the"
                        " encrypted_field_factory"
                    )

    def test_discover_encrypted_fields_finds_dbs_table(self):
        """
        Ensure discover_encrypted_fields finds the encrypted columns on the
        dbs table (password, encrypted_extra, server_cert). This guards
        against db.metadata diverging from db.Model.metadata.
        """
        migrator = SecretsMigrator("")
        encrypted_fields = migrator.discover_encrypted_fields()
        assert "dbs" in encrypted_fields, (
            "dbs table not found in encrypted fields — "
            "discover_encrypted_fields may be using the wrong MetaData instance"
        )
        _table, dbs_cols = encrypted_fields["dbs"]
        assert {"password", "encrypted_extra", "server_cert"}.issubset(
            set(dbs_cols.keys())
        )

    def test_discover_encrypted_fields_returns_table_with_non_id_pk(self):
        """
        Ensure discover_encrypted_fields surfaces the Table object alongside
        encrypted columns, and that the PK introspection works for tables
        whose primary key is not a conventional integer `id` column
        (e.g. `semantic_layers` uses `uuid` as its PK).
        """
        # Import triggers FAB metadata registration for the semantic_layers table.
        from superset.semantic_layers.models import SemanticLayer  # noqa: F401

        migrator = SecretsMigrator("")
        encrypted_fields = migrator.discover_encrypted_fields()
        assert "semantic_layers" in encrypted_fields, (
            "semantic_layers table not found — it has an encrypted `configuration` "
            "column and should be discovered"
        )
        table, cols = encrypted_fields["semantic_layers"]
        assert "configuration" in cols
        pk_columns = [c.name for c in table.primary_key.columns]
        assert pk_columns == ["uuid"], (
            f"Expected semantic_layers PK to be ['uuid'], got {pk_columns}"
        )

    def test_lazy_key_resolution(self):
        """
        Verify that the encryption key is resolved lazily at runtime,
        not captured statically at field creation time.
        """
        original_key = self.app.config["SECRET_KEY"]
        field = encrypted_field_factory.create(String(1024))

        # Key should initially resolve to the current SECRET_KEY
        assert callable(field.key)
        assert field.key() == original_key

        # Simulate a key change (e.g. config override, env var update)
        new_key = "ROTATED_TEST_KEY_12345"
        self.app.config["SECRET_KEY"] = new_key

        # The field's key should now resolve to the new value
        assert field.key() == new_key

        # Restore original key
        self.app.config["SECRET_KEY"] = original_key
        assert field.key() == original_key

    def test_secret_key_rotation(self):
        """
        End-to-end test: encrypt data with KEY_A, rotate to KEY_B,
        run re-encryption, and verify data is accessible under KEY_B.
        """
        from sqlalchemy.engine import make_url

        key_a = self.app.config["SECRET_KEY"]
        key_b = "NEW_ROTATION_TEST_KEY_67890"
        test_value = "super_secret_password_123"

        field = encrypted_field_factory.create(String(1024))
        dialect = make_url("sqlite://").get_dialect()

        # Step 1: Encrypt with KEY_A
        encrypted_a = field.process_bind_param(test_value, dialect)
        assert encrypted_a is not None
        assert encrypted_a != test_value

        # Step 2: Verify decryption with KEY_A works
        decrypted = field.process_result_value(encrypted_a, dialect)
        assert decrypted == test_value

        # Step 3: Rotate key to KEY_B
        self.app.config["SECRET_KEY"] = key_b

        # Step 4: Re-encrypt with KEY_B (simulating SecretsMigrator logic)
        # Decrypt using previous key
        previous_field = EncryptedType(type_in=field.underlying_type, key=key_a)
        decrypted_with_prev = previous_field.process_result_value(encrypted_a, dialect)
        assert decrypted_with_prev == test_value

        # Re-encrypt using current key (KEY_B, resolved via lambda)
        encrypted_b = field.process_bind_param(decrypted_with_prev, dialect)
        assert encrypted_b is not None
        assert encrypted_b != encrypted_a  # Different ciphertext

        # Step 5: Verify decryption with KEY_B works
        decrypted_b = field.process_result_value(encrypted_b, dialect)
        assert decrypted_b == test_value

        # Step 6: Verify KEY_A can no longer decrypt the new ciphertext
        self.app.config["SECRET_KEY"] = key_a
        with pytest.raises(ValueError, match="Invalid decryption key"):
            field.process_result_value(encrypted_b, dialect)

        # Restore original key
        self.app.config["SECRET_KEY"] = key_a

    def test_re_encrypt_row_uses_pk_columns(self):
        """
        Verify SecretsMigrator builds UPDATE statements targeting the table's
        actual primary key columns rather than a hardcoded `id` column.
        Regression guard for tables like `semantic_layers` whose PK is `uuid`.
        """
        from unittest.mock import MagicMock

        from sqlalchemy.engine import make_url

        dialect = make_url("sqlite://").get_dialect()
        previous_key = "PREVIOUS_KEY_FOR_PK_COLUMN_TEST"
        migrator = SecretsMigrator(previous_key)
        migrator._dialect = dialect  # noqa: SLF001

        # Encrypt under the previous key so the current-key decrypt fails
        # and the re-encrypt path (which issues the UPDATE) is exercised.
        previous_field = EncryptedType(type_in=String(1024), key=previous_key)
        ciphertext = previous_field.process_bind_param("hunter2", dialect)

        current_field = encrypted_field_factory.create(String(1024))
        conn = MagicMock()
        row = {"uuid": b"\x00" * 16, "configuration": ciphertext}
        stats = ReEncryptStats()

        migrator._re_encrypt_row(  # noqa: SLF001
            conn,
            row,
            "semantic_layers",
            {"configuration": current_field},
            ["uuid"],
            stats,
        )

        assert conn.execute.call_count == 1
        stmt = str(conn.execute.call_args.args[0])
        assert "WHERE uuid = :_pk_uuid" in stmt
        kwargs = conn.execute.call_args.kwargs
        assert kwargs["_pk_uuid"] == row["uuid"]
        assert "configuration" in kwargs
        assert stats == ReEncryptStats(re_encrypted=1, skipped=0, failed=0)

    def test_re_encrypt_row_is_idempotent(self):
        """
        Re-running re-encryption on a row that is already encrypted under the
        current key must be a no-op: no UPDATE is issued, no error is raised,
        and the outcome is counted as skipped.
        """
        from unittest.mock import MagicMock

        from sqlalchemy.engine import make_url

        dialect = make_url("sqlite://").get_dialect()
        current_key = self.app.config["SECRET_KEY"]
        migrator = SecretsMigrator("WRONG_PREVIOUS_KEY_abcdef")
        migrator._dialect = dialect  # noqa: SLF001

        field = encrypted_field_factory.create(String(1024))
        ciphertext = field.process_bind_param("hunter2", dialect)
        assert field.process_result_value(ciphertext, dialect) == "hunter2"

        conn = MagicMock()
        row = {"uuid": b"\x00" * 16, "configuration": ciphertext}
        stats = ReEncryptStats()

        migrator._re_encrypt_row(  # noqa: SLF001
            conn,
            row,
            "semantic_layers",
            {"configuration": field},
            ["uuid"],
            stats,
        )

        assert conn.execute.call_count == 0, (
            "Row already readable under current key should not trigger UPDATE"
        )
        assert stats == ReEncryptStats(re_encrypted=0, skipped=1, failed=0)
        # Current key must still decrypt the original ciphertext — nothing
        # was mutated.
        self.app.config["SECRET_KEY"] = current_key
        assert field.process_result_value(ciphertext, dialect) == "hunter2"

    def test_re_encrypt_row_idempotent_when_previous_key_also_decrypts(self):
        """
        When the supplied previous_secret_key can also decrypt the value
        (e.g. re-running after a successful rotation while still passing
        the original secret, or mistakenly passing the current secret as
        the previous one), the row must still be skipped. Idempotency is
        anchored on whether the current key can already read the data,
        not on whether the previous key fails to decrypt.
        """
        from unittest.mock import MagicMock

        from sqlalchemy.engine import make_url

        dialect = make_url("sqlite://").get_dialect()
        # Previous key == current key — this is the "re-run with no actual
        # rotation" scenario.
        migrator = SecretsMigrator(self.app.config["SECRET_KEY"])
        migrator._dialect = dialect  # noqa: SLF001

        field = encrypted_field_factory.create(String(1024))
        ciphertext = field.process_bind_param("hunter2", dialect)

        conn = MagicMock()
        row = {"uuid": b"\x00" * 16, "configuration": ciphertext}
        stats = ReEncryptStats()

        migrator._re_encrypt_row(  # noqa: SLF001
            conn,
            row,
            "semantic_layers",
            {"configuration": field},
            ["uuid"],
            stats,
        )

        assert conn.execute.call_count == 0, (
            "Idempotency must hold even when previous_secret_key can also "
            "decrypt the value"
        )
        assert stats == ReEncryptStats(re_encrypted=0, skipped=1, failed=0)

    def test_re_encrypt_row_counts_failures_without_raising(self):
        """
        Per-column failures are accumulated onto the stats counter so the
        caller can emit a summary covering every row. The row method itself
        must not raise — run() decides whether to abort based on the totals.
        """
        from unittest.mock import MagicMock

        from sqlalchemy.engine import make_url

        dialect = make_url("sqlite://").get_dialect()
        migrator = SecretsMigrator("WRONG_PREVIOUS_KEY_abcdef")
        migrator._dialect = dialect  # noqa: SLF001

        field = encrypted_field_factory.create(String(1024))
        conn = MagicMock()
        row = {"uuid": b"\x00" * 16, "configuration": b"not-valid-ciphertext"}
        stats = ReEncryptStats()

        migrator._re_encrypt_row(  # noqa: SLF001
            conn,
            row,
            "semantic_layers",
            {"configuration": field},
            ["uuid"],
            stats,
        )

        assert conn.execute.call_count == 0
        assert stats == ReEncryptStats(re_encrypted=0, skipped=0, failed=1)

    def test_re_encrypt_row_counts_nulls_separately(self):
        """
        NULL column values are not encrypted and therefore have nothing to
        migrate. They must be counted as ``null`` (not ``skipped``) and
        must not trigger an UPDATE, regardless of which key is supplied as
        the previous secret.
        """
        from unittest.mock import MagicMock

        from sqlalchemy.engine import make_url

        dialect = make_url("sqlite://").get_dialect()
        migrator = SecretsMigrator("WRONG_PREVIOUS_KEY_abcdef")
        migrator._dialect = dialect  # noqa: SLF001

        field = encrypted_field_factory.create(String(1024))
        conn = MagicMock()
        row = {"uuid": b"\x00" * 16, "configuration": None}
        stats = ReEncryptStats()

        migrator._re_encrypt_row(  # noqa: SLF001
            conn,
            row,
            "semantic_layers",
            {"configuration": field},
            ["uuid"],
            stats,
        )

        assert conn.execute.call_count == 0
        assert stats == ReEncryptStats(re_encrypted=0, skipped=0, null=1, failed=0)
