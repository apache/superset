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
from pytest_mock import MockFixture
from sqlalchemy.orm.session import Session

from superset.commands.exceptions import ImportFailedError


def test_import_database(mocker: MockFixture, session: Session) -> None:
    """
    Test importing a database.
    """
    from superset import security_manager
    from superset.databases.commands.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)
    database = import_database(session, config)
    assert database.database_name == "imported_database"
    assert database.sqlalchemy_uri == "sqlite:///test.db"
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
    session.delete(database)
    session.flush()
    database = import_database(session, config)
    assert database.allow_dml is False


def test_import_database_managed_externally(
    mocker: MockFixture,
    session: Session,
) -> None:
    """
    Test importing a database that is managed externally.
    """
    from superset import security_manager
    from superset.databases.commands.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)
    config["is_managed_externally"] = True
    config["external_url"] = "https://example.org/my_database"

    database = import_database(session, config)
    assert database.is_managed_externally is True
    assert database.external_url == "https://example.org/my_database"


def test_import_database_without_permission(
    mocker: MockFixture,
    session: Session,
) -> None:
    """
    Test importing a database when a user doesn't have permissions to create.
    """
    from superset import security_manager
    from superset.databases.commands.importers.v1.utils import import_database
    from superset.models.core import Database
    from tests.integration_tests.fixtures.importexport import database_config

    mocker.patch.object(security_manager, "can_access", return_value=False)

    engine = session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    config = copy.deepcopy(database_config)

    with pytest.raises(ImportFailedError) as excinfo:
        import_database(session, config)
    assert (
        str(excinfo.value)
        == "Database doesn't exist and user doesn't have permission to create databases"
    )
