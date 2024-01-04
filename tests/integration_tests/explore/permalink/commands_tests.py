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

from superset import app, db, security, security_manager
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.commands.explore.permalink.create import CreateExplorePermalinkCommand
from superset.commands.explore.permalink.get import GetExplorePermalinkCommand
from superset.connectors.sqla.models import SqlaTable
from superset.key_value.utils import decode_permalink_id
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.utils.core import DatasourceType, get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import SupersetTestCase


class TestCreatePermalinkDataCommand(SupersetTestCase):
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

    @pytest.fixture()
    def create_query(self):
        with self.create_app().app_context():
            session = db.session

            query = Query(
                sql="select 1 as foo;",
                client_id="sldkfjlk",
                database=get_example_database(),
            )

            session.add(query)
            session.commit()

            yield query

            # rollback
            session.delete(query)
            session.commit()

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice")
    def test_create_permalink_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        command = CreateExplorePermalinkCommand(
            {"formData": {"datasource": datasource, "slice_id": slice.id}}
        )

        assert isinstance(command.run(), str)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice")
    def test_get_permalink_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"

        key = CreateExplorePermalinkCommand(
            {"formData": {"datasource": datasource, "slice_id": slice.id}}
        ).run()

        get_command = GetExplorePermalinkCommand(key)
        cache_data = get_command.run()

        assert cache_data.get("datasource") == datasource

    @patch("superset.security.manager.g")
    @patch("superset.commands.key_value.get.GetKeyValueCommand.run")
    @patch("superset.commands.explore.permalink.get.decode_permalink_id")
    @pytest.mark.usefixtures("create_dataset", "create_slice")
    def test_get_permalink_command_with_old_dataset_key(
        self, decode_id_mock, get_kv_command_mock, mock_g
    ):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource_string = f"{dataset.id}__{DatasourceType.TABLE}"

        decode_id_mock.return_value = "123456"
        get_kv_command_mock.return_value = {
            "chartId": slice.id,
            "datasetId": dataset.id,
            "datasource": datasource_string,
            "state": {
                "formData": {"datasource": datasource_string, "slice_id": slice.id}
            },
        }
        get_command = GetExplorePermalinkCommand("thisisallmocked")
        cache_data = get_command.run()

        assert cache_data.get("datasource") == datasource_string
