from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

import pyarrow as pa
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    Metric,
    Operator,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature

from databricks_metric_views.client import (
    describe_metric_view,
    execute_metric_query,
)

logger = logging.getLogger(__name__)

REQUEST_TYPE = "databricks_sql"

# Mapping from Databricks type names to PyArrow types
_TYPE_MAP: dict[str, pa.DataType] = {
    "string": pa.utf8(),
    "int": pa.int32(),
    "bigint": pa.int64(),
    "long": pa.int64(),
    "float": pa.float32(),
    "double": pa.float64(),
    "decimal": pa.decimal128(38, 10),
    "boolean": pa.bool_(),
    "date": pa.date32(),
    "timestamp": pa.timestamp("us"),
    "binary": pa.binary(),
    "short": pa.int16(),
    "byte": pa.int8(),
}


def _to_arrow_type(db_type: dict[str, Any]) -> pa.DataType:
    """Convert Databricks column type dict to a PyArrow type."""
    name = db_type.get("name", "string")
    if name.startswith("decimal"):
        precision = db_type.get("precision", 38)
        scale = db_type.get("scale", 10)
        return pa.decimal128(precision, scale)
    return _TYPE_MAP.get(name, pa.utf8())


class DatabricksMetricView(SemanticView):
    features = frozenset({SemanticViewFeature.GROUP_LIMIT})

    def __init__(
        self,
        view_name: str,
        server_hostname: str,
        http_path: str,
        access_token: str,
        catalog: str,
        schema: str,
    ):
        self.name = view_name
        self.view_name = view_name
        self.server_hostname = server_hostname
        self.http_path = http_path
        self.access_token = access_token
        self.catalog = catalog
        self.schema = schema

        self._fqn = f"{catalog}.{schema}.{view_name}"

        # Parse metadata from DESCRIBE TABLE EXTENDED
        desc = describe_metric_view(
            server_hostname, http_path, access_token, catalog, schema, view_name
        )
        self._parse_columns(desc)

    def _parse_columns(self, desc: dict[str, Any]) -> None:
        """Parse columns from DESCRIBE TABLE EXTENDED AS JSON output."""
        dims: set[Dimension] = set()
        mets: set[Metric] = set()

        for col in desc.get("columns", []):
            col_name = col["name"]
            col_type = _to_arrow_type(col.get("type", {}))
            comment = col.get("comment")
            display_name = col.get("metadata", {}).get("display_name", col_name)
            is_measure = col.get("is_measure", False)

            col_id = f"{self.view_name}.{col_name}"

            if is_measure:
                mets.add(
                    Metric(
                        id=col_id,
                        name=col_name,
                        type=col_type,
                        definition=f"MEASURE({col_name})",
                        description=display_name + (f": {comment}" if comment else ""),
                    )
                )
            else:
                dims.add(
                    Dimension(
                        id=col_id,
                        name=col_name,
                        type=col_type,
                        description=display_name + (f": {comment}" if comment else ""),
                    )
                )

        self.dimensions = dims
        self.metrics = mets

    def uid(self) -> str:
        return f"databricks.{self._fqn}"

    def get_dimensions(self) -> set[Dimension]:
        return self.dimensions

    def get_metrics(self) -> set[Metric]:
        return self.metrics

    def get_compatible_metrics(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[Dimension],
    ) -> set[Metric]:
        return self.metrics

    def get_compatible_dimensions(
        self,
        selected_metrics: set[Metric],
        selected_dimensions: set[Dimension],
    ) -> set[Dimension]:
        return self.dimensions

    def get_values(
        self,
        dimension: Dimension,
        filters: set[Filter] | None = None,
    ) -> SemanticResult:
        where_clause = self._build_where(filters) if filters else ""
        query_sql = (
            f"SELECT DISTINCT `{dimension.name}` "
            f"FROM {self._fqn} "
            f"{where_clause} "
            f"ORDER BY `{dimension.name}` LIMIT 1000"
        )

        columns, rows = execute_metric_query(
            self.server_hostname,
            self.http_path,
            self.access_token,
            self.catalog,
            self.schema,
            self.view_name,
            query_sql,
        )
        result_table = self._rows_to_arrow(columns, rows)
        return SemanticResult(
            requests=[SemanticRequest(REQUEST_TYPE, query_sql)],
            results=result_table,
        )

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        metrics = query.metrics
        dimensions = query.dimensions
        filters = query.filters
        order = query.order
        limit = query.limit
        offset = query.offset

        if not metrics and not dimensions:
            return SemanticResult(requests=[], results=pa.table({}))

        # Build SELECT clause
        select_parts: list[str] = []
        for dim in dimensions:
            select_parts.append(f"`{dim.name}`")
        for met in metrics:
            select_parts.append(f"MEASURE(`{met.name}`) AS `{met.name}`")

        select_clause = ", ".join(select_parts)

        # Build WHERE clause
        where_clause = self._build_where(filters) if filters else ""

        # Build GROUP BY
        group_by = "GROUP BY ALL" if dimensions and metrics else ""

        # Build ORDER BY
        order_clause = ""
        if order:
            order_parts = []
            for element, direction in order:
                if isinstance(element, (Dimension, Metric)):
                    order_parts.append(f"`{element.name}` {direction.value}")
            if order_parts:
                order_clause = "ORDER BY " + ", ".join(order_parts)

        # Build LIMIT/OFFSET
        limit_clause = f"LIMIT {limit}" if limit is not None else ""
        offset_clause = f"OFFSET {offset}" if offset else ""

        query_sql = (
            f"SELECT {select_clause} "
            f"FROM {self._fqn} "
            f"{where_clause} "
            f"{group_by} "
            f"{order_clause} "
            f"{limit_clause} "
            f"{offset_clause}"
        ).strip()

        columns, rows = execute_metric_query(
            self.server_hostname,
            self.http_path,
            self.access_token,
            self.catalog,
            self.schema,
            self.view_name,
            query_sql,
        )
        result_table = self._rows_to_arrow(columns, rows)
        return SemanticResult(
            requests=[SemanticRequest(REQUEST_TYPE, query_sql)],
            results=result_table,
        )

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        # Wrap the main query in a COUNT(*)
        inner_result = self.get_table(query)
        count = inner_result.results.num_rows
        return SemanticResult(
            requests=inner_result.requests,
            results=pa.table({"COUNT": [count]}),
        )

    def _build_where(self, filters: set[Filter] | None) -> str:
        """Build a WHERE clause from a set of filters."""
        if not filters:
            return ""

        conditions: list[str] = []
        for f in filters:
            if f.operator == Operator.ADHOC:
                continue
            if f.type != PredicateType.WHERE:
                continue
            if f.column is None:
                continue

            col = f"`{f.column.name}`"
            op = f.operator.value

            if f.operator == Operator.IS_NULL:
                conditions.append(f"{col} IS NULL")
            elif f.operator == Operator.IS_NOT_NULL:
                conditions.append(f"{col} IS NOT NULL")
            elif f.operator in (Operator.IN, Operator.NOT_IN):
                if isinstance(f.value, (set, frozenset)):
                    vals = ", ".join(self._format_value(v) for v in f.value)
                else:
                    vals = self._format_value(f.value)
                conditions.append(f"{col} {op} ({vals})")
            else:
                val = self._format_value(f.value)
                conditions.append(f"{col} {op} {val}")

        if not conditions:
            return ""
        return "WHERE " + " AND ".join(conditions)

    @staticmethod
    def _format_value(val: Any) -> str:
        """Format a filter value for SQL, quoting strings and datetimes."""
        if isinstance(val, datetime):
            return f"'{val.strftime('%Y-%m-%d %H:%M:%S')}'"
        if isinstance(val, date):
            return f"'{val.strftime('%Y-%m-%d')}'"
        if isinstance(val, str):
            return f"'{val}'"
        return str(val)

    def _rows_to_arrow(self, columns: list[str], rows: list[list[Any]]) -> pa.Table:
        """Convert column names + rows to a PyArrow Table."""
        if not rows:
            # Return empty table with correct column names
            return pa.table({col: [] for col in columns})

        data: dict[str, list[Any]] = {col: [] for col in columns}
        for row in rows:
            for col, val in zip(columns, row):
                data[col].append(val)
        return pa.table(data)

    __repr__ = uid
