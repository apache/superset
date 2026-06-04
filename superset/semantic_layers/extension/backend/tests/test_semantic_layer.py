# flake8: noqa: E501

from unittest.mock import MagicMock

import pytest
from preset_io.dataset_semantic_layer import (
    DatasetConfiguration,
    DatasetSemanticLayer,
    DatasetSemanticView,
)


@pytest.fixture
def dataset() -> MagicMock:
    db = MagicMock()
    db.db_engine_spec.engine = "postgresql"
    ds = MagicMock(spec=[])
    ds.id = 1
    ds.table_name = "orders"
    ds.schema = "public"
    ds.catalog = None
    ds.sql = None
    ds.database = db
    ds.columns = []
    ds.metrics = []
    return ds


def test_empty_configuration_schema() -> None:
    schema = DatasetSemanticLayer.get_configuration_schema()
    # No required fields — adding the layer takes zero input.
    assert schema.get("required", []) == []
    assert schema["properties"] == {}


def test_runtime_schema_exposes_dataset_dropdown(mocker, dataset: MagicMock) -> None:
    mocker.patch(
        "preset_io.dataset_semantic_layer.layer.list_datasets",
        return_value=[dataset],
    )
    schema = DatasetSemanticLayer.get_runtime_schema(DatasetConfiguration())

    assert schema["required"] == ["dataset_id"]
    field = schema["properties"]["dataset_id"]
    assert field["enum"] == ["1"]
    assert field["x-enumNames"] == ["public.orders"]


def test_get_semantic_view_requires_dataset_id() -> None:
    layer = DatasetSemanticLayer.from_configuration({})
    with pytest.raises(ValueError, match="dataset_id"):
        layer.get_semantic_view("orders", {})


def test_get_semantic_view_returns_dataset_view(mocker, dataset: MagicMock) -> None:
    mocker.patch(
        "preset_io.dataset_semantic_layer.layer.get_dataset_by_id",
        return_value=dataset,
    )
    layer = DatasetSemanticLayer.from_configuration({})
    view = layer.get_semantic_view("orders", {"dataset_id": "1"})

    assert isinstance(view, DatasetSemanticView)
    assert view.uid() == "dataset:1"
