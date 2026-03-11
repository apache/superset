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

# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, redefined-outer-name

from typing import TYPE_CHECKING

import pytest
from marshmallow import fields, Schema, ValidationError
from pytest_mock import MockerFixture

from superset.utils import json

if TYPE_CHECKING:
    from superset.databases.schemas import DatabaseParametersSchemaMixin


# pylint: disable=too-few-public-methods
class InvalidEngine:
    """
    An invalid DB engine spec.
    """


@pytest.fixture
def dummy_schema() -> "DatabaseParametersSchemaMixin":
    """
    Fixture providing a dummy schema.
    """
    from superset.databases.schemas import DatabaseParametersSchemaMixin

    class DummySchema(DatabaseParametersSchemaMixin, Schema):
        sqlalchemy_uri = fields.String()

    return DummySchema()


@pytest.fixture
def dummy_engine(mocker: MockerFixture) -> None:
    """
    Fixture proving a dummy DB engine spec.
    """
    from superset.db_engine_specs.base import BasicParametersMixin

    class DummyEngine(BasicParametersMixin):
        engine = "dummy"
        default_driver = "dummy"

    mocker.patch("superset.databases.schemas.get_engine_spec", return_value=DummyEngine)


@pytest.fixture
def mock_bq_engine(mocker: MockerFixture) -> None:
    """
    Fixture providing a mocked BQ engine spec.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    mock_url = mocker.MagicMock()
    mock_url.get_backend_name.return_value = "bigquery"
    mock_url.get_driver_name.return_value = "bigquery"

    mocker.patch("superset.databases.schemas.make_url_safe", return_value=mock_url)
    mocker.patch(
        "superset.databases.schemas.get_engine_spec",
        return_value=BigQueryEngineSpec,
    )


def test_database_parameters_schema_mixin(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "dummy_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    result = dummy_schema.load(payload)
    assert result == {
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "sqlalchemy_uri": "dummy+dummy://username:password@localhost:12345/dbname",
    }


def test_database_parameters_schema_mixin_no_engine(
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert (  # noqa: PT017
            err.messages
            == {  # noqa: PT017
                "_schema": [
                    (
                        "An engine must be specified when passing individual parameters to "  # noqa: E501
                        "a database."
                    ),
                ]
            }
        )


def test_database_parameters_schema_mixin_invalid_engine(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "dummy_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert err.messages == {  # noqa: PT017
            "_schema": ['Engine "dummy_engine" is not a valid engine.']
        }


def test_database_parameters_schema_no_mixin(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "invalid_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": 12345,
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert (  # noqa: PT017
            err.messages
            == {  # noqa: PT017
                "_schema": [
                    (
                        'Engine spec "InvalidEngine" does not support '
                        "being configured via individual parameters."
                    )
                ]
            }
        )


def test_database_parameters_schema_mixin_invalid_type(
    dummy_engine: None,
    dummy_schema: "Schema",
) -> None:
    from superset.models.core import ConfigurationMethod

    payload = {
        "engine": "dummy_engine",
        "configuration_method": ConfigurationMethod.DYNAMIC_FORM,
        "parameters": {
            "username": "username",
            "password": "password",
            "host": "localhost",
            "port": "badport",
            "database": "dbname",
        },
    }
    try:
        dummy_schema.load(payload)
    except ValidationError as err:
        assert err.messages == {"port": ["Not a valid integer."]}  # noqa: PT017


def test_rename_encrypted_extra() -> None:
    """
    Test that ``encrypted_extra`` gets renamed to ``masked_encrypted_extra``.
    """
    from superset.databases.schemas import ConfigurationMethod, DatabasePostSchema

    schema = DatabasePostSchema()

    # current schema
    payload = schema.load(
        {
            "database_name": "My database",
            "masked_encrypted_extra": "{}",
        }
    )
    assert payload == {
        "database_name": "My database",
        "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        "masked_encrypted_extra": "{}",
    }

    # previous schema
    payload = schema.load(
        {
            "database_name": "My database",
            "encrypted_extra": "{}",
        }
    )
    assert payload == {
        "database_name": "My database",
        "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        "masked_encrypted_extra": "{}",
    }


def test_oauth2_schema_success() -> None:
    """
    Test a successful redirect.
    """
    from superset.databases.schemas import OAuth2ProviderResponseSchema

    schema = OAuth2ProviderResponseSchema()

    payload = schema.load({"code": "SECRET", "state": "12345"})
    assert payload == {"code": "SECRET", "state": "12345"}


def test_oauth2_schema_error() -> None:
    """
    Test a redirect with an error.
    """
    from superset.databases.schemas import OAuth2ProviderResponseSchema

    schema = OAuth2ProviderResponseSchema()

    payload = schema.load({"error": "access_denied"})
    assert payload == {"error": "access_denied"}


def test_oauth2_schema_extra() -> None:
    """
    Test a redirect with extra keys.
    """
    from superset.databases.schemas import OAuth2ProviderResponseSchema

    schema = OAuth2ProviderResponseSchema()

    payload = schema.load(
        {
            "code": "SECRET",
            "state": "12345",
            "optional": "NEW THING",
        }
    )
    assert payload == {"code": "SECRET", "state": "12345"}


def test_import_schema_rejects_both_encrypted_and_masked() -> None:
    """
    Test that ImportV1DatabaseSchema rejects configs with both
    encrypted_extra and masked_encrypted_extra.
    """
    from superset.databases.schemas import ImportV1DatabaseSchema

    schema = ImportV1DatabaseSchema()
    config = {
        "database_name": "test_db",
        "sqlalchemy_uri": "bigquery://test/",
        "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "encrypted_extra": json.dumps({"secret": "value"}),
        "masked_encrypted_extra": json.dumps({"secret": "XXXXXXXXXX"}),
        "extra": {},
        "version": "1.0.0",
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(config)
    assert "File contains both" in str(exc_info.value)


def test_import_schema_rejects_masked_fields_for_new_db(
    mock_bq_engine: None,
    mocker: MockerFixture,
) -> None:
    """
    Test that ImportV1DatabaseSchema rejects configs with PASSWORD_MASK
    values for a new DB (no existing UUID match).
    """
    from superset.databases.schemas import ImportV1DatabaseSchema

    mock_session = mocker.patch("superset.databases.schemas.db.session")
    mock_session.query.return_value.filter_by.return_value.first.return_value = None

    schema = ImportV1DatabaseSchema()
    config = {
        "database_name": "test_db",
        "sqlalchemy_uri": "bigquery://test/",
        "uuid": "bbbbbbbb-aaaa-cccc-dddd-eeeeeeeeeeff",
        "masked_encrypted_extra": json.dumps(
            {"credentials_info": {"private_key": "XXXXXXXXXX"}}
        ),
        "extra": {},
        "version": "1.0.0",
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(config)
    error_messages = str(exc_info.value)
    assert "Must provide value for masked_encrypted_extra field" in error_messages
    assert "$.credentials_info.private_key" in error_messages


def test_import_schema_allows_masked_fields_for_existing_db(
    mock_bq_engine: None,
    mocker: MockerFixture,
) -> None:
    """
    Test that ImportV1DatabaseSchema allows PASSWORD_MASK values when
    the DB already exists (UUID match). The reveal will happen later
    in import_database().
    """
    from superset.databases.schemas import ImportV1DatabaseSchema

    mock_session = mocker.patch("superset.databases.schemas.db.session")
    mock_existing_db = mocker.MagicMock()
    mock_session = mocker.patch("superset.databases.schemas.db.session")
    mock_session.query.return_value.filter_by.return_value.first.return_value = (
        mock_existing_db
    )

    schema = ImportV1DatabaseSchema()
    config = {
        "database_name": "test_db",
        "sqlalchemy_uri": "bigquery://test/",
        "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "masked_encrypted_extra": json.dumps(
            {"credentials_info": {"private_key": "XXXXXXXXXX"}}
        ),
        "extra": {},
        "version": "1.0.0",
    }
    # Should not raise - masked values are allowed for existing DBs
    schema.load(config)
