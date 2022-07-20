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
# isort:skip_file
"""Unit tests for Superset"""
import json
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.utils.database import get_main_database

from tests.integration_tests.base_tests import SupersetTestCase
import pytest
import prison

from superset.utils.core import get_example_default_schema

from tests.integration_tests.utils.get_dashboards import get_dashboards_ids
from unittest import mock
from sqlalchemy import Column
from typing import Any, List
from superset.advanced_data_type.types import (
    AdvancedDataType,
    AdvancedDataTypeRequest,
    AdvancedDataTypeResponse,
)
from superset.extensions import db
from superset.utils.core import backend, FilterOperator, FilterStringOperators


target_resp: AdvancedDataTypeResponse = {
    "values": [],
    "error_message": "",
    "display_value": "",
    "valid_filter_operators": [
        FilterStringOperators.EQUALS,
        FilterStringOperators.GREATER_THAN_OR_EQUAL,
        FilterStringOperators.GREATER_THAN,
        FilterStringOperators.IN,
        FilterStringOperators.LESS_THAN,
        FilterStringOperators.LESS_THAN_OR_EQUAL,
    ],
}


class TestAdvancedDataTypeApi(SupersetTestCase):
    def translation_func(req: AdvancedDataTypeRequest) -> AdvancedDataTypeResponse:
        return target_resp

    def translate_filter_func(col: Column, op: FilterOperator, values: List[Any]):
        pass

    test_type: AdvancedDataType = AdvancedDataType(
        verbose_name="type",
        valid_data_types=["int"],
        translate_type=translation_func,
        description="",
        translate_filter=translate_filter_func,
    )

    CHART_DATA_URI = "api/v1/chart/advanced_data_type"
    CHARTS_FIXTURE_COUNT = 10

    @pytest.fixture()
    def create_dataset(self):
        with self.create_app().app_context():
            if backend() == "sqlite":
                yield
                return
            obj_owners = [self.get_user("admin")]
            table = SqlaTable(
                table_name="test_dataset",
                schema=None,
                owners=obj_owners,
                database=get_main_database(),
                sql="SELECT * from ab_view_menu;",
            )
            db.session.add(table)
            db.session.commit()
            table.fetch_metadata()
            table.columns[0].advanced_data_type = "port"
            yield table

            # rollback changes
            db.session.delete(table)
            db.session.commit()

    @mock.patch(
        "superset.advanced_data_type.api.ADVANCED_DATA_TYPES",
        {"type": 1},
    )
    def test_types_type_request(self):
        """
        Advanced Data Type API: Test to see if the API call returns all the valid advanced data types
        """
        uri = f"api/v1/advanced_data_type/types"
        self.login(username="admin")
        response_value = self.client.get(uri)
        data = json.loads(response_value.data.decode("utf-8"))
        assert response_value.status_code == 200
        assert data == {"result": ["type"]}

    def test_types_convert_bad_request_no_vals(self):
        """
        Advanced Data Type API: Test request to see if it behaves as expected when no values are passed
        """
        arguments = {"type": "type", "values": []}
        uri = f"api/v1/advanced_data_type/convert?q={prison.dumps(arguments)}"
        self.login(username="admin")
        response_value = self.client.get(uri)
        assert response_value.status_code == 400

    def test_types_convert_bad_request_no_type(self):
        """
        Advanced Data Type API: Test request to see if it behaves as expected when no type is passed
        """
        arguments = {"type": "", "values": [1]}
        uri = f"api/v1/advanced_data_type/convert?q={prison.dumps(arguments)}"
        self.login(username="admin")
        response_value = self.client.get(uri)
        assert response_value.status_code == 400

    @mock.patch(
        "superset.advanced_data_type.api.ADVANCED_DATA_TYPES",
        {"type": 1},
    )
    def test_types_convert_bad_request_type_not_found(self):
        """
        Advanced Data Type API: Test request to see if it behaves as expected when passed in type is
        not found/not valid
        """
        arguments = {"type": "not_found", "values": [1]}
        uri = f"api/v1/advanced_data_type/convert?q={prison.dumps(arguments)}"
        self.login(username="admin")
        response_value = self.client.get(uri)
        assert response_value.status_code == 400

    @mock.patch(
        "superset.advanced_data_type.api.ADVANCED_DATA_TYPES",
        {"type": test_type},
    )
    def test_types_convert_request(self):
        """
        Advanced Data Type API: Test request to see if it behaves as expected when a valid type
        and valid values are passed in
        """
        arguments = {"type": "type", "values": [1]}
        uri = f"api/v1/advanced_data_type/convert?q={prison.dumps(arguments)}"
        self.login(username="admin")
        response_value = self.client.get(uri)
        assert response_value.status_code == 200
        data = json.loads(response_value.data.decode("utf-8"))
        assert data == {"result": target_resp}

    @pytest.mark.usefixtures("create_dataset")
    def test_get_datasets(self):
        if backend() == "sqlite":
            return
        arguments = {"type": "port"}
        uri = f"api/v1/advanced_data_type/datasets?q={prison.dumps(arguments)}"
        self.login(username="admin")
        response_value = self.client.get(uri)
        assert response_value.status_code == 200
        data = json.loads(response_value.data.decode("utf-8"))
        dataset = (
            db.session.query(
                SqlaTable.id,
                TableColumn.id,
                TableColumn.column_name,
                TableColumn.advanced_data_type,
            )
            .join(TableColumn, TableColumn.table_id == SqlaTable.id)
            .filter(
                SqlaTable.table_name == "test_dataset",
                TableColumn.advanced_data_type == "port",
            )
            .one_or_none()
        )
        print(dataset)
        assert data == {"result": {f"{dataset[0]}": [dataset[1]]}}
