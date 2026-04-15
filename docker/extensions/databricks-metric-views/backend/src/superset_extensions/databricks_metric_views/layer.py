from __future__ import annotations

from typing import Any

from superset_core.semantic_layers.decorators import semantic_layer
from superset_core.semantic_layers.layer import SemanticLayer

from databricks_metric_views.client import list_metric_views
from databricks_metric_views.schemas import DatabricksConfiguration
from databricks_metric_views.view import DatabricksMetricView


@semantic_layer(
    id="databricks-metric-views",
    name="Databricks Metric Views",
    description="Unity Catalog metric views from Databricks.",
)
class DatabricksMetricViewsLayer(
    SemanticLayer[DatabricksConfiguration, DatabricksMetricView]
):
    configuration_class = DatabricksConfiguration

    @classmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
    ) -> DatabricksMetricViewsLayer:
        config = DatabricksConfiguration.model_validate(configuration)
        return cls(config)

    @classmethod
    def get_configuration_schema(
        cls,
        configuration: DatabricksConfiguration | None = None,
    ) -> dict[str, Any]:
        return DatabricksConfiguration.model_json_schema()

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: DatabricksConfiguration,
        runtime_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {"type": "object", "properties": {}}

    def __init__(self, configuration: DatabricksConfiguration):
        self.configuration = configuration

    def get_semantic_views(
        self,
        runtime_configuration: dict[str, Any],
    ) -> set[DatabricksMetricView]:
        cfg = self.configuration
        view_names = list_metric_views(
            cfg.server_hostname,
            cfg.http_path,
            cfg.access_token,
            cfg.catalog,
            cfg.schema_name,
        )
        return {
            DatabricksMetricView(
                view_name=name,
                server_hostname=cfg.server_hostname,
                http_path=cfg.http_path,
                access_token=cfg.access_token,
                catalog=cfg.catalog,
                schema=cfg.schema_name,
            )
            for name in view_names
        }

    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> DatabricksMetricView:
        cfg = self.configuration
        return DatabricksMetricView(
            view_name=name,
            server_hostname=cfg.server_hostname,
            http_path=cfg.http_path,
            access_token=cfg.access_token,
            catalog=cfg.catalog,
            schema=cfg.schema_name,
        )
