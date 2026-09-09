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
    Operator,
    PredicateType,
    SemanticRequest,
    SemanticResult,
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
            verbose_name="Order date",
        ),
        Dimension(
            id="products.category",
            name="category",
            type=pa.utf8(),
            definition="products.category",
            description="Product category",
            grain=None,
            verbose_name="Category",
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
            verbose_name="Total revenue",
            d3format="$,.2f",
        ),
        Metric(
            id="orders.count",
            name="order_count",
            type=pa.int64(),
            definition="COUNT(*)",
            description="Number of orders",
            verbose_name="Order count",
            d3format=",.0f",
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
        assert metrics[0].verbose_name == "Total revenue"
        assert metrics[0].description == "Total revenue"
        assert metrics[0].d3format == "$,.2f"
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
        assert columns[0].verbose_name == "Order date"
        assert columns[0].description == "Date of the order"
        assert columns[1].column_name == "category"
        assert columns[1].type == "string"
        assert columns[1].is_dttm is False
        assert columns[1].verbose_name == "Category"


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
        assert data["columns"][0]["verbose_name"] == "Order date"
        assert data["columns"][1]["column_name"] == "category"
        assert data["columns"][1]["type"] == "string"
        assert data["columns"][1]["type_generic"] == GenericDataType.STRING
        assert data["columns"][1]["verbose_name"] == "Category"

        # Check metrics
        assert len(data["metrics"]) == 2
        assert data["metrics"][0]["metric_name"] == "revenue"
        assert data["metrics"][0]["expression"] == "SUM(orders.amount)"
        assert data["metrics"][0]["verbose_name"] == "Total revenue"
        assert data["metrics"][0]["d3format"] == "$,.2f"
        assert data["metrics"][1]["metric_name"] == "order_count"
        assert data["metrics"][1]["verbose_name"] == "Order count"
        assert data["metrics"][1]["d3format"] == ",.0f"

        assert data["verbose_map"] == {
            "revenue": "Total revenue",
            "order_count": "Order count",
            "order_date": "Order date",
            "category": "Category",
        }
        assert data["column_formats"] == {
            "revenue": "$,.2f",
            "order_count": ",.0f",
        }

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
        # Semantic views don't model raw rows, so neither samples nor
        # drill-to-detail are available.
        assert data["supports_samples"] is False
        assert data["supports_drill_to_detail"] is False


def test_semantic_view_supports_samples_is_false() -> None:
    """The class-level flag opts SemanticView out of the Samples affordance."""
    assert SemanticView.supports_samples is False


@pytest.fixture
def mock_grain_variant_dimensions() -> list[Dimension]:
    """Time column exposed as multiple Dimension variants, one per grain."""
    base = {
        "id": "orders.created_at",
        "name": "created_at",
        "type": pa.timestamp("us"),
        "definition": "orders.created_at",
        "description": "Order timestamp",
    }
    return [
        Dimension(**base, grain=Grains.HOUR),
        Dimension(**base, grain=Grains.DAY),
        Dimension(**base, grain=Grains.MONTH),
        Dimension(
            id="products.category",
            name="category",
            type=pa.utf8(),
            definition="products.category",
            description="Product category",
            grain=None,
        ),
    ]


def test_semantic_view_columns_dedupes_grain_variants(
    mock_grain_variant_dimensions: list[Dimension],
) -> None:
    """Multiple grain variants of the same time column collapse to one column."""
    impl = MagicMock()
    impl.get_dimensions.return_value = mock_grain_variant_dimensions
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: impl),
    ):
        columns = view.columns
        assert [c.column_name for c in columns] == ["created_at", "category"]
        assert columns[0].is_dttm is True
        assert view.column_names == ["created_at", "category"]


def test_semantic_view_get_time_grains_dedupes_across_dimensions(
    mock_grain_variant_dimensions: list[Dimension],
) -> None:
    """Grains shared across multiple time dimensions are returned once each."""
    extra_dim = Dimension(
        id="shipments.shipped_at",
        name="shipped_at",
        type=pa.timestamp("us"),
        definition="shipments.shipped_at",
        description=None,
        grain=Grains.DAY,
    )
    impl = MagicMock()
    impl.get_dimensions.return_value = mock_grain_variant_dimensions + [extra_dim]
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: impl),
    ):
        grains = view.get_time_grains()

    durations = sorted(grain["duration"] or "" for grain in grains)
    assert durations == sorted(["PT1H", "P1D", "P1M"])


def test_semantic_view_data_populates_time_grain_sqla(
    mock_grain_variant_dimensions: list[Dimension],
    mock_metrics: list[Metric],
) -> None:
    """``data['time_grain_sqla']`` mirrors ``get_time_grains`` for the explore UI."""
    from superset.semantic_layers.models import SemanticLayer

    impl = MagicMock()
    impl.get_dimensions.return_value = mock_grain_variant_dimensions
    impl.get_metrics.return_value = mock_metrics
    impl.uid.return_value = "semantic_view_uid_123"

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
        new_callable=lambda: property(lambda s: impl),
    ):
        data = view.data

    assert data["column_names"] == ["created_at", "category"]
    assert len(data["columns"]) == 2
    assert data["columns"][0]["is_dttm"] is True
    # ``time_grain_sqla`` in ExplorableData is ``(duration, name)`` tuples.
    grain_durations = sorted(entry[0] for entry in data["time_grain_sqla"])
    assert grain_durations == sorted(["PT1H", "P1D", "P1M"])


def test_semantic_view_supports_drill_to_detail_is_false() -> None:
    """The class-level flag opts SemanticView out of Drill to detail."""
    assert SemanticView.supports_drill_to_detail is False


def test_semantic_view_get_query_result(
    mock_implementation: MagicMock,
) -> None:
    """Test SemanticView get_query_result method."""
    view = SemanticView()

    mock_query_object = MagicMock()
    mock_query_object.post_processing = []
    mock_result = MagicMock()

    with patch(
        "superset.semantic_layers.models.get_results",
        return_value=mock_result,
    ) as mock_get_results:
        result = view.get_query_result(mock_query_object)

        mock_get_results.assert_called_once_with(mock_query_object)
        mock_query_object.exec_post_processing.assert_not_called()
        assert result == mock_result


def test_semantic_view_get_query_result_runs_post_processing(
    mock_implementation: MagicMock,
) -> None:
    """
    ``get_query_result`` must run ``query_object.exec_post_processing`` so that
    features like ``percent_metrics`` (contribution) are applied to the semantic
    layer's DataFrame — matching the dataset flow in
    ``superset/models/helpers.py``.
    """
    import pandas as pd

    view = SemanticView()

    input_df = pd.DataFrame({"Orders Count": [40000.0]})
    processed_df = pd.DataFrame({"Orders Count": [40000.0], "%Orders Count": [1.0]})

    mock_query_object = MagicMock()
    mock_query_object.post_processing = [
        {
            "operation": "contribution",
            "options": {
                "columns": ["Orders Count"],
                "rename_columns": ["%Orders Count"],
            },
        }
    ]
    mock_query_object.exec_post_processing.return_value = processed_df

    mock_result = MagicMock()
    mock_result.df = input_df

    with patch(
        "superset.semantic_layers.models.get_results",
        return_value=mock_result,
    ):
        result = view.get_query_result(mock_query_object)

    mock_query_object.exec_post_processing.assert_called_once_with(input_df)
    assert result is mock_result
    assert list(result.df.columns) == ["Orders Count", "%Orders Count"]


def test_semantic_view_get_query_result_wraps_post_processing_errors(
    mock_implementation: MagicMock,
) -> None:
    """
    ``InvalidPostProcessingError`` raised from post-processing must be re-raised
    as ``QueryObjectValidationError`` so the API surfaces a clean 400 rather
    than a 500.
    """
    import pandas as pd

    from superset.exceptions import (
        InvalidPostProcessingError,
        QueryObjectValidationError,
    )

    view = SemanticView()

    mock_query_object = MagicMock()
    mock_query_object.post_processing = [{"operation": "bogus"}]
    mock_query_object.exec_post_processing.side_effect = InvalidPostProcessingError(
        "boom"
    )

    mock_result = MagicMock()
    mock_result.df = pd.DataFrame({"count": [1]})

    with (
        patch(
            "superset.semantic_layers.models.get_results",
            return_value=mock_result,
        ),
        pytest.raises(QueryObjectValidationError, match="boom"),
    ):
        view.get_query_result(mock_query_object)


def test_semantic_view_get_query_result_skips_post_processing_on_empty_df(
    mock_implementation: MagicMock,
) -> None:
    """
    Match the dataset flow's guard: skip post-processing when the DataFrame is
    empty. Contribution and other ops assume at least one row.
    """
    import pandas as pd

    view = SemanticView()

    mock_query_object = MagicMock()
    mock_query_object.post_processing = [{"operation": "contribution"}]

    mock_result = MagicMock()
    mock_result.df = pd.DataFrame()

    with patch(
        "superset.semantic_layers.models.get_results",
        return_value=mock_result,
    ):
        result = view.get_query_result(mock_query_object)

    mock_query_object.exec_post_processing.assert_not_called()
    assert result is mock_result


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
# SemanticLayer.raise_for_access tests
# =============================================================================


def test_semantic_layer_raise_for_access_all_datasources(app: Any) -> None:
    """Test raise_for_access passes when user has all_datasource_access."""
    from superset import security_manager

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = layer.get_perm()

    with patch.object(
        security_manager, "can_access_all_datasources", return_value=True
    ):
        layer.raise_for_access()


def test_semantic_layer_raise_for_access_perm(app: Any) -> None:
    """Test raise_for_access passes when user has datasource_access to the
    layer's perm."""
    from superset import security_manager

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = layer.get_perm()

    with (
        patch.object(
            security_manager, "can_access_all_datasources", return_value=False
        ),
        patch.object(
            security_manager, "can_access", return_value=True
        ) as mock_can_access,
    ):
        layer.raise_for_access()
        mock_can_access.assert_called_once_with("datasource_access", layer.perm)


def test_semantic_layer_raise_for_access_denied(app: Any) -> None:
    """Test raise_for_access raises SupersetSecurityException when denied."""
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = layer.get_perm()

    with (
        patch.object(
            security_manager, "can_access_all_datasources", return_value=False
        ),
        patch.object(security_manager, "can_access", return_value=False),
    ):
        with pytest.raises(SupersetSecurityException):
            layer.raise_for_access()


def test_semantic_layer_raise_for_access_no_perm_denied(app: Any) -> None:
    """Test raise_for_access raises SupersetSecurityException when the layer
    has no perm set, without even attempting a datasource_access check."""
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException

    layer = SemanticLayer()
    layer.name = "Layer"
    layer.uuid = uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890")
    layer.perm = None

    with (
        patch.object(
            security_manager, "can_access_all_datasources", return_value=False
        ),
        patch.object(security_manager, "can_access") as mock_can_access,
    ):
        with pytest.raises(SupersetSecurityException):
            layer.raise_for_access()
        mock_can_access.assert_not_called()


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


def test_semantic_layer_after_delete_calls_security_manager() -> None:
    """Test SemanticLayer.after_delete delegates to security manager."""
    from superset import security_manager

    mapper = MagicMock()
    connection = MagicMock()
    target = MagicMock(spec=SemanticLayer)

    with patch.object(security_manager, "semantic_layer_after_delete") as mock_hook:
        SemanticLayer.after_delete(mapper, connection, target)

    mock_hook.assert_called_once_with(mapper, connection, target)


def test_semantic_view_after_delete_calls_security_manager() -> None:
    """Test SemanticView.after_delete delegates to security manager."""
    from superset import security_manager

    mapper = MagicMock()
    connection = MagicMock()
    target = MagicMock(spec=SemanticView)

    with patch.object(security_manager, "semantic_view_after_delete") as mock_hook:
        SemanticView.after_delete(mapper, connection, target)

    mock_hook.assert_called_once_with(mapper, connection, target)


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


def _values_result(values: list[Any], name: str = "category") -> SemanticResult:
    return SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table({name: pa.array(values)}),
    )


def test_values_for_column_delegates_to_get_values_sorted_and_limited(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """The provider ABC's purpose-built get_values is the fetch; the host
    sorts ascending and truncates, so the page is deterministic rather than
    an arbitrary provider-order subset."""
    view = SemanticView()
    mock_implementation.get_values.return_value = _values_result(
        ["Electronics", "Books", "Clothing"]
    )

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.values_for_column("category", limit=2) == ["Books", "Clothing"]

    mock_implementation.get_values.assert_called_once_with(mock_dimensions[1], None)
    mock_implementation.get_table.assert_not_called()


def test_values_for_column_dataset_endpoint_flags_are_ignored(
    mock_implementation: MagicMock,
) -> None:
    """denormalize_column/array_elements are accepted for endpoint signature
    compatibility and change nothing."""
    view = SemanticView()
    mock_implementation.get_values.return_value = _values_result(["x"])

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.values_for_column(
            "category", denormalize_column=True, array_elements=True
        ) == ["x"]


def test_values_for_column_unknown_column_and_metric_raise_key_error(
    mock_implementation: MagicMock,
) -> None:
    """Unknown names — metric names included — are the caller's error; the
    endpoint maps KeyError to a 400 naming the column."""
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        with pytest.raises(KeyError):
            view.values_for_column("no_such_column")
        with pytest.raises(KeyError):
            view.values_for_column("revenue")
    mock_implementation.get_values.assert_not_called()


def test_values_for_column_empty_and_none_results_return_empty_list(
    mock_implementation: MagicMock,
) -> None:
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        mock_implementation.get_values.return_value = _values_result([])
        assert view.values_for_column("category") == []

        mock_implementation.get_values.return_value = SemanticResult(
            requests=[SemanticRequest(type="SQL", definition="values query")],
            results=None,
        )
        assert view.values_for_column("category") == []


def test_values_for_column_nulls_sort_first_and_numbers_survive(
    mock_implementation: MagicMock,
) -> None:
    """Non-text values arrive JSON-safe and typed; arrow nulls become None
    and sort ahead of values."""
    view = SemanticView()
    mock_implementation.get_values.return_value = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table({"category": pa.array([3.0, None, 1.5])}),
    )

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.values_for_column("category") == [None, 1.5, 3.0]


def test_values_for_column_single_unnamed_column_is_accepted(
    mock_implementation: MagicMock,
) -> None:
    """get_values contracts a single-column table; a provider that names the
    column differently still works when there is exactly one column."""
    view = SemanticView()
    mock_implementation.get_values.return_value = _values_result(["x"], name="anything")

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.values_for_column("category") == ["x"]


def test_values_for_column_ambiguous_result_is_a_server_error(
    mock_implementation: MagicMock,
) -> None:
    """A multi-column result without the dimension is not the caller's 400."""
    view = SemanticView()
    mock_implementation.get_values.return_value = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table({"a": pa.array(["x"]), "b": pa.array(["y"])}),
    )

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        with pytest.raises(ValueError, match="category"):
            view.values_for_column("category")


@pytest.mark.parametrize("reverse", [False, True])
def test_values_for_column_uses_grain_collapsed_dimensions(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    reverse: bool,
) -> None:
    """Grain variants share a name; the values fetch uses the same collapsed
    dimension that columns/column_names present to the picker, and the pick
    must not depend on ``get_dimensions()`` iteration order — the ABC returns
    a set. The least-aggregated variant wins: DAY-truncated values beat
    MONTH-truncated ones as suggestions. Both orders assert the same pick."""
    variant = Dimension(
        id="orders.order_date",
        name="order_date",
        type=pa.date32(),
        definition="orders.order_date",
        grain=Grains.MONTH,
    )
    dims = [*mock_dimensions, variant]
    if reverse:
        dims = list(reversed(dims))
    mock_implementation.get_dimensions.return_value = dims
    mock_implementation.get_values.return_value = _values_result([], name="order_date")
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        view.values_for_column("order_date")

    assert mock_implementation.get_values.call_args.args[0] == mock_dimensions[0]


@pytest.mark.parametrize("reverse", [False, True])
def test_values_for_column_prefers_the_unaggregated_variant(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
    reverse: bool,
) -> None:
    """When a name has an unaggregated variant (``grain is None``) alongside
    grained ones, the unaggregated one is the suggestion source, whatever
    order the provider's set iterates in."""
    unaggregated = Dimension(
        id="orders.order_date",
        name="order_date",
        type=pa.date32(),
        definition="orders.order_date",
        grain=None,
    )
    monthly = Dimension(
        id="orders.order_date",
        name="order_date",
        type=pa.date32(),
        definition="orders.order_date",
        grain=Grains.MONTH,
    )
    dims = [*mock_dimensions, monthly, unaggregated]
    if reverse:
        dims = list(reversed(dims))
    mock_implementation.get_dimensions.return_value = dims
    mock_implementation.get_values.return_value = _values_result([], name="order_date")
    view = SemanticView()

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        view.values_for_column("order_date")

    assert mock_implementation.get_values.call_args.args[0] == unaggregated


def test_values_for_column_sorts_struct_values_without_error(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """A STRUCT-typed dimension arrives as Python dicts, which have no natural
    order; the sort must fall back to a deterministic canonical order instead
    of raising TypeError, keeping nulls first."""
    view = SemanticView()
    mock_implementation.get_values.return_value = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table(
            {
                "category": pa.array(
                    [{"code": "b", "n": 2}, None, {"code": "a", "n": 1}],
                    type=pa.struct([("code", pa.string()), ("n", pa.int64())]),
                )
            }
        ),
    )

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        values = view.values_for_column("category")

    # Exact expected order: nulls first, then canonical-string order of
    # the dicts (json.dumps with sorted keys puts code "a" before "b").
    assert values == [None, {"code": "a", "n": 1}, {"code": "b", "n": 2}]


def test_values_for_column_sorts_list_values_with_null_elements(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """A LIST-typed dimension can hold null ELEMENTS inside the arrays;
    comparing [None, "a"] with ["a"] raises TypeError under natural ordering,
    so the fallback order must apply. Whole-null values still sort first."""
    view = SemanticView()
    mock_implementation.get_values.return_value = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table(
            {
                "category": pa.array(
                    [[None, "a"], None, ["a"], ["b", None]],
                    type=pa.list_(pa.string()),
                )
            }
        ),
    )

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        values = view.values_for_column("category")

    assert values[0] is None
    assert len(values) == 4
    assert [None, "a"] in values
    assert ["a"] in values
    assert ["b", None] in values


def test_values_for_column_normalizes_non_finite_floats(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """NaN and Infinity in a numeric dimension must become None before the
    result leaves the model: emitted raw they render the endpoint's body as
    invalid strict JSON (browsers' JSON.parse throws and the picker silently
    empties -- the exact failure class this feature exists to kill), and NaN
    defeats the ascending sort (every comparison is False). Datasets guard
    the same edge by replacing NaN with None after the query."""
    view = SemanticView()
    mock_implementation.get_values.return_value = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table(
            {
                "category": pa.array(
                    [1.5, float("nan"), 0.5, float("inf"), float("-inf"), None],
                    type=pa.float64(),
                )
            }
        ),
    )

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        values = view.values_for_column("category")

    # Non-finite floats collapse to None alongside the real null: nulls
    # first, finite values in ascending order, everything JSON-safe.
    assert values == [None, None, None, None, 0.5, 1.5]
    assert all(v is None or isinstance(v, float) for v in values)


def test_values_for_column_scalar_sort_unchanged(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Scalar dimensions keep the natural ascending order, nulls first --
    the fallback must not engage for orderable values."""
    view = SemanticView()
    mock_implementation.get_values.return_value = _values_result(["10", "2", None, "1"])

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        # Natural string order: "1" < "10" < "2" (not the fallback's order
        # of the same strings, which would coincide here, but the nulls-first
        # natural contract is what the endpoint tests already pin).
        assert view.values_for_column("category") == [None, "1", "10", "2"]


def test_semantic_view_normalize_columns_is_false() -> None:
    assert SemanticView().normalize_columns is False


def test_values_for_column_search_narrows_at_the_provider(
    mock_implementation: MagicMock,
    mock_dimensions: list[Dimension],
) -> None:
    """Search text becomes a containment LIKE filter, so values beyond the
    bounded first page are findable. The filter model cannot declare an escape
    character, so wildcards pass through: over-matching is the safe failure
    for suggestions."""
    view = SemanticView()
    mock_implementation.get_values.return_value = _values_result(["Books"])

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        assert view.values_for_column("category", search="oo%k_") == ["Books"]

    dimension, filters = mock_implementation.get_values.call_args.args
    assert dimension == mock_dimensions[1]
    (narrowing,) = filters
    assert narrowing.type is PredicateType.WHERE
    assert narrowing.column == mock_dimensions[1]
    assert narrowing.operator is Operator.LIKE
    assert narrowing.value == "%oo%k_%"


def test_values_for_column_search_rejection_falls_back_unfiltered(
    mock_implementation: MagicMock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A provider that rejects the narrowing filter degrades to the bounded
    unfiltered page — logged, never an error and never silent."""
    view = SemanticView()
    mock_implementation.get_values.side_effect = [
        RuntimeError("LIKE unsupported on this dimension"),
        _values_result(["Books", "Clothing"]),
    ]

    with patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: mock_implementation),
    ):
        with caplog.at_level("WARNING"):
            values = view.values_for_column("category", search="oo")

    assert values == ["Books", "Clothing"]
    assert mock_implementation.get_values.call_count == 2
    assert mock_implementation.get_values.call_args.args[1] is None
    assert "rejected the value-search filter" in caplog.text
    assert "category" in caplog.text
