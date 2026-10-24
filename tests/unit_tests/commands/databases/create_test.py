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

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.create import CreateDatabaseCommand
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.exceptions import OAuth2RedirectError
from superset.extensions import security_manager
from superset.utils import json


@pytest.mark.parametrize("enabled", [False, True])
@pytest.mark.parametrize(
    "engine,metric", [("bigquery", "bytes_processed"), ("postgresql", "total_cost")]
)
def test_create_preserves_warning_rule_and_unrelated_extras(
    mocker: MockerFixture, enabled: bool, engine: str, metric: str
) -> None:
    """Command saves preserve explicit rules and unrelated connection settings."""
    mocker.patch(
        "superset.commands.database.create.DatabaseDAO.validate_uniqueness",
        return_value=True,
    )
    extra = {
        "query_cost_warning": {
            "enabled": enabled,
            "metric": metric,
            "threshold": 100,
        },
        "engine_params": {"pool_pre_ping": True},
    }
    command = CreateDatabaseCommand(
        {
            "database_name": "test",
            "sqlalchemy_uri": f"{engine}://",
            "extra": json.dumps(extra),
        }
    )
    command.validate()
    assert json.loads(command._properties["extra"]) == extra


@pytest.mark.parametrize("extra", [None, {}, {"metadata_params": {}}])
def test_create_does_not_add_warning_settings(
    mocker: MockerFixture, extra: dict[str, object] | None
) -> None:
    """Creating a connection without a rule preserves absent and explicit extras."""
    mocker.patch(
        "superset.commands.database.create.DatabaseDAO.validate_uniqueness",
        return_value=True,
    )
    properties = {"database_name": "test", "sqlalchemy_uri": "postgresql://"}
    if extra is not None:
        properties["extra"] = json.dumps(extra)
    command = CreateDatabaseCommand(properties)

    command.validate()

    if extra is None:
        assert "extra" not in command._properties
    else:
        assert json.loads(command._properties["extra"]) == extra


def test_create_rejects_warning_metric_for_another_engine(
    mocker: MockerFixture,
) -> None:
    """Direct command callers also validate enabled metrics against the URI."""
    mocker.patch(
        "superset.commands.database.create.DatabaseDAO.validate_uniqueness",
        return_value=True,
    )
    command = CreateDatabaseCommand(
        {
            "database_name": "test",
            "sqlalchemy_uri": "postgresql://",
            "extra": json.dumps(
                {
                    "query_cost_warning": {
                        "enabled": True,
                        "metric": "bytes_processed",
                        "threshold": 100,
                    }
                }
            ),
        }
    )
    with pytest.raises(DatabaseInvalidError):
        command.validate()


@pytest.fixture
def database_with_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database with catalogs and schemas.
    """
    mocker.patch("superset.commands.database.create.TestConnectionDatabaseCommand")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = True
    database.get_all_catalog_names.return_value = ["catalog1", "catalog2"]
    database.get_all_schema_names.side_effect = [
        {"schema1", "schema2"},
        {"schema3", "schema4"},
    ]

    DatabaseDAO = mocker.patch("superset.commands.database.create.DatabaseDAO")  # noqa: N806
    DatabaseDAO.create.return_value = database

    return database


@pytest.fixture
def database_without_catalog(mocker: MockerFixture) -> MagicMock:
    """
    Mock a database without catalogs.
    """
    mocker.patch("superset.commands.database.create.TestConnectionDatabaseCommand")

    database = mocker.MagicMock()
    database.database_name = "test_database"
    database.db_engine_spec.__name__ = "test_engine"
    database.db_engine_spec.supports_catalog = False
    database.get_all_schema_names.return_value = ["schema1", "schema2"]

    DatabaseDAO = mocker.patch("superset.commands.database.create.DatabaseDAO")  # noqa: N806
    DatabaseDAO.create.return_value = database

    return database


def test_create_permissions_with_catalog(
    mocker: MockerFixture,
    database_with_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are created when a database with a catalog is created.
    """
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    CreateDatabaseCommand(
        {
            "database_name": "test_database",
            "sqlalchemy_uri": "sqlite://",
        }
    ).run()

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("catalog_access", "[test_database].[catalog1]"),
            mocker.call("catalog_access", "[test_database].[catalog2]"),
            mocker.call("schema_access", "[test_database].[catalog1].[schema1]"),
            mocker.call("schema_access", "[test_database].[catalog1].[schema2]"),
            mocker.call("schema_access", "[test_database].[catalog2].[schema3]"),
            mocker.call("schema_access", "[test_database].[catalog2].[schema4]"),
        ],
        any_order=True,
    )


def test_create_permissions_without_catalog(
    mocker: MockerFixture,
    database_without_catalog: MockerFixture,
) -> None:
    """
    Test that permissions are created when a database without a catalog is created.
    """
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    CreateDatabaseCommand(
        {
            "database_name": "test_database",
            "sqlalchemy_uri": "sqlite://",
        }
    ).run()

    add_permission_view_menu.assert_has_calls(
        [
            mocker.call("schema_access", "[test_database].[schema1]"),
            mocker.call("schema_access", "[test_database].[schema2]"),
        ],
        any_order=True,
    )


def test_create_with_oauth2(
    mocker: MockerFixture,
    database_without_catalog: MockerFixture,
) -> None:
    """
    Test that the database can be created even if OAuth2 is needed to connect.
    """
    TestConnectionDatabaseCommand = mocker.patch(  # noqa: N806
        "superset.commands.database.create.TestConnectionDatabaseCommand"
    )
    TestConnectionDatabaseCommand().run.side_effect = OAuth2RedirectError(
        "url",
        "tab_id",
        "redirect_uri",
    )
    add_permission_view_menu = mocker.patch.object(
        security_manager,
        "add_permission_view_menu",
    )

    CreateDatabaseCommand(
        {
            "database_name": "test_database",
            "sqlalchemy_uri": "sqlite://",
        }
    ).run()

    add_permission_view_menu.assert_not_called()
