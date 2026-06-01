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
# pylint: disable=unused-argument, import-outside-toplevel, invalid-name

import copy

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db
from superset.commands.exceptions import ImportFailedError
from superset.utils import json


def test_import_database(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a database.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)
    database = import_database(config)
    assert database.database_name == "imported_database"
    assert database.sqlalchemy_uri == "postgresql://user:XXXXXXXXXX@host1"
    assert database.password == "pass"  # noqa: S105
    assert database.cache_timeout is None
    assert database.expose_in_sqllab is True
    assert database.allow_run_async is False
    assert database.allow_ctas is True
    assert database.allow_cvas is True
    assert database.allow_dml is True
    assert database.allow_file_upload is True
    assert database.extra == "{}"
    assert database.uuid == "b8a1ccd3-779d-4ab7-8ad8-9ab119d7fe89"
    assert database.is_managed_externally is False
    assert database.external_url is None

    # ``allow_dml`` was initially not exported; the import should work if the field is
    # missing
    config = copy.deepcopy(database_config)
    del config["allow_dml"]
    db.session.delete(database)
    db.session.flush()
    database = import_database(config)
    assert database.allow_dml is False


def test_import_database_no_creds(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a database.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config_no_creds

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config_no_creds)
    database = import_database(config)
    assert database.database_name == "imported_database_no_creds"
    assert database.sqlalchemy_uri == "bigquery://test-db/"
    assert database.extra == "{}"
    assert database.uuid == "2ff17edc-f3fa-4609-a5ac-b484281225bc"


def test_import_database_sqlite_invalid(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test importing a database.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config_sqlite

    current_app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = True
    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config_sqlite)
    with pytest.raises(ImportFailedError) as excinfo:
        _ = import_database(config)
    assert (
        str(excinfo.value)
        == "SQLiteDialect_pysqlite cannot be used as a data source for security reasons."  # noqa: E501
    )
    # restore app config
    current_app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = True


def test_import_database_sqlite_allowed_with_ignore_permissions(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Test that SQLite imports succeed when ignore_permissions=True.

    System imports (like examples) use URIs from server config, not user input,
    so they should bypass the PREVENT_UNSAFE_DB_CONNECTIONS check. This is the
    key fix from PR #37577 that allows example loading to work in CI/showtime
    environments where PREVENT_UNSAFE_DB_CONNECTIONS is enabled.
    """
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config_sqlite

    mocker.patch.dict(current_app.config, {"PREVENT_UNSAFE_DB_CONNECTIONS": True})
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config_sqlite)
    # With ignore_permissions=True, the security check should be skipped
    database = import_database(config, ignore_permissions=True)

    assert database.database_name == "imported_database"
    assert "sqlite" in database.sqlalchemy_uri

    # Cleanup
    db.session.delete(database)
    db.session.flush()


def test_import_database_managed_externally(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a database that is managed externally.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_database"

    database = import_database(config)
    assert database.is_managed_externally is True
    assert database.external_url == "https://example.org/my_database"


def test_import_database_without_permission(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a database when a user doesn't have permissions to create.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=False)

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)

    with pytest.raises(ImportFailedError) as excinfo:
        import_database(config)
    assert (
        str(excinfo.value)
        == "Database doesn't exist and user doesn't have permission to create databases"
    )


def test_import_database_with_version(mocker: MockerFixture, session: Session) -> None:
    """
    Test importing a database with a version set.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)
    config["extra"]["version"] = "1.1.1"
    database = import_database(config)
    assert json.loads(database.extra)["version"] == "1.1.1"


def test_import_database_with_user_impersonation(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a database that is managed externally.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)
    config["impersonate_user"] = True

    database = import_database(config)
    assert database.impersonate_user is True


def test_import_database_with_masked_encrypted_extra_new_db(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing a new database with masked_encrypted_extra.

    When no existing DB matches the UUID, the masked_encrypted_extra value
    should be stored as-is in encrypted_extra.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import (
        database_config_with_masked_encrypted_extra,
    )

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config_with_masked_encrypted_extra)
    database = import_database(config)

    assert database.database_name == "imported_database_encrypted"
    # masked_encrypted_extra should be stored as encrypted_extra
    assert database.encrypted_extra is not None
    encrypted = json.loads(database.encrypted_extra)
    assert encrypted["credentials_info"]["type"] == "service_account"
    assert encrypted["credentials_info"]["project_id"] == "test-project"
    assert encrypted["credentials_info"]["private_key"] == (
        "-----BEGIN PRIVATE KEY-----\nMyPriVaTeKeY\n-----END PRIVATE KEY-----\n"
    )


def test_import_database_with_masked_encrypted_extra_existing_db(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test importing over an existing database with masked_encrypted_extra.

    When the import carries PASSWORD_MASK values for sensitive fields and
    an existing DB has the real values, reveal_sensitive should restore
    the original values from the existing DB's encrypted_extra.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.constants import PASSWORD_MASK
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import (
        database_config_with_masked_encrypted_extra,
    )

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    # First, create the existing database with real encrypted_extra
    config = copy.deepcopy(database_config_with_masked_encrypted_extra)
    import_database(config)
    db.session.flush()

    # Now import again with masked values (simulating re-import)
    config2 = copy.deepcopy(database_config_with_masked_encrypted_extra)
    config2["masked_encrypted_extra"] = json.dumps(
        {
            "credentials_info": {
                "type": "service_account",
                "project_id": "updated-project",
                "private_key": PASSWORD_MASK,
            }
        }
    )
    database2 = import_database(config2, overwrite=True)

    # The masked private_key should be revealed from the existing DB
    encrypted = json.loads(database2.encrypted_extra)
    assert encrypted["credentials_info"]["project_id"] == "updated-project"
    assert encrypted["credentials_info"]["private_key"] == (
        "-----BEGIN PRIVATE KEY-----\nMyPriVaTeKeY\n-----END PRIVATE KEY-----\n"
    )
    assert encrypted["credentials_info"]["private_key"] != PASSWORD_MASK


def test_import_database_oauth2_redirect_is_nonfatal(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test that an OAuth2RedirectError from add_permissions is logged
    and does not prevent the import from succeeding.
    """
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.exceptions import OAuth2RedirectError
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mock_add_perms = mocker.patch(
        "superset.commands.database.importers.v1.utils.add_permissions",
        side_effect=OAuth2RedirectError(
            url="https://oauth.example.com/authorize",
            tab_id="abc-123",
            redirect_uri="https://superset.example.com/callback",
        ),
    )

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)
    database = import_database(config)

    assert database.database_name == "imported_database"
    mock_add_perms.assert_called_once_with(database)


def test_import_datasources_cli_encrypts_password(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Regression for #31983: import_datasources must encrypt sqlalchemy_uri passwords,
    not store them as cleartext.

    The ``superset import_datasources -p file.yaml`` CLI command uses the legacy v0
    YAML format (a dict with a top-level ``databases`` key).  Internally it calls
    ``Database.import_from_dict``, which historically set ``sqlalchemy_uri`` directly
    on the model — bypassing ``set_sqlalchemy_uri`` and leaving the plaintext password
    stored in the DB.

    After the fix, the stored ``sqlalchemy_uri`` must contain the password mask
    (``XXXXXXXXXX``) rather than the cleartext secret, and ``database.password``
    must hold the real credential so that connections still work.
    """
    from superset import db
    from superset.commands.dataset.importers.v0 import import_from_dict
    from superset.constants import PASSWORD_MASK
    from superset.models.core import Database

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    plaintext_password = "secret-password"  # noqa: S105
    plaintext_uri = (
        f"postgresql://user:{plaintext_password}@db.example.org:5432/superset_data"
    )

    # This is the exact YAML structure produced by the Helm chart / docs example
    # referenced in issue #31983.
    data: dict[str, list[dict[str, object]]] = {
        "databases": [
            {
                "database_name": "issue_31983_regression",
                "sqlalchemy_uri": plaintext_uri,
                "expose_in_sqllab": True,
                "allow_run_async": False,
                "allow_ctas": False,
                "allow_cvas": False,
                "allow_dml": False,
                "allow_file_upload": False,
                "tables": [],
            }
        ]
    }

    import_from_dict(data)
    db.session.flush()

    database = (
        db.session.query(Database)
        .filter_by(database_name="issue_31983_regression")
        .one()
    )

    # The stored URI must NOT contain the plaintext password.
    assert plaintext_password not in database.sqlalchemy_uri, (
        f"Bug #31983: plaintext password found in sqlalchemy_uri: "
        f"{database.sqlalchemy_uri!r}"
    )

    # The stored URI must contain the password mask (same behaviour as the REST API).
    assert PASSWORD_MASK in database.sqlalchemy_uri, (
        f"Bug #31983: expected password mask {PASSWORD_MASK!r} in "
        f"sqlalchemy_uri, got: {database.sqlalchemy_uri!r}"
    )

    # The real password must be recoverable via the encrypted ``password`` column
    # so that existing connections continue to work after import.
    assert database.password == plaintext_password, (  # noqa: S105
        f"Bug #31983: expected real password to be stored in the encrypted "
        f"``password`` column, got: {database.password!r}"
    )


def test_import_datasources_cli_no_password_does_not_clobber_existing(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Guard against the Copilot-identified regression: importing a URI that has no
    password segment must not overwrite an existing encrypted ``password`` value.

    Users commonly keep secrets out of YAML and rely on the ``password`` column
    populated during a prior import.  Before the guard, calling
    ``set_sqlalchemy_uri`` on a password-less URI would set ``password = None``
    and break existing connections.
    """
    from superset import db
    from superset.commands.dataset.importers.v0 import import_from_dict
    from superset.models.core import Database

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    # URI with no password segment — this is the "secret kept out of YAML" pattern.
    no_password_uri = "postgresql://user@db.example.org:5432/superset_data"  # noqa: S105

    data: dict[str, list[dict[str, object]]] = {
        "databases": [
            {
                "database_name": "no_password_uri_test",
                "sqlalchemy_uri": no_password_uri,
                "expose_in_sqllab": True,
                "allow_run_async": False,
                "allow_ctas": False,
                "allow_cvas": False,
                "allow_dml": False,
                "allow_file_upload": False,
                "tables": [],
            }
        ]
    }

    import_from_dict(data)
    db.session.flush()

    database = (
        db.session.query(Database).filter_by(database_name="no_password_uri_test").one()
    )

    # The ``password`` column must not have been set to None by
    # set_sqlalchemy_uri — it should remain at whatever value import_from_dict
    # left it (None for a brand-new record with no password in the URI).
    # The critical invariant is that a subsequent import of the same no-password
    # URI does not overwrite a password that was stored by a prior import.
    assert database.password is None

    # Simulate a prior import having stored an encrypted password (e.g. from a
    # previous import run that included the password in the URI).
    stored_password = "previously-stored-secret"  # noqa: S105
    database.password = stored_password
    db.session.flush()

    # Re-import with the same no-password URI — must not clobber the stored value.
    import_from_dict(data)
    db.session.flush()

    database = (
        db.session.query(Database).filter_by(database_name="no_password_uri_test").one()
    )
    assert database.password == stored_password, (
        "Importing a URI with no password segment must not overwrite an "
        f"existing encrypted password; got: {database.password!r}"
    )
