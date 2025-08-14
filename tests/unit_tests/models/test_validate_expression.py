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

"""Unit tests for SqlaTable.validate_expression"""

from unittest.mock import MagicMock, patch

from superset.connectors.sqla.models import SqlaTable
from superset.utils.core import SqlExpressionType


class TestValidateExpression:
    """Test validate_expression method"""

    def setup_method(self):
        """Set up test fixtures"""
        self.table = SqlaTable()
        self.table.table_name = "test_table"
        self.table.schema = "test_schema"
        self.table.database = MagicMock()
        self.table.database.db_engine_spec = MagicMock()
        self.table.database.db_engine_spec.make_sqla_column_compatible = lambda x, _: x

    @patch("superset.models.helpers.sa.select")
    def test_validate_column_expression(self, mock_select):
        """Test validation of column expressions"""
        mock_query = MagicMock()
        mock_select.return_value = mock_query
        mock_query.where.return_value = mock_query
        mock_query.compile.return_value = MagicMock()

        # Mock database compile method to succeed
        self.table.database.compile_query.return_value = (
            "SELECT test_col FROM test_table WHERE 0=1"
        )

        result = self.table.validate_expression(
            expression="test_col",
            expression_type=SqlExpressionType.COLUMN,
        )

        assert result["valid"] is True
        assert result["errors"] == []
        mock_select.assert_called_once()
        mock_query.where.assert_called_once()

    @patch("superset.models.helpers.sa.select")
    def test_validate_metric_expression(self, mock_select):
        """Test validation of metric expressions"""
        mock_query = MagicMock()
        mock_select.return_value = mock_query
        mock_query.where.return_value = mock_query
        mock_query.compile.return_value = MagicMock()

        self.table.database.compile_query.return_value = (
            "SELECT SUM(amount) FROM test_table WHERE 0=1"
        )

        result = self.table.validate_expression(
            expression="SUM(amount)",
            expression_type=SqlExpressionType.METRIC,
        )

        assert result["valid"] is True
        assert result["errors"] == []

    @patch("superset.models.helpers.sa.select")
    def test_validate_where_expression(self, mock_select):
        """Test validation of WHERE clause expressions"""
        mock_query = MagicMock()
        mock_select.return_value = mock_query
        mock_query.where.return_value = mock_query
        mock_query.compile.return_value = MagicMock()

        self.table.database.compile_query.return_value = (
            "SELECT * FROM test_table WHERE status = 'active' AND 0=1"
        )

        result = self.table.validate_expression(
            expression="status = 'active'",
            expression_type=SqlExpressionType.WHERE,
        )

        assert result["valid"] is True
        assert result["errors"] == []

    @patch("superset.models.helpers.sa.select")
    def test_validate_having_expression(self, mock_select):
        """Test validation of HAVING clause expressions"""
        mock_query = MagicMock()
        mock_select.return_value = mock_query
        mock_query.group_by.return_value = mock_query
        mock_query.having.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.compile.return_value = MagicMock()

        self.table.database.compile_query.return_value = (
            "SELECT 'A' as dummy FROM test_table GROUP BY dummy "
            "HAVING SUM(amount) > 100 WHERE 0=1"
        )

        result = self.table.validate_expression(
            expression="SUM(amount) > 100",
            expression_type=SqlExpressionType.HAVING,
        )

        assert result["valid"] is True
        assert result["errors"] == []
        mock_query.group_by.assert_called_once()
        mock_query.having.assert_called_once()

    @patch("superset.models.helpers.sa.select")
    def test_validate_invalid_expression(self, mock_select):
        """Test validation of invalid SQL expressions"""
        mock_query = MagicMock()
        mock_select.return_value = mock_query
        mock_query.where.return_value = mock_query

        # Mock database compile to raise an exception
        self.table.database.compile_query.side_effect = Exception("Invalid SQL syntax")

        result = self.table.validate_expression(
            expression="INVALID SQL HERE",
            expression_type=SqlExpressionType.COLUMN,
        )

        assert result["valid"] is False
        assert len(result["errors"]) == 1
        assert "Invalid SQL syntax" in result["errors"][0]["message"]

    @patch("superset.models.helpers.sa.select")
    def test_validate_having_with_non_aggregated_column(self, mock_select):
        """Test that HAVING clause properly detects non-aggregated columns"""
        mock_query = MagicMock()
        mock_select.return_value = mock_query
        mock_query.group_by.return_value = mock_query
        mock_query.having.return_value = mock_query
        mock_query.limit.return_value = mock_query

        # Simulate database error for non-aggregated column in HAVING
        self.table.database.compile_query.side_effect = Exception(
            (
                "column 'region' must appear in the GROUP BY clause "
                "or be used in an aggregate function"
            )
        )

        result = self.table.validate_expression(
            expression="region = 'US'",
            expression_type=SqlExpressionType.HAVING,
        )

        assert result["valid"] is False
        assert len(result["errors"]) == 1
        assert "must appear in the GROUP BY clause" in result["errors"][0]["message"]

    def test_validate_empty_expression(self):
        """Test validation of empty expressions"""
        result = self.table.validate_expression(
            expression="",
            expression_type=SqlExpressionType.COLUMN,
        )

        assert result["valid"] is False
        assert len(result["errors"]) == 1
        assert "Expression cannot be empty" in result["errors"][0]["message"]

    def test_validate_expression_with_rls(self):
        """Test that RLS filters are applied during validation"""
        # This would require more complex mocking of the RLS system
        # For now, we just ensure the method handles RLS without error
        with patch.object(self.table, "get_rendered_sql") as mock_get_sql:
            mock_get_sql.return_value = (
                "SELECT test_col FROM test_table WHERE department = 'sales' AND 0=1"
            )
            self.table.database.compile_query.return_value = mock_get_sql.return_value

            result = self.table.validate_expression(
                expression="test_col",
                expression_type=SqlExpressionType.COLUMN,
            )

            assert result["valid"] is True
