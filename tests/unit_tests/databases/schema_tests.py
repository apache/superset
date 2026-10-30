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

from typing import Any, Optional, TYPE_CHECKING

import pytest
from marshmallow import fields, Schema, ValidationError
from pytest_mock import MockerFixture

from superset.constants import PASSWORD_MASK
from superset.utils import json
from tests.unit_tests.conftest import with_feature_flags

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


def test_extra_validator_interpolates_invalid_metadata_params_key() -> None:
    """
    The message names the offending key. It is built with a lazy translated
    string, so a malformed placeholder would only fail once the message is
    rendered; asserting on the rendered text pins the interpolation.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps({"metadata_params": {"not_a_metadata_arg": 1}}),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    message = str(exc_info.value)
    assert "not_a_metadata_arg" in message
    assert "%(" not in message


def test_extra_validator_interpolates_json_decode_error() -> None:
    """
    As above, for the message raised when ``extra`` is not decodable JSON.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {"database_name": "test_db", "extra": "{not json"}
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    message = str(exc_info.value)
    # Assert on the interpolated value rather than the surrounding wording. The
    # value comes from json.JSONDecodeError, which is not translated, so this
    # stays valid under any locale.
    assert "line 1 column" in message
    assert "%(" not in message


@pytest.mark.parametrize("value", [123, None, [1, 2], True, "abc"])
def test_extra_validator_rejects_non_dict_top_level_value(value: Any) -> None:
    """
    Test that extra_validator rejects a top-level extra value that is valid
    JSON but not a mapping (int, null, list, bool, string), instead of
    letting AttributeError propagate from extra_.get("metadata_params").
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "extra": json.dumps(value),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "must be a mapping" in str(exc_info.value)


@pytest.mark.parametrize("value", [123, None, [1, 2], True, "abc"])
def test_encrypted_extra_validator_rejects_non_dict_top_level_value(
    value: Any,
) -> None:
    """
    Test that encrypted_extra_validator rejects a top-level value that is valid
    JSON but not a mapping (int, null, list, bool, string), instead of letting
    AttributeError propagate from downstream .get() calls.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "masked_encrypted_extra": json.dumps(value),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "must be a mapping" in str(exc_info.value)


@pytest.mark.parametrize(
    "credentials",
    [
        {"username": "embedded_svc"},
        {"password": "pw"},
        {"username": "embedded_svc", "password": ""},
        {"username": "   ", "password": "pw"},
        {"username": " \t ", "auth_method": "keypair", "privatekey_body": "PEM"},
        {"username": "embedded_svc", "auth_method": "keypair"},
        {"auth_method": "keypair", "privatekey_body": "-----BEGIN-----"},
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_masked_encrypted_extra_rejects_a_half_filled_embedded_credential(
    credentials: dict[str, str],
) -> None:
    """
    Test that a direct API caller cannot store an incomplete guest credential.

    `Database.get_embedded_fallback_credentials` ignores one, so storing it leaves
    a security-relevant setting that reads as configured and never applies. The
    connection dialog is blocked by the validate command; this closes the same
    hole for a POST/PUT that never goes near the dialog. Completeness is whatever
    `superset.databases.utils.validated_embedded_credentials` accepts, for both
    auth methods.
    """
    from superset.databases.schemas import DatabasePostSchema

    schema = DatabasePostSchema()
    payload = {
        "database_name": "test_db",
        "masked_encrypted_extra": json.dumps(
            {"embedded_credentials": credentials},
        ),
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(payload)
    assert "Embedded guest credentials are invalid or incomplete" in str(exc_info.value)


@pytest.mark.parametrize(
    "encrypted_extra",
    [
        {"embedded_credentials": {"username": "embedded_svc", "password": "pw"}},
        {
            "embedded_credentials": {
                "username": "embedded_svc",
                "auth_method": "keypair",
                "privatekey_body": "-----BEGIN PRIVATE KEY-----",
            }
        },
        {"embedded_credentials": {}},
        {"oauth2_client_info": {"id": "client-id"}},
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_masked_encrypted_extra_accepts_complete_or_absent_credentials(
    encrypted_extra: dict[str, Any],
) -> None:
    """
    Test that complete, empty and absent credentials all load.
    """
    from superset.databases.schemas import DatabasePostSchema

    DatabasePostSchema().load(
        {
            "database_name": "test_db",
            "masked_encrypted_extra": json.dumps(encrypted_extra),
        }
    )


def test_import_accepts_a_half_filled_embedded_credential() -> None:
    """
    Test that the import schema is deliberately not tightened.

    The check lives on `DatabaseParametersSchemaMixin` rather than on
    `encrypted_extra_validator`, which also backs the import schemas: rejecting
    this in the schema would refuse existing exports whatever the feature flags.
    `import_database` refuses it only while the embedded fallback is on.
    """
    from superset.databases.schemas import ImportV1DatabaseSchema

    ImportV1DatabaseSchema().load(
        {
            "database_name": "test_db",
            "sqlalchemy_uri": "snowflake://user:pw@account/db",
            "uuid": "e4b5b8a1-9c6f-4a2d-8f3e-1a2b3c4d5e6f",
            "version": "1.0.0",
            "encrypted_extra": json.dumps(
                {"embedded_credentials": {"username": "embedded_svc"}},
            ),
        }
    )


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
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    mock_existing_db = mocker.MagicMock()
    mock_existing_db.db_engine_spec = BigQueryEngineSpec
    mock_existing_db.encrypted_extra = json.dumps(
        {"credentials_info": {"private_key": "stored-key"}}
    )
    mock_existing_db.sqlalchemy_uri = "bigquery://test/"
    mock_existing_db.extra = "{}"
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


def _existing_bigquery_db(mocker: MockerFixture, private_key: str) -> None:
    """Make the import schema find an existing BigQuery connection."""
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    existing = mocker.MagicMock()
    existing.db_engine_spec = BigQueryEngineSpec
    existing.encrypted_extra = json.dumps(
        {"credentials_info": {"private_key": private_key}}
    )
    existing.sqlalchemy_uri = "bigquery://test/"
    existing.extra = "{}"
    mock_session = mocker.patch("superset.databases.schemas.db.session")
    mock_session.query.return_value.filter_by.return_value.first.return_value = existing


def _masked_bigquery_import(sqlalchemy_uri: str = "bigquery://test/") -> dict[str, Any]:
    return {
        "database_name": "test_db",
        "sqlalchemy_uri": sqlalchemy_uri,
        "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "masked_encrypted_extra": json.dumps(
            {"credentials_info": {"private_key": PASSWORD_MASK}}
        ),
        "extra": {},
        "version": "1.0.0",
    }


def test_import_schema_asks_for_a_secret_stored_as_the_mask(
    mock_bq_engine: None,
    mocker: MockerFixture,
) -> None:
    """
    An overwrite import asks for a secret whose stored value is the mask itself.

    Releases before this one saved the mask when an overwrite import had nothing
    to reveal. Revealing it hands the mask back, so without asking here the
    import reaches the ``import_database`` backstop and fails with a 500.
    """
    from superset.databases.schemas import ImportV1DatabaseSchema

    _existing_bigquery_db(mocker, private_key=PASSWORD_MASK)

    with pytest.raises(ValidationError) as excinfo:
        ImportV1DatabaseSchema().load(_masked_bigquery_import())
    assert "$.credentials_info.private_key" in str(excinfo.value)


def test_import_schema_asks_for_secrets_when_the_connection_moves(
    mock_bq_engine: None,
    mocker: MockerFixture,
) -> None:
    """
    An overwrite import that changes where the connection points asks for every
    masked secret: ``import_database`` never reveals stored secrets onto a new
    destination, so it would otherwise store the mask and fail with a 500.
    """
    from superset.databases.schemas import ImportV1DatabaseSchema

    _existing_bigquery_db(mocker, private_key="stored-key")

    with pytest.raises(ValidationError) as excinfo:
        ImportV1DatabaseSchema().load(
            _masked_bigquery_import(sqlalchemy_uri="bigquery://other-project/")
        )
    assert "$.credentials_info.private_key" in str(excinfo.value)


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


def _fallback_off(mocker: MockerFixture, disabled_flag: str) -> None:
    mocker.patch(
        "superset.extensions.feature_flag_manager.get_feature_flags",
        return_value={
            "EMBEDDED_CREDENTIAL_FALLBACK": True,
            "EMBEDDED_SUPERSET": True,
            disabled_flag: False,
        },
    )


@pytest.mark.parametrize(
    "disabled_flag", ["EMBEDDED_CREDENTIAL_FALLBACK", "EMBEDDED_SUPERSET"]
)
@pytest.mark.parametrize(
    "schema_name,database_id",
    [("DatabasePutSchema", 1), ("DatabaseTestConnectionSchema", None)],
)
def test_disabled_embedded_credentials_survive_unrelated_api_edits(
    mocker: MockerFixture,
    disabled_flag: str,
    schema_name: str,
    database_id: Optional[int],
) -> None:
    """
    With the fallback off, a stored credential -- even a partial import -- is
    preserved: re-saving it unchanged and testing the connection both load.
    """
    from superset.databases import schemas
    from superset.models.core import Database

    _fallback_off(mocker, disabled_flag)
    stored = json.dumps({"embedded_credentials": {"username": "embedded_svc"}})
    mocker.patch(
        "superset.databases.schemas.db.session.get",
        return_value=Database(sqlalchemy_uri="sqlite://", encrypted_extra=stored),
    )
    schema = getattr(schemas, schema_name)
    loaded = (schema(database_id=database_id) if database_id else schema()).load(
        {
            "database_name": "renamed",
            "sqlalchemy_uri": "snowflake://user:pw@account/db",
            "masked_encrypted_extra": stored,
        }
    )
    assert loaded["masked_encrypted_extra"] == stored


@pytest.mark.parametrize(
    "schema_name",
    ["DatabasePostSchema", "DatabasePutSchema", "DatabaseTestConnectionSchema"],
)
@pytest.mark.parametrize("valid", [True, False])
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_api_schemas_use_the_engine_credential_validator(
    mocker: MockerFixture, schema_name: str, valid: bool
) -> None:
    """Save and test endpoints accept the same credential shapes as execution."""
    from superset.databases import schemas
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database

    class TokenEngineSpec(SqliteEngineSpec):
        @classmethod
        def validate_embedded_credentials(
            cls, credentials: Any
        ) -> dict[str, str] | None:
            if isinstance(credentials, dict) and credentials.get("token"):
                return credentials
            return None

    mocker.patch.object(Database, "get_db_engine_spec", return_value=TokenEngineSpec)
    credentials = (
        {"token": "engine-token"} if valid else {"username": "svc", "password": "pw"}
    )
    payload = {
        "database_name": "test_db",
        "sqlalchemy_uri": "sqlite://",
        "masked_encrypted_extra": json.dumps({"embedded_credentials": credentials}),
    }
    schema = getattr(schemas, schema_name)()
    if valid:
        assert (
            schema.load(payload)["masked_encrypted_extra"]
            == payload["masked_encrypted_extra"]
        )
    else:
        with pytest.raises(ValidationError) as excinfo:
            schema.load(payload)
        assert "masked_encrypted_extra" in excinfo.value.messages


@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_partial_update_uses_the_stored_engine_credential_validator(
    mocker: MockerFixture,
) -> None:
    """An update without a URI still validates with the connection's engine."""
    from superset.databases.schemas import DatabasePutSchema
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database

    database = Database(sqlalchemy_uri="sqlite://")
    mocker.patch("superset.databases.schemas.db.session.get", return_value=database)
    validator = mocker.patch.object(
        SqliteEngineSpec, "validate_embedded_credentials", return_value={"token": "t"}
    )
    payload = {
        "masked_encrypted_extra": json.dumps({"embedded_credentials": {"token": "t"}})
    }
    DatabasePutSchema(database_id=1).load(payload)
    validator.assert_called_with({"token": "t"})


@pytest.mark.parametrize("credentials", ["not json", "[]", "42", [], False, 0])
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_api_rejects_malformed_embedded_credentials(credentials: Any) -> None:
    """Valid outer JSON must not hide a malformed credential value."""
    from superset.databases.schemas import DatabasePostSchema

    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(
            {
                "database_name": "test_db",
                "masked_encrypted_extra": json.dumps(
                    {"embedded_credentials": credentials}
                ),
            }
        )
    assert "masked_encrypted_extra" in excinfo.value.messages


_CLIENT = {
    "id": "client",
    "secret": "secret",
    "scope": "refresh_token",
    "authorization_request_uri": "https://oauth.example/authorize",
    "token_request_uri": "https://oauth.example/token",
}
_CREDENTIALS = {"username": "embedded_svc", "password": "embedded_pw"}


@pytest.mark.parametrize(
    "impersonate_user,client,global_client,credentials,expect_error",
    [
        # sc-126624 case 4: impersonation off -> every viewer on the base account.
        (False, _CLIENT, False, _CREDENTIALS, True),
        # sc-126624 case 1: no OAuth2 client -> the credential never applies.
        (True, None, False, _CREDENTIALS, True),
        (True, _CLIENT, False, _CREDENTIALS, False),
        # A deployment-wide client counts as OAuth2 on the connection.
        (True, None, True, _CREDENTIALS, False),
        # A cleared credential is "no credential", wherever it is saved.
        (False, None, False, {"username": "", "password": ""}, False),
        # sc-127897: a blank client is no client, so impersonation alone can't
        # make the credential apply.
        (True, {**_CLIENT, "id": "", "secret": ""}, False, _CREDENTIALS, True),
        (True, {**_CLIENT, "secret": "  "}, False, _CREDENTIALS, True),
        (True, {**_CLIENT, "id": ""}, False, _CREDENTIALS, True),
        # A stored secret comes back masked on edit and still counts.
        (True, {**_CLIENT, "secret": "XXXXXXXXXX"}, False, _CREDENTIALS, False),
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_embedded_credentials_need_oauth2_and_impersonation(
    mocker: MockerFixture,
    impersonate_user: bool,
    client: Optional[dict[str, str]],
    global_client: bool,
    credentials: dict[str, str],
    expect_error: bool,
) -> None:
    """A credential that could never apply is refused instead of saved."""
    from flask import current_app

    from superset.databases.schemas import DatabasePostSchema
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    mocker.patch.object(SqliteEngineSpec, "supports_embedded_credential_fallback", True)
    mocker.patch.object(SqliteEngineSpec, "supports_oauth2", True)
    mocker.patch.dict(
        current_app.config,
        {"DATABASE_OAUTH2_CLIENTS": {"SQLite": _CLIENT} if global_client else {}},
    )
    extra: dict[str, Any] = {"embedded_credentials": credentials}
    if client:
        extra["oauth2_client_info"] = client
    payload = {
        "database_name": "test_db",
        "sqlalchemy_uri": "sqlite://",
        "impersonate_user": impersonate_user,
        "masked_encrypted_extra": json.dumps(extra),
    }

    if expect_error:
        with pytest.raises(ValidationError) as excinfo:
            DatabasePostSchema().load(payload)
        assert "Impersonate logged in user" in str(excinfo.value.messages)
    else:
        DatabasePostSchema().load(payload)


@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_embedded_credentials_requirement_skips_engines_without_the_fallback() -> None:
    """On an engine that has not opted in the credential is inert; not refused."""
    from superset.databases.schemas import DatabasePostSchema

    DatabasePostSchema().load(
        {
            "database_name": "test_db",
            "sqlalchemy_uri": "sqlite://",
            "impersonate_user": False,
            "masked_encrypted_extra": json.dumps(
                {"embedded_credentials": _CREDENTIALS}
            ),
        }
    )


def _pem(passphrase: str) -> str:
    """A freshly generated RSA private key, PEM-encoded under ``passphrase``."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    return (
        rsa.generate_private_key(public_exponent=65537, key_size=2048)
        .private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.BestAvailableEncryption(passphrase.encode()),
        )
        .decode()
    )


def _snowflake_keypair_payload(body: str, passphrase: str) -> dict[str, Any]:
    return {
        "database_name": "test_db",
        "sqlalchemy_uri": "snowflake://base_user@xy12345/db",
        "impersonate_user": True,
        "masked_encrypted_extra": json.dumps(
            {
                "oauth2_client_info": _CLIENT,
                "embedded_credentials": {
                    "username": "embedded_svc",
                    "auth_method": "keypair",
                    "privatekey_body": body,
                    "privatekey_pass": passphrase,
                },
            }
        ),
    }


@pytest.mark.parametrize(
    "body, passphrase, expect_error",
    [
        ("right", "key passphrase", False),
        ("right", "wrong passphrase", True),
        ("not a PEM key", "key passphrase", True),
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_an_unreadable_embedded_key_is_refused_at_save(
    body: str, passphrase: str, expect_error: bool
) -> None:
    """A key pair that cannot be decoded is refused when saved (sc-130269)."""
    from superset.databases.schemas import DatabasePostSchema

    pem = _pem("key passphrase") if body == "right" else body
    payload = _snowflake_keypair_payload(pem, passphrase)

    if not expect_error:
        DatabasePostSchema().load(payload)
        return
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(payload)
    messages = str(excinfo.value.messages)
    assert "private key could not be read" in messages
    assert passphrase not in messages
    assert all(line not in messages for line in pem.splitlines()[1:-1] or [pem])


@pytest.mark.parametrize(
    "new_passphrase, expect_error",
    [("XXXXXXXXXX", False), ("key passphrase", False), ("wrong passphrase", True)],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_an_edit_checks_the_embedded_key_against_its_stored_secrets(
    mocker: MockerFixture, new_passphrase: str, expect_error: bool
) -> None:
    """
    An edit sends an unchanged key and passphrase masked. They are restored from
    the stored connection before the key is checked, so an untouched credential
    still saves and a new passphrase is checked against the stored key.
    """
    from superset.databases.schemas import DatabasePutSchema
    from superset.models.core import Database

    saved = _snowflake_keypair_payload(_pem("key passphrase"), "key passphrase")
    stored = Database(
        sqlalchemy_uri=saved["sqlalchemy_uri"],
        impersonate_user=True,
        encrypted_extra=saved["masked_encrypted_extra"],
    )
    mocker.patch("superset.databases.schemas.db.session.get", return_value=stored)
    payload = _snowflake_keypair_payload("XXXXXXXXXX", new_passphrase)
    del payload["database_name"], payload["sqlalchemy_uri"]

    if expect_error:
        with pytest.raises(ValidationError) as excinfo:
            DatabasePutSchema(database_id=1).load(payload)
        assert "private key could not be read" in str(excinfo.value.messages)
    else:
        DatabasePutSchema(database_id=1).load(payload)


@pytest.mark.parametrize("stored_impersonate_user", [True, False])
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_embedded_credentials_requirement_uses_stored_impersonation_on_update(
    mocker: MockerFixture, stored_impersonate_user: bool
) -> None:
    """An update that omits impersonate_user is judged by the stored setting."""
    from superset.databases.schemas import DatabasePutSchema
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database

    mocker.patch.object(SqliteEngineSpec, "supports_embedded_credential_fallback", True)
    stored = Database(
        sqlalchemy_uri="sqlite://", impersonate_user=stored_impersonate_user
    )
    mocker.patch("superset.databases.schemas.db.session.get", return_value=stored)
    payload = {
        "masked_encrypted_extra": json.dumps(
            {"embedded_credentials": _CREDENTIALS, "oauth2_client_info": _CLIENT}
        )
    }

    if stored_impersonate_user:
        DatabasePutSchema(database_id=1).load(payload)
    else:
        with pytest.raises(ValidationError):
            DatabasePutSchema(database_id=1).load(payload)


@pytest.mark.parametrize(
    "stored_encrypted_extra",
    [None, json.dumps({"oauth2_client_info": {"id": "client"}})],
)
def test_import_schema_asks_for_masks_an_existing_db_cannot_reveal(
    mocker: MockerFixture, stored_encrypted_extra: Optional[str]
) -> None:
    """
    Overwriting a connection asks for secrets it has no stored value for.

    A connection promoted by a dashboard bundle exists without its OAuth2 client
    or embedded credential. Importing its database export over it used to store
    the mask itself as the secret (QA OEF-SECRET-04).
    """
    from superset.databases.schemas import ImportV1DatabaseSchema
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    existing = mocker.MagicMock()
    existing.db_engine_spec = SqliteEngineSpec
    existing.encrypted_extra = stored_encrypted_extra
    mock_session = mocker.patch("superset.databases.schemas.db.session")
    mock_session.query.return_value.filter_by.return_value.first.return_value = existing

    with pytest.raises(ValidationError) as excinfo:
        ImportV1DatabaseSchema().load(
            {
                "database_name": "promoted",
                "sqlalchemy_uri": "sqlite://",
                "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
                "masked_encrypted_extra": json.dumps(
                    {
                        "oauth2_client_info": {"id": "client", "secret": "XXXXXXXXXX"},
                        "embedded_credentials": {
                            "username": "svc",
                            "password": "XXXXXXXXXX",
                        },
                    }
                ),
                "extra": {},
                "version": "1.0.0",
            }
        )

    messages = str(excinfo.value.messages)
    assert "$.oauth2_client_info.secret" in messages
    assert "$.embedded_credentials.password" in messages


def _stored_connection(
    mocker: MockerFixture,
    *,
    credentials: Optional[dict[str, str]] = _CREDENTIALS,
    impersonate_user: bool = True,
    client: Optional[dict[str, str]] = _CLIENT,
) -> Any:
    """A stored per-user OAuth2 connection, optionally carrying a guest credential."""
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database

    mocker.patch.object(SqliteEngineSpec, "supports_embedded_credential_fallback", True)
    extra: dict[str, Any] = {}
    if client is not None:
        extra["oauth2_client_info"] = client
    if credentials is not None:
        extra["embedded_credentials"] = credentials
    stored = Database(
        sqlalchemy_uri="sqlite://",
        impersonate_user=impersonate_user,
        encrypted_extra=json.dumps(extra),
    )
    mocker.patch("superset.databases.schemas.db.session.get", return_value=stored)
    return stored


@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_turning_impersonation_off_is_refused_while_a_credential_is_stored(
    mocker: MockerFixture,
) -> None:
    """
    sc-130268: the API must refuse what the dialog refuses. An update that turns
    impersonation off without resending Secure Extra keeps the stored credential
    attached, and every embedded viewer would then run as the base account.
    """
    from superset.databases.schemas import DatabasePutSchema

    _stored_connection(mocker)

    with pytest.raises(ValidationError) as excinfo:
        DatabasePutSchema(database_id=1).load({"impersonate_user": False})

    assert "impersonate_user" in excinfo.value.messages
    assert "Clear the embedded credentials" in str(excinfo.value.messages)


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"impersonate_user": False}, id="impersonation-only"),
        pytest.param(
            {"impersonate_user": False, "database_name": "renamed"},
            id="with-an-unrelated-edit",
        ),
        pytest.param(
            {
                "impersonate_user": False,
                "masked_encrypted_extra": json.dumps(
                    {
                        "oauth2_client_info": _CLIENT,
                        "embedded_credentials": _CREDENTIALS,
                    }
                ),
            },
            id="resending-the-credential",
        ),
        pytest.param(
            {
                "masked_encrypted_extra": json.dumps(
                    {"embedded_credentials": _CREDENTIALS}
                ),
            },
            id="dropping-the-oauth2-client",
        ),
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_no_update_strands_a_stored_credential(
    mocker: MockerFixture, payload: dict[str, Any]
) -> None:
    """
    However the update is shaped, it cannot leave a credential on a connection
    without impersonation or without an OAuth2 client.
    """
    from superset.databases.schemas import DatabasePutSchema

    _stored_connection(mocker)

    with pytest.raises(ValidationError):
        DatabasePutSchema(database_id=1).load(payload)


@pytest.mark.parametrize(
    "payload",
    [
        # Clearing the credential in the same save is the way out.
        pytest.param(
            {
                "impersonate_user": False,
                "masked_encrypted_extra": json.dumps({"oauth2_client_info": _CLIENT}),
            },
            id="clearing-the-credential",
        ),
        pytest.param(
            {
                "impersonate_user": False,
                "masked_encrypted_extra": json.dumps(
                    {"embedded_credentials": {"username": "", "password": ""}}
                ),
            },
            id="blanking-the-credential",
        ),
        pytest.param({"impersonate_user": True}, id="impersonation-kept-on"),
        pytest.param({"database_name": "renamed"}, id="unrelated-edit"),
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_impersonation_updates_that_leave_no_stranded_credential_are_allowed(
    mocker: MockerFixture, payload: dict[str, Any]
) -> None:
    from superset.databases.schemas import DatabasePutSchema

    _stored_connection(mocker)

    DatabasePutSchema(database_id=1).load(payload)


@pytest.mark.parametrize(
    "credentials",
    [
        pytest.param(None, id="no-stored-credential"),
        pytest.param({"username": "", "password": ""}, id="cleared-credential"),
    ],
)
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_turning_impersonation_off_is_allowed_without_a_stored_credential(
    mocker: MockerFixture, credentials: Optional[dict[str, str]]
) -> None:
    from superset.databases.schemas import DatabasePutSchema

    _stored_connection(mocker, credentials=credentials)

    DatabasePutSchema(database_id=1).load({"impersonate_user": False})


@pytest.mark.parametrize(
    "disabled_flag", ["EMBEDDED_CREDENTIAL_FALLBACK", "EMBEDDED_SUPERSET"]
)
def test_turning_impersonation_off_is_allowed_with_the_fallback_off(
    mocker: MockerFixture, disabled_flag: str
) -> None:
    """With the fallback off a stored credential is inert and must not block edits."""
    from superset.databases.schemas import DatabasePutSchema

    mocker.patch(
        "superset.extensions.feature_flag_manager.get_feature_flags",
        return_value={
            "EMBEDDED_CREDENTIAL_FALLBACK": True,
            "EMBEDDED_SUPERSET": True,
            disabled_flag: False,
        },
    )
    _stored_connection(mocker)

    DatabasePutSchema(database_id=1).load({"impersonate_user": False})


@pytest.mark.parametrize("encrypted_extra", ["null", "[1]", ""])
@with_feature_flags(EMBEDDED_CREDENTIAL_FALLBACK=True, EMBEDDED_SUPERSET=True)
def test_a_stored_secure_extra_without_an_object_carries_no_credential(
    mocker: MockerFixture, encrypted_extra: str
) -> None:
    from superset.databases.schemas import DatabasePutSchema

    stored = _stored_connection(mocker)
    stored.encrypted_extra = encrypted_extra

    DatabasePutSchema(database_id=1).load({"impersonate_user": False})


_FALLBACK_OFF_MESSAGE = "can't be added or changed while the embedded credential"


@pytest.mark.parametrize(
    "disabled_flag", ["EMBEDDED_CREDENTIAL_FALLBACK", "EMBEDDED_SUPERSET"]
)
@pytest.mark.parametrize(
    "credentials",
    [
        pytest.param(_CREDENTIALS, id="complete"),
        pytest.param({"username": "EMBED_VIEWER"}, id="half-filled"),
    ],
)
def test_a_new_credential_is_refused_while_the_fallback_is_off(
    mocker: MockerFixture, disabled_flag: str, credentials: dict[str, str]
) -> None:
    """
    sc-130270: nothing validates a credential while the fallback is off, and one
    stored then goes live unchecked when the fallback is turned on.
    """
    from superset.databases.schemas import DatabasePostSchema

    _fallback_off(mocker, disabled_flag)

    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(
            {
                "database_name": "test_db",
                "sqlalchemy_uri": "sqlite://",
                "masked_encrypted_extra": json.dumps(
                    {"embedded_credentials": credentials}
                ),
            }
        )

    assert "masked_encrypted_extra" in excinfo.value.messages
    assert _FALLBACK_OFF_MESSAGE in str(excinfo.value.messages)


@pytest.mark.parametrize(
    "stored_credentials",
    [
        pytest.param(None, id="added"),
        pytest.param(_CREDENTIALS, id="changed"),
    ],
)
def test_adding_or_changing_a_credential_is_refused_while_the_fallback_is_off(
    mocker: MockerFixture, stored_credentials: Optional[dict[str, str]]
) -> None:
    """The M3 repro: a non-impersonating connection given a credential by PUT."""
    from superset.databases.schemas import DatabasePutSchema

    _fallback_off(mocker, "EMBEDDED_CREDENTIAL_FALLBACK")
    _stored_connection(
        mocker, credentials=stored_credentials, impersonate_user=False, client=None
    )

    with pytest.raises(ValidationError) as excinfo:
        DatabasePutSchema(database_id=1).load(
            {
                "masked_encrypted_extra": json.dumps(
                    {"embedded_credentials": {"username": "EMBED_VIEWER"}}
                )
            }
        )

    assert _FALLBACK_OFF_MESSAGE in str(excinfo.value.messages)


@pytest.mark.parametrize(
    "payload",
    [
        # What the dialog loads and posts back: the secret comes back masked.
        pytest.param(
            {
                "masked_encrypted_extra": json.dumps(
                    {
                        "oauth2_client_info": {**_CLIENT, "secret": "XXXXXXXXXX"},
                        "embedded_credentials": {
                            **_CREDENTIALS,
                            "password": "XXXXXXXXXX",
                        },
                    }
                ),
                "database_name": "renamed",
            },
            id="masked-round-trip",
        ),
        pytest.param(
            {
                "masked_encrypted_extra": json.dumps(
                    {
                        "oauth2_client_info": _CLIENT,
                        "embedded_credentials": _CREDENTIALS,
                    }
                ),
                "impersonate_user": False,
            },
            id="unchanged-with-other-edits",
        ),
        pytest.param({"impersonate_user": False}, id="no-secure-extra"),
        pytest.param(
            {"masked_encrypted_extra": json.dumps({"oauth2_client_info": _CLIENT})},
            id="cleared",
        ),
        pytest.param(
            {
                "masked_encrypted_extra": json.dumps(
                    {"embedded_credentials": {"username": "", "password": ""}}
                )
            },
            id="blanked",
        ),
    ],
)
def test_a_stored_credential_is_left_alone_while_the_fallback_is_off(
    mocker: MockerFixture, payload: dict[str, Any]
) -> None:
    """
    OEF-REG-07 (sc-125538): with the fallback off, the stored credential and the
    edits around it keep working, so turning the fallback back on restores it.
    """
    from superset.databases.schemas import DatabasePutSchema

    _fallback_off(mocker, "EMBEDDED_CREDENTIAL_FALLBACK")
    _stored_connection(mocker)

    DatabasePutSchema(database_id=1).load(payload)


def test_a_new_connection_without_a_credential_loads_while_the_fallback_is_off(
    mocker: MockerFixture,
) -> None:
    from superset.databases.schemas import DatabasePostSchema

    _fallback_off(mocker, "EMBEDDED_CREDENTIAL_FALLBACK")

    DatabasePostSchema().load(
        {
            "database_name": "test_db",
            "sqlalchemy_uri": "sqlite://",
            "masked_encrypted_extra": json.dumps(
                {"embedded_credentials": {"auth_method": "password"}}
            ),
        }
    )


@pytest.mark.parametrize(
    "value, present",
    [
        (None, False),
        ("", False),
        ({}, False),
        ({"auth_method": "keypair"}, False),
        ({"username": "  ", "password": ""}, False),
        ({"username": "svc"}, True),
        (_CREDENTIALS, True),
        ([], True),
        ("not json", True),
    ],
)
def test_embedded_credentials_present(value: Any, present: bool) -> None:
    from superset.databases.utils import embedded_credentials_present

    assert embedded_credentials_present(value) is present
