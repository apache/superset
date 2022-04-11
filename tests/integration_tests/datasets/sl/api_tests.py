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
"""Unit tests for Superset"""
import json
import unittest
from io import BytesIO
from typing import List, Optional
from unittest.mock import patch
from zipfile import is_zipfile, ZipFile

import prison
import pytest
import yaml
from sqlalchemy.sql import func

from superset import db
from superset.columns.models import Column
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.dao.exceptions import (
    DAOCreateFailedError,
    DAODeleteFailedError,
    DAOUpdateFailedError,
)
from superset.datasets.models import Dataset
from superset.extensions import db, security_manager
from superset.models.core import Database
from superset.tables.models import Table
from superset.utils.core import backend, get_example_default_schema
from superset.utils.database import get_example_database, get_main_database
from superset.utils.dict_import_export import export_to_dict
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import CTAS_SCHEMA_NAME


class SLTestDatasetApi(SupersetTestCase):
    def create_table(self):
        pass

    def create_datasets(self):
        pass

    def insert_dataset(self):
        database = Database(database_name="db1", sqlalchemy_uri="sqlite://")
        database1 = Database(database_name="db2", sqlalchemy_uri="sqlite://")

        table = Table(
            name="a",
            schema="schema1",
            catalog="my_catalog",
            database=database,
            columns=[
                Column(name="longitude", expression="longitude", type="test"),
                Column(name="latitude", expression="latitude", type="test"),
            ],
        )

        dataset = Dataset(
            name="position",
            expression="""
            SELECT array_agg(array[longitude,latitude]) AS position
            FROM my_catalog.my_schema.my_table
            """,
            tables=[table],
            columns=[
                Column(
                    name="position",
                    expression="array_agg(array[longitude,latitude])",
                    type="test",
                ),
            ],
        )

        table1 = Table(
            name="b",
            schema="schema2",
            catalog="my_catalog",
            database=database1,
            columns=[
                Column(name="longitude", expression="longitude", type="test"),
                Column(name="latitude", expression="latitude", type="test"),
            ],
        )

        dataset1 = Dataset(
            name="position2",
            expression="""
            SELECT array_agg(array[longitude,latitude]) AS position
            FROM my_catalog.my_schema.my_table
            """,
            tables=[table1],
            columns=[
                Column(
                    name="position",
                    expression="array_agg(array[longitude,latitude])",
                    type="test",
                ),
            ],
        )

        db.session.add(database)
        db.session.add(table)
        db.session.add(dataset)
        db.session.add(table1)
        db.session.add(dataset1)
        db.session.add(database1)

        db.session.commit()

        return [database, table, table1, dataset, dataset1, database1]

    @pytest.fixture()
    def create_dataset(self):
        with self.create_app().app_context():
            models = self.insert_dataset()

            yield

            for m in models:
                db.session.delete(m)

            db.session.commit()

    @pytest.mark.usefixtures("create_dataset")
    def test_get_dataset_list(self):
        """
        Dataset API: Test get all datasets
        """
        self.login(username="admin")
        uri = f"api/v1/datasets/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] == 2
        expected_columns = [
            "changed_by",
            "changed_by_name",
            "changed_by_url",
            "changed_on_delta_humanized",
            "database",
            "datasource_type",
            "default_endpoint",
            "description",
            "extra",
            "id",
            "kind",
            "owners",
            "sql",
        ]
        assert sorted(list(response["result"][0].keys())) == expected_columns

    @pytest.mark.usefixtures("create_dataset")
    def test_get_dataset_list_filter_schema(self):
        """
        Dataset API: Test get all datasets with specfic schema
        """
        self.login(username="admin")
        arguments = {
            "filters": [
                {"col": "tables", "opr": "schema", "value": "schema1"},
            ]
        }
        uri = f"api/v1/datasets/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        response = json.loads(rv.data.decode("utf-8"))
        assert len(response["result"]) == 1
        assert rv.status_code == 200

    @pytest.mark.usefixtures("create_dataset")
    def test_get_dataset_list_filter_db(self):
        """
        Dataset API: Test get all datasets connected to specific db
        """
        self.login(username="admin")
        from superset import db
        from superset.models import core as models

        database = (
            db.session.query(models.Database)
            .filter_by(database_name="db1")
            .autoflush(False)
            .first()
        )

        arguments = {
            "filters": [
                {"col": "tables", "opr": "db", "value": database.id},
            ]
        }
        uri = f"api/v1/datasets/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        response = json.loads(rv.data.decode("utf-8"))
        assert len(response["result"]) == 1
        assert rv.status_code == 200

    # todo: write this test once owners pr is merged
    # @pytest.mark.usefixtures("create_dataset")
    # def test_get_dataset_list_filter_owners(self):
    #     """
    #     Dataset API: Test get all datasets with specific owners
    #     """
    #     self.login(username="admin")
    #     uri = f"api/v1/datasets/"
    #     rv = self.get_assert_metric(uri, "get_list")
    #     assert rv.status_code == 200

    def test_get_dataset_list_search(self):
        """
        Dataset API: Test get all datasets search
        """
        self.login(username="admin")
        uri = f"api/v1/datasets/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
