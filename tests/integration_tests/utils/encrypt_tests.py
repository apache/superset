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
        assert self.app.config["SECRET_KEY"] == field.key

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
