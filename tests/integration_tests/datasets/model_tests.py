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
from unittest import mock

import pytest
from sqlalchemy import inspect
from sqlalchemy.orm.exc import NoResultFound

from superset.columns.models import Column
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.datasource import load_dataset_with_columns


class SqlaTableModelTest(SupersetTestCase):
    @pytest.mark.usefixtures("load_dataset_with_columns")
    def test_dual_update_column(self) -> None:
        """
        Test that when updating a sqla ``TableColumn``
        That the shadow ``Column`` is also updated
        """
        dataset = db.session.query(SqlaTable).filter_by(table_name="students").first()
        column = dataset.columns[0]
        column_name = column.column_name
        column.column_name = "new_column_name"
        SqlaTable.update_column(None, None, target=column)

        # refetch
        dataset = db.session.query(SqlaTable).filter_by(id=dataset.id).one()
        assert dataset.columns[0].column_name == "new_column_name"

        # reset
        column.column_name = column_name
        SqlaTable.update_column(None, None, target=column)

    @pytest.mark.usefixtures("load_dataset_with_columns")
    @mock.patch("superset.columns.models.Column")
    def test_dual_update_column_not_found(self, column_mock) -> None:
        """
        Test that when updating a sqla ``TableColumn``
        That the shadow ``Column`` is also updated
        """
        dataset = db.session.query(SqlaTable).filter_by(table_name="students").first()
        column = dataset.columns[0]
        column_uuid = column.uuid
        with mock.patch("sqlalchemy.orm.query.Query.one", side_effect=NoResultFound):
            SqlaTable.update_column(None, None, target=column)

        session = inspect(column).session

        session.flush()

        # refetch
        dataset = db.session.query(SqlaTable).filter_by(id=dataset.id).one()
        # it should create a new uuid
        assert dataset.columns[0].uuid != column_uuid

        # reset
        column.uuid = column_uuid
        SqlaTable.update_column(None, None, target=column)

    @pytest.mark.usefixtures("load_dataset_with_columns")
    def test_to_sl_column_no_known_columns(self) -> None:
        """
        Test that the function returns a new column
        """
        dataset = db.session.query(SqlaTable).filter_by(table_name="students").first()
        column = dataset.columns[0]
        new_column = column.to_sl_column()

        # it should use the same uuid
        assert column.uuid == new_column.uuid
