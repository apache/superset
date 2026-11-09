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
# pylint: disable=import-outside-toplevel, invalid-name, unused-argument

from typing import Any
from unittest import mock

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from marshmallow import ValidationError

from superset.constants import PASSWORD_MASK
from superset.databases.schemas import (
    DatabasePostSchema,
    DatabasePutSchema,
    DatabaseTestConnectionSchema,
)
from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.snowflake import (
    SnowflakeEngineSpec,
    SnowflakeParametersSchema,
)
from superset.utils import json

PEM_HEADER = "-----BEGIN PRIVATE KEY-----"
PEM_KEY = f"{PEM_HEADER}\nQUJDREVGRw==\n-----END PRIVATE KEY-----\n"
PEM_PASSPHRASE = "correct horse battery staple"  # noqa: S105

BASE_PARAMETERS: dict[str, Any] = {
    "username": "svc_superset",
    "account": "xy12345.us-east-1",
    "database": "ANALYTICS",
    "role": "READER",
    "warehouse": "COMPUTE_WH",
}

SCHEMAS = [DatabasePostSchema, DatabasePutSchema, DatabaseTestConnectionSchema]


# A connection that has every secret stored, standing in for the saved database an
# update is applied to.
STORED_SECRETS = {
    "auth_method": "keypair",
    "auth_params": {"privatekey_body": "stored", "privatekey_pass": "stored"},
    "oauth2_client_info": {"secret": "stored"},
}


@pytest.fixture(autouse=True)
def stored_database(mocker: Any) -> mock.MagicMock:
    stored = mock.MagicMock()
    stored.encrypted_extra = json.dumps(STORED_SECRETS)
    session = mocker.patch("superset.databases.schemas.db").session
    session.get.return_value = stored
    session.query.return_value.filter_by.return_value.first.return_value = stored
    return stored


def new_schema(schema_class: type) -> Any:
    """Updates are validated against the stored connection with this id."""
    if schema_class is DatabasePutSchema:
        return DatabasePutSchema(database_id=1)
    return schema_class()


def make_payload(**parameters: Any) -> dict[str, Any]:
    return {
        "database_name": "snow",
        "engine": "snowflake",
        "configuration_method": "dynamic_form",
        "parameters": {**BASE_PARAMETERS, **parameters},
    }


def load_with_extra(schema_class: type, payload: dict[str, Any]) -> dict[str, Any]:
    """
    Load a payload that, like the edit form, carries ``masked_encrypted_extra``.

    Updates that omit it are applied to the stored settings by the update command
    instead (see ``test_auth_parameters_are_carried_only_when_a_method_is_named``).
    """
    return new_schema(schema_class).load({"masked_encrypted_extra": "{}", **payload})


def keypair_parameters(**overrides: Any) -> dict[str, Any]:
    return {"auth_method": "keypair", "privatekey_body": PEM_KEY, **overrides}


def error_text(err: ValidationError) -> str:
    return json.dumps(err.messages)


def test_default_engine_spec_has_no_auth_methods() -> None:
    assert BaseEngineSpec.get_auth_methods() == []


def test_snowflake_auth_methods() -> None:
    methods = SnowflakeEngineSpec.get_auth_methods()

    assert [method["id"] for method in methods] == ["password", "keypair"]
    assert [str(method["label"]) for method in methods] == ["Password", "Key pair"]
    assert methods[0]["fields"] == ["password"]
    assert methods[1]["fields"] == ["privatekey_body", "privatekey_pass"]
    # every field a method lists is a parameter of the engine
    properties = SnowflakeEngineSpec.parameters_json_schema()["properties"]
    for method in methods:
        assert set(method["fields"]) <= set(properties)


def test_parameters_json_schema() -> None:
    schema = SnowflakeEngineSpec.parameters_json_schema()

    assert schema["properties"]["auth_method"]["enum"] == ["password", "keypair"]
    assert schema["properties"]["auth_method"]["default"] == "password"
    assert set(schema["required"]) == set(BASE_PARAMETERS)
    assert {"password", "privatekey_body", "privatekey_pass"} <= set(
        schema["properties"]
    )


@pytest.mark.parametrize("schema_class", SCHEMAS)
def test_password_connection_is_unchanged(schema_class: type) -> None:
    """Payloads without ``auth_method`` produce the same result as before."""
    payload = make_payload(password="s3cret")  # noqa: S106

    loaded = new_schema(schema_class).load(payload)

    assert loaded["sqlalchemy_uri"] == (
        "snowflake://svc_superset:s3cret@xy12345.us-east-1/ANALYTICS"
        "?role=READER&warehouse=COMPUTE_WH"
    )
    assert "masked_encrypted_extra" not in loaded


@pytest.mark.parametrize("schema_class", SCHEMAS)
def test_password_connection_missing_password_error_shape(schema_class: type) -> None:
    with pytest.raises(ValidationError) as excinfo:
        new_schema(schema_class).load(make_payload())

    assert excinfo.value.messages == {"password": ["Missing data for required field."]}


def test_password_error_shape_with_other_missing_fields() -> None:
    """Missing fields are reported together, as when ``password`` was required."""
    with pytest.raises(ValidationError) as excinfo:
        SnowflakeParametersSchema().load({"account": "a"})

    assert excinfo.value.messages == {
        field: ["Missing data for required field."]
        for field in ("username", "database", "role", "warehouse", "password")
    }


def test_explicit_password_method_matches_default() -> None:
    explicit = DatabasePostSchema().load(
        make_payload(auth_method="password", password="s3cret")  # noqa: S106
    )
    implicit = DatabasePostSchema().load(make_payload(password="s3cret"))  # noqa: S106

    assert explicit["sqlalchemy_uri"] == implicit["sqlalchemy_uri"]
    assert "masked_encrypted_extra" not in explicit


@pytest.mark.parametrize("schema_class", SCHEMAS)
def test_keypair_connection(schema_class: type) -> None:
    loaded = load_with_extra(
        schema_class, make_payload(**keypair_parameters(privatekey_pass=PEM_PASSPHRASE))
    )

    assert loaded["sqlalchemy_uri"] == (
        "snowflake://svc_superset@xy12345.us-east-1/ANALYTICS"
        "?role=READER&warehouse=COMPUTE_WH"
    )
    assert json.loads(loaded["masked_encrypted_extra"]) == {
        "auth_method": "keypair",
        "auth_params": {
            "privatekey_body": PEM_KEY,
            "privatekey_pass": PEM_PASSPHRASE,
        },
    }


def test_keypair_ignores_password() -> None:
    loaded = DatabasePostSchema().load(make_payload(**keypair_parameters(password="x")))  # noqa: S106

    assert "svc_superset:" not in loaded["sqlalchemy_uri"]
    assert "x@" not in loaded["sqlalchemy_uri"]


def test_keypair_without_passphrase_stores_none() -> None:
    loaded = DatabasePostSchema().load(
        make_payload(**keypair_parameters(privatekey_pass=""))
    )

    extra = json.loads(loaded["masked_encrypted_extra"])
    assert extra["auth_params"] == {"privatekey_body": PEM_KEY}


def test_keypair_keeps_other_encrypted_extra_settings() -> None:
    payload = make_payload(**keypair_parameters())
    payload["masked_encrypted_extra"] = json.dumps(
        {"oauth2_client_info": {"id": "abc", "secret": PASSWORD_MASK}}
    )

    loaded = new_schema(DatabasePutSchema).load(payload)

    extra = json.loads(loaded["masked_encrypted_extra"])
    assert extra["oauth2_client_info"] == {"id": "abc", "secret": PASSWORD_MASK}
    assert extra["auth_method"] == "keypair"


@pytest.mark.parametrize("schema_class", SCHEMAS)
def test_keypair_requires_private_key(schema_class: type) -> None:
    with pytest.raises(ValidationError) as excinfo:
        new_schema(schema_class).load(
            make_payload(auth_method="keypair", password="s3cret")  # noqa: S106
        )

    assert excinfo.value.messages == {
        "privatekey_body": ["Missing data for required field."]
    }
    assert "s3cret" not in error_text(excinfo.value)


@pytest.mark.parametrize("schema_class", SCHEMAS)
@pytest.mark.parametrize("blank", ["", " ", "\n\t  \n"])
def test_keypair_rejects_blank_private_key(schema_class: type, blank: str) -> None:
    with pytest.raises(ValidationError) as excinfo:
        new_schema(schema_class).load(
            make_payload(**keypair_parameters(privatekey_body=blank))
        )

    assert list(excinfo.value.messages) == ["privatekey_body"]


@pytest.mark.parametrize("schema_class", SCHEMAS)
def test_keypair_rejects_key_that_is_not_pem(schema_class: type) -> None:
    """A file path (or any non-PEM text) is not accepted, and is not echoed back."""
    path = "/home/user/rsa_key_9f3a.p8"
    with pytest.raises(ValidationError) as excinfo:
        new_schema(schema_class).load(
            make_payload(**keypair_parameters(privatekey_body=path))
        )

    assert list(excinfo.value.messages) == ["privatekey_body"]
    assert "rsa_key_9f3a" not in error_text(excinfo.value)


def test_keypair_rejects_blank_passphrase() -> None:
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(
            make_payload(**keypair_parameters(privatekey_pass=" "))  # noqa: S106
        )

    assert list(excinfo.value.messages) == ["privatekey_pass"]


def test_unknown_auth_method_is_rejected() -> None:
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(make_payload(auth_method="kerberos", password="x"))  # noqa: S106

    assert list(excinfo.value.messages) == ["auth_method"]


def test_error_messages_never_contain_secrets() -> None:
    secret_key = PEM_KEY.replace("QUJDREVGRw==", "TOPSECRETKEYMATERIAL")
    for parameters in (
        {"auth_method": "keypair", "privatekey_body": secret_key, "role": 5},
        {"auth_method": "keypair", "privatekey_body": secret_key, "username": None},
    ):
        with pytest.raises(ValidationError) as excinfo:
            DatabasePostSchema().load(make_payload(**parameters))

        assert "TOPSECRETKEYMATERIAL" not in error_text(excinfo.value)


def test_mask_is_rejected_on_create() -> None:
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(
            make_payload(**keypair_parameters(privatekey_body=PASSWORD_MASK))
        )

    assert excinfo.value.messages == {
        "masked_encrypted_extra": [
            "Must provide value for masked_encrypted_extra field: "
            "$.auth_params.privatekey_body (Private Key Body)"
        ]
    }


def test_masked_passphrase_is_rejected_on_create() -> None:
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(
            make_payload(**keypair_parameters(privatekey_pass=PASSWORD_MASK))
        )

    assert "privatekey_pass" in error_text(excinfo.value)


@pytest.mark.parametrize(
    "schema_class", [DatabasePutSchema, DatabaseTestConnectionSchema]
)
def test_mask_round_trips_on_update_and_test(schema_class: type) -> None:
    """Sending the mask back restores the stored key and passphrase."""
    stored = json.dumps(
        {
            "auth_method": "keypair",
            "auth_params": {
                "privatekey_body": PEM_KEY,
                "privatekey_pass": PEM_PASSPHRASE,
            },
        }
    )
    loaded = load_with_extra(
        schema_class,
        make_payload(
            **keypair_parameters(
                privatekey_body=PASSWORD_MASK, privatekey_pass=PASSWORD_MASK
            )
        ),
    )

    revealed = SnowflakeEngineSpec.unmask_encrypted_extra(
        stored, loaded["masked_encrypted_extra"]
    )

    assert json.loads(revealed or "{}") == json.loads(stored)


def test_replacing_key_on_update_keeps_it_out_of_the_mask() -> None:
    stored = json.dumps(
        {"auth_method": "keypair", "auth_params": {"privatekey_body": PEM_KEY}}
    )
    new_key = PEM_KEY.replace("QUJDREVGRw==", "SEVMTE8=")
    loaded = load_with_extra(
        DatabasePutSchema, make_payload(**keypair_parameters(privatekey_body=new_key))
    )

    revealed = SnowflakeEngineSpec.unmask_encrypted_extra(
        stored, loaded["masked_encrypted_extra"]
    )

    assert json.loads(revealed or "{}")["auth_params"] == {"privatekey_body": new_key}


def test_switching_to_password_removes_key_pair_settings() -> None:
    payload = make_payload(auth_method="password", password="s3cret")  # noqa: S106
    payload["masked_encrypted_extra"] = json.dumps(
        {
            "auth_method": "keypair",
            "auth_params": {"privatekey_body": PASSWORD_MASK},
            "oauth2_client_info": {"id": "abc"},
        }
    )

    loaded = new_schema(DatabasePutSchema).load(payload)

    assert json.loads(loaded["masked_encrypted_extra"]) == {
        "oauth2_client_info": {"id": "abc"}
    }
    assert ":s3cret@" in loaded["sqlalchemy_uri"]


def test_legacy_key_pair_in_encrypted_extra_is_untouched() -> None:
    """Requests that do not name a method keep working as they always did."""
    extra = json.dumps(
        {"auth_method": "keypair", "auth_params": {"privatekey_body": PEM_KEY}}
    )
    payload = make_payload(password="placeholder")  # noqa: S106
    payload["masked_encrypted_extra"] = extra

    loaded = DatabasePostSchema().load(payload)

    assert loaded["masked_encrypted_extra"] == extra
    assert ":placeholder@" in loaded["sqlalchemy_uri"]


def test_custom_authenticator_in_encrypted_extra_is_untouched() -> None:
    extra = json.dumps({"auth_method": "okta", "auth_params": {"user": "u"}})
    payload = make_payload(auth_method="password", password="s3cret")  # noqa: S106
    payload["masked_encrypted_extra"] = extra

    loaded = new_schema(DatabasePutSchema).load(payload)

    assert loaded["masked_encrypted_extra"] == extra


def test_invalid_encrypted_extra_json_is_left_for_field_validation() -> None:
    payload = make_payload(**keypair_parameters())
    payload["masked_encrypted_extra"] = "{not json"

    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(payload)

    assert "masked_encrypted_extra" in excinfo.value.messages


def test_get_parameters_from_uri_password() -> None:
    uri = "snowflake://u:pw@acct/db?role=R&warehouse=W"

    assert SnowflakeEngineSpec.get_parameters_from_uri(uri, {}) == {
        "username": "u",
        "password": "pw",
        "account": "acct",
        "database": "db",
        "role": "R",
        "warehouse": "W",
        "auth_method": "password",
    }


def test_get_parameters_from_uri_without_encrypted_extra_is_unchanged() -> None:
    uri = "snowflake://u:pw@acct/db?role=R&warehouse=W"

    assert "auth_method" not in SnowflakeEngineSpec.get_parameters_from_uri(uri)


def test_get_parameters_from_uri_keypair_reports_only_masks() -> None:
    uri = "snowflake://u@acct/db?role=R&warehouse=W"
    stored = {
        "auth_method": "keypair",
        "auth_params": {"privatekey_body": PEM_KEY, "privatekey_pass": PEM_PASSPHRASE},
    }

    parameters = SnowflakeEngineSpec.get_parameters_from_uri(uri, stored)

    assert parameters == {
        "username": "u",
        "account": "acct",
        "database": "db",
        "role": "R",
        "warehouse": "W",
        "auth_method": "keypair",
        "privatekey_body": PASSWORD_MASK,
        "privatekey_pass": PASSWORD_MASK,
    }
    assert PEM_KEY not in json.dumps(parameters)
    assert PEM_PASSPHRASE not in json.dumps(parameters)


def test_get_parameters_from_uri_keypair_without_passphrase() -> None:
    parameters = SnowflakeEngineSpec.get_parameters_from_uri(
        "snowflake://u@acct/db",
        {"auth_method": "keypair", "auth_params": {"privatekey_body": PEM_KEY}},
    )

    assert parameters["privatekey_body"] == PASSWORD_MASK
    assert "privatekey_pass" not in parameters


def test_get_parameters_from_uri_other_authenticator_reads_as_password() -> None:
    parameters = SnowflakeEngineSpec.get_parameters_from_uri(
        "snowflake://u:pw@acct/db", {"auth_method": "okta", "auth_params": {}}
    )

    assert parameters["auth_method"] == "password"


def test_edit_form_round_trip() -> None:
    """What the edit form receives can be sent back unchanged."""
    stored = {"auth_method": "keypair", "auth_params": {"privatekey_body": PEM_KEY}}
    hydrated = SnowflakeEngineSpec.get_parameters_from_uri(
        "snowflake://svc_superset@xy12345.us-east-1/ANALYTICS"
        "?role=READER&warehouse=COMPUTE_WH",
        stored,
    )

    loaded = load_with_extra(
        DatabasePutSchema,
        {
            "database_name": "snow",
            "engine": "snowflake",
            "configuration_method": "dynamic_form",
            "parameters": hydrated,
        },
    )

    revealed = SnowflakeEngineSpec.unmask_encrypted_extra(
        json.dumps(stored), loaded["masked_encrypted_extra"]
    )
    assert json.loads(revealed or "{}") == stored


def test_validate_parameters_is_mode_aware() -> None:
    def missing(**parameters: Any) -> list[str]:
        errors = SnowflakeEngineSpec.validate_parameters(
            {"parameters": {**BASE_PARAMETERS, **parameters}}  # type: ignore[typeddict-item]
        )
        return (errors[0].extra or {})["missing"] if errors else []

    assert missing() == ["password"]
    assert missing(password="x") == []  # noqa: S106
    assert missing(auth_method="keypair") == ["privatekey_body"]
    assert missing(auth_method="keypair", privatekey_body=PEM_KEY) == []


def test_validate_parameters_password_message_unchanged() -> None:
    errors = SnowflakeEngineSpec.validate_parameters({"parameters": {}})

    assert errors[0].message == (
        "One or more parameters are missing: "
        "account, database, password, role, username, warehouse"
    )


def generate_pem(passphrase: str | None = None) -> str:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    encryption: serialization.KeySerializationEncryption = (
        serialization.BestAvailableEncryption(passphrase.encode())
        if passphrase
        else serialization.NoEncryption()
    )
    return key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        encryption,
    ).decode()


@pytest.mark.parametrize("passphrase", [None, PEM_PASSPHRASE])
def test_form_saved_key_loads_at_connect_time(passphrase: str | None) -> None:
    pem = generate_pem(passphrase)
    loaded = DatabasePostSchema().load(
        make_payload(
            **keypair_parameters(privatekey_body=pem, privatekey_pass=passphrase or "")
        )
    )
    database = mock.MagicMock()
    database.embedded_fallback_applies.return_value = False
    database.encrypted_extra = loaded["masked_encrypted_extra"]
    params: dict[str, Any] = {}

    SnowflakeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert isinstance(params["connect_args"]["private_key"], bytes)


def test_key_pair_with_key_path_still_loads(tmp_path: Any) -> None:
    """Connections configured through ``encrypted_extra`` keep supporting paths."""
    path = tmp_path / "key.p8"
    path.write_text(generate_pem())
    database = mock.MagicMock()
    database.embedded_fallback_applies.return_value = False
    database.encrypted_extra = json.dumps(
        {"auth_method": "keypair", "auth_params": {"privatekey_path": str(path)}}
    )
    params: dict[str, Any] = {}

    SnowflakeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert isinstance(params["connect_args"]["private_key"], bytes)


def test_unlisted_custom_authenticator_is_still_rejected(app_context: None) -> None:
    database = mock.MagicMock()
    database.embedded_fallback_applies.return_value = False
    database.encrypted_extra = json.dumps({"auth_method": "okta", "auth_params": {}})

    with pytest.raises(ValueError, match="ALLOWED_EXTRA_AUTHENTICATIONS"):
        SnowflakeEngineSpec.update_params_from_encrypted_extra(database, {})


def test_allowed_custom_authenticator_still_works(app_context: None) -> None:
    from flask import current_app

    authenticator = mock.MagicMock(return_value="auth-object")
    database = mock.MagicMock()
    database.embedded_fallback_applies.return_value = False
    database.encrypted_extra = json.dumps(
        {"auth_method": "okta", "auth_params": {"user": "u"}}
    )
    params: dict[str, Any] = {}

    with mock.patch.dict(
        current_app.config,
        {"ALLOWED_EXTRA_AUTHENTICATIONS": {"snowflake": {"okta": authenticator}}},
    ):
        SnowflakeEngineSpec.update_params_from_encrypted_extra(database, params)

    authenticator.assert_called_once_with(user="u")
    assert params["connect_args"]["auth"] == "auth-object"


def test_subclass_can_add_an_authentication_method(app_context: None) -> None:
    """A distribution adds a method without copying code from the engine spec."""

    class OAuthParametersSchema(SnowflakeParametersSchema):
        required_by_auth_method = {
            **SnowflakeParametersSchema.required_by_auth_method,
            "oauth2": ("token",),
        }
        auth_method = SnowflakeParametersSchema._declared_fields["auth_method"]
        token = SnowflakeParametersSchema._declared_fields["username"]

    applied: dict[str, Any] = {}

    def apply_oauth2(auth_params: dict[str, Any], connect_args: dict[str, Any]) -> None:
        applied.update(auth_params)
        connect_args["token"] = auth_params["token"]

    class OAuthSnowflakeEngineSpec(SnowflakeEngineSpec):
        parameters_schema = OAuthParametersSchema()
        auth_method_handlers = {
            **SnowflakeEngineSpec.auth_method_handlers,
            "oauth2": apply_oauth2,
        }

        @classmethod
        def get_auth_methods(cls) -> Any:
            return [
                *super().get_auth_methods(),
                {"id": "oauth2", "label": "OAuth", "fields": ["token"]},
            ]

    assert [m["id"] for m in OAuthSnowflakeEngineSpec.get_auth_methods()] == [
        "password",
        "keypair",
        "oauth2",
    ]
    database = mock.MagicMock()
    database.embedded_fallback_applies.return_value = False
    database.encrypted_extra = json.dumps(
        {"auth_method": "oauth2", "auth_params": {"token": "t"}}
    )
    params: dict[str, Any] = {}

    OAuthSnowflakeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params["connect_args"]["token"] == "t"  # noqa: S105
    assert applied == {"token": "t"}
    # the base spec is unaffected, and still guards unknown methods
    assert "oauth2" not in SnowflakeEngineSpec.auth_method_handlers
    with pytest.raises(ValueError, match="ALLOWED_EXTRA_AUTHENTICATIONS"):
        SnowflakeEngineSpec.update_params_from_encrypted_extra(database, {})


def test_other_engines_are_unaffected_by_the_credentials_hook() -> None:
    from superset.db_engine_specs.postgres import PostgresEngineSpec

    extra = {"anything": {"nested": 1}}

    assert PostgresEngineSpec.get_encrypted_extra_from_parameters({}, extra) is extra
    assert PostgresEngineSpec.get_auth_methods() == []


def escaped(pem: str, newline: str = "\\n") -> str:
    return pem.replace("\n", newline)


@pytest.mark.parametrize("newline", ["\\n", "\\r\\n"])
@pytest.mark.parametrize("schema_class", SCHEMAS)
def test_escaped_newlines_in_key_are_normalised(
    schema_class: type, newline: str
) -> None:
    loaded = load_with_extra(
        schema_class,
        make_payload(**keypair_parameters(privatekey_body=escaped(PEM_KEY, newline))),
    )

    stored = json.loads(loaded["masked_encrypted_extra"])
    assert stored["auth_params"]["privatekey_body"] == PEM_KEY


def test_key_with_real_newlines_is_stored_unchanged() -> None:
    key = PEM_KEY.replace("\n", "\r\n")

    loaded = DatabasePostSchema().load(
        make_payload(**keypair_parameters(privatekey_body=key))
    )

    stored = json.loads(loaded["masked_encrypted_extra"])
    assert stored["auth_params"]["privatekey_body"] == key


def test_escaped_text_that_is_not_pem_still_fails() -> None:
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(
            make_payload(**keypair_parameters(privatekey_body="notakeyZZZ\\nQQQ"))
        )

    assert list(excinfo.value.messages) == ["privatekey_body"]
    assert "notakeyZZZ" not in error_text(excinfo.value)
    assert "QQQ" not in error_text(excinfo.value)


@pytest.mark.parametrize("blank", ["\\n", " \\n ", "\\r\\n\\n"])
def test_blank_escaped_key_is_rejected(blank: str) -> None:
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(
            make_payload(**keypair_parameters(privatekey_body=blank))
        )

    assert list(excinfo.value.messages) == ["privatekey_body"]


def test_mask_is_not_altered_by_normalisation() -> None:
    loaded = load_with_extra(
        DatabasePutSchema,
        make_payload(**keypair_parameters(privatekey_body=PASSWORD_MASK)),
    )

    stored = json.loads(loaded["masked_encrypted_extra"])
    assert stored["auth_params"]["privatekey_body"] == PASSWORD_MASK


KEY_PATH = "/etc/snowflake/legacy_rsa_key.p8"
PATH_EXTRA = {"auth_method": "keypair", "auth_params": {"privatekey_path": KEY_PATH}}
PATH_URI = (
    "snowflake://svc_superset@xy12345.us-east-1/ANALYTICS?role=READER&warehouse=W"
)


def test_hydration_reports_a_stored_key_path_read_only() -> None:
    parameters = SnowflakeEngineSpec.get_parameters_from_uri(PATH_URI, PATH_EXTRA)

    assert parameters["auth_method"] == "keypair"
    assert parameters["privatekey_path"] == KEY_PATH
    assert "privatekey_body" not in parameters
    assert "password" not in parameters


def test_hydration_prefers_the_stored_key_over_a_path() -> None:
    parameters = SnowflakeEngineSpec.get_parameters_from_uri(
        PATH_URI,
        {
            "auth_method": "keypair",
            "auth_params": {"privatekey_body": PEM_KEY, "privatekey_path": KEY_PATH},
        },
    )

    assert parameters["privatekey_body"] == PASSWORD_MASK
    assert "privatekey_path" not in parameters


def test_hydration_of_other_connections_has_no_path() -> None:
    assert "privatekey_path" not in SnowflakeEngineSpec.get_parameters_from_uri(
        "snowflake://u:pw@acct/db", {}
    )
    assert "privatekey_path" not in SnowflakeEngineSpec.get_parameters_from_uri(
        "snowflake://u:pw@acct/db", {"auth_method": "okta", "auth_params": {}}
    )


SUBMITTED_PATHS = [KEY_PATH, "/tmp/other.p8", "", None, 7, ["x"], {"a": 1}]  # noqa: S108
ABSENT = object()


def path_payload(
    in_parameters: Any = ABSENT, in_extra: Any = ABSENT, **parameters: Any
) -> dict[str, Any]:
    """A form request, optionally carrying a submitted path in either place."""
    if in_parameters is not ABSENT:
        parameters["privatekey_path"] = in_parameters
    payload = make_payload(auth_method="keypair", **parameters)
    extra: dict[str, Any] = {"auth_method": "keypair", "auth_params": {}}
    if in_extra is not ABSENT:
        extra["auth_params"]["privatekey_path"] = in_extra
    payload["masked_encrypted_extra"] = json.dumps(extra)
    return payload


@pytest.fixture
def stored_with_path(stored_database: mock.MagicMock) -> mock.MagicMock:
    stored_database.encrypted_extra = json.dumps(PATH_EXTRA)
    return stored_database


@pytest.mark.parametrize(
    "schema_class", [DatabasePutSchema, DatabaseTestConnectionSchema]
)
@pytest.mark.parametrize("in_extra", [ABSENT, *SUBMITTED_PATHS])
@pytest.mark.parametrize("in_parameters", [ABSENT, *SUBMITTED_PATHS])
def test_stored_path_is_used_whatever_path_is_submitted(
    stored_with_path: mock.MagicMock,
    schema_class: type,
    in_parameters: Any,
    in_extra: Any,
) -> None:
    loaded = new_schema(schema_class).load(path_payload(in_parameters, in_extra))

    assert loaded["masked_encrypted_extra"] == json.dumps(
        {"auth_method": "keypair", "auth_params": {"privatekey_path": KEY_PATH}}
    )
    assert "svc_superset:" not in loaded["sqlalchemy_uri"]


def test_stored_path_survives_next_to_other_settings(stored_database: Any) -> None:
    stored_database.encrypted_extra = json.dumps(
        {**PATH_EXTRA, "oauth2_client_info": OAUTH_CLIENT}
    )
    payload = path_payload(ABSENT, "/tmp/other.p8")  # noqa: S108
    payload["masked_encrypted_extra"] = json.dumps(
        {"oauth2_client_info": OAUTH_CLIENT, "auth_params": {"privatekey_path": "/x"}}
    )

    loaded = new_schema(DatabasePutSchema).load(payload)

    assert json.loads(loaded["masked_encrypted_extra"]) == {
        **PATH_EXTRA,
        "oauth2_client_info": OAUTH_CLIENT,
    }


def test_stored_path_uses_the_submitted_passphrase(
    stored_with_path: mock.MagicMock,
) -> None:
    stored_with_path.encrypted_extra = json.dumps(
        {
            "auth_method": "keypair",
            "auth_params": {"privatekey_path": KEY_PATH, "privatekey_pass": "stored"},
        }
    )
    loaded = new_schema(DatabasePutSchema).load(
        path_payload(privatekey_pass=PASSWORD_MASK)
    )

    assert json.loads(loaded["masked_encrypted_extra"])["auth_params"] == {
        "privatekey_path": KEY_PATH,
        "privatekey_pass": PASSWORD_MASK,
    }


@pytest.mark.parametrize("schema_class", SCHEMAS)
@pytest.mark.parametrize("in_extra", [ABSENT, *SUBMITTED_PATHS])
@pytest.mark.parametrize("in_parameters", [ABSENT, *SUBMITTED_PATHS])
def test_missing_key_gives_the_same_error_whatever_path_is_submitted(
    stored_database: mock.MagicMock,
    schema_class: type,
    in_parameters: Any,
    in_extra: Any,
) -> None:
    """With no stored path, a submitted one changes nothing, not even the error."""
    stored_database.encrypted_extra = json.dumps({"oauth2_client_info": OAUTH_CLIENT})

    with pytest.raises(ValidationError) as excinfo:
        new_schema(schema_class).load(path_payload(in_parameters, in_extra))

    assert excinfo.value.messages == {
        "privatekey_body": ["Missing data for required field."]
    }


def test_submitted_path_is_not_reflected_in_errors() -> None:
    secret_path = "/srv/keys/guess_me_8841.p8"  # noqa: S105
    with pytest.raises(ValidationError) as excinfo:
        DatabasePostSchema().load(path_payload(secret_path, secret_path))

    assert "guess_me_8841" not in error_text(excinfo.value)


def test_legacy_secure_extra_path_is_untouched_without_a_named_method() -> None:
    """Without ``auth_method`` in the form, ``encrypted_extra`` is not interpreted."""
    extra = json.dumps(
        {"auth_method": "keypair", "auth_params": {"privatekey_path": "/other.p8"}}
    )
    payload = make_payload(password="placeholder")  # noqa: S106
    payload["masked_encrypted_extra"] = extra

    loaded = DatabasePostSchema().load(payload)

    assert loaded["masked_encrypted_extra"] == extra


def test_pasting_a_key_replaces_the_path(stored_with_path: mock.MagicMock) -> None:
    loaded = new_schema(DatabasePutSchema).load(
        path_payload(ABSENT, KEY_PATH, privatekey_body=PEM_KEY)
    )

    assert json.loads(loaded["masked_encrypted_extra"])["auth_params"] == {
        "privatekey_body": PEM_KEY
    }


def test_auth_parameters_are_carried_only_when_a_method_is_named() -> None:
    def named() -> dict[str, Any]:
        return make_payload(auth_method="password", password="s3cret")  # noqa: S106

    def omitted() -> dict[str, Any]:
        return make_payload(password="s3cret")  # noqa: S106

    assert "parameters" in new_schema(DatabasePutSchema).load(named())
    assert "parameters" not in new_schema(DatabasePutSchema).load(omitted())
    assert "parameters" not in DatabasePostSchema().load(named())
    assert "parameters" in DatabaseTestConnectionSchema().load(named())
    assert "parameters" not in DatabaseTestConnectionSchema().load(omitted())


EMBEDDED = {
    "auth_method": "keypair",
    "privatekey_body": PEM_KEY,
    "username": "embedded_user",
}
OAUTH_CLIENT = {"id": "abc", "secret": "client-secret"}  # noqa: S105


def test_hook_keeps_oauth2_and_embedded_credentials() -> None:
    stored = {
        "auth_method": "keypair",
        "auth_params": {"privatekey_body": "old"},
        "oauth2_client_info": OAUTH_CLIENT,
        "embedded_credentials": EMBEDDED,
    }

    keypair = SnowflakeEngineSpec.get_encrypted_extra_from_parameters(
        {"auth_method": "keypair", "privatekey_body": PEM_KEY}, stored
    )
    password = SnowflakeEngineSpec.get_encrypted_extra_from_parameters(
        {"auth_method": "password", "password": "x"},
        stored,  # noqa: S106
    )

    assert keypair["auth_params"] == {"privatekey_body": PEM_KEY}
    assert keypair["oauth2_client_info"] == OAUTH_CLIENT
    assert keypair["embedded_credentials"] == EMBEDDED
    # the embedded guest's own key pair is not the connection's
    assert password == {
        "oauth2_client_info": OAUTH_CLIENT,
        "embedded_credentials": EMBEDDED,
    }


def test_hydration_ignores_oauth2_and_embedded_credentials() -> None:
    parameters = SnowflakeEngineSpec.get_parameters_from_uri(
        "snowflake://u@acct/db",
        {
            "auth_method": "keypair",
            "auth_params": {"privatekey_body": PEM_KEY},
            "oauth2_client_info": OAUTH_CLIENT,
            "embedded_credentials": EMBEDDED,
        },
    )

    assert set(parameters) == {
        "username",
        "account",
        "database",
        "role",
        "warehouse",
        "auth_method",
        "privatekey_body",
    }


def test_embedded_credentials_alone_do_not_look_like_key_pair() -> None:
    parameters = SnowflakeEngineSpec.get_parameters_from_uri(
        "snowflake://u:pw@acct/db", {"embedded_credentials": EMBEDDED}
    )

    assert parameters["auth_method"] == "password"
    assert "privatekey_body" not in parameters


def test_mask_without_stored_secret_is_rejected_on_update(
    stored_database: mock.MagicMock,
) -> None:
    stored_database.encrypted_extra = json.dumps({"oauth2_client_info": OAUTH_CLIENT})

    with pytest.raises(ValidationError) as excinfo:
        load_with_extra(
            DatabasePutSchema,
            make_payload(**keypair_parameters(privatekey_body=PASSWORD_MASK)),
        )

    assert "$.auth_params.privatekey_body" in error_text(excinfo.value)


def test_mask_is_accepted_on_test_connection_without_stored_connection() -> None:
    loaded = load_with_extra(
        DatabaseTestConnectionSchema,
        make_payload(**keypair_parameters(privatekey_body=PASSWORD_MASK)),
    )

    stored = json.loads(loaded["masked_encrypted_extra"])
    assert stored["auth_params"]["privatekey_body"] == PASSWORD_MASK


@pytest.mark.parametrize(
    ("parameters", "stored", "expected"),
    [
        ({"auth_method": "keypair"}, PATH_EXTRA, True),
        ({"auth_method": "keypair", "privatekey_pass": "x"}, PATH_EXTRA, True),
        ({"auth_method": "keypair", "privatekey_path": "/x"}, PATH_EXTRA, True),
        # a pasted key is a new secret
        ({"auth_method": "keypair", "privatekey_body": PEM_KEY}, PATH_EXTRA, False),
        # nothing stored to reuse
        ({"auth_method": "keypair"}, {}, False),
        ({"auth_method": "keypair"}, None, False),
        (
            {"auth_method": "keypair"},
            {"auth_method": "keypair", "auth_params": {"privatekey_body": "k"}},
            False,
        ),
        # not a form key pair request
        ({"auth_method": "password"}, PATH_EXTRA, False),
        ({}, PATH_EXTRA, False),
    ],
)
def test_reuses_stored_credentials(
    parameters: dict[str, Any], stored: dict[str, Any] | None, expected: bool
) -> None:
    assert SnowflakeEngineSpec.reuses_stored_credentials(parameters, stored) is expected


def test_other_engines_never_reuse_stored_credentials() -> None:
    assert (
        BaseEngineSpec.reuses_stored_credentials({"auth_method": "keypair"}, PATH_EXTRA)
        is False
    )
