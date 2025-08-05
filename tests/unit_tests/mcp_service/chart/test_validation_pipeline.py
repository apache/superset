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

"""Tests for the chart validation pipeline"""

from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from superset.mcp_service.chart.schemas import (
    ColumnRef,
    FilterConfig,
    GenerateChartRequest,
    TableChartConfig,
    XYChartConfig,
)
from superset.mcp_service.chart.validation.dataset_validator import DatasetValidator
from superset.mcp_service.chart.validation.pipeline import ValidationPipeline
from superset.mcp_service.chart.validation.schema_validator import SchemaValidator


class TestValidationPipeline:
    """Test the chart validation pipeline"""

    def test_pipeline_initialization(self):
        """Test that validation pipeline initializes correctly"""
        # The ValidationPipeline is a static class, not an instance
        assert ValidationPipeline is not None
        assert hasattr(ValidationPipeline, "validate_request")

    def test_schema_validation_table_chart(self):
        """Test schema validation for table charts"""
        # Valid table chart config
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region", label="Region"),
                ColumnRef(name="sales", label="Sales", aggregate="SUM"),
            ],
            filters=[FilterConfig(column="year", op="=", value=2024)],
            sort_by=["sales"],
        )

        request = GenerateChartRequest(dataset_id=1, config=config)

        # Schema validation should pass
        is_valid, parsed_request, error = SchemaValidator.validate_request(
            request.model_dump()
        )
        assert is_valid is True
        assert error is None

    def test_schema_validation_xy_chart(self):
        """Test schema validation for XY charts"""
        # Valid XY chart config
        config = XYChartConfig(
            chart_type="xy",
            kind="line",
            x=ColumnRef(name="date", label="Date"),
            y=[ColumnRef(name="revenue", label="Revenue", aggregate="SUM")],
        )

        request = GenerateChartRequest(dataset_id=1, config=config)

        # Schema validation should pass
        is_valid, parsed_request, error = SchemaValidator.validate_request(
            request.model_dump()
        )
        assert is_valid is True
        assert error is None

    def test_schema_validation_empty_columns(self):
        """Test schema validation fails for empty columns"""
        with pytest.raises(ValidationError) as exc_info:
            TableChartConfig(
                chart_type="table",
                columns=[],  # Empty columns should fail
            )
        assert "at least 1 item" in str(exc_info.value)

    def test_schema_validation_empty_y_axis(self):
        """Test schema validation fails for empty Y axis"""
        with pytest.raises(ValidationError) as exc_info:
            XYChartConfig(
                chart_type="xy",
                kind="line",
                x=ColumnRef(name="date"),
                y=[],  # Empty Y axis should fail
            )
        assert "at least 1 item" in str(exc_info.value)

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    def test_dataset_validation_success(self, mock_find_dataset):
        """Test dataset validation with valid columns"""
        # Mock dataset with columns
        mock_dataset = Mock()
        mock_dataset.id = 1
        mock_dataset.table_name = "sales_data"
        mock_dataset.schema = "public"
        mock_dataset.database = Mock(database_name="test_db")

        # Mock columns
        mock_col1 = Mock()
        mock_col1.column_name = "region"
        mock_col1.type = "varchar"
        mock_col1.description = "Sales region"

        mock_col2 = Mock()
        mock_col2.column_name = "sales"
        mock_col2.type = "decimal"
        mock_col2.description = "Sales amount"

        mock_dataset.columns = [mock_col1, mock_col2]
        mock_dataset.metrics = []

        mock_find_dataset.return_value = mock_dataset

        # Create request with valid columns
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="sales", aggregate="SUM"),
            ],
        )
        request = GenerateChartRequest(dataset_id=1, config=config)

        # Dataset validation should pass
        is_valid, error = DatasetValidator.validate_against_dataset(
            request.config, request.dataset_id
        )
        assert is_valid is True
        assert error is None

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    def test_dataset_validation_invalid_column(self, mock_find_dataset):
        """Test dataset validation with invalid column"""
        # Mock dataset with columns
        mock_dataset = Mock()
        mock_dataset.id = 1
        mock_dataset.table_name = "sales_data"
        mock_dataset.schema = "public"
        mock_dataset.database = Mock(database_name="test_db")

        # Mock columns (only region exists)
        mock_col = Mock()
        mock_col.column_name = "region"
        mock_col.type = "varchar"
        mock_col.description = "Sales region"

        mock_dataset.columns = [mock_col]
        mock_dataset.metrics = []

        mock_find_dataset.return_value = mock_dataset

        # Create request with invalid column "sales"
        config = TableChartConfig(
            chart_type="table",
            columns=[
                ColumnRef(name="region"),
                ColumnRef(name="sales"),  # This column doesn't exist
            ],
        )
        request = GenerateChartRequest(dataset_id=1, config=config)

        # Dataset validation should fail
        is_valid, error = DatasetValidator.validate_against_dataset(
            request.config, request.dataset_id
        )
        assert is_valid is False
        assert error is not None
        # The error type can be either validation_error or column_not_found
        assert error.error_type in [
            "validation_error",
            "column_not_found",
            "multiple_invalid_columns",
        ]
        # For column_not_found or multiple_invalid_columns errors, we get suggestions
        if hasattr(error, "validation_errors") and error.validation_errors:
            assert len(error.validation_errors) > 0
            # Check that we get suggestions
            assert any(err.suggestions for err in error.validation_errors)
        else:
            # For simple column_not_found errors, we still have suggestions
            assert len(error.suggestions) > 0

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    def test_dataset_not_found(self, mock_find_dataset):
        """Test dataset validation when dataset doesn't exist"""
        mock_find_dataset.return_value = None

        config = TableChartConfig(
            chart_type="table",
            columns=[ColumnRef(name="any_column")],
        )
        request = GenerateChartRequest(dataset_id=999, config=config)

        # Dataset validation should fail
        is_valid, error = DatasetValidator.validate_against_dataset(
            request.config, request.dataset_id
        )
        assert is_valid is False
        assert error is not None
        assert error.error_type == "dataset_not_found"
        assert "999" in error.message

    @patch("superset.daos.dataset.DatasetDAO.find_by_id")
    def test_full_pipeline_validation(self, mock_find_dataset):
        """Test full validation pipeline"""
        # Mock dataset
        mock_dataset = Mock()
        mock_dataset.id = 1
        mock_dataset.table_name = "orders"
        mock_dataset.schema = "public"
        mock_dataset.database = Mock(database_name="test_db")

        # Mock columns
        mock_date = Mock()
        mock_date.column_name = "order_date"
        mock_date.type = "datetime"
        mock_date.description = "Order date"
        mock_date.is_dttm = True

        mock_amount = Mock()
        mock_amount.column_name = "amount"
        mock_amount.type = "decimal"
        mock_amount.description = "Order amount"

        mock_dataset.columns = [mock_date, mock_amount]
        mock_dataset.metrics = []

        mock_find_dataset.return_value = mock_dataset

        # Create valid XY chart request
        config = XYChartConfig(
            chart_type="xy",
            kind="line",
            x=ColumnRef(name="order_date"),
            y=[ColumnRef(name="amount", aggregate="SUM")],
        )
        request = GenerateChartRequest(dataset_id=1, config=config)

        # Full pipeline validation should pass
        is_valid, parsed_request, error = ValidationPipeline.validate_request(
            request.model_dump()
        )
        assert is_valid is True
        assert error is None

    def test_invalid_aggregate_function(self):
        """Test that invalid aggregate functions are caught"""
        with pytest.raises(ValidationError) as exc_info:
            ColumnRef(name="sales", aggregate="INVALID_AGG")
        assert "INVALID_AGG" in str(exc_info.value)

    def test_filter_validation(self):
        """Test filter configuration validation"""
        # Valid filter
        filter_config = FilterConfig(column="year", op="=", value=2024)
        assert filter_config.column == "year"
        assert filter_config.op == "="
        assert filter_config.value == 2024

        # Invalid operator should fail
        with pytest.raises(ValidationError):
            FilterConfig(column="year", op="invalid_op", value=2024)

    def test_unique_column_labels(self):
        """Test that duplicate column labels are detected"""
        # This test verifies that duplicate labels are caught at creation time
        with pytest.raises(ValidationError) as exc_info:
            TableChartConfig(
                chart_type="table",
                columns=[
                    ColumnRef(name="col1", label="Label"),
                    ColumnRef(name="col2", label="Label"),  # Duplicate label
                ],
            )

        # Check that the error mentions duplicate labels
        assert "Duplicate" in str(exc_info.value)
