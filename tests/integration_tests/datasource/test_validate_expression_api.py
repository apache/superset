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

"""Integration tests for datasource validate_expression API endpoint"""

from unittest.mock import patch

from superset.utils import json
from superset.utils.core import SqlExpressionType
from tests.integration_tests.base_tests import SupersetTestCase

# Note: Tests use mocked responses, so we don't need the actual energy table fixture


class TestDatasourceValidateExpressionApi(SupersetTestCase):
    """Test the datasource validate_expression API endpoint"""

    @patch("superset.connectors.sqla.models.SqlaTable.validate_expression")
    def test_validate_expression_column_success(self, mock_validate):
        """Test successful validation of a column expression"""
        self.login("admin")

        # Mock successful validation
        mock_validate.return_value = {"valid": True, "errors": []}

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={
                "expression": "test_col",
                "expression_type": SqlExpressionType.COLUMN.value,
            },
        )

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert "result" in data
        assert data["result"] == []  # Empty array means success

    @patch("superset.connectors.sqla.models.SqlaTable.validate_expression")
    def test_validate_expression_metric_success(self, mock_validate):
        """Test successful validation of a metric expression"""
        self.login("admin")

        # Mock successful validation
        mock_validate.return_value = {"valid": True, "errors": []}

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={
                "expression": "SUM(amount)",
                "expression_type": SqlExpressionType.METRIC.value,
            },
        )

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert "result" in data
        assert data["result"] == []

    @patch("superset.connectors.sqla.models.SqlaTable.validate_expression")
    def test_validate_expression_where_success(self, mock_validate):
        """Test successful validation of a WHERE clause expression"""
        self.login("admin")

        # Mock successful validation
        mock_validate.return_value = {"valid": True, "errors": []}

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={
                "expression": "status = 'active'",
                "expression_type": SqlExpressionType.WHERE.value,
            },
        )

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert "result" in data
        assert data["result"] == []

    @patch("superset.connectors.sqla.models.SqlaTable.validate_expression")
    def test_validate_expression_having_success(self, mock_validate):
        """Test successful validation of a HAVING clause expression"""
        self.login("admin")

        # Mock successful validation
        mock_validate.return_value = {"valid": True, "errors": []}

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={
                "expression": "SUM(amount) > 100",
                "expression_type": SqlExpressionType.HAVING.value,
            },
        )

        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert "result" in data
        assert data["result"] == []

    def test_validate_expression_invalid_sql(self):
        """Test validation of invalid SQL expression"""
        self.login("admin")

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        with patch(
            "superset.connectors.sqla.models.SqlaTable.validate_expression"
        ) as mock_validate:
            mock_validate.return_value = {
                "valid": False,
                "errors": [{"message": "Invalid SQL syntax"}],
            }

            rv = self.client.post(
                f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
                json={
                    "expression": "INVALID SQL HERE",
                    "expression_type": SqlExpressionType.COLUMN.value,
                },
            )

            assert rv.status_code == 200
            data = json.loads(rv.data.decode("utf-8"))
            assert "result" in data
            assert len(data["result"]) == 1
            assert data["result"][0]["message"] == "Invalid SQL syntax"

    def test_validate_expression_having_with_non_aggregated_column(self):
        """Test that HAVING clause fails for non-aggregated columns"""
        self.login("admin")

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        with patch(
            "superset.connectors.sqla.models.SqlaTable.validate_expression"
        ) as mock_validate:
            mock_validate.return_value = {
                "valid": False,
                "errors": [
                    {
                        "message": (
                            "column 'source' must appear in the GROUP BY clause "
                            "or be used in an aggregate function"
                        )
                    }
                ],
            }

            rv = self.client.post(
                f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
                json={
                    "expression": "source = 'energy_source1'",
                    "expression_type": SqlExpressionType.HAVING.value,
                },
            )

            assert rv.status_code == 200
            data = json.loads(rv.data.decode("utf-8"))
            assert "result" in data
            assert len(data["result"]) == 1
            assert "must appear in the GROUP BY clause" in data["result"][0]["message"]

    def test_validate_expression_empty(self):
        """Test validation of empty expression"""
        self.login("admin")

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={
                "expression": "",
                "expression_type": SqlExpressionType.COLUMN.value,
            },
        )

        assert rv.status_code == 400  # Bad request for empty expression

    def test_validate_expression_missing_parameters(self):
        """Test validation with missing required parameters"""
        self.login("admin")

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        # Missing expression_type - defaults to "where"
        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={"expression": "test_col"},
        )

        assert rv.status_code == 200  # Defaults to "where" type, so succeeds

        # Missing expression - this should fail
        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={"expression_type": SqlExpressionType.COLUMN.value},
        )

        assert rv.status_code == 400  # Missing expression is an error

    def test_validate_expression_datasource_not_found(self):
        """Test validation with non-existent datasource"""
        self.login("admin")

        rv = self.client.post(
            "/api/v1/datasource/table/99999/validate_expression/",
            json={
                "expression": "test_col",
                "expression_type": SqlExpressionType.COLUMN.value,
            },
        )

        assert rv.status_code == 404

    def test_validate_expression_no_permission(self):
        """Test validation without permission to access datasource"""
        # Create a user without admin privileges
        self.login("gamma")

        # Use the birth_names dataset for testing
        datasource = self.get_birth_names_dataset()
        datasource_id = datasource.id

        rv = self.client.post(
            f"/api/v1/datasource/table/{datasource_id}/validate_expression/",
            json={
                "expression": "test_col",
                "expression_type": SqlExpressionType.COLUMN.value,
            },
        )

        # Should get 403 Forbidden or 404 if datasource is hidden
        assert rv.status_code in [403, 404]

    def test_validate_expression_invalid_datasource_type(self):
        """Test validation with invalid datasource type"""
        self.login("admin")

        rv = self.client.post(
            "/api/v1/datasource/invalid_type/1/validate_expression/",
            json={
                "expression": "test_col",
                "expression_type": SqlExpressionType.COLUMN.value,
            },
        )

        assert rv.status_code == 400  # Returns 400 for invalid datasource type
