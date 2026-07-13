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

from typing import Any, TYPE_CHECKING

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


def test_extra_validator_rejects_negative_schema_cache_timeout() -> None:
    """
    Test that extra_validator rejects negative schema_cache_timeout values.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_cache_timeout": {"schema_cache_timeout": -1}}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "non-negative integer" in str(exc_info.value)


def test_extra_validator_rejects_negative_table_cache_timeout() -> None:
    """
    Test that extra_validator rejects negative table_cache_timeout values.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_cache_timeout": {"table_cache_timeout": -5}}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "non-negative integer" in str(exc_info.value)


def test_extra_validator_accepts_zero_cache_timeout() -> None:
    """
    Test that extra_validator accepts zero as a valid cache timeout.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps(
            {
                "metadata_cache_timeout": {
                    "schema_cache_timeout": 0,
                    "table_cache_timeout": 0,
                }
            }
        ),
    }
    result = schema.load(payload)
    extra = json.loads(result["extra"])
    assert extra["metadata_cache_timeout"]["schema_cache_timeout"] == 0
    assert extra["metadata_cache_timeout"]["table_cache_timeout"] == 0


def test_extra_validator_accepts_positive_cache_timeout() -> None:
    """
    Test that extra_validator accepts positive cache timeout values.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps(
            {
                "metadata_cache_timeout": {
                    "schema_cache_timeout": 600,
                    "table_cache_timeout": 1200,
                }
            }
        ),
    }
    result = schema.load(payload)
    extra = json.loads(result["extra"])
    assert extra["metadata_cache_timeout"]["schema_cache_timeout"] == 600
    assert extra["metadata_cache_timeout"]["table_cache_timeout"] == 1200


def test_extra_validator_rejects_non_dict_metadata_cache_timeout() -> None:
    """
    Test that extra_validator rejects metadata_cache_timeout when it is not a dict.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_cache_timeout": 600}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "metadata_cache_timeout must be a mapping" in str(exc_info.value)


@pytest.mark.parametrize("value", [0, "", [], False, None])
def test_extra_validator_rejects_non_dict_metadata_cache_timeout_values(
    value: Any,
) -> None:
    """
    Test that extra_validator rejects a present but non-dict
    metadata_cache_timeout, including an explicit null (None) and other falsy
    non-dict values (0, "", [], False), instead of silently treating them as
    empty. Rejecting null keeps the API in sync with the import schema.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_cache_timeout": value}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "metadata_cache_timeout must be a mapping" in str(exc_info.value)


def test_extra_validator_accepts_absent_metadata_cache_timeout() -> None:
    """
    Test that extra_validator treats an absent metadata_cache_timeout key as
    unset (valid). Only a present-but-non-dict value is rejected.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_params": {}}),
    }
    result = schema.load(payload)
    assert "metadata_cache_timeout" not in json.loads(result["extra"])


@pytest.mark.parametrize(
    "key",
    ["schema_cache_timeout", "table_cache_timeout", "catalog_cache_timeout"],
)
def test_extra_validator_rejects_null_nested_cache_timeout(key: str) -> None:
    """
    Test that extra_validator rejects an explicit null nested cache timeout
    (e.g. {"metadata_cache_timeout": {"schema_cache_timeout": null}}). Import
    (fields.Integer, no allow_none) rejects it, so the API must too, keeping
    the two paths in sync and avoiding an enabled-but-None model state.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_cache_timeout": {key: None}}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "non-negative integer" in str(exc_info.value)


@pytest.mark.parametrize("value", [True, False])
def test_extra_validator_rejects_boolean_nested_cache_timeout(value: bool) -> None:
    """
    Test that extra_validator rejects boolean nested cache timeouts. Python's
    bool is a subclass of int, so true/false would otherwise pass as 1/0;
    the import schema's fields.Integer rejects booleans, so the API must too.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps(
            {"metadata_cache_timeout": {"schema_cache_timeout": value}}
        ),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "non-negative integer" in str(exc_info.value)


def test_extra_validator_rejects_negative_catalog_cache_timeout() -> None:
    """
    Test that extra_validator rejects negative catalog_cache_timeout values.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_cache_timeout": {"catalog_cache_timeout": -3}}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "non-negative integer" in str(exc_info.value)


def test_extra_validator_accepts_catalog_cache_timeout() -> None:
    """
    Test that extra_validator accepts non-negative catalog_cache_timeout values.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_cache_timeout": {"catalog_cache_timeout": 600}}),
    }
    result = schema.load(payload)
    extra = json.loads(result["extra"])
    assert extra["metadata_cache_timeout"]["catalog_cache_timeout"] == 600


def test_cache_timeout_rejects_values_below_minus_one() -> None:
    """
    Test that cache_timeout rejects values less than -1.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "cache_timeout": -5,
    }
    with pytest.raises(ValidationError):
        schema.load(payload)


def test_cache_timeout_allows_minus_one() -> None:
    """
    Test that cache_timeout allows -1 (bypass cache).
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "cache_timeout": -1,
    }
    result = schema.load(payload)
    assert result["cache_timeout"] == -1


def test_cache_timeout_allows_zero_and_positive() -> None:
    """
    Test that cache_timeout allows 0 and positive values.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    for value in (0, 300, 86400):
        payload = {
            "database_name": "test_db",
            "cache_timeout": value,
        }
        result = schema.load(payload)
        assert result["cache_timeout"] == value


def test_cache_timeout_allows_none() -> None:
    """
    Test that cache_timeout allows None (use global default).
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "cache_timeout": None,
    }
    result = schema.load(payload)
    assert result["cache_timeout"] is None


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


def test_ssh_tunnel_server_address_rejects_non_hostnames() -> None:
    """server_address must look like a hostname/IP, not a URL or arbitrary text."""
    from superset.databases.schemas import DatabaseSSHTunnel

    schema = DatabaseSSHTunnel()
    base = {"server_port": 22, "username": "u", "private_key": "k"}

    for address in ("10.0.0.5", "ssh.internal.example.com", "[::1]", "bastion_host"):
        schema.load({**base, "server_address": address})

    for bad in ("http://evil/", "1.2.3.4/../x", "a b", "file:///etc/passwd"):
        with pytest.raises(ValidationError):
            schema.load({**base, "server_address": bad})


def test_ssh_tunnel_credentials_load_only() -> None:
    """
    Credential fields on DatabaseSSHTunnel are accepted on input (load) but
    never serialized in output (dump).
    """
    from superset.databases.schemas import DatabaseSSHTunnel

    schema = DatabaseSSHTunnel()
    payload = {
        "server_address": "localhost",
        "server_port": 22,
        "username": "user",
        "password": "secret",  # noqa: S106
        "private_key": "PRIVATE",
        "private_key_password": "keysecret",  # noqa: S106
    }

    # Load accepts the credential fields
    loaded = schema.load(payload)
    assert loaded["password"] == "secret"  # noqa: S105
    assert loaded["private_key"] == "PRIVATE"
    assert loaded["private_key_password"] == "keysecret"  # noqa: S105

    # Dump never emits the credential fields
    dumped = schema.dump(payload)
    assert "password" not in dumped
    assert "private_key" not in dumped
    assert "private_key_password" not in dumped
    assert dumped["server_address"] == "localhost"


def test_validate_parameters_schema_accepts_server_host_key() -> None:
    """
    ``ssh_tunnel`` payloads for databases with host-key verification
    configured include ``server_host_key``; the validate schema must not
    reject it as an unknown nested field.
    """
    from superset.databases.schemas import DatabaseValidateParametersSchema

    schema = DatabaseValidateParametersSchema()
    loaded = schema.load(
        {
            "engine": "postgresql",
            "configuration_method": "dynamic_form",
            "ssh_tunnel": {
                "server_address": "ssh.example.com",
                "server_port": 22,
                "username": "user",
                "server_host_key": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA",
            },
        }
    )
    assert (
        loaded["ssh_tunnel"]["server_host_key"]
        == "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA"
    )
