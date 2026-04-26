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
        for table_name, cols in encrypted_fields.items():
            for col_name, field in cols.items():
                if not encrypted_field_factory.created_by_enc_field_factory(field):
                    self.fail(
                        f"The encrypted column [{col_name}]"
                        f" in the table [{table_name}]"
                        " was not created using the"
                        " encrypted_field_factory"
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
