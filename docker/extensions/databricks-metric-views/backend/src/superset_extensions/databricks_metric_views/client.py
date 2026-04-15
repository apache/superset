from __future__ import annotations

import json
import logging
from typing import Any

from databricks import sql as databricks_sql

logger = logging.getLogger(__name__)


def get_connection(
    server_hostname: str,
    http_path: str,
    access_token: str,
    catalog: str | None = None,
    schema: str | None = None,
) -> Any:
    """Create a Databricks SQL connection."""
    return databricks_sql.connect(
        server_hostname=server_hostname,
        http_path=http_path,
        access_token=access_token,
        catalog=catalog,
        schema=schema,
    )


def list_metric_views(
    server_hostname: str,
    http_path: str,
    access_token: str,
    catalog: str,
    schema: str,
    exclude_prefix: str = "conformed_dimension_",
) -> list[str]:
    """List metric view names in a given catalog.schema."""
    conn = get_connection(server_hostname, http_path, access_token)
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT table_name
            FROM system.information_schema.tables
            WHERE table_catalog = '{catalog}'
              AND table_schema = '{schema}'
              AND table_type = 'METRIC_VIEW'
              AND table_name NOT LIKE '{exclude_prefix}%'
            ORDER BY table_name
            """
        )
        return [row[0] for row in cursor.fetchall()]
    finally:
        conn.close()


def describe_metric_view(
    server_hostname: str,
    http_path: str,
    access_token: str,
    catalog: str,
    schema: str,
    view_name: str,
) -> dict[str, Any]:
    """Get the JSON description of a metric view including columns and YAML."""
    conn = get_connection(server_hostname, http_path, access_token)
    try:
        cursor = conn.cursor()
        fqn = f"{catalog}.{schema}.{view_name}"
        cursor.execute(f"DESCRIBE TABLE EXTENDED {fqn} AS JSON")
        result = cursor.fetchall()
        return json.loads(result[0][0])
    finally:
        conn.close()


def execute_metric_query(
    server_hostname: str,
    http_path: str,
    access_token: str,
    catalog: str,
    schema: str,
    view_name: str,
    query_sql: str,
) -> tuple[list[str], list[list[Any]]]:
    """
    Execute a SQL query against a metric view and return (column_names, rows).
    """
    conn = get_connection(server_hostname, http_path, access_token, catalog, schema)
    try:
        cursor = conn.cursor()
        cursor.execute(query_sql)
        columns = [desc[0] for desc in cursor.description]
        rows = [list(row) for row in cursor.fetchall()]
        return columns, rows
    finally:
        conn.close()
