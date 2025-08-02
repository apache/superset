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

"""Tests for enhanced error handling in chart generation"""

from unittest.mock import Mock, patch

from superset.mcp_service.chart.validation_utils import (
    get_column_suggestions,
    get_dataset_context,
    validate_chart_config,
)
from superset.mcp_service.schemas.chart_schemas import (
    ColumnRef,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.schemas.error_schemas import DatasetContext


class TestEnhancedErrorHandling:
    """Test enhanced error handling for chart generation"""

    def test_column_suggestions_fuzzy_matching(self):
        """Test that column suggestions use fuzzy matching effectively"""
        # Create mock dataset context
        dataset_context = DatasetContext(
            id=1,
            table_name="test_table",
            database_name="test_db",
            available_columns=[
                {
                    "name": "customer_name",
                    "type": "varchar",
                    "description": "Customer name",
                },
                {"name": "order_date", "type": "datetime", "description": "Order date"},
                {
                    "name": "total_amount",
                    "type": "decimal",
                    "description": "Total amount",
                },
                {
                    "name": "product_category",
                    "type": "varchar",
                    "description": "Product category",
                },
            ],
            available_metrics=[],
        )

        # Test typo in column name
        suggestions = get_column_suggestions(
            "custmer_name", dataset_context, max_suggestions=3
        )

        # Should suggest customer_name as top match
        assert len(suggestions) > 0
        assert suggestions[0].name == "customer_name"
        assert suggestions[0].similarity_score > 0.8
        assert "Customer name" in suggestions[0].description

    def test_invalid_column_validation(self):
        """Test validation of invalid column names"""
        # Mock dataset DAO
        with patch("superset.daos.dataset.DatasetDAO") as mock_dao:
            # Create mock dataset with proper attributes
            mock_dataset = Mock()
            mock_dataset.id = 1
            mock_dataset.table_name = "test_table"
            mock_dataset.schema = "public"  # Must be string, not Mock
            mock_database = Mock()
            mock_database.database_name = "test_db"
            mock_dataset.database = mock_database

            # Mock columns with all required attributes
            mock_column = Mock()
            mock_column.column_name = "valid_column"
            mock_column.type = "varchar"
            mock_column.description = "A valid column"
            mock_column.is_dttm = False
            mock_column.python_date_format = None
            mock_column.verbose_name = None
            mock_dataset.columns = [mock_column]
            mock_dataset.metrics = []

            mock_dao.find_by_id.return_value = mock_dataset

            # Create config with invalid column
            config = TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="invalid_column")]
            )

            # Validate
            is_valid, error = validate_chart_config(config, 1)

            # Should be invalid with detailed error
            assert not is_valid
            assert error is not None
            assert error.error_type == "validation_error"
            assert len(error.validation_errors) == 1
            assert error.validation_errors[0].field == "columns[0]"
            assert error.validation_errors[0].error_type == "column_not_found"
            assert len(error.validation_errors[0].suggestions) > 0

    def test_aggregate_type_validation(self):
        """Test validation of aggregate functions against column types"""
        with patch("superset.daos.dataset.DatasetDAO") as mock_dao:
            # Create mock dataset with text column
            mock_dataset = Mock()
            mock_dataset.id = 1
            mock_dataset.table_name = "test_table"
            mock_dataset.schema = "public"  # Must be string, not Mock
            mock_database = Mock()
            mock_database.database_name = "test_db"
            mock_dataset.database = mock_database

            mock_column = Mock()
            mock_column.column_name = "text_column"
            mock_column.type = "varchar"
            mock_column.description = "A text column"
            mock_column.is_dttm = False
            mock_column.python_date_format = None
            mock_column.verbose_name = None
            mock_dataset.columns = [mock_column]
            mock_dataset.metrics = []

            mock_dao.find_by_id.return_value = mock_dataset

            # Create config with invalid aggregate (SUM on text)
            config = TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="text_column", aggregate="SUM")],
            )

            # Validate
            is_valid, error = validate_chart_config(config, 1)

            # Should be invalid with aggregate type error
            assert not is_valid
            assert error is not None
            assert any(
                err.error_type == "aggregate_type_mismatch"
                for err in error.validation_errors
            )

    def test_dataset_not_found_error(self):
        """Test dataset not found error handling"""
        with patch("superset.daos.dataset.DatasetDAO") as mock_dao:
            mock_dao.find_by_id.return_value = None

            config = TableChartConfig(
                chart_type="table", columns=[ColumnRef(name="any_column")]
            )

            is_valid, error = validate_chart_config(config, 999)

            assert not is_valid
            assert error is not None
            assert error.error_type == "dataset_not_found"
            assert "999" in error.message
            assert len(error.suggestions) > 0

    def test_xy_chart_validation(self):
        """Test validation of XY chart configuration"""
        with patch("superset.daos.dataset.DatasetDAO") as mock_dao:
            # Create mock dataset with proper attributes
            mock_dataset = Mock()
            mock_dataset.id = 1
            mock_dataset.table_name = "test_table"
            mock_dataset.schema = "public"  # Must be string, not Mock
            mock_database = Mock()
            mock_database.database_name = "test_db"
            mock_dataset.database = mock_database

            # Mock valid columns with all required attributes
            mock_x_col = Mock()
            mock_x_col.column_name = "date_column"
            mock_x_col.type = "datetime"
            mock_x_col.description = "Date column"
            mock_x_col.is_dttm = True
            mock_x_col.python_date_format = None
            mock_x_col.verbose_name = None

            mock_y_col = Mock()
            mock_y_col.column_name = "amount_column"
            mock_y_col.type = "decimal"
            mock_y_col.description = "Amount column"
            mock_y_col.is_dttm = False
            mock_y_col.python_date_format = None
            mock_y_col.verbose_name = None

            mock_dataset.columns = [mock_x_col, mock_y_col]
            mock_dataset.metrics = []

            mock_dao.find_by_id.return_value = mock_dataset

            # Create valid XY config
            config = XYChartConfig(
                chart_type="xy",
                kind="line",
                x=ColumnRef(name="date_column"),
                y=[ColumnRef(name="amount_column", aggregate="SUM")],
            )

            # Should be valid
            is_valid, error = validate_chart_config(config, 1)
            assert is_valid
            assert error is None

    def test_get_dataset_context(self):
        """Test dataset context retrieval"""
        with patch("superset.daos.dataset.DatasetDAO") as mock_dao:
            # Create comprehensive mock dataset
            mock_dataset = Mock()
            mock_dataset.id = 1
            mock_dataset.table_name = "customers"
            mock_dataset.schema = "public"
            mock_database = Mock()
            mock_database.database_name = "postgres_db"
            mock_dataset.database = mock_database

            # Mock columns with various types
            mock_columns = []
            column_data = [
                ("id", "integer", "Customer ID"),
                ("name", "varchar", "Customer name"),
                ("created_at", "datetime", "Account creation date"),
                ("balance", "decimal", "Account balance"),
            ]

            for name, col_type, desc in column_data:
                mock_col = Mock()
                mock_col.column_name = name
                mock_col.type = col_type
                mock_col.description = desc
                mock_col.is_dttm = col_type == "datetime"
                mock_col.python_date_format = None
                mock_col.verbose_name = None
                mock_columns.append(mock_col)

            mock_dataset.columns = mock_columns
            mock_dataset.metrics = []

            mock_dao.find_by_id.return_value = mock_dataset

            # Get context
            context = get_dataset_context(1)

            assert context is not None
            assert context.id == 1
            assert context.table_name == "customers"
            assert context.schema == "public"
            assert context.database_name == "postgres_db"
            assert len(context.available_columns) == 4
            assert context.available_columns[0]["name"] == "id"
            assert context.available_columns[2]["is_dttm"] is True

    def test_validation_performance(self):
        """Test that validation doesn't significantly impact performance"""
        import time

        with patch("superset.daos.dataset.DatasetDAO") as mock_dao:
            # Create mock dataset with many columns
            mock_dataset = Mock()
            mock_dataset.id = 1
            mock_dataset.table_name = "large_table"
            mock_dataset.schema = "public"  # Must be string, not Mock
            mock_database = Mock()
            mock_database.database_name = "test_db"
            mock_dataset.database = mock_database

            # Create 100 mock columns with all required attributes
            mock_columns = []
            for i in range(100):
                mock_col = Mock()
                mock_col.column_name = f"column_{i}"
                mock_col.type = "varchar"
                mock_col.description = f"Column {i}"
                mock_col.is_dttm = False
                mock_col.python_date_format = None
                mock_col.verbose_name = None
                mock_columns.append(mock_col)

            mock_dataset.columns = mock_columns
            mock_dataset.metrics = []
            mock_dao.find_by_id.return_value = mock_dataset

            # Test validation time
            config = TableChartConfig(
                chart_type="table",
                columns=[ColumnRef(name="column_1"), ColumnRef(name="column_2")],
            )

            start_time = time.time()
            is_valid, error = validate_chart_config(config, 1)
            validation_time = time.time() - start_time

            # Should complete quickly (< 100ms even for large datasets)
            assert validation_time < 0.1
            assert is_valid is True
