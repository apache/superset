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

from unittest.mock import patch

import pytest

from superset import app, db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.explore.form_data.commands.create import CreateFormDataCommand
from superset.explore.form_data.commands.parameters import CommandParameters
from superset.models.slice import Slice
from superset.utils.core import DatasourceType, get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase


class TestCreateFormDataCommand(SupersetTestCase):
    @pytest.fixture()
    def create_dataset(self):
        with self.create_app().app_context():
            dataset = SqlaTable(
                table_name="dummy_sql_table",
                database=get_example_database(),
                schema=get_example_default_schema(),
                sql="select 123 as intcol, 'abc' as strcol",
            )
            session = db.session
            session.add(dataset)
            session.commit()

            yield dataset

            # rollback
            session.delete(dataset)
            session.commit()

    @pytest.fixture()
    def create_slice(self):
        with self.create_app().app_context():
            session = db.session
            dataset = (
                session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
            )
            slice = Slice(
                datasource_id=dataset.id,
                datasource_type=DatasourceType.TABLE,
                datasource_name="tmp_perm_table",
                slice_name="slice_name",
            )

            session.add(slice)
            session.commit()

            yield slice

            # rollback
            session.delete(slice)
            session.commit()

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice")
    def test_create_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()
        args = CommandParameters(
            actor=mock_g.user,
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data="",
        )
        command = CreateFormDataCommand(args)

        assert isinstance(command.run(), str)
