from __future__ import annotations

from pydantic import BaseModel, Field


class DatabricksConfiguration(BaseModel):
    """
    Configuration for the Databricks Metric Views semantic layer.
    """

    server_hostname: str = Field(
        description="Databricks workspace hostname (e.g., myworkspace.cloud.databricks.com)",
    )
    http_path: str = Field(
        description="HTTP path for the SQL warehouse (e.g., /sql/1.0/warehouses/abc123)",
    )
    access_token: str = Field(
        description="Databricks personal access token",
        json_schema_extra={"writeOnly": True},
    )
    catalog: str = Field(
        description="Unity Catalog name containing the metric views",
    )
    schema_name: str = Field(
        alias="schema",
        description="Schema name containing the metric views",
    )
