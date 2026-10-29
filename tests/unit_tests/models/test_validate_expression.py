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
        self.table.catalog = None
        self.table.database = MagicMock()
        self.table.database.backend = "sqlite"
        self.table.database.db_engine_spec = MagicMock()
        self.table.database.db_engine_spec.make_sqla_column_compatible = lambda x, _: x
        self.table.columns = []

        # Mock get_from_clause to return a simple table
        self.table.get_from_clause = MagicMock(return_value=(MagicMock(), None))

        # Mock get_sqla_row_level_filters
        self.table.get_sqla_row_level_filters = MagicMock(return_value=[])

        # Mock get_template_processor
        self.table.get_template_processor = MagicMock(return_value=None)

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_column_expression(self, mock_execute):
        """Test validation of column expressions"""
        # Mock _execute_validation_query to return success
        mock_execute.return_value = {"valid": True, "errors": []}

        result = self.table.validate_expression(
            expression="test_col",
            expression_type=SqlExpressionType.COLUMN,
        )

        assert result["valid"] is True
        assert result["errors"] == []
        mock_execute.assert_called_once()

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_metric_expression(self, mock_execute):
        """Test validation of metric expressions"""
        # Mock _execute_validation_query to return success
        mock_execute.return_value = {"valid": True, "errors": []}

        result = self.table.validate_expression(
            expression="SUM(amount)",
            expression_type=SqlExpressionType.METRIC,
        )

        assert result["valid"] is True
        assert result["errors"] == []

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_where_expression(self, mock_execute):
        """Test validation of WHERE clause expressions"""
        # Mock _execute_validation_query to return success
        mock_execute.return_value = {"valid": True, "errors": []}

        result = self.table.validate_expression(
            expression="status = 'active'",
            expression_type=SqlExpressionType.WHERE,
        )

        assert result["valid"] is True
        assert result["errors"] == []

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_having_expression(self, mock_execute):
        """Test validation of HAVING clause expressions"""
        # Mock _execute_validation_query to return success
        mock_execute.return_value = {"valid": True, "errors": []}

        result = self.table.validate_expression(
            expression="SUM(amount) > 100",
            expression_type=SqlExpressionType.HAVING,
        )

        assert result["valid"] is True
        assert result["errors"] == []

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_invalid_expression(self, mock_execute):
        """Unparseable SQL is rejected by the shared expression parser before the
        validation query is built or executed."""
        result = self.table.validate_expression(
            expression="INVALID SQL HERE",
            expression_type=SqlExpressionType.COLUMN,
        )

        assert result["valid"] is False
        assert len(result["errors"]) == 1
        assert result["errors"][0]["message"]
        mock_execute.assert_not_called()

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_having_with_non_aggregated_column(self, mock_execute):
        """Test that HAVING clause properly detects non-aggregated columns"""
        # Simulate database error for non-aggregated column in HAVING
        mock_execute.side_effect = Exception(
            "column 'region' must appear in the GROUP BY clause "
            "or be used in an aggregate function"
        )

        result = self.table.validate_expression(
            expression="region = 'US'",
            expression_type=SqlExpressionType.HAVING,
        )

        assert result["valid"] is False
        assert len(result["errors"]) == 1
        assert "must appear in the GROUP BY clause" in result["errors"][0]["message"]

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_empty_expression(self, mock_execute):
        """Test validation of empty expressions"""
        # Mock _execute_validation_query to raise exception for empty expression
        mock_execute.side_effect = Exception("Expression is empty")

        result = self.table.validate_expression(
            expression="",
            expression_type=SqlExpressionType.COLUMN,
        )

        assert result["valid"] is False
        assert len(result["errors"]) == 1
        # The actual error message will come from the exception
        assert "empty" in result["errors"][0]["message"].lower()

    @patch("superset.models.helpers.is_feature_enabled", return_value=False)
    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_expression_rejects_subquery(
        self, mock_execute: MagicMock, mock_ff: MagicMock
    ) -> None:
        """A sub-query expression is rejected by the same validate_adhoc_subquery
        gate used for stored adhoc expressions, before any validation query is
        built or run (with ALLOW_ADHOC_SUBQUERY off, the default). Locks in that
        expression validation never executes the sub-query."""
        result = self.table.validate_expression(
            expression="(SELECT 1) IS NOT NULL OR 1 = 1",
            expression_type=SqlExpressionType.WHERE,
        )

        assert result["valid"] is False
        mock_execute.assert_not_called()

    @patch("superset.models.helpers.is_feature_enabled", return_value=False)
    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_expression_rejects_set_operation(
        self, mock_execute: MagicMock, mock_ff: MagicMock
    ) -> None:
        """A set-operation expression is rejected before the validation query is
        built or run, matching the stored-adhoc-expression policy."""
        result = self.table.validate_expression(
            expression="1 UNION SELECT 1",
            expression_type=SqlExpressionType.WHERE,
        )

        assert result["valid"] is False
        mock_execute.assert_not_called()

    @patch("superset.connectors.sqla.models.SqlaTable._execute_validation_query")
    def test_validate_expression_with_rls(self, mock_execute):
        """Test that RLS filters are applied during validation"""
        # Mock _execute_validation_query to return success
        mock_execute.return_value = {"valid": True, "errors": []}

        # Mock RLS filters
        self.table.get_sqla_row_level_filters = MagicMock(return_value=[MagicMock()])

        result = self.table.validate_expression(
            expression="test_col",
            expression_type=SqlExpressionType.COLUMN,
        )

        assert result["valid"] is True
