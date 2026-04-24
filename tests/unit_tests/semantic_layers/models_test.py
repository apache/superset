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
from typing import Any
from unittest.mock import MagicMock, patch

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    Dimension,
    Grains,
    Metric,
)

from superset.semantic_layers.models import (
    ColumnMetadata,
    get_column_type,
    MetricMetadata,
    SemanticLayer,
    SemanticView,
)
from superset.utils.core import GenericDataType

# =============================================================================
# get_column_type tests
# =============================================================================


def test_get_column_type_temporal_date() -> None:
    """Test that date types map to TEMPORAL."""
    assert get_column_type(pa.date32()) == GenericDataType.TEMPORAL
    assert get_column_type(pa.date64()) == GenericDataType.TEMPORAL


def test_get_column_type_temporal_timestamp() -> None:
    """Test that timestamp types map to TEMPORAL."""
    assert get_column_type(pa.timestamp("us")) == GenericDataType.TEMPORAL


def test_get_column_type_temporal_time() -> None:
    """Test that time types map to TEMPORAL."""
    assert get_column_type(pa.time64("us")) == GenericDataType.TEMPORAL
    assert get_column_type(pa.time32("ms")) == GenericDataType.TEMPORAL


def test_get_column_type_numeric_integer() -> None:
    """Test that integer types map to NUMERIC."""
    assert get_column_type(pa.int64()) == GenericDataType.NUMERIC
    assert get_column_type(pa.int32()) == GenericDataType.NUMERIC


def test_get_column_type_numeric_float() -> None:
    """Test that float types map to NUMERIC."""
    assert get_column_type(pa.float64()) == GenericDataType.NUMERIC


def test_get_column_type_numeric_decimal() -> None:
    """Test that decimal types map to NUMERIC."""
    assert get_column_type(pa.decimal128(38, 10)) == GenericDataType.NUMERIC


def test_get_column_type_numeric_duration() -> None:
    """Test that duration types map to NUMERIC."""
    assert get_column_type(pa.duration("us")) == GenericDataType.NUMERIC


def test_get_column_type_boolean() -> None:
    """Test that boolean types map to BOOLEAN."""
    assert get_column_type(pa.bool_()) == GenericDataType.BOOLEAN


def test_get_column_type_string() -> None:
    """Test that string types map to STRING."""
    assert get_column_type(pa.utf8()) == GenericDataType.STRING
    assert get_column_type(pa.large_utf8()) == GenericDataType.STRING


def test_get_column_type_binary() -> None:
    """Test that binary types map to STRING."""
    assert get_column_type(pa.binary()) == GenericDataType.STRING


def test_get_column_type_unknown() -> None:
    """Test that unknown types default to STRING."""
    assert get_column_type(pa.null()) == GenericDataType.STRING


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
    """Test that implementation raises KeyError for unregistered type."""
    layer = SemanticLayer()
    with pytest.raises(KeyError):
        _ = layer.implementation


def test_semantic_layer_implementation() -> None:
    """Test that implementation returns a configured semantic layer."""
    layer = SemanticLayer()
    layer.type = "test_type"
    layer.configuration = '{"key": "value"}'

    mock_class = MagicMock()
    mock_impl = MagicMock()
    mock_class.from_configuration.return_value = mock_impl

    with patch.dict(
        "superset.semantic_layers.models.registry",
        {"test_type": mock_class},
    ):
        # Clear cached property if it exists
        if "implementation" in layer.__dict__:
            del layer.__dict__["implementation"]

        result = layer.implementation

    mock_class.from_configuration.assert_called_once_with({"key": "value"})
    assert result == mock_impl


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
            type=pa.date32(),
            definition="orders.order_date",
            description="Date of the order",
            grain=Grains.DAY,
        ),
        Dimension(
            id="products.category",
            name="category",
            type=pa.utf8(),
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
            type=pa.float64(),
            definition="SUM(orders.amount)",
            description="Total revenue",
        ),
        Metric(
            id="orders.count",
            name="order_count",
            type=pa.int64(),
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
    layer = SemanticLayer()
    layer.name = "Test Layer"
    layer.uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    layer.perm = "[Test Layer](id:87654321432187654321876543218765)"

    view = SemanticView()
    view.name = "Orders View"
    view.description = "View of order data"
    view.id = 1
    view.uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    view.semantic_layer_uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    view.semantic_layer = layer
    view.cache_timeout = 3600
    view.configuration = "{}"
    view.perm = "[Test Layer].[Orders View](id:1)"

    # Persist mocked implementation on this instance
    view.__dict__["implementation"] = mock_implementation

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


def test_semantic_view_table_name() -> None:
    """Test SemanticView table_name property."""
    view = SemanticView()
    view.name = "Orders View"
    assert view.table_name == "Orders View"


def test_semantic_view_kind() -> None:
    """Test SemanticView kind property."""
    view = SemanticView()
    assert view.kind == "semantic_view"


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
    """Test SemanticView perm stores the view-level permission string."""
    view = SemanticView()
    view.perm = "[My Layer].[My View](id:42)"
    assert view.perm == "[My Layer].[My View](id:42)"


def test_semantic_view_perm_none_by_default() -> None:
    """Test SemanticView perm is None when not set."""
    view = SemanticView()
    assert view.perm is None


def test_semantic_view_get_perm() -> None:
    """Test SemanticView.get_perm() format: [layer].[view](id:N)."""
    layer = SemanticLayer()
    layer.name = "My Layer"
    layer.uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")

    view = SemanticView()
    view.id = 42
    view.name = "My View"
    view.semantic_layer = layer
    assert view.get_perm() == "[My Layer].[My View](id:42)"


def test_semantic_view_get_perm_without_layer() -> None:
    """Test get_perm uses 'unknown' when no semantic_layer."""
    view = SemanticView()
    view.id = 1
    view.name = "Orphan View"
    view.semantic_layer = None  # type: ignore
    assert view.get_perm() == "[unknown].[Orphan View](id:1)"


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
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.uid == "semantic_view_uid_123"


def test_semantic_view_metrics(
    mock_implementation: MagicMock,
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView metrics property."""
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
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
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        columns = view.columns
        assert len(columns) == 2
        assert columns[0].column_name == "order_date"
        assert columns[0].type == "date32[day]"
        assert columns[0].is_dttm is True
        assert columns[0].description == "Date of the order"
        assert columns[1].column_name == "category"
        assert columns[1].type == "string"
        assert columns[1].is_dttm is False


def test_semantic_view_column_names(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test SemanticView column_names property."""
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
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
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        time_grains = view.get_time_grains()
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
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.has_drill_by_columns(["order_date", "category"]) is True


def test_semantic_view_has_drill_by_columns_some_missing(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test has_drill_by_columns when some columns are missing."""
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.has_drill_by_columns(["order_date", "nonexistent"]) is False


def test_semantic_view_has_drill_by_columns_empty(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Test has_drill_by_columns with empty list."""
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.has_drill_by_columns([]) is True


def test_semantic_view_data(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView data property."""
    from superset.semantic_layers.models import SemanticLayer

    layer = SemanticLayer()
    layer.name = "My Semantic Layer"
    layer.uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    layer.perm = "[My Semantic Layer](id:87654321432187654321876543218765)"

    view = SemanticView()
    view.name = "Orders View"
    view.description = "View of order data"
    view.id = 1
    view.uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    view.semantic_layer_uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    view.semantic_layer = layer
    view.cache_timeout = 3600

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        data = view.data

        # Check core fields
        assert data["id"] == 1
        assert data["uid"] == "semantic_view_uid_123"
        assert data["type"] == "semantic_view"
        assert data["name"] == "Orders View"
        assert data["description"] == "View of order data"
        assert data["cache_timeout"] == 3600
        assert data["database"] == {}
        assert data["parent"] == {"name": "My Semantic Layer"}

        # Check columns
        assert len(data["columns"]) == 2
        assert data["columns"][0]["column_name"] == "order_date"
        assert data["columns"][0]["type"] == "date32[day]"
        assert data["columns"][0]["is_dttm"] is True
        assert data["columns"][0]["type_generic"] == GenericDataType.TEMPORAL
        assert data["columns"][1]["column_name"] == "category"
        assert data["columns"][1]["type"] == "string"
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
        assert data["column_names"] == ["order_date", "category"]

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


def test_semantic_view_data_for_slices(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView data_for_slices returns same as data."""
    from superset.semantic_layers.models import SemanticLayer

    layer = SemanticLayer()
    layer.name = "My Semantic Layer"
    layer.uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    layer.perm = "[My Semantic Layer](id:87654321432187654321876543218765)"

    view = SemanticView()
    view.name = "Orders View"
    view.description = "View of order data"
    view.id = 1
    view.uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    view.semantic_layer_uuid = uuid.UUID("87654321-4321-8765-4321-876543218765")
    view.semantic_layer = layer
    view.cache_timeout = 3600

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.data_for_slices([]) == view.data


def test_semantic_view_catalog_perm() -> None:
    """Test SemanticView catalog_perm returns None."""
    view = SemanticView()
    assert view.catalog_perm is None


def test_semantic_view_schema_perm() -> None:
    """Test SemanticView schema_perm returns None."""
    view = SemanticView()
    assert view.schema_perm is None


def test_semantic_view_schema() -> None:
    """Test SemanticView schema returns None."""
    view = SemanticView()
    assert view.schema is None


def test_semantic_view_url() -> None:
    """Test SemanticView url property."""
    view = SemanticView()
    view.uuid = uuid.UUID("12345678-1234-5678-1234-567812345678")
    assert view.url == "/semantic_view/12345678-1234-5678-1234-567812345678/"


def test_semantic_view_explore_url() -> None:
    """Test SemanticView explore_url property."""
    view = SemanticView()
    view.id = 42
    assert (
        view.explore_url == "/explore/?datasource_type=semantic_view&datasource_id=42"
    )


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


def test_semantic_view_get_compatible_metrics(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView get_compatible_metrics maps names to objects and back."""
    view = SemanticView()

    mock_implementation.get_compatible_metrics.return_value = {mock_metrics[0]}

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        result = view.get_compatible_metrics(
            selected_metrics=["revenue", "missing_metric"],
            selected_dimensions=["order_date", "missing_dimension"],
        )

    assert result == ["revenue"]
    args = mock_implementation.get_compatible_metrics.call_args.args
    assert args[0] == {mock_metrics[0]}
    assert args[1] == {mock_dimensions[0]}


def test_semantic_view_get_compatible_dimensions(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> None:
    """Test SemanticView get_compatible_dimensions maps names to objects and back."""
    view = SemanticView()

    mock_implementation.get_compatible_dimensions.return_value = {mock_dimensions[1]}

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        result = view.get_compatible_dimensions(
            selected_metrics=["order_count", "missing_metric"],
            selected_dimensions=["category", "missing_dimension"],
        )

    assert result == ["category"]
    args = mock_implementation.get_compatible_dimensions.call_args.args
    assert args[0] == {mock_metrics[1]}
    assert args[1] == {mock_dimensions[1]}


# =============================================================================
# SemanticLayer.get_perm tests
# =============================================================================


def test_semantic_layer_get_perm() -> None:
    """Test SemanticLayer.get_perm() format."""
    layer = SemanticLayer()
    layer.name = "My Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    assert layer.get_perm() == "[My Layer](id:abcdef1234567890abcdef1234567890)"


def test_semantic_layer_get_perm_special_characters() -> None:
    """Test get_perm with special characters in the layer name."""
    layer = SemanticLayer()
    layer.name = "Layer [with] (parens)"
    layer.uuid = uuid.UUID("11111111-1111-1111-1111-111111111111")
    assert (
        layer.get_perm()
        == "[Layer [with] (parens)](id:11111111111111111111111111111111)"
    )


# =============================================================================
# SemanticView.raise_for_access tests
# =============================================================================


def test_semantic_view_raise_for_access_all_datasources(app: Any) -> None:
    """Test raise_for_access passes when user has all_datasource_access."""
    from superset import security_manager

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = layer.get_perm()

    view = SemanticView()
    view.semantic_layer = layer

    with patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    ):
        view.raise_for_access()


def test_semantic_view_raise_for_access_view_perm(app: Any) -> None:
    """Test raise_for_access passes when user has view-level perm."""
    from superset import security_manager

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = layer.get_perm()

    view = SemanticView()
    view.id = 1
    view.name = "My View"
    view.semantic_layer = layer
    view.perm = "[Layer].[My View](id:1)"

    with (
        patch.object(
            security_manager, "can_access_all_datasources", return_value=False
        ),
        patch.object(
            security_manager, "can_access", return_value=True
        ) as mock_can_access,
    ):
        view.raise_for_access()
        mock_can_access.assert_called_once_with(
            "datasource_access", "[Layer].[My View](id:1)"
        )


def test_semantic_view_raise_for_access_layer_perm(app: Any) -> None:
    """Test raise_for_access passes via layer perm when view perm is denied."""
    from superset import security_manager

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = layer.get_perm()

    view = SemanticView()
    view.id = 1
    view.name = "My View"
    view.semantic_layer = layer
    view.perm = "[Layer].[My View](id:1)"

    def side_effect(permission: str, perm: str) -> bool:
        # Deny view perm, allow layer perm
        return perm == layer.perm

    with (
        patch.object(
            security_manager, "can_access_all_datasources", return_value=False
        ),
        patch.object(
            security_manager, "can_access", side_effect=side_effect
        ) as mock_can_access,
    ):
        view.raise_for_access()
        assert mock_can_access.call_count == 2


def test_semantic_view_raise_for_access_denied(app: Any) -> None:
    """Test raise_for_access raises SupersetSecurityException when denied."""
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = layer.get_perm()

    view = SemanticView()
    view.id = 1
    view.name = "My View"
    view.semantic_layer = layer
    view.perm = "[Layer].[My View](id:1)"

    with (
        patch.object(
            security_manager, "can_access_all_datasources", return_value=False
        ),
        patch.object(security_manager, "can_access", return_value=False),
    ):
        with pytest.raises(SupersetSecurityException):
            view.raise_for_access()


# =============================================================================
# create_missing_perms backfill tests
# =============================================================================


def test_create_missing_perms_backfills_semantic_layer_perm(app: Any) -> None:
    """Test that create_missing_perms sets perm on layers with perm=NULL."""
    from superset import security_manager
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Backfill Layer"
    layer.uuid = uuid.UUID("aaaa1111-2222-3333-4444-555566667777")
    layer.type = "test"
    layer.perm = None  # simulate pre-existing layer without perm

    db.session.add(layer)
    db.session.flush()

    try:
        with (
            patch.object(security_manager, "_get_all_pvms", return_value=[]),
            patch.object(security_manager, "add_permission_view_menu") as mock_add_pvm,
        ):
            security_manager.create_missing_perms()

        expected_perm = "[Backfill Layer](id:aaaa1111222233334444555566667777)"
        assert layer.perm == expected_perm
        mock_add_pvm.assert_any_call("datasource_access", expected_perm)
    finally:
        db.session.rollback()


def test_create_missing_perms_backfills_semantic_view_perm(app: Any) -> None:
    """Test that create_missing_perms sets perm on views with perm=NULL."""
    from superset import security_manager
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Backfill Layer"
    layer.uuid = uuid.UUID("aaaa1111-2222-3333-4444-555566667777")
    layer.type = "test"
    layer.perm = "[Backfill Layer](id:aaaa1111222233334444555566667777)"

    view = SemanticView()
    view.name = "Backfill View"
    view.semantic_layer_uuid = layer.uuid
    view.perm = None  # simulate pre-existing view without perm

    db.session.add(layer)
    db.session.add(view)
    db.session.flush()

    try:
        with (
            patch.object(security_manager, "_get_all_pvms", return_value=[]),
            patch.object(security_manager, "add_permission_view_menu") as mock_add_pvm,
        ):
            security_manager.create_missing_perms()

        expected_perm = f"[Backfill Layer].[Backfill View](id:{view.id})"
        assert view.perm == expected_perm
        mock_add_pvm.assert_any_call("datasource_access", expected_perm)
    finally:
        db.session.rollback()


# =============================================================================
# SemanticView.get_perm with explicit layer_name
# =============================================================================


def test_semantic_view_get_perm_explicit_layer_name() -> None:
    """Test get_perm with explicit layer_name parameter."""
    view = SemanticView()
    view.id = 5
    view.name = "My View"
    view.semantic_layer = None  # type: ignore
    assert (
        view.get_perm(layer_name="Explicit Layer") == "[Explicit Layer].[My View](id:5)"
    )


# =============================================================================
# Event listener tests
# =============================================================================


def test_semantic_view_after_insert_sets_perm(app: Any) -> None:
    """Test that the after_insert event listener sets the perm column."""
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Event Layer"
    layer.uuid = uuid.UUID("eeee1111-2222-3333-4444-555566667777")
    layer.type = "test"

    view = SemanticView()
    view.name = "Event View"
    view.semantic_layer_uuid = layer.uuid

    db.session.add(layer)
    db.session.add(view)
    db.session.flush()

    try:
        assert view.perm == f"[Event Layer].[Event View](id:{view.id})"
    finally:
        db.session.rollback()


def test_semantic_view_before_update_updates_perm(app: Any) -> None:
    """Test that renaming a view updates its perm via the before_update event."""
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Update Layer"
    layer.uuid = uuid.UUID("dddd1111-2222-3333-4444-555566667777")
    layer.type = "test"

    view = SemanticView()
    view.name = "Old Name"
    view.semantic_layer_uuid = layer.uuid

    db.session.add(layer)
    db.session.add(view)
    db.session.flush()

    try:
        view.name = "New Name"
        db.session.flush()
        assert view.perm == f"[Update Layer].[New Name](id:{view.id})"
    finally:
        db.session.rollback()


def test_semantic_layer_rename_cascades_to_view_perms(app: Any) -> None:
    """Test that renaming a layer cascades the perm update to its views."""
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Old Layer"
    layer.uuid = uuid.UUID("cccc1111-2222-3333-4444-555566667777")
    layer.type = "test"

    view = SemanticView()
    view.name = "Cascade View"
    view.semantic_layer_uuid = layer.uuid

    db.session.add(layer)
    db.session.add(view)
    db.session.flush()

    assert view.perm == f"[Old Layer].[Cascade View](id:{view.id})"

    try:
        layer.name = "New Layer"
        db.session.flush()

        # Cascade update is via raw SQL, so refresh the ORM object
        db.session.refresh(view)
        assert view.perm == f"[New Layer].[Cascade View](id:{view.id})"
    finally:
        db.session.rollback()


# =============================================================================
# build_semantic_view_query dual perm tests
# =============================================================================


def test_build_semantic_view_query_view_perm_grants_access(app: Any) -> None:
    """Test that view-level perm grants access in build_semantic_view_query."""
    from superset import security_manager
    from superset.daos.datasource import DatasourceDAO
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Query Layer"
    layer.uuid = uuid.UUID("bbbb1111-2222-3333-4444-555566667777")
    layer.type = "test"

    view = SemanticView()
    view.name = "Query View"
    view.semantic_layer_uuid = layer.uuid

    db.session.add(layer)
    db.session.add(view)
    db.session.flush()

    try:
        # Only grant the view-level perm (not the layer perm)
        with (
            patch.object(
                security_manager, "can_access_all_datasources", return_value=False
            ),
            patch.object(
                security_manager,
                "user_view_menu_names",
                return_value={view.perm},
            ),
        ):
            query = DatasourceDAO.build_semantic_view_query(name_filter=None)
            results = db.session.execute(query).fetchall()

        item_ids = [row.item_id for row in results]
        assert view.id in item_ids
    finally:
        db.session.rollback()


def test_build_semantic_view_query_layer_perm_grants_access(app: Any) -> None:
    """Test that layer-level perm grants access in build_semantic_view_query."""
    from superset import security_manager
    from superset.daos.datasource import DatasourceDAO
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Query Layer 2"
    layer.uuid = uuid.UUID("aaaa2222-3333-4444-5555-666677778888")
    layer.type = "test"

    view = SemanticView()
    view.name = "Query View 2"
    view.semantic_layer_uuid = layer.uuid

    db.session.add(layer)
    db.session.add(view)
    db.session.flush()

    try:
        # Only grant the layer-level perm (not the view perm)
        with (
            patch.object(
                security_manager, "can_access_all_datasources", return_value=False
            ),
            patch.object(
                security_manager,
                "user_view_menu_names",
                return_value={layer.perm},
            ),
        ):
            query = DatasourceDAO.build_semantic_view_query(name_filter=None)
            results = db.session.execute(query).fetchall()

        item_ids = [row.item_id for row in results]
        assert view.id in item_ids
    finally:
        db.session.rollback()


def test_build_semantic_view_query_no_perm_excludes(app: Any) -> None:
    """Test that views are excluded when user has neither view nor layer perm."""
    from superset import security_manager
    from superset.daos.datasource import DatasourceDAO
    from superset.extensions import db

    layer = SemanticLayer()
    layer.name = "Query Layer 3"
    layer.uuid = uuid.UUID("aaaa3333-4444-5555-6666-777788889999")
    layer.type = "test"

    view = SemanticView()
    view.name = "Query View 3"
    view.semantic_layer_uuid = layer.uuid

    db.session.add(layer)
    db.session.add(view)
    db.session.flush()

    try:
        with (
            patch.object(
                security_manager, "can_access_all_datasources", return_value=False
            ),
            patch.object(
                security_manager,
                "user_view_menu_names",
                return_value={"[unrelated](id:xxx)"},
            ),
        ):
            query = DatasourceDAO.build_semantic_view_query(name_filter=None)
            results = db.session.execute(query).fetchall()

        item_ids = [row.item_id for row in results]
        assert view.id not in item_ids
    finally:
        db.session.rollback()
