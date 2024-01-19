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

import json
from unittest.mock import patch

import pytest

from superset import app, db, security, security_manager
from superset.commands.exceptions import DatasourceTypeInvalidError
from superset.commands.explore.form_data.create import CreateFormDataCommand
from superset.commands.explore.form_data.delete import DeleteFormDataCommand
from superset.commands.explore.form_data.get import GetFormDataCommand
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.commands.explore.form_data.update import UpdateFormDataCommand
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.models.sql_lab import Query
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
    def test_create_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        command = CreateFormDataCommand(args)

        assert isinstance(command.run(), str)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_create_form_data_command_invalid_type(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type="InvalidType",
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        with pytest.raises(DatasourceTypeInvalidError) as exc:
            CreateFormDataCommand(create_args).run()

        assert "Datasource type is invalid" in str(exc.value)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_create_form_data_command_type_as_string(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type="table",
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        command = CreateFormDataCommand(create_args)

        assert isinstance(command.run(), str)

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice")
    def test_get_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        key_args = CommandParameters(key=key)
        get_command = GetFormDataCommand(key_args)
        cache_data = json.loads(get_command.run())

        assert cache_data.get("datasource") == datasource

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_update_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        query = db.session.query(Query).filter_by(sql="select 1 as foo;").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        query_datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        update_args = CommandParameters(
            datasource_id=query.id,
            datasource_type=DatasourceType.QUERY,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": query_datasource}),
            key=key,
        )

        update_command = UpdateFormDataCommand(update_args)
        new_key = update_command.run()

        # it should return a key
        assert isinstance(new_key, str)
        # the updated key returned should be different from the old one
        assert new_key != key

        key_args = CommandParameters(key=key)
        get_command = GetFormDataCommand(key_args)

        cache_data = json.loads(get_command.run())

        assert cache_data.get("datasource") == query_datasource

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_update_form_data_command_same_form_data(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        update_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
            key=key,
        )

        update_command = UpdateFormDataCommand(update_args)
        new_key = update_command.run()

        # it should return a key
        assert isinstance(new_key, str)

        # the updated key returned should be the same as the old one
        assert new_key == key

        key_args = CommandParameters(key=key)
        get_command = GetFormDataCommand(key_args)

        cache_data = json.loads(get_command.run())

        assert cache_data.get("datasource") == datasource

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_delete_form_data_command(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="dummy_sql_table").first()
        )
        slice = db.session.query(Slice).filter_by(slice_name="slice_name").first()

        datasource = f"{dataset.id}__{DatasourceType.TABLE}"
        create_args = CommandParameters(
            datasource_id=dataset.id,
            datasource_type=DatasourceType.TABLE,
            chart_id=slice.id,
            tab_id=1,
            form_data=json.dumps({"datasource": datasource}),
        )
        key = CreateFormDataCommand(create_args).run()

        delete_args = CommandParameters(
            key=key,
        )

        delete_command = DeleteFormDataCommand(delete_args)
        response = delete_command.run()

        assert response == True

    @patch("superset.security.manager.g")
    @pytest.mark.usefixtures("create_dataset", "create_slice", "create_query")
    def test_delete_form_data_command_key_expired(self, mock_g):
        mock_g.user = security_manager.find_user("admin")
        app.config["EXPLORE_FORM_DATA_CACHE_CONFIG"] = {
            "REFRESH_TIMEOUT_ON_RETRIEVAL": True
        }

        delete_args = CommandParameters(
            key="some_expired_key",
        )

        delete_command = DeleteFormDataCommand(delete_args)
        response = delete_command.run()

        assert response == False
