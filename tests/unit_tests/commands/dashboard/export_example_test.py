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
from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
import yaml

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dashboard.export_example import (
    _make_bytes_generator,
    _make_yaml_generator,
    export_chart,
    export_dataset_yaml,
    ExportExampleCommand,
    sanitize_filename,
)


def test_sanitize_filename_basic():
    """Test basic filename sanitization."""
    assert sanitize_filename("my_dashboard") == "my_dashboard"
    assert sanitize_filename("My Dashboard") == "My_Dashboard"
    assert sanitize_filename("test-name") == "test-name"


def test_sanitize_filename_special_chars():
    """Test sanitization of special characters."""
    assert sanitize_filename("test/name") == "test_name"
    assert sanitize_filename("test:name") == "test_name"
    assert sanitize_filename("test<>name") == "test_name"


def test_sanitize_filename_collapses_underscores():
    """Test that multiple underscores are collapsed."""
    assert sanitize_filename("test___name") == "test_name"
    assert sanitize_filename("a  b  c") == "a_b_c"


def test_make_yaml_generator():
    """Test YAML generator function."""
    config = {"key": "value", "number": 42}
    generator = _make_yaml_generator(config)

    result = generator()
    assert isinstance(result, bytes)

    parsed = yaml.safe_load(result.decode("utf-8"))
    assert parsed == config


def test_make_bytes_generator():
    """Test bytes generator function."""
    data = b"test binary data"
    generator = _make_bytes_generator(data)

    result = generator()
    assert result == data


def test_export_dataset_yaml():
    """Test dataset YAML export."""
    # Create mock dataset
    mock_dataset = MagicMock()
    mock_dataset.table_name = "test_table"
    mock_dataset.main_dttm_col = "created_at"
    mock_dataset.description = "Test description"
    mock_dataset.default_endpoint = None
    mock_dataset.offset = 0
    mock_dataset.cache_timeout = None
    mock_dataset.catalog = None
    mock_dataset.sql = None
    mock_dataset.template_params = None
    mock_dataset.filter_select_enabled = True
    mock_dataset.fetch_values_predicate = None
    mock_dataset.extra = None
    mock_dataset.normalize_columns = False
    mock_dataset.always_filter_main_dttm = False
    mock_dataset.uuid = uuid4()
    mock_dataset.metrics = []
    mock_dataset.columns = []

    result = export_dataset_yaml(mock_dataset)

    assert result["table_name"] == "test_table"
    assert result["main_dttm_col"] == "created_at"
    assert result["description"] == "Test description"
    assert result["uuid"] == str(mock_dataset.uuid)
    assert result["version"] == "1.0.0"
    # Schema should be None (use target database default)
    assert result["schema"] is None


def test_export_dataset_yaml_with_metrics():
    """Test dataset YAML export includes metrics."""
    mock_metric = MagicMock()
    mock_metric.metric_name = "count"
    mock_metric.verbose_name = "Count"
    mock_metric.metric_type = "count"
    mock_metric.expression = "COUNT(*)"
    mock_metric.description = "Row count"
    mock_metric.d3format = None
    mock_metric.currency = None
    mock_metric.extra = None
    mock_metric.warning_text = None

    mock_dataset = MagicMock()
    mock_dataset.table_name = "test_table"
    mock_dataset.main_dttm_col = None
    mock_dataset.description = None
    mock_dataset.default_endpoint = None
    mock_dataset.offset = 0
    mock_dataset.cache_timeout = None
    mock_dataset.catalog = None
    mock_dataset.sql = None
    mock_dataset.template_params = None
    mock_dataset.filter_select_enabled = True
    mock_dataset.fetch_values_predicate = None
    mock_dataset.extra = None
    mock_dataset.normalize_columns = False
    mock_dataset.always_filter_main_dttm = False
    mock_dataset.uuid = uuid4()
    mock_dataset.metrics = [mock_metric]
    mock_dataset.columns = []

    result = export_dataset_yaml(mock_dataset)

    assert len(result["metrics"]) == 1
    assert result["metrics"][0]["metric_name"] == "count"
    assert result["metrics"][0]["expression"] == "COUNT(*)"


def test_export_chart():
    """Test chart YAML export."""
    mock_chart = MagicMock()
    mock_chart.slice_name = "Test Chart"
    mock_chart.description = "A test chart"
    mock_chart.certified_by = None
    mock_chart.certification_details = None
    mock_chart.viz_type = "table"
    mock_chart.params_dict = {"groupby": ["col1"]}
    mock_chart.cache_timeout = None
    mock_chart.uuid = uuid4()

    dataset_uuid = str(uuid4())

    result = export_chart(mock_chart, dataset_uuid)

    assert result["slice_name"] == "Test Chart"
    assert result["description"] == "A test chart"
    assert result["viz_type"] == "table"
    assert result["params"] == {"groupby": ["col1"]}
    assert result["uuid"] == str(mock_chart.uuid)
    assert result["dataset_uuid"] == dataset_uuid
    assert result["version"] == "1.0.0"
    # query_context should be None (contains stale IDs)
    assert result["query_context"] is None


def test_export_example_command_not_found():
    """Test ExportExampleCommand raises error for non-existent dashboard."""
    with patch("superset.commands.dashboard.export_example.DashboardDAO") as mock_dao:
        mock_dao.find_by_id.return_value = None

        command = ExportExampleCommand(dashboard_id=9999)

        with pytest.raises(DashboardNotFoundError):
            list(command.run())


def test_export_example_command_single_dataset():
    """Test ExportExampleCommand with single dataset dashboard."""
    # Create mock objects
    mock_chart = MagicMock()
    mock_chart.id = 1
    mock_chart.uuid = uuid4()
    mock_chart.slice_name = "Test Chart"
    mock_chart.description = None
    mock_chart.certified_by = None
    mock_chart.certification_details = None
    mock_chart.viz_type = "table"
    mock_chart.params_dict = {}
    mock_chart.cache_timeout = None

    mock_dataset = MagicMock()
    mock_dataset.id = 1
    mock_dataset.uuid = uuid4()
    mock_dataset.table_name = "test_table"
    mock_dataset.main_dttm_col = None
    mock_dataset.description = None
    mock_dataset.default_endpoint = None
    mock_dataset.offset = 0
    mock_dataset.cache_timeout = None
    mock_dataset.catalog = None
    mock_dataset.schema = None
    mock_dataset.sql = None
    mock_dataset.template_params = None
    mock_dataset.filter_select_enabled = True
    mock_dataset.fetch_values_predicate = None
    mock_dataset.extra = None
    mock_dataset.normalize_columns = False
    mock_dataset.always_filter_main_dttm = False
    mock_dataset.metrics = []
    mock_dataset.columns = []
    mock_dataset.database = MagicMock()

    mock_chart.datasource = mock_dataset

    mock_dashboard = MagicMock()
    mock_dashboard.id = 1
    mock_dashboard.uuid = uuid4()
    mock_dashboard.dashboard_title = "Test Dashboard"
    mock_dashboard.description = None
    mock_dashboard.css = None
    mock_dashboard.slug = "test-dashboard"
    mock_dashboard.certified_by = None
    mock_dashboard.certification_details = None
    mock_dashboard.published = True
    mock_dashboard.position = {}
    mock_dashboard.json_metadata = "{}"
    mock_dashboard.slices = [mock_chart]

    with (
        patch("superset.commands.dashboard.export_example.DashboardDAO") as mock_dao,
        patch(
            "superset.commands.dashboard.export_example.export_dataset_data"
        ) as mock_export_data,
    ):
        mock_dao.find_by_id.return_value = mock_dashboard
        mock_export_data.return_value = b"parquet data"

        command = ExportExampleCommand(dashboard_id=1, export_data=True)
        files = dict(command.run())

        # Should have single dataset structure
        assert "dataset.yaml" in files
        assert "data.parquet" in files
        assert "dashboard.yaml" in files
        assert any(f.startswith("charts/") for f in files)

        # Verify content generators work
        dataset_content = files["dataset.yaml"]()
        assert isinstance(dataset_content, bytes)
        dataset_yaml = yaml.safe_load(dataset_content.decode("utf-8"))
        assert dataset_yaml["table_name"] == "test_table"


def test_export_example_command_no_data():
    """Test ExportExampleCommand with export_data=False."""
    mock_chart = MagicMock()
    mock_chart.id = 1
    mock_chart.uuid = uuid4()
    mock_chart.slice_name = "Test Chart"
    mock_chart.description = None
    mock_chart.certified_by = None
    mock_chart.certification_details = None
    mock_chart.viz_type = "table"
    mock_chart.params_dict = {}
    mock_chart.cache_timeout = None

    mock_dataset = MagicMock()
    mock_dataset.id = 1
    mock_dataset.uuid = uuid4()
    mock_dataset.table_name = "test_table"
    mock_dataset.main_dttm_col = None
    mock_dataset.description = None
    mock_dataset.default_endpoint = None
    mock_dataset.offset = 0
    mock_dataset.cache_timeout = None
    mock_dataset.catalog = None
    mock_dataset.schema = None
    mock_dataset.sql = None
    mock_dataset.template_params = None
    mock_dataset.filter_select_enabled = True
    mock_dataset.fetch_values_predicate = None
    mock_dataset.extra = None
    mock_dataset.normalize_columns = False
    mock_dataset.always_filter_main_dttm = False
    mock_dataset.metrics = []
    mock_dataset.columns = []

    mock_chart.datasource = mock_dataset

    mock_dashboard = MagicMock()
    mock_dashboard.id = 1
    mock_dashboard.uuid = uuid4()
    mock_dashboard.dashboard_title = "Test Dashboard"
    mock_dashboard.description = None
    mock_dashboard.css = None
    mock_dashboard.slug = "test-dashboard"
    mock_dashboard.certified_by = None
    mock_dashboard.certification_details = None
    mock_dashboard.published = True
    mock_dashboard.position = {}
    mock_dashboard.json_metadata = "{}"
    mock_dashboard.slices = [mock_chart]

    with patch("superset.commands.dashboard.export_example.DashboardDAO") as mock_dao:
        mock_dao.find_by_id.return_value = mock_dashboard

        command = ExportExampleCommand(dashboard_id=1, export_data=False)
        files = dict(command.run())

        # Should have dataset.yaml but no data.parquet
        assert "dataset.yaml" in files
        assert "data.parquet" not in files
        assert "dashboard.yaml" in files
