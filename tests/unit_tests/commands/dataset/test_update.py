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
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset import db
from superset.commands.dataset.exceptions import DatasetInvalidError
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database


@pytest.mark.usefixture("session")
def test_update_uniqueness_error(mocker: MockerFixture) -> None:
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    bar = SqlaTable(table_name="bar", schema="foo", database=database)
    baz = SqlaTable(table_name="baz", schema="qux", database=database)
    db.session.add_all([database, bar, baz])
    db.session.commit()

    mock_g = mocker.patch("superset.security.manager.g")
    mock_g.user = MagicMock()

    mocker.patch(
        "superset.views.base.security_manager.can_access_all_datasources",
        return_value=True,
    )

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        return_value=None,
    )

    mocker.patch.object(UpdateDatasetCommand, "compute_owners", return_value=[])

    with pytest.raises(DatasetInvalidError):
        UpdateDatasetCommand(
            bar.id,
            {
                "table_name": "baz",
                "schema": "qux",
            },
        ).run()


@pytest.mark.usefixture("session")
def test_update_validate_roles_when_in_payload(mocker: MockerFixture) -> None:
    """When the payload contains "roles", `populate_roles` is called and
    the resolved roles are stored in `command._properties["roles"]`."""
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db_3", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="bar", schema="foo", database=database)
    db.session.add_all([database, dataset])
    db.session.commit()

    mock_g = mocker.patch("superset.security.manager.g")
    mock_g.user = MagicMock()

    # Allow DAO to see the created datasource
    mocker.patch(
        "superset.views.base.security_manager.can_access_all_datasources",
        return_value=True,
    )

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        return_value=None,
    )
    mocker.patch.object(UpdateDatasetCommand, "compute_owners", return_value=[])

    resolved_roles = [MagicMock(id=1), MagicMock(id=2)]
    populate_roles_mock = mocker.patch(
        "superset.commands.dataset.update.populate_roles",
        return_value=resolved_roles,
    )

    command = UpdateDatasetCommand(
        dataset.id,
        {
            "table_name": "bar",
            "schema": "foo",
            "roles": [1, 2],
        },
    )
    command.validate()

    populate_roles_mock.assert_called_once_with([1, 2])
    assert command._properties["roles"] == resolved_roles


@pytest.mark.usefixture("session")
def test_update_does_not_validate_roles_when_not_in_payload(
    mocker: MockerFixture,
) -> None:
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db_2", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="bar", schema="foo", database=database)
    db.session.add_all([database, dataset])
    db.session.commit()

    mock_g = mocker.patch("superset.security.manager.g")
    mock_g.user = MagicMock()

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        return_value=None,
    )
    mocker.patch.object(UpdateDatasetCommand, "compute_owners", return_value=[])

    # autorise la visibilité de la datasource créée pour le DAO
    mocker.patch(
        "superset.views.base.security_manager.can_access_all_datasources",
        return_value=True,
    )

    populate_roles_mock = mocker.patch(
        "superset.commands.dataset.update.populate_roles",
        side_effect=ValidationError("populate_roles should not be called"),
    )

    command = UpdateDatasetCommand(
        dataset.id,
        {
            "table_name": "bar",
            "schema": "foo",
        },
    )
    command.validate()

    populate_roles_mock.assert_not_called()
    assert "roles" not in command._properties
