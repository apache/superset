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
