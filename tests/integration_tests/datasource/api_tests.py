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

from unittest.mock import ANY, patch

import pytest
from sqlalchemy.sql.elements import TextClause

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.daos.exceptions import DatasourceTypeNotSupportedError
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME


class TestDatasourceApi(SupersetTestCase):
    def get_virtual_dataset(self):
        return (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "virtual_dataset")
            .one()
        )

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_ints(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col1/values/")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        for val in range(10):
            assert val in response["result"]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_strs(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col2/values/")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        for val in ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]:
            assert val in response["result"]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_floats(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col3/values/")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        for val in [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9]:
            assert val in response["result"]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_nulls(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col4/values/")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["result"], [None])

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_integers_with_nulls(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col6/values/")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        for val in [1, None, 3, 4, 5, 6, 7, 8, 9, 10]:
            assert val in response["result"]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_invalid_datasource_type(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(
            f"api/v1/datasource/not_table/{table.id}/column/col1/values/"
        )
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["message"], "Invalid datasource type: not_table")

    @patch("superset.datasource.api.DatasourceDAO.get_datasource")
    def test_get_column_values_datasource_type_not_supported(self, get_datasource_mock):
        get_datasource_mock.side_effect = DatasourceTypeNotSupportedError
        self.login(ADMIN_USERNAME)
        rv = self.client.get("api/v1/datasource/table/1/column/col1/values/")
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response["message"], "DAO datasource query source type is not supported"
        )

    def test_get_column_values_datasource_not_found(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.get("api/v1/datasource/table/999/column/col1/values/")
        self.assertEqual(rv.status_code, 404)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["message"], "Datasource does not exist")

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_no_datasource_access(self):
        # Allow gamma user to use this endpoint, but does not have datasource access
        perm = security_manager.find_permission_view_menu(
            "can_get_column_values", "Datasource"
        )
        gamma_role = security_manager.find_role("Gamma")
        security_manager.add_permission_role(gamma_role, perm)

        self.login(GAMMA_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col1/values/")
        self.assertEqual(rv.status_code, 403)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response["message"],
            f"This endpoint requires the datasource {table.id}, "
            "database or `all_datasource_access` permission",
        )

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_normalize_columns_enabled(self, values_for_column_mock):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        table.normalize_columns = True
        self.client.get(f"api/v1/datasource/table/{table.id}/column/col2/values/")  # noqa: F841
        values_for_column_mock.assert_called_with(
            column_name="col2",
            limit=10000,
            denormalize_column=False,
        )

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.db_engine_specs.base.BaseEngineSpec.denormalize_name")
    def test_get_column_values_not_denormalize_column(self, denormalize_name_mock):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        table.normalize_columns = True
        self.client.get(f"api/v1/datasource/table/{table.id}/column/col2/values/")  # noqa: F841
        denormalize_name_mock.assert_not_called()

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_normalize_columns_disabled(self, values_for_column_mock):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        table.normalize_columns = False
        self.client.get(f"api/v1/datasource/table/{table.id}/column/col2/values/")  # noqa: F841
        values_for_column_mock.assert_called_with(
            column_name="col2",
            limit=10000,
            denormalize_column=True,
        )

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.db_engine_specs.base.BaseEngineSpec.denormalize_name")
    def test_get_column_values_denormalize_column(self, denormalize_name_mock):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        table.normalize_columns = False
        self.client.get(f"api/v1/datasource/table/{table.id}/column/col2/values/")  # noqa: F841
        denormalize_name_mock.assert_called_with(ANY, "col2")

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_with_rls(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        with patch.object(
            table, "get_sqla_row_level_filters", return_value=[TextClause("col2 = 'b'")]
        ):
            rv = self.client.get(
                f"api/v1/datasource/table/{table.id}/column/col2/values/"
            )
            self.assertEqual(rv.status_code, 200)
            response = json.loads(rv.data.decode("utf-8"))
            self.assertEqual(response["result"], ["b"])

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_with_rls_no_values(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        with patch.object(
            table, "get_sqla_row_level_filters", return_value=[TextClause("col2 = 'q'")]
        ):
            rv = self.client.get(
                f"api/v1/datasource/table/{table.id}/column/col2/values/"
            )
            self.assertEqual(rv.status_code, 200)
            response = json.loads(rv.data.decode("utf-8"))
            self.assertEqual(response["result"], [])
