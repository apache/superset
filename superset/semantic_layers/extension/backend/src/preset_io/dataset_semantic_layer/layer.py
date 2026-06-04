from __future__ import annotations

from typing import Any

from superset_core.semantic_layers.config import build_configuration_schema
from superset_core.semantic_layers.decorators import semantic_layer
from superset_core.semantic_layers.layer import SemanticLayer

from .schemas import DatasetConfiguration
from .utils import dataset_label, get_dataset_by_id, list_datasets
from .view import DatasetSemanticView


@semantic_layer(
    id="dataset",
    name="Dataset Semantic Layer",
    description=(
        "Expose any Superset dataset as a semantic view. Metrics and columns "
        "defined on the dataset become the semantic metrics and dimensions."
    ),
)
class DatasetSemanticLayer(SemanticLayer[DatasetConfiguration, DatasetSemanticView]):
    configuration_class = DatasetConfiguration

    @classmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
    ) -> "DatasetSemanticLayer":
        config = DatasetConfiguration.model_validate(configuration or {})
        return cls(config)

    @classmethod
    def get_configuration_schema(
        cls,
        configuration: DatasetConfiguration | None = None,
    ) -> dict[str, Any]:
        """
        No configuration is needed to add this semantic layer — the layer wraps
        whatever datasets are already registered in Superset.
        """
        return build_configuration_schema(DatasetConfiguration, configuration)

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: DatasetConfiguration,
        runtime_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        When adding a semantic view, the user picks a dataset from a dropdown.
        Each existing dataset can be wrapped into a semantic view.
        """
        datasets = list_datasets()
        ids = [str(dataset.id) for dataset in datasets]
        labels = [dataset_label(dataset) for dataset in datasets]

        return {
            "type": "object",
            "required": ["dataset_id"],
            "x-singleView": True,
            "properties": {
                "dataset_id": {
                    "type": "string",
                    "title": "Dataset",
                    "description": "The Superset dataset to expose as a semantic view.",
                    "enum": ids,
                    "x-enumNames": labels,
                },
            },
        }

    def __init__(self, configuration: DatasetConfiguration) -> None:
        self.configuration = configuration

    def get_semantic_views(
        self,
        runtime_configuration: dict[str, Any],
    ) -> set[DatasetSemanticView]:
        dataset_id = runtime_configuration.get("dataset_id")
        if not dataset_id:
            return set()
        dataset = get_dataset_by_id(int(dataset_id))
        return {DatasetSemanticView(dataset)}

    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> DatasetSemanticView:
        dataset_id = additional_configuration.get("dataset_id")
        if not dataset_id:
            raise ValueError("dataset_id is required to load a semantic view")
        dataset = get_dataset_by_id(int(dataset_id))
        return DatasetSemanticView(dataset)
