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

import copy
import json  # noqa: TID251
from typing import Any

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from tests.unit_tests.fixtures.assets_configs import databases_config


def test_import_database_with_encrypted_extra(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test that databases are imported with their encrypted extra info when available.
    """
    from superset import db, security_manager
    from superset.commands.database.importers.v1 import ImportDatabasesCommand
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member
    configs = copy.deepcopy(databases_config)
    configs["databases/examples.yaml"]["encrypted_extra"] = json.dumps(
        {"secret": "info"},
    )

    ImportDatabasesCommand._import(configs)
    uuid = configs["databases/examples.yaml"]["uuid"]
    database = db.session.query(Database).filter_by(uuid=uuid).one()
    assert database.encrypted_extra == '{"secret": "info"}'


def test_import_mask_password(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test that passwords are masked when importing databases.
    """
    from superset import db, security_manager
    from superset.commands.database.importers.v1 import ImportDatabasesCommand
    from superset.models.core import Database

    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    mocker.patch.object(security_manager, "can_access", return_value=True)

    configs: dict[str, dict[str, Any]] = {
        "databases/examples.yaml": {
            "database_name": "examples",
            "sqlalchemy_uri": "postgresql://user:password@localhost:5432/superset",
            "cache_timeout": None,
            "expose_in_sqllab": True,
            "allow_run_async": False,
            "allow_ctas": False,
            "allow_cvas": False,
            "extra": {},
            "uuid": "a2dc77af-e654-49bb-b321-40f6b559a1ee",
            "version": "1.0.0",
            "password": None,
            "allow_csv_upload": False,
        },
    }

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    ImportDatabasesCommand._import(configs)
    uuid = configs["databases/examples.yaml"]["uuid"]
    database = db.session.query(Database).filter_by(uuid=uuid).one()
    assert (
        database.sqlalchemy_uri
        == "postgresql://user:XXXXXXXXXX@localhost:5432/superset"
    )
    assert database.password == "password"  # noqa: S105


def test_import_database_with_password_in_config(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    Test that passwords in the YAML config are used when importing databases.
    """
    from superset import db, security_manager
    from superset.commands.database.importers.v1 import ImportDatabasesCommand
    from superset.models.core import Database

    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    mocker.patch.object(security_manager, "can_access", return_value=True)

    configs: dict[str, dict[str, Any]] = {
        "databases/examples.yaml": {
            "database_name": "examples_with_password",
            "sqlalchemy_uri": "postgresql://user:XXXXXXXXXX@localhost:5432/superset",
            "cache_timeout": None,
            "expose_in_sqllab": True,
            "allow_run_async": False,
            "allow_ctas": False,
            "allow_cvas": False,
            "extra": {},
            "uuid": "b3dc77af-e654-49bb-b321-40f6b559a1ee",
            "version": "1.0.0",
            "password": "yaml_password",  # Password provided in YAML config
            "allow_csv_upload": False,
        },
    }

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    ImportDatabasesCommand._import(configs)
    uuid = configs["databases/examples.yaml"]["uuid"]
    database = db.session.query(Database).filter_by(uuid=uuid).one()
    assert database.password == "yaml_password"  # noqa: S105


def test_transient_schema_listing_failure_is_recovered_by_retry(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """
    A single transient failure while listing schemas for a connection must
    not permanently discard the schema_access grant for a schema that
    appeared on the live connection since the last successful sync. Before
    this fix, ``add_permissions()`` gave up on a catalog after one failed
    attempt at ``get_all_schema_names()`` -- even though the exception
    caught (``GenericDBException``, a bare alias for the built-in
    ``Exception``) does not distinguish a genuinely unlistable catalog from
    a one-off connector hiccup -- so a schema that needed a first-time grant
    during the failing attempt was never granted, silently, while the
    import still reported success.
    """
    from superset import db, security_manager
    from superset.commands.database.importers.v1 import ImportDatabasesCommand
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.core import Database

    mocker.patch.object(security_manager, "can_access", return_value=True)
    add_permission_view_menu = mocker.spy(security_manager, "add_permission_view_menu")

    engine = db.session.get_bind()
    Database.metadata.create_all(engine)  # pylint: disable=no-member

    configs = copy.deepcopy(databases_config)

    # First import (existing=None): only "old_schema" exists on the live
    # target connection.
    mocker.patch.object(
        SqliteEngineSpec, "get_schema_names", return_value={"old_schema"}
    )
    ImportDatabasesCommand._import(copy.deepcopy(configs))
    add_permission_view_menu.reset_mock()

    # A new schema now exists, but the first attempt to list schemas for
    # this connection hits a transient failure (e.g. a driver hiccup right
    # after the schema was created). Re-importing with overwrite=True --
    # the only way to legitimately re-import an existing connection -- must
    # still end up granting the new schema once the retry succeeds.
    mocker.patch.object(
        SqliteEngineSpec,
        "get_schema_names",
        side_effect=[Exception("transient driver error"), {"old_schema", "new_schema"}],
    )
    ImportDatabasesCommand._import(copy.deepcopy(configs), overwrite=True)

    add_permission_view_menu.assert_any_call("schema_access", "[examples].[new_schema]")
