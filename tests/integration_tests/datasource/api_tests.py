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

from datetime import datetime
from unittest.mock import ANY, patch

import pytest
from sqlalchemy.sql.elements import TextClause

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.daos.exceptions import DatasourceTypeNotSupportedError
from superset.extensions import cache_manager
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME, GAMMA_USERNAME


class TestDatasourceApi(SupersetTestCase):
    def setUp(self):
        # Clear the column-values cache before every test so that
        # ``get_column_values`` always re-runs ``values_for_column`` rather
        # than returning a payload populated by a previous test. Prevents
        # order-dependent flakes now that the endpoint caches its result.
        super().setUp()
        cache_manager.data_cache.clear()

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
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        for val in range(10):
            assert val in response["result"]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_strs(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col2/values/")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        for val in ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]:
            assert val in response["result"]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_floats(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col3/values/")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        for val in [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9]:
            assert val in response["result"]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_nulls(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col4/values/")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["result"] == [None]

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    def test_get_column_values_integers_with_nulls(self):
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        rv = self.client.get(f"api/v1/datasource/table/{table.id}/column/col6/values/")
        assert rv.status_code == 200
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
        assert rv.status_code == 400
        response = json.loads(rv.data.decode("utf-8"))
        assert response["message"] == "Invalid datasource type: not_table"

    @patch("superset.datasource.api.DatasourceDAO.get_datasource")
    def test_get_column_values_datasource_type_not_supported(self, get_datasource_mock):
        get_datasource_mock.side_effect = DatasourceTypeNotSupportedError
        self.login(ADMIN_USERNAME)
        rv = self.client.get("api/v1/datasource/table/1/column/col1/values/")
        assert rv.status_code == 400
        response = json.loads(rv.data.decode("utf-8"))
        assert (
            response["message"] == "DAO datasource query source type is not supported"
        )

    def test_get_column_values_datasource_not_found(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.get("api/v1/datasource/table/999/column/col1/values/")
        assert rv.status_code == 404
        response = json.loads(rv.data.decode("utf-8"))
        assert response["message"] == "Datasource does not exist"

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
        assert rv.status_code == 403
        response = json.loads(rv.data.decode("utf-8"))
        assert (
            response["message"] == f"This endpoint requires the datasource {table.id}, "
            "database or `all_datasource_access` permission"
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
            assert rv.status_code == 200
            response = json.loads(rv.data.decode("utf-8"))
            assert response["result"] == ["b"]

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
            assert rv.status_code == 200
            response = json.loads(rv.data.decode("utf-8"))
            assert response["result"] == []

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_cache_hit_skips_query(self, values_for_column_mock):
        """Regression test for #39342.

        Two identical requests for the same column on the same datasource
        should hit ``values_for_column`` exactly once — the second request
        returns the cached payload.
        """
        cache_manager.data_cache.clear()
        values_for_column_mock.return_value = ["a", "b", "c"]
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        url = f"api/v1/datasource/table/{table.id}/column/col2/values/"

        rv1 = self.client.get(url)
        rv2 = self.client.get(url)

        assert rv1.status_code == 200
        assert rv2.status_code == 200
        assert json.loads(rv2.data.decode("utf-8"))["result"] == ["a", "b", "c"]
        assert values_for_column_mock.call_count == 1

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_force_bypasses_cache(self, values_for_column_mock):
        """``?force=true`` should bypass the cache and re-query the source."""
        cache_manager.data_cache.clear()
        values_for_column_mock.return_value = ["a", "b"]
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        url = f"api/v1/datasource/table/{table.id}/column/col2/values/"

        self.client.get(url)
        self.client.get(f"{url}?force=true")

        assert values_for_column_mock.call_count == 2

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_cache_isolated_per_column(self, values_for_column_mock):
        """Different columns on the same datasource must not share a cache
        entry — otherwise filter values would be silently swapped."""
        cache_manager.data_cache.clear()
        values_for_column_mock.return_value = ["x"]
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()

        self.client.get(f"api/v1/datasource/table/{table.id}/column/col1/values/")
        self.client.get(f"api/v1/datasource/table/{table.id}/column/col2/values/")

        assert values_for_column_mock.call_count == 2

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_cache_busts_on_changed_on(self, values_for_column_mock):
        """Editing the underlying virtual dataset SQL bumps ``changed_on``,
        which is part of the cache key — so the next request must miss the
        cache and re-run the query."""
        cache_manager.data_cache.clear()
        values_for_column_mock.return_value = ["v"]
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        url = f"api/v1/datasource/table/{table.id}/column/col2/values/"

        self.client.get(url)
        # Simulate an edit to the dataset; ``changed_on`` is what the cache
        # key reads, so any new value forces a miss.
        table.changed_on = datetime(2030, 1, 1)
        db.session.flush()
        self.client.get(url)

        assert values_for_column_mock.call_count == 2

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.datasource.api.security_manager.get_rls_cache_key")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_cache_isolated_per_rls_context(
        self, values_for_column_mock, get_rls_cache_key_mock
    ):
        """RLS safety for guest/embedded sessions. ``get_user_id()`` returns
        ``None`` for guest users, so two embedded dashboards with different
        guest-token RLS would otherwise collide on ``user=None``. Including
        the RLS fingerprint in the cache key keeps them separate."""
        cache_manager.data_cache.clear()
        values_for_column_mock.return_value = ["v"]
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        url = f"api/v1/datasource/table/{table.id}/column/col2/values/"

        get_rls_cache_key_mock.return_value = ["dept='A'"]
        self.client.get(url)
        get_rls_cache_key_mock.return_value = ["dept='B'"]
        self.client.get(url)

        assert values_for_column_mock.call_count == 2

    @pytest.mark.usefixtures("app_context", "virtual_dataset")
    @patch("superset.models.helpers.ExploreMixin.values_for_column")
    def test_get_column_values_response_advertises_cache_status(
        self, values_for_column_mock
    ):
        """The ``X-Cache-Status`` response header should advertise MISS on
        the populating request and HIT on the next identical request, so
        operators can debug cache behavior from logs or browser devtools."""
        cache_manager.data_cache.clear()
        values_for_column_mock.return_value = ["v"]
        self.login(ADMIN_USERNAME)
        table = self.get_virtual_dataset()
        url = f"api/v1/datasource/table/{table.id}/column/col2/values/"

        rv_miss = self.client.get(url)
        rv_hit = self.client.get(url)

        assert rv_miss.headers.get("X-Cache-Status") == "MISS"
        assert rv_hit.headers.get("X-Cache-Status") == "HIT"

    @patch("superset.datasource.api.security_manager.can_access")
    @patch("superset.datasource.api.GetCombinedDatasourceListCommand.run")
    def test_combined_list_invalid_order_column(
        self,
        run_mock,
        can_access_mock,
    ):
        security_manager.add_permission_view_menu("can_combined_list", "Datasource")
        perm = security_manager.find_permission_view_menu(
            "can_combined_list", "Datasource"
        )
        admin_role = security_manager.find_role("Admin")
        security_manager.add_permission_role(admin_role, perm)
        can_access_mock.side_effect = [True, True]
        run_mock.side_effect = ValueError("Invalid order column: invalid")
        self.login(ADMIN_USERNAME)

        rv = self.client.get(
            "api/v1/datasource/?q=(order_column:invalid,order_direction:desc,page:0,page_size:25)"
        )

        assert rv.status_code == 400
        response = json.loads(rv.data.decode("utf-8"))
        assert response["message"] == "Invalid order column: invalid"

    @patch("superset.datasource.api.security_manager.can_access")
    @patch("superset.datasource.api.GetCombinedDatasourceListCommand.run")
    def test_combined_list_semantic_layers_off(
        self,
        run_mock,
        can_access_mock,
    ):
        security_manager.add_permission_view_menu("can_combined_list", "Datasource")
        perm = security_manager.find_permission_view_menu(
            "can_combined_list", "Datasource"
        )
        admin_role = security_manager.find_role("Admin")
        security_manager.add_permission_role(admin_role, perm)
        can_access_mock.return_value = True
        run_mock.return_value = {"count": 1, "result": []}
        self.login(ADMIN_USERNAME)

        with patch("superset.datasource.api.is_feature_enabled", return_value=False):
            rv = self.client.get(
                "api/v1/datasource/?q=(order_column:changed_on_delta_humanized,order_direction:desc,page:0,page_size:25)"
            )

        assert rv.status_code == 200
        run_mock.assert_called_once()
        _, kwargs = run_mock.call_args
        assert kwargs == {}
