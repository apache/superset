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
from unittest.mock import MagicMock

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.constants import PASSWORD_MASK
from superset.utils import json

PEM_KEY = (
    "-----BEGIN PRIVATE KEY-----\nU0VDUkVULUtFWS1CT0RZ\n-----END PRIVATE KEY-----\n"
)
PASSPHRASE = "pass-phrase-value"  # noqa: S105
URI_TAIL = "xy12345.us-east-1/ANALYTICS?role=READER&warehouse=COMPUTE_WH"

PARAMETERS: dict[str, Any] = {
    "username": "svc_superset",
    "account": "xy12345.us-east-1",
    "database": "ANALYTICS",
    "role": "READER",
    "warehouse": "COMPUTE_WH",
}


@pytest.fixture
def snowflake_db(
    mocker: MockerFixture, session: Session, full_api_access: None
) -> Session:
    """Real persistence and update command, without external services."""
    from superset.databases.api import DatabaseRestApi
    from superset.models.core import Database

    mocker.patch.object(DatabaseRestApi.datamodel, "_session", session)
    Database.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    mocker.patch("superset.utils.log.DBEventLogger.log")
    mocker.patch("superset.commands.database.create.add_permissions")
    mocker.patch("superset.commands.database.update.SyncPermissionsCommand.run")
    mocker.patch("superset.commands.database.update.get_username", return_value="admin")
    mocker.patch.object(Database, "get_default_catalog", return_value=None)
    mocker.patch("sqlalchemy.engine.URL.get_driver_name", return_value="snowflake")
    return session


@pytest.fixture
def snowflake_api(mocker: MockerFixture, snowflake_db: Session) -> Session:
    """As above, and creating a database does not test the connection."""
    mocker.patch("superset.commands.database.create.TestConnectionDatabaseCommand.run")
    return snowflake_db


def payload(**parameters: Any) -> dict[str, Any]:
    return {
        "database_name": "snow",
        "engine": "snowflake",
        "configuration_method": "dynamic_form",
        "parameters": {**PARAMETERS, **parameters},
    }


def create_keypair(client: FlaskClient, **overrides: Any) -> Any:
    return client.post(
        "/api/v1/database/",
        json=payload(
            **{
                "auth_method": "keypair",
                "privatekey_body": PEM_KEY,
                "privatekey_pass": PASSPHRASE,
                **overrides,
            }
        ),
    )


def test_available_lists_auth_methods(
    mocker: MockerFixture, client: FlaskClient, full_api_access: None
) -> None:
    from superset.db_engine_specs.postgres import PostgresEngineSpec
    from superset.db_engine_specs.snowflake import SnowflakeEngineSpec

    mocker.patch(
        "superset.databases.api.get_available_engine_specs",
        return_value={
            SnowflakeEngineSpec: {"snowflake"},
            PostgresEngineSpec: {"psycopg2"},
        },
    )

    response = client.get("/api/v1/database/available/")

    assert response.status_code == 200
    entries = {item["engine"]: item for item in response.json["databases"]}
    assert entries["snowflake"]["auth_methods"] == [
        {"id": "password", "label": "Password", "fields": ["password"]},
        {
            "id": "keypair",
            "label": "Key pair",
            "fields": ["privatekey_body", "privatekey_pass"],
        },
    ]
    assert {"auth_method", "privatekey_body", "privatekey_pass"} <= set(
        entries["snowflake"]["parameters"]["properties"]
    )
    assert "auth_methods" not in entries["postgresql"]


def test_create_password_connection(
    snowflake_api: Session, client: FlaskClient
) -> None:
    from superset.models.core import Database

    response = client.post("/api/v1/database/", json=payload(password="s3cret"))  # noqa: S106

    assert response.status_code == 201
    stored = snowflake_api.query(Database).one()
    assert stored.sqlalchemy_uri == "snowflake://svc_superset:XXXXXXXXXX@" + URI_TAIL
    assert stored.password == "s3cret"  # noqa: S105
    assert json.loads(stored.encrypted_extra or "{}") == {}


def test_create_password_connection_requires_password(
    snowflake_api: Session, client: FlaskClient
) -> None:
    response = client.post("/api/v1/database/", json=payload())

    assert response.status_code == 422
    assert response.json["message"] == {
        "password": ["Missing data for required field."]
    }


def test_create_keypair_connection(snowflake_api: Session, client: FlaskClient) -> None:
    from superset.models.core import Database

    response = create_keypair(client)

    assert response.status_code == 201
    stored = snowflake_api.query(Database).one()
    assert stored.sqlalchemy_uri == "snowflake://svc_superset@" + URI_TAIL
    assert stored.password is None
    assert json.loads(stored.encrypted_extra) == {
        "auth_method": "keypair",
        "auth_params": {"privatekey_body": PEM_KEY, "privatekey_pass": PASSPHRASE},
    }
    body = response.get_data(as_text=True)
    assert "U0VDUkVULUtFWS1CT0RZ" not in body
    assert PASSPHRASE not in body


def test_create_keypair_requires_key(
    snowflake_api: Session, client: FlaskClient
) -> None:
    from superset.models.core import Database

    response = client.post("/api/v1/database/", json=payload(auth_method="keypair"))

    assert response.status_code == 422
    assert response.json["message"] == {
        "privatekey_body": ["Missing data for required field."]
    }
    assert snowflake_api.query(Database).count() == 0


@pytest.mark.parametrize("secret_field", ["privatekey_body", "privatekey_pass"])
def test_create_rejects_literal_mask(
    snowflake_api: Session, client: FlaskClient, secret_field: str
) -> None:
    from superset.models.core import Database

    response = create_keypair(client, **{secret_field: PASSWORD_MASK})

    assert response.status_code == 422
    assert "masked_encrypted_extra" in response.json["message"]
    assert snowflake_api.query(Database).count() == 0


def test_edit_round_trip_keeps_stored_key(
    snowflake_api: Session, client: FlaskClient
) -> None:
    """The edit form shows masks, and sending them back keeps the stored key."""
    from superset.models.core import Database

    database_id = create_keypair(client).json["id"]

    connection = client.get(f"/api/v1/database/{database_id}/connection")
    assert connection.status_code == 200
    parameters = connection.json["result"]["parameters"]
    assert parameters["auth_method"] == "keypair"
    assert parameters["privatekey_body"] == PASSWORD_MASK
    assert parameters["privatekey_pass"] == PASSWORD_MASK
    assert "password" not in parameters
    assert "U0VDUkVULUtFWS1CT0RZ" not in connection.get_data(as_text=True)

    response = client.put(
        f"/api/v1/database/{database_id}",
        json={
            "configuration_method": "dynamic_form",
            "engine": "snowflake",
            "database_name": "renamed",
            "parameters": parameters,
        },
    )

    assert response.status_code == 200, response.json
    snowflake_api.expire_all()
    stored = snowflake_api.get(Database, database_id)
    assert stored is not None
    assert json.loads(stored.encrypted_extra) == {
        "auth_method": "keypair",
        "auth_params": {"privatekey_body": PEM_KEY, "privatekey_pass": PASSPHRASE},
    }
    assert stored.database_name == "renamed"


def test_edit_can_replace_key_and_drop_passphrase(
    snowflake_api: Session, client: FlaskClient
) -> None:
    from superset.models.core import Database

    database_id = create_keypair(client).json["id"]
    new_key = PEM_KEY.replace("U0VDUkVULUtFWS1CT0RZ", "TkVXLUtFWQ==")

    response = client.put(
        f"/api/v1/database/{database_id}",
        json={
            "configuration_method": "dynamic_form",
            "engine": "snowflake",
            "parameters": {
                **PARAMETERS,
                "auth_method": "keypair",
                "privatekey_body": new_key,
                "privatekey_pass": "",
            },
        },
    )

    assert response.status_code == 200
    snowflake_api.expire_all()
    stored = snowflake_api.get(Database, database_id)
    assert stored is not None
    assert json.loads(stored.encrypted_extra)["auth_params"] == {
        "privatekey_body": new_key
    }


def test_edit_switch_from_keypair_to_password(
    snowflake_api: Session, client: FlaskClient
) -> None:
    from superset.models.core import Database

    created = create_keypair(client)
    database_id = created.json["id"]
    # the edit form submits the masked settings it was loaded with
    masked_encrypted_extra = created.json["result"]["masked_encrypted_extra"]

    response = client.put(
        f"/api/v1/database/{database_id}",
        json={
            "configuration_method": "dynamic_form",
            "engine": "snowflake",
            "masked_encrypted_extra": masked_encrypted_extra,
            "parameters": {
                **PARAMETERS,
                "auth_method": "password",
                "password": "s3cret",
            },
        },
    )

    assert response.status_code == 200
    snowflake_api.expire_all()
    stored = snowflake_api.get(Database, database_id)
    assert stored is not None
    assert json.loads(stored.encrypted_extra or "{}") == {}
    assert stored.password == "s3cret"  # noqa: S105


def test_edit_key_cannot_follow_the_connection_to_another_account(
    snowflake_api: Session, client: FlaskClient
) -> None:
    """The stored key is not re-used when the account it is sent to changes."""
    database_id = create_keypair(client).json["id"]

    response = client.put(
        f"/api/v1/database/{database_id}",
        json={
            "configuration_method": "dynamic_form",
            "engine": "snowflake",
            "parameters": {
                **PARAMETERS,
                "account": "attacker.example.com",
                "auth_method": "keypair",
                "privatekey_body": PASSWORD_MASK,
            },
        },
    )

    assert response.status_code == 422


def test_test_connection_uses_form_credentials(
    mocker: MockerFixture, client: FlaskClient, full_api_access: None
) -> None:
    build = mocker.patch(
        "superset.commands.database.test_connection."
        "DatabaseDAO.build_db_for_connection_test",
        return_value=MagicMock(),
    )
    mocker.patch("superset.commands.database.test_connection.ping", return_value=True)
    mocker.patch("superset.utils.log.DBEventLogger.log")
    mocker.patch("sqlalchemy.engine.URL.get_driver_name", return_value="snowflake")

    response = client.post(
        "/api/v1/database/test_connection/",
        json=payload(auth_method="keypair", privatekey_body=PEM_KEY),
    )

    assert response.status_code == 200, response.json
    assert json.loads(build.call_args.kwargs["encrypted_extra"]) == {
        "auth_method": "keypair",
        "auth_params": {"privatekey_body": PEM_KEY},
    }


def test_test_connection_requires_credentials(
    mocker: MockerFixture, client: FlaskClient, full_api_access: None
) -> None:
    build = mocker.patch(
        "superset.commands.database.test_connection."
        "DatabaseDAO.build_db_for_connection_test"
    )
    mocker.patch("superset.utils.log.DBEventLogger.log")

    response = client.post(
        "/api/v1/database/test_connection/", json=payload(auth_method="keypair")
    )

    assert response.status_code == 400
    assert response.json["message"] == {
        "privatekey_body": ["Missing data for required field."]
    }
    build.assert_not_called()


KEY_PATH = "/etc/snowflake/legacy_rsa_key.p8"
OAUTH_INFO = {
    "id": "abc",
    "secret": "oauth-secret-value",  # noqa: S105
    "scope": "session:role-any",
    "authorization_request_uri": "https://acct.example.com/oauth/authorize",
    "token_request_uri": "https://acct.example.com/oauth/token",
}


def add_database(session: Session, encrypted_extra: dict[str, Any], uri: str) -> int:
    from superset.models.core import Database

    database = Database(
        database_name="snow",
        sqlalchemy_uri=uri,
        encrypted_extra=json.dumps(encrypted_extra),
    )
    session.add(database)
    session.commit()
    return database.id


def stored_extra(session: Session, database_id: int) -> dict[str, Any]:
    from superset.models.core import Database

    session.expire_all()
    database = session.get(Database, database_id)
    assert database is not None
    return json.loads(database.encrypted_extra or "{}")


def put(client: FlaskClient, database_id: int, **body: Any) -> Any:
    return client.put(f"/api/v1/database/{database_id}", json=body)


def form_body(**parameters: Any) -> dict[str, Any]:
    return {
        "configuration_method": "dynamic_form",
        "engine": "snowflake",
        "parameters": {**PARAMETERS, **parameters},
    }


KEYPAIR_EXTRA = {
    "auth_method": "keypair",
    "auth_params": {"privatekey_body": PEM_KEY, "privatekey_pass": PASSPHRASE},
    "oauth2_client_info": OAUTH_INFO,
}
KEYPAIR_URI = "snowflake://svc_superset@" + URI_TAIL


def test_explicit_password_clears_only_the_key_pair_block(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, KEYPAIR_EXTRA, KEYPAIR_URI)

    response = put(
        client,
        database_id,
        **form_body(auth_method="password", password="s3cret"),  # noqa: S106
    )

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == {
        "oauth2_client_info": OAUTH_INFO
    }


def test_omitted_auth_method_leaves_stored_settings_alone(
    snowflake_api: Session, client: FlaskClient
) -> None:
    """Requests from existing integrations never touch the stored key pair."""
    database_id = add_database(snowflake_api, KEYPAIR_EXTRA, KEYPAIR_URI)

    response = put(client, database_id, **form_body(password="placeholder"))  # noqa: S106

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == KEYPAIR_EXTRA


def test_unrelated_update_leaves_stored_settings_alone(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, KEYPAIR_EXTRA, KEYPAIR_URI)

    response = put(client, database_id, database_name="renamed")

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == KEYPAIR_EXTRA


def test_connection_without_auth_method_is_unaffected_by_password_choice(
    snowflake_api: Session, client: FlaskClient
) -> None:
    extra = {"oauth2_client_info": OAUTH_INFO}
    database_id = add_database(
        snowflake_api, extra, "snowflake://svc_superset:pw@" + URI_TAIL
    )

    response = put(
        client,
        database_id,
        **form_body(auth_method="password", password="s3cret"),  # noqa: S106
    )

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == extra


def test_explicit_keypair_without_stored_settings_request_keeps_stored_key(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, KEYPAIR_EXTRA, KEYPAIR_URI)
    connection = client.get(f"/api/v1/database/{database_id}/connection")

    response = put(
        client, database_id, **form_body(**connection.json["result"]["parameters"])
    )

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == KEYPAIR_EXTRA


def test_explicit_keypair_replaces_the_stored_key_and_keeps_other_settings(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, KEYPAIR_EXTRA, KEYPAIR_URI)
    new_key = PEM_KEY.replace("U0VDUkVULUtFWS1CT0RZ", "TkVXLUtFWQ==")

    response = put(
        client,
        database_id,
        **form_body(auth_method="keypair", privatekey_body=new_key),
    )

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == {
        **KEYPAIR_EXTRA,
        "auth_params": {"privatekey_body": new_key},
    }


PATH_EXTRA = {
    "auth_method": "keypair",
    "auth_params": {"privatekey_path": KEY_PATH},
    "oauth2_client_info": OAUTH_INFO,
}


def test_path_connection_shows_the_path_and_saves_untouched(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, PATH_EXTRA, KEYPAIR_URI)

    connection = client.get(f"/api/v1/database/{database_id}/connection")
    parameters = connection.json["result"]["parameters"]
    assert parameters["auth_method"] == "keypair"
    assert parameters["privatekey_path"] == KEY_PATH
    assert "privatekey_body" not in parameters

    response = put(client, database_id, **form_body(**parameters))

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == PATH_EXTRA


def test_path_connection_saves_untouched_when_the_form_sends_the_extra_too(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, PATH_EXTRA, KEYPAIR_URI)
    parameters = client.get(f"/api/v1/database/{database_id}/connection").json[
        "result"
    ]["parameters"]

    response = put(
        client,
        database_id,
        masked_encrypted_extra=json.dumps(PATH_EXTRA),
        **form_body(**parameters),
    )

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == PATH_EXTRA


def test_pasting_a_key_replaces_a_stored_path(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, PATH_EXTRA, KEYPAIR_URI)

    response = put(
        client,
        database_id,
        **form_body(auth_method="keypair", privatekey_body=PEM_KEY),
    )

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == {
        **PATH_EXTRA,
        "auth_params": {"privatekey_body": PEM_KEY},
    }


SUBMITTED_PATHS = ["/tmp/other.p8", KEY_PATH, "", None, 7, ["x"]]  # noqa: S108


@pytest.mark.parametrize("submitted", SUBMITTED_PATHS)
def test_submitted_path_does_not_change_the_error_without_a_stored_key(
    snowflake_api: Session, client: FlaskClient, submitted: Any
) -> None:
    password_id = add_database(
        snowflake_api, {}, "snowflake://svc_superset:pw@" + URI_TAIL
    )

    response = put(
        client,
        password_id,
        **form_body(auth_method="keypair", privatekey_path=submitted),
    )

    assert response.status_code == 400
    assert response.json["message"] == {
        "privatekey_body": ["Missing data for required field."]
    }
    assert stored_extra(snowflake_api, password_id) == {}


@pytest.mark.parametrize("submitted", SUBMITTED_PATHS)
def test_stored_path_is_kept_whatever_path_is_submitted(
    snowflake_api: Session, client: FlaskClient, submitted: Any
) -> None:
    database_id = add_database(snowflake_api, PATH_EXTRA, KEYPAIR_URI)

    response = put(
        client,
        database_id,
        **form_body(auth_method="keypair", privatekey_path=submitted),
    )

    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == PATH_EXTRA


@pytest.mark.parametrize("submitted", SUBMITTED_PATHS)
def test_test_connection_uses_the_stored_path(
    mocker: MockerFixture,
    snowflake_db: Session,
    client: FlaskClient,
    submitted: Any,
) -> None:
    add_database(snowflake_db, PATH_EXTRA, KEYPAIR_URI)
    build = mocker.patch(
        "superset.commands.database.test_connection."
        "DatabaseDAO.build_db_for_connection_test",
        return_value=MagicMock(),
    )
    mocker.patch("superset.commands.database.test_connection.ping", return_value=True)

    response = client.post(
        "/api/v1/database/test_connection/",
        json=payload(auth_method="keypair", privatekey_path=submitted),
    )

    assert response.status_code == 200, response.json
    assert json.loads(build.call_args.kwargs["encrypted_extra"])["auth_params"] == {
        "privatekey_path": KEY_PATH
    }


def test_path_never_appears_in_errors(
    snowflake_api: Session, client: FlaskClient
) -> None:
    database_id = add_database(snowflake_api, PATH_EXTRA, KEYPAIR_URI)

    response = put(
        client,
        database_id,
        **form_body(auth_method="keypair", privatekey_body="not a key"),
    )

    assert response.status_code == 400
    assert KEY_PATH not in response.get_data(as_text=True)


EMBEDDED_CREDENTIALS = {
    "auth_method": "keypair",
    "privatekey_body": PEM_KEY,
    "username": "embedded_user",
}


def test_key_pair_choices_keep_oauth2_and_embedded_credentials(
    snowflake_api: Session, client: FlaskClient
) -> None:
    extra = {
        "auth_method": "keypair",
        "auth_params": {"privatekey_body": PEM_KEY},
        "oauth2_client_info": OAUTH_INFO,
        "embedded_credentials": EMBEDDED_CREDENTIALS,
    }
    database_id = add_database(snowflake_api, extra, KEYPAIR_URI)
    new_key = PEM_KEY.replace("U0VDUkVULUtFWS1CT0RZ", "TkVXLUtFWQ==")

    response = put(
        client,
        database_id,
        **form_body(auth_method="keypair", privatekey_body=new_key),
    )
    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == {
        **extra,
        "auth_params": {"privatekey_body": new_key},
    }

    response = put(
        client,
        database_id,
        **form_body(auth_method="password", password="s3cret"),  # noqa: S106
    )
    assert response.status_code == 200
    assert stored_extra(snowflake_api, database_id) == {
        "oauth2_client_info": OAUTH_INFO,
        "embedded_credentials": EMBEDDED_CREDENTIALS,
    }


def test_mask_without_stored_key_is_rejected_when_the_extra_is_omitted(
    snowflake_api: Session, client: FlaskClient
) -> None:
    extra = {"oauth2_client_info": OAUTH_INFO}
    database_id = add_database(
        snowflake_api, extra, "snowflake://svc_superset:pw@" + URI_TAIL
    )

    response = put(
        client,
        database_id,
        **form_body(auth_method="keypair", privatekey_body=PASSWORD_MASK),
    )

    assert response.status_code == 422
    assert stored_extra(snowflake_api, database_id) == extra


def test_mask_without_stored_key_is_rejected_on_update(
    snowflake_api: Session, client: FlaskClient
) -> None:
    extra = {"oauth2_client_info": OAUTH_INFO}
    database_id = add_database(
        snowflake_api, extra, "snowflake://svc_superset:pw@" + URI_TAIL
    )

    response = put(
        client,
        database_id,
        masked_encrypted_extra=json.dumps(extra),
        **form_body(auth_method="keypair", privatekey_body=PASSWORD_MASK),
    )

    assert response.status_code == 400
    assert stored_extra(snowflake_api, database_id) == extra
