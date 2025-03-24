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
