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

"""Tests for semantic layer models."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from superset_core.semantic_layers.types import (
    BINARY,
    BOOLEAN,
    DATE,
    DATETIME,
    DECIMAL,
    INTEGER,
    INTERVAL,
    NUMBER,
    OBJECT,
    STRING,
    TIME,
    Day,
    Dimension,
    Metric,
    Type,
)

from superset.semantic_layers.models import (
    ColumnMetadata,
    MetricMetadata,
    SemanticLayer,
    SemanticView,
    get_column_type,
)
from superset.utils.core import GenericDataType


# =============================================================================
# get_column_type tests
# =============================================================================


def test_get_column_type_temporal_date() -> None:
    """Test that DATE maps to TEMPORAL."""
    assert get_column_type(DATE) == GenericDataType.TEMPORAL


def test_get_column_type_temporal_datetime() -> None:
    """Test that DATETIME maps to TEMPORAL."""
    assert get_column_type(DATETIME) == GenericDataType.TEMPORAL


def test_get_column_type_temporal_time() -> None:
    """Test that TIME maps to TEMPORAL."""
    assert get_column_type(TIME) == GenericDataType.TEMPORAL


def test_get_column_type_numeric_integer() -> None:
    """Test that INTEGER maps to NUMERIC."""
    assert get_column_type(INTEGER) == GenericDataType.NUMERIC


def test_get_column_type_numeric_number() -> None:
    """Test that NUMBER maps to NUMERIC."""
    assert get_column_type(NUMBER) == GenericDataType.NUMERIC


def test_get_column_type_numeric_decimal() -> None:
    """Test that DECIMAL maps to NUMERIC."""
    assert get_column_type(DECIMAL) == GenericDataType.NUMERIC


def test_get_column_type_numeric_interval() -> None:
    """Test that INTERVAL maps to NUMERIC."""
    assert get_column_type(INTERVAL) == GenericDataType.NUMERIC


def test_get_column_type_boolean() -> None:
    """Test that BOOLEAN maps to BOOLEAN."""
    assert get_column_type(BOOLEAN) == GenericDataType.BOOLEAN


def test_get_column_type_string() -> None:
    """Test that STRING maps to STRING."""
    assert get_column_type(STRING) == GenericDataType.STRING


def test_get_column_type_object() -> None:
    """Test that OBJECT maps to STRING."""
    assert get_column_type(OBJECT) == GenericDataType.STRING


def test_get_column_type_binary() -> None:
    """Test that BINARY maps to STRING."""
    assert get_column_type(BINARY) == GenericDataType.STRING


def test_get_column_type_unknown() -> None:
    """Test that unknown types default to STRING."""

    class UnknownType(Type):
        pass

    assert get_column_type(UnknownType) == GenericDataType.STRING


# =============================================================================
# MetricMetadata tests
# =============================================================================


def test_metric_metadata_required_fields() -> None:
    """Test MetricMetadata with required fields only."""
    metadata = MetricMetadata(
        metric_name="revenue",
        expression="SUM(amount)",
    )
    assert metadata.metric_name == "revenue"
    assert metadata.expression == "SUM(amount)"
    assert metadata.verbose_name is None
    assert metadata.description is None
    assert metadata.d3format is None
    assert metadata.currency is None
    assert metadata.warning_text is None
    assert metadata.certified_by is None
    assert metadata.certification_details is None


def test_metric_metadata_all_fields() -> None:
    """Test MetricMetadata with all fields."""
    metadata = MetricMetadata(
        metric_name="revenue",
        expression="SUM(amount)",
        verbose_name="Total Revenue",
        description="Sum of all revenue",
        d3format="$,.2f",
        currency={"symbol": "$", "symbolPosition": "prefix"},
        warning_text="Data may be incomplete",
        certified_by="Data Team",
        certification_details="Verified Q1 2024",
    )
    assert metadata.metric_name == "revenue"
    assert metadata.expression == "SUM(amount)"
    assert metadata.verbose_name == "Total Revenue"
    assert metadata.description == "Sum of all revenue"
    assert metadata.d3format == "$,.2f"
    assert metadata.currency == {"symbol": "$", "symbolPosition": "prefix"}
    assert metadata.warning_text == "Data may be incomplete"
    assert metadata.certified_by == "Data Team"
    assert metadata.certification_details == "Verified Q1 2024"


# =============================================================================
# ColumnMetadata tests
# =============================================================================


def test_column_metadata_required_fields() -> None:
    """Test ColumnMetadata with required fields only."""
    metadata = ColumnMetadata(
        column_name="order_date",
        type="DATE",
        is_dttm=True,
    )
    assert metadata.column_name == "order_date"
    assert metadata.type == "DATE"
    assert metadata.is_dttm is True
    assert metadata.verbose_name is None
    assert metadata.description is None
    assert metadata.groupby is True
    assert metadata.filterable is True
    assert metadata.expression is None
    assert metadata.python_date_format is None
    assert metadata.advanced_data_type is None
    assert metadata.extra is None


def test_column_metadata_all_fields() -> None:
    """Test ColumnMetadata with all fields."""
    metadata = ColumnMetadata(
        column_name="order_date",
        type="DATE",
        is_dttm=True,
        verbose_name="Order Date",
        description="Date of the order",
        groupby=True,
        filterable=True,
        expression="DATE(order_timestamp)",
        python_date_format="%Y-%m-%d",
        advanced_data_type="date",
        extra='{"grain": "day"}',
    )
    assert metadata.column_name == "order_date"
    assert metadata.type == "DATE"
    assert metadata.is_dttm is True
    assert metadata.verbose_name == "Order Date"
    assert metadata.description == "Date of the order"
    assert metadata.groupby is True
    assert metadata.filterable is True
    assert metadata.expression == "DATE(order_timestamp)"
    assert metadata.python_date_format == "%Y-%m-%d"
    assert metadata.advanced_data_type == "date"
    assert metadata.extra == '{"grain": "day"}'


# =============================================================================
# SemanticLayer tests
# =============================================================================


def test_semantic_layer_repr_with_name() -> None:
    """Test SemanticLayer __repr__ with name."""
    layer = SemanticLayer()
    layer.name = "My Semantic Layer"
    layer.uuid = uuid.uuid4()
    assert repr(layer) == "My Semantic Layer"


def test_semantic_layer_repr_without_name() -> None:
    """Test SemanticLayer __repr__ without name (uses uuid)."""
    layer = SemanticLayer()
    layer.name = None
    test_uuid = uuid.uuid4()
    layer.uuid = test_uuid
    assert repr(layer) == str(test_uuid)


def test_semantic_layer_implementation_not_implemented() -> None:
    """Test that implementation raises NotImplementedError."""
    layer = SemanticLayer()
    with pytest.raises(NotImplementedError):
        _ = layer.implementation


# =============================================================================
# SemanticView tests
# =============================================================================


@pytest.fixture
def mock_dimensions() -> list[Dimension]:
    """Create mock dimensions for testing."""
    return [
        Dimension(
            id="orders.order_date",
            name="order_date",
            type=DATE,
            definition="orders.order_date",
            description="Date of the order",
            grain=Day,
        ),
        Dimension(
            id="products.category",
            name="category",
            type=STRING,
            definition="products.category",
            description="Product category",
            grain=None,
        ),
    ]


@pytest.fixture
def mock_metrics() -> list[Metric]:
    """Create mock metrics for testing."""
    return [
        Metric(
            id="orders.revenue",
            name="revenue",
            type=NUMBER,
            definition="SUM(orders.amount)",
            description="Total revenue",
        ),
        Metric(
            id="orders.count",
            name="order_count",
            type=INTEGER,
            definition="COUNT(*)",
            description="Number of orders",
        ),
    ]


@pytest.fixture
def mock_implementation(
    mock_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> MagicMock:
    """Create a mock implementation."""
    impl = MagicMock()
    impl.get_dimensions.return_value = mock_dimensions
    impl.get_metrics.return_value = mock_metrics
    impl.uid.return_value = "semantic_view_uid_123"
    return impl


@pytest.fixture
def semantic_view(mock_implementation: MagicMock) -> SemanticView:
    """Create a SemanticView with mocked implementation."""
    view = SemanticView()
    view.name = "Orders View"
    view.description = "View of order data"
    view.uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    view.semantic_layer_uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    view.cache_timeout = 3600
    view.configuration = "{}"

    # Mock the implementation property
    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda self: mock_implementation),
    ):
        # We need to return the view but the patch won't persist
        pass

    return view


def test_semantic_view_repr_with_name() -> None:
    """Test SemanticView __repr__ with name."""
    view = SemanticView()
    view.name = "My View"
    view.uuid = uuid.uuid4()
    assert repr(view) == "My View"


def test_semantic_view_repr_without_name() -> None:
    """Test SemanticView __repr__ without name (uses uuid)."""
    view = SemanticView()
    view.name = None
    test_uuid = uuid.uuid4()
    view.uuid = test_uuid
    assert repr(view) == str(test_uuid)


def test_semantic_view_type() -> None:
    """Test SemanticView type property."""
    view = SemanticView()
    assert view.type == "semantic_view"


def test_semantic_view_offset() -> None:
    """Test SemanticView offset property."""
    view = SemanticView()
    assert view.offset == 0


def test_semantic_view_is_rls_supported() -> None:
    """Test SemanticView is_rls_supported property."""
    view = SemanticView()
    assert view.is_rls_supported is False


def test_semantic_view_query_language() -> None:
    """Test SemanticView query_language property."""
    view = SemanticView()
    assert view.query_language is None


def test_semantic_view_get_query_str() -> None:
    """Test SemanticView get_query_str method."""
    view = SemanticView()
    result = view.get_query_str({})
    assert result == "Not implemented for semantic layers"


def test_semantic_view_get_extra_cache_keys() -> None:
    """Test SemanticView get_extra_cache_keys method."""
    view = SemanticView()
    result = view.get_extra_cache_keys({})
    assert result == []


def test_semantic_view_perm() -> None:
    """Test SemanticView perm property."""
    view = SemanticView()
    view.uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    view.semantic_layer_uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    assert view.perm == "87654321432187654321876543218765::12345678123456781234567812345678"


def test_semantic_view_uid(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView uid property."""
    view = SemanticView()
    view.name = "Test View"
    view.uuid = uuid.uuid4()
    view.semantic_layer_uuid = uuid.uuid4()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        assert view.uid == "semantic_view_uid_123"


def test_semantic_view_metrics(
    mock_implementation: MagicMock,
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView metrics property."""
    view = SemanticView()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        metrics = view.metrics
        assert len(metrics) == 2
        assert metrics[0].metric_name == "revenue"
        assert metrics[0].expression == "SUM(orders.amount)"
        assert metrics[0].description == "Total revenue"
        assert metrics[1].metric_name == "order_count"


def test_semantic_view_columns(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test SemanticView columns property."""
    view = SemanticView()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        columns = view.columns
        assert len(columns) == 2
        assert columns[0].column_name == "order_date"
        assert columns[0].type == "DATE"
        assert columns[0].is_dttm is True
        assert columns[0].description == "Date of the order"
        assert columns[1].column_name == "category"
        assert columns[1].type == "STRING"
        assert columns[1].is_dttm is False


def test_semantic_view_column_names(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test SemanticView column_names property."""
    view = SemanticView()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        column_names = view.column_names
        assert column_names == ["order_date", "category"]


def test_semantic_view_get_time_grains(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test SemanticView get_time_grains property."""
    view = SemanticView()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        time_grains = view.get_time_grains
        assert len(time_grains) == 1
        assert time_grains[0]["name"] == "Day"
        assert time_grains[0]["duration"] == "P1D"


def test_semantic_view_has_drill_by_columns_all_exist(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test has_drill_by_columns when all columns exist."""
    view = SemanticView()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        assert view.has_drill_by_columns(["order_date", "category"]) is True


def test_semantic_view_has_drill_by_columns_some_missing(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test has_drill_by_columns when some columns are missing."""
    view = SemanticView()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        assert view.has_drill_by_columns(["order_date", "nonexistent"]) is False


def test_semantic_view_has_drill_by_columns_empty(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test has_drill_by_columns with empty list."""
    view = SemanticView()

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        assert view.has_drill_by_columns([]) is True


def test_semantic_view_data(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView data property."""
    view = SemanticView()
    view.name = "Orders View"
    view.description = "View of order data"
    view.uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    view.semantic_layer_uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    view.cache_timeout = 3600

    with patch.object(
        SemanticView, "implementation", new_callable=lambda: property(lambda s: mock_implementation)
    ):
        data = view.data

        # Check core fields
        assert data["id"] == "12345678123456781234567812345678"
        assert data["uid"] == "semantic_view_uid_123"
        assert data["type"] == "semantic_view"
        assert data["name"] == "Orders View"
        assert data["description"] == "View of order data"
        assert data["cache_timeout"] == 3600

        # Check columns
        assert len(data["columns"]) == 2
        assert data["columns"][0]["column_name"] == "order_date"
        assert data["columns"][0]["type"] == "DATE"
        assert data["columns"][0]["is_dttm"] is True
        assert data["columns"][0]["type_generic"] == GenericDataType.TEMPORAL
        assert data["columns"][1]["column_name"] == "category"
        assert data["columns"][1]["type"] == "STRING"
        assert data["columns"][1]["type_generic"] == GenericDataType.STRING

        # Check metrics
        assert len(data["metrics"]) == 2
        assert data["metrics"][0]["metric_name"] == "revenue"
        assert data["metrics"][0]["expression"] == "SUM(orders.amount)"
        assert data["metrics"][1]["metric_name"] == "order_count"

        # Check column_types and column_names
        assert data["column_types"] == [
            GenericDataType.TEMPORAL,
            GenericDataType.STRING,
        ]
        assert data["column_names"] == {"order_date", "category"}

        # Check other fields
        assert data["table_name"] == "Orders View"
        assert data["datasource_name"] == "Orders View"
        assert data["offset"] == 0


def test_semantic_view_get_query_result(
    mock_implementation: MagicMock,
) -> None:
    """Test SemanticView get_query_result method."""
    view = SemanticView()

    mock_query_object = MagicMock()
    mock_result = MagicMock()

    with patch(
        "superset.semantic_layers.models.get_results",
        return_value=mock_result,
    ) as mock_get_results:
        result = view.get_query_result(mock_query_object)

        mock_get_results.assert_called_once_with(mock_query_object)
        assert result == mock_result


def test_semantic_view_implementation() -> None:
    """Test SemanticView implementation property."""
    view = SemanticView()
    view.name = "Test View"
    view.configuration = '{"key": "value"}'

    mock_semantic_layer = MagicMock()
    mock_semantic_view_impl = MagicMock()
    mock_semantic_layer.implementation.get_semantic_view.return_value = (
        mock_semantic_view_impl
    )
    view.semantic_layer = mock_semantic_layer

    # Clear cached property if it exists
    if "implementation" in view.__dict__:
        del view.__dict__["implementation"]

    result = view.implementation

    mock_semantic_layer.implementation.get_semantic_view.assert_called_once_with(
        "Test View",
        {"key": "value"},
    )
    assert result == mock_semantic_view_impl
