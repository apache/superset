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
"""
Bundle exports carry a connection's Secure Extra, masked, and imports ask for it.

A dashboard, chart or dataset bundle used to write the database YAML without
``encrypted_extra``, so promoting a dashboard dropped the connection's OAuth2
client and embedded viewer credential with no warning (sc-126855, QA
OEF-SECRET-14).
"""

from typing import Any

import pytest
import yaml
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db
from superset.constants import PASSWORD_MASK
from superset.utils import json

SECRETS = {
    "oauth2_client_info": {
        "id": "client-id",
        "secret": "client-secret",
        "scope": "refresh_token",
        "authorization_request_uri": "https://account.example/oauth/authorize",
        "token_request_uri": "https://account.example/oauth/token-request",
    },
    "embedded_credentials": {"username": "embedded_svc", "password": "embedded-pw"},
}


@pytest.fixture
def snowflake_like_paths(mocker: MockerFixture) -> None:
    """Mask the specific secret paths, as the Snowflake engine spec does."""
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    mocker.patch.object(
        SqliteEngineSpec,
        "encrypted_extra_sensitive_fields",
        {"$.oauth2_client_info.secret": "OAuth2 Client Secret"},
    )


def _export_bundle(secure_extra: dict[str, Any] | None = None) -> dict[str, str]:
    """Export a dataset on a connection carrying ``secure_extra``."""
    from superset.commands.dataset.export import ExportDatasetsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member
    database = Database(
        database_name="promoted",
        sqlalchemy_uri="sqlite://",
        impersonate_user=True,
        encrypted_extra=json.dumps(SECRETS if secure_extra is None else secure_extra),
    )
    db.session.add(database)
    db.session.flush()
    dataset = SqlaTable(table_name="identity", database=database, columns=[])
    db.session.add(dataset)
    db.session.flush()

    bundle = {
        name: content() for name, content in ExportDatasetsCommand([dataset.id]).run()
    }

    db.session.delete(dataset)
    db.session.delete(database)
    db.session.flush()
    return bundle


def _database_file(bundle: dict[str, str]) -> str:
    return next(name for name in bundle if name.startswith("databases/"))


@pytest.mark.usefixtures("snowflake_like_paths")
def test_bundle_export_carries_secure_extra_masked(
    mocker: MockerFixture, session: Session
) -> None:
    """The bundle's database YAML keeps both blocks, with no secret in clear."""
    from superset import security_manager

    mocker.patch.object(security_manager, "can_access", return_value=True)
    bundle = _export_bundle()

    config = yaml.safe_load(bundle[_database_file(bundle)])

    assert "encrypted_extra" not in config
    masked = json.loads(config["masked_encrypted_extra"])
    assert masked["oauth2_client_info"]["secret"] == PASSWORD_MASK
    assert masked["oauth2_client_info"]["id"] == "client-id"
    assert masked["embedded_credentials"] == {
        "username": "embedded_svc",
        "password": PASSWORD_MASK,
    }
    for content in bundle.values():
        assert "client-secret" not in content
        assert "embedded-pw" not in content


@pytest.mark.usefixtures("snowflake_like_paths")
def test_bundle_import_asks_for_secrets_and_keeps_them(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Importing where the connection doesn't exist asks for both secrets, then
    stores what was supplied -- never the mask.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1 import ImportDatasetsCommand
    from superset.commands.exceptions import CommandInvalidError
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    bundle = _export_bundle()
    database_file = _database_file(bundle)

    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDatasetsCommand(bundle).run()
    messages = str(excinfo.value.normalized_messages())
    assert "$.oauth2_client_info.secret" in messages
    assert "$.embedded_credentials.password" in messages

    secrets: dict[str, Any] = {
        database_file: {
            "$.oauth2_client_info.secret": "client-secret",
            "$.embedded_credentials.password": "embedded-pw",
        }
    }
    ImportDatasetsCommand(bundle, encrypted_extra_secrets=secrets).run()

    imported = db.session.query(Database).filter_by(database_name="promoted").one()
    assert json.loads(imported.encrypted_extra) == SECRETS
    assert imported.impersonate_user is True


@pytest.mark.usefixtures("snowflake_like_paths")
def test_bundle_import_reuses_an_existing_connection_without_asking(
    mocker: MockerFixture, session: Session
) -> None:
    """
    A bundle whose connection already exists reuses it as is: its masked secrets
    are never applied, so the import must not stall asking for them.
    """
    from superset import security_manager
    from superset.commands.dataset.importers.v1 import ImportDatasetsCommand
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    bundle = _export_bundle()
    config = yaml.safe_load(bundle[_database_file(bundle)])
    existing = Database(
        database_name="promoted",
        sqlalchemy_uri="sqlite://",
        uuid=config["uuid"],
        encrypted_extra=None,
    )
    db.session.add(existing)
    db.session.flush()

    ImportDatasetsCommand(bundle).run()

    assert existing.encrypted_extra is None


CERTIFICATES = {
    "certificates": {
        "client-cert.pem": "-----BEGIN CERTIFICATE-----cert-----END CERTIFICATE-----",
        "client-key.pem": "-----BEGIN PRIVATE KEY-----key-----END PRIVATE KEY-----",
    }
}


@pytest.mark.usefixtures("snowflake_like_paths")
def test_bundle_export_never_carries_the_rest_of_secure_extra(
    mocker: MockerFixture, session: Session
) -> None:
    """
    A bundle carries only the OAuth2 client and embedded credential blocks.

    Anyone who can export a dashboard or dataset gets the bundle, and an engine's
    own Secure Extra -- a Postgres client key -- is not registered as sensitive,
    so masking alone would leave it in clear.
    """
    from superset import security_manager

    mocker.patch.object(security_manager, "can_access", return_value=True)
    bundle = _export_bundle({**SECRETS, **CERTIFICATES})

    config = yaml.safe_load(bundle[_database_file(bundle)])

    assert "encrypted_extra" not in config
    carried = json.loads(config["masked_encrypted_extra"])
    assert set(carried) == {"oauth2_client_info", "embedded_credentials"}
    for content in bundle.values():
        assert "client-key.pem" not in content
        assert "PRIVATE KEY" not in content


@pytest.mark.usefixtures("snowflake_like_paths")
def test_bundle_export_carries_no_secure_extra_without_the_blocks(
    mocker: MockerFixture, session: Session
) -> None:
    """A connection with neither block exports no Secure Extra at all."""
    from superset import security_manager

    mocker.patch.object(security_manager, "can_access", return_value=True)
    bundle = _export_bundle(CERTIFICATES)

    config = yaml.safe_load(bundle[_database_file(bundle)])

    assert "encrypted_extra" not in config
    assert "masked_encrypted_extra" not in config
    for content in bundle.values():
        assert "PRIVATE KEY" not in content
