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

# ruff: noqa: S608

from __future__ import annotations

import itertools
import re
from collections import defaultdict
from textwrap import dedent

from pandas import DataFrame
from snowflake.connector import connect, DictCursor
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

from superset.semantic_layers.snowflake.schemas import SnowflakeConfiguration
from superset.semantic_layers.snowflake.utils import (
    get_connection_parameters,
    substitute_parameters,
    validate_order_by,
)
from superset.semantic_layers.types import (
    AdhocExpression,
    AdhocFilter,
    BINARY,
    BOOLEAN,
    DATE,
    DATETIME,
    DECIMAL,
    Dimension,
    Filter,
    FilterValues,
    GroupLimit,
    INTEGER,
    Metric,
    NUMBER,
    OBJECT,
    Operator,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticRequest,
    SemanticResult,
    SemanticViewFeature,
    SemanticViewImplementation,
    STRING,
    TIME,
    Type,
)

REQUEST_TYPE = "snowflake"


class SnowflakeSemanticView(SemanticViewImplementation):
    features = frozenset(
        {
            SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY,
            SemanticViewFeature.GROUP_LIMIT,
            SemanticViewFeature.GROUP_OTHERS,
        }
    )

    def __init__(self, name: str, configuration: SnowflakeConfiguration):
        self.configuration = configuration
        self.name = name

        self._quote = SnowflakeDialect().identifier_preparer.quote

        self.dimensions = self.get_dimensions()
        self.metrics = self.get_metrics()

    def uid(self) -> str:
        return ".".join(
            self._quote(part)
            for part in (
                self.configuration.database,
                self.configuration.schema_,
                self.name,
            )
        )

    def get_dimensions(self) -> set[Dimension]:
        """
        Get the dimensions defined in the semantic view.

        Even though Snowflake supports `SHOW SEMANTIC DIMENSIONS IN my_semantic_view`,
        it doesn't return the expression of dimensions, so we use a slightly more
        complicated query to get all the information we need in one go.
        """
        dimensions: set[Dimension] = set()

        query = dedent(
            f"""
            DESC SEMANTIC VIEW {self.uid()}
                ->> SELECT "object_name", "property", "property_value"
                    FROM $1
                    WHERE
                        "object_kind" = 'DIMENSION' AND
                        "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
            """
        ).strip()

        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor(DictCursor)
            rows = cursor.execute(query).fetchall()

        for name, group in itertools.groupby(rows, key=lambda x: x["object_name"]):
            attributes = defaultdict(set)
            for row in group:
                attributes[row["property"]].add(row["property_value"])

            table = next(iter(attributes["TABLE"]))
            id_ = table + "." + name
            type_ = self._get_type(next(iter(attributes["DATA_TYPE"])))
            description = next(iter(attributes["COMMENT"]), None)
            definition = next(iter(attributes["EXPRESSION"]), None)

            dimensions.add(Dimension(id_, name, type_, description, definition))

        return dimensions

    def get_metrics(self) -> set[Metric]:
        """
        Get the metrics defined in the semantic view.
        """
        metrics: set[Metric] = set()

        query = dedent(
            f"""
            DESC SEMANTIC VIEW {self.uid()}
                ->> SELECT "object_name", "property", "property_value"
                    FROM $1
                    WHERE
                        "object_kind" = 'METRIC' AND
                        "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
            """
        ).strip()

        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor(DictCursor)
            rows = cursor.execute(query).fetchall()

        for name, group in itertools.groupby(rows, key=lambda x: x["object_name"]):
            attributes = defaultdict(set)
            for row in group:
                attributes[row["property"]].add(row["property_value"])

            table = next(iter(attributes["TABLE"]))
            id_ = table + "." + name
            type_ = self._get_type(next(iter(attributes["DATA_TYPE"])))
            description = next(iter(attributes["COMMENT"]), None)
            definition = next(iter(attributes["EXPRESSION"]), None)

            metrics.add(Metric(id_, name, type_, definition, description))

        return metrics

    def _get_type(self, snowflake_type: str | None) -> type[Type]:
        """
        Return the semantic type corresponding to a Snowflake type.
        """
        if snowflake_type is None:
            return STRING

        type_map = {
            STRING: {r"VARCHAR\(\d+\)$", "STRING$", "TEXT$", r"CHAR\(\d+\)$"},
            INTEGER: {r"NUMBER\(38,\s?0\)$", "INT$", "INTEGER$", "BIGINT$"},
            DECIMAL: {r"NUMBER\(10,\s?2\)$"},
            NUMBER: {r"NUMBER\(\d+,\s?\d+\)$", "FLOAT$", "DOUBLE$"},
            BOOLEAN: {"BOOLEAN$"},
            DATE: {"DATE$"},
            DATETIME: {"TIMESTAMP_TZ$", "TIMESTAMP__NTZ$"},
            TIME: {"TIME$"},
            OBJECT: {"OBJECT$"},
            BINARY: {r"BINARY\(\d+\)$", r"VARBINARY\(\d+\)$"},
        }
        for semantic_type, patterns in type_map.items():
            if any(
                re.match(pattern, snowflake_type, re.IGNORECASE) for pattern in patterns
            ):
                return semantic_type

        return STRING

    def _build_predicates(
        self,
        filters: list[Filter | AdhocFilter],
    ) -> tuple[str, tuple[FilterValues, ...]]:
        """
        Convert a set of filters to a single `AND`ed predicate.

        Caller should check the types of filters beforehand, as this method does not
        differentiate between `WHERE` and `HAVING` predicates.
        """
        if not filters:
            return "", ()

        # convert filters predicate with associated parameters; native filters are
        # already strings, so we keep them as-is
        unary_operators = {Operator.IS_NULL, Operator.IS_NOT_NULL}
        predicates: list[str] = []
        parameters: list[FilterValues] = []
        for filter_ in filters or set():
            if isinstance(filter_, AdhocFilter):
                predicates.append(f"({filter_.definition})")
            else:
                predicates.append(f"({self._build_native_filter(filter_)})")
                if filter_.operator not in unary_operators:
                    parameters.extend(
                        [filter_.value]
                        if not isinstance(filter_.value, (set, frozenset))
                        else filter_.value
                    )

        return " AND ".join(predicates), tuple(parameters)

    def get_values(
        self,
        dimension: Dimension,
        filters: set[Filter | AdhocFilter] | None = None,
    ) -> SemanticResult:
        """
        Return distinct values for a dimension.
        """
        where_clause, parameters = self._build_predicates(
            sorted(
                filter_
                for filter_ in (filters or [])
                if filter_.type == PredicateType.WHERE
            )
        )
        query = dedent(
            f"""
            SELECT {self._quote(dimension.name)}
            FROM SEMANTIC_VIEW(
                {self.uid()}
                DIMENSIONS {dimension.id}
                {"WHERE " + where_clause if where_clause else ""}
            )
            """
        ).strip()
        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            df = connection.cursor().execute(query, parameters).fetch_pandas_all()

        return SemanticResult(
            requests=[
                SemanticRequest(
                    REQUEST_TYPE,
                    substitute_parameters(query, parameters),
                )
            ],
            results=df,
        )

    def _build_native_filter(self, filter_: Filter) -> str:
        """
        Convert a Filter to a AdhocFilter.
        """
        column = filter_.column
        operator = filter_.operator
        value = filter_.value

        column_name = self._quote(column.name)

        # Handle IS NULL and IS NOT NULL operators (no value needed)
        if operator in {Operator.IS_NULL, Operator.IS_NOT_NULL}:
            return f"{column_name} {operator.value}"

        # Handle IN and NOT IN operators (set values)
        if operator in {Operator.IN, Operator.NOT_IN}:
            parameter_count = len(value) if isinstance(value, (set, frozenset)) else 1
            formatted_values = ", ".join("?" for _ in range(parameter_count))
            return f"{column_name} {operator.value} ({formatted_values})"

        return f"{column_name} {operator.value} ?"

    def get_dataframe(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        *,
        group_limit: GroupLimit | None = None,
    ) -> SemanticResult:
        """
        Execute a query and return the results as a (wrapped) Pandas DataFrame.
        """
        if not metrics and not dimensions:
            return DataFrame()

        query, parameters = self._get_query(
            metrics,
            dimensions,
            filters,
            order,
            limit,
            offset,
            group_limit,
        )
        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            df = connection.cursor().execute(query, parameters).fetch_pandas_all()

        # map column names to dimension/metric names instead of IDs
        mapping = {
            **{dimension.id: dimension.name for dimension in dimensions},
            **{metric.id: metric.name for metric in metrics},
        }
        df.rename(columns=mapping, inplace=True)

        return SemanticResult(
            requests=[
                SemanticRequest(
                    REQUEST_TYPE,
                    substitute_parameters(query, parameters),
                )
            ],
            results=df,
        )

    def get_row_count(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        *,
        group_limit: GroupLimit | None = None,
    ) -> SemanticResult:
        """
        Execute a query and return the number of rows the result would have.
        """
        if not metrics and not dimensions:
            return SemanticResult(
                requests=[],
                results=DataFrame([[0]], columns=["COUNT"]),
            )

        query, parameters = self._get_query(
            metrics,
            dimensions,
            filters,
            order,
            limit,
            offset,
            group_limit,
        )
        query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            df = connection.cursor().execute(query, parameters).fechone()[0]

        return SemanticResult(
            requests=[
                SemanticRequest(
                    REQUEST_TYPE,
                    substitute_parameters(query, parameters),
                )
            ],
            results=df,
        )

    def _get_query(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        group_limit: GroupLimit | None = None,
    ) -> tuple[str, tuple[FilterValues, ...]]:
        """
        Build a query to fetch data from the semantic view.

        This also returns the parameters need to run `cursor.execute()`, passed
        separately to prevent SQL injection.
        """
        if limit is None and offset is not None:
            raise ValueError("Offset cannot be set without limit")

        filters = filters or set()
        where_clause, where_parameters = self._build_predicates(
            # XXX sort to ensure deterministic order for parameters
            [filter_ for filter_ in filters if filter_.type == PredicateType.WHERE]
        )
        # having clauses are not supported, since there's no GROUP BY
        if any(filter_.type == PredicateType.HAVING for filter_ in filters):
            raise ValueError("HAVING filters are not supported")

        if group_limit:
            query, cte_parameters = self._build_query_with_group_limit(
                metrics,
                dimensions,
                where_clause,
                order,
                limit,
                offset,
                group_limit,
            )
            # Combine parameters: CTE params first, then main query params
            all_parameters = cte_parameters + where_parameters
        else:
            query = self._build_simple_query(
                metrics,
                dimensions,
                where_clause,
                order,
                limit,
                offset,
            )
            all_parameters = where_parameters

        return query, all_parameters

    def _alias_element(self, element: Metric | Dimension) -> str:
        """
        Generate an aliased column expression for a metric or dimension.
        """
        return f"{element.id} AS {self._quote(element.id)}"

    def _build_order_clause(
        self,
        order: list[OrderTuple] | None = None,
    ) -> str:
        """
        Build the ORDER BY clause from a list of (element, direction) tuples.

        Note that for adhoc expressions, Superset will still add `ASC` or `DESC` to the
        end, which means adhoc expressions can contain multiple columns as long as the
        last one has no direction specified.

        This is fine:

            gender ASC, COUNT(*)

        But this is not

            gender ASC, COUNT(*) DESC

        The latter will produce a query that looks like this:

            ... ORDER BY gender ASC, COUNT(*) DESC DESC

        """
        if not order:
            return ""

        def build_element(element: Metric | Dimension | AdhocExpression) -> str:
            if isinstance(element, AdhocExpression):
                validate_order_by(element.definition)
                return element.definition
            return self._quote(element.id)

        return ", ".join(
            f"{build_element(element)} {direction.value}"
            for element, direction in order
        )

    def _get_temporal_dimension(
        self,
        dimensions: list[Dimension],
    ) -> Dimension | None:
        """
        Find the first temporal dimension in the list.

        Returns the first dimension with a temporal type (DATE, DATETIME, TIME),
        or None if no temporal dimension is found.
        """
        temporal_types = {DATE, DATETIME, TIME}
        for dimension in dimensions:
            if dimension.type in temporal_types:
                return dimension
        return None

    def _get_default_order(
        self,
        dimensions: list[Dimension],
        order: list[OrderTuple] | None,
    ) -> list[OrderTuple] | None:
        """
        Get the order to use, prepending temporal sort if needed.

        If there's a temporal dimension in the query and it's not already
        in the order, prepends an ascending sort by that dimension.
        This ensures time-series data is always sorted chronologically first.
        """
        temporal_dimension = self._get_temporal_dimension(dimensions)
        if not temporal_dimension:
            return order

        # Check if temporal dimension is already in the order
        if order:
            for element, _ in order:
                if isinstance(element, Dimension) and element.id == temporal_dimension.id:
                    return order
            # Prepend temporal dimension to existing order
            return [(temporal_dimension, OrderDirection.ASC)] + list(order)

        # No order specified, use temporal dimension
        return [(temporal_dimension, OrderDirection.ASC)]

    def _build_simple_query(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        where_clause: str,
        order: list[OrderTuple] | None,
        limit: int | None,
        offset: int | None,
    ) -> str:
        """
        Build a query without group limiting.
        """
        dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in dimensions
        )
        metric_arguments = ", ".join(self._alias_element(metric) for metric in metrics)
        # Use default temporal ordering if no explicit order is provided
        effective_order = self._get_default_order(dimensions, order)
        order_clause = self._build_order_clause(effective_order)

        return dedent(
            f"""
            SELECT * FROM SEMANTIC_VIEW(
                {self.uid()}
                {"DIMENSIONS " + dimension_arguments if dimension_arguments else ""}
                {"METRICS " + metric_arguments if metric_arguments else ""}
                {"WHERE " + where_clause if where_clause else ""}
            )
            {"ORDER BY " + order_clause if order_clause else ""}
            {"LIMIT " + str(limit) if limit is not None else ""}
            {"OFFSET " + str(offset) if offset is not None else ""}
            """
        ).strip()

    def _build_top_groups_cte(
        self,
        group_limit: GroupLimit,
        where_clause: str,
    ) -> tuple[str, tuple[FilterValues, ...]]:
        """
        Build a CTE that finds the top N combinations of limited dimensions.

        If group_limit.filters is set, it uses those filters instead of the main
        query's where clause. This allows using different time bounds for finding top
        groups vs showing data.

        Returns:
            Tuple of (CTE SQL, parameters for the CTE)
        """
        limited_dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in group_limit.dimensions
        )
        limited_dimension_names = ", ".join(
            self._quote(dimension.id) for dimension in group_limit.dimensions
        )

        # Use separate filters for group limit if provided (Option 2)
        # Otherwise use the same filters as the main query (Option 1)
        if group_limit.filters is not None:
            group_where_clause, group_where_params = self._build_predicates(
                sorted(
                    filter_
                    for filter_ in group_limit.filters
                    if filter_.type == PredicateType.WHERE
                )
            )
            if any(
                filter_.type == PredicateType.HAVING for filter_ in group_limit.filters
            ):
                raise ValueError(
                    "HAVING filters are not supported in group limit filters"
                )
            cte_params = group_where_params
        else:
            group_where_clause = where_clause
            cte_params = ()  # No additional params - using main query params

        # Build METRICS clause and ORDER BY based on whether metric is provided
        if group_limit.metric is not None:
            metrics_clause = (
                f"METRICS {group_limit.metric.id}"
                f" AS {self._quote(group_limit.metric.id)}"
            )
            order_by_clause = (
                f"{self._quote(group_limit.metric.id)} {group_limit.direction.value}"
            )
        else:
            # No metric provided - order by first dimension
            metrics_clause = ""
            order_by_clause = (
                f"{self._quote(group_limit.dimensions[0].id)} "
                f"{group_limit.direction.value}"
            )

        # Build SEMANTIC_VIEW arguments
        semantic_view_args = [
            f"DIMENSIONS {limited_dimension_arguments}",
        ]
        if metrics_clause:
            semantic_view_args.append(metrics_clause)
        if group_where_clause:
            semantic_view_args.append(f"WHERE {group_where_clause}")

        semantic_view_args_str = "\n                    ".join(semantic_view_args)

        # Add trailing blank line if there's no WHERE clause
        # This matches the original template behavior
        if not group_where_clause:
            semantic_view_args_str += "\n"

        cte_sql = dedent(
            f"""
            WITH top_groups AS (
                SELECT {limited_dimension_names}
                FROM SEMANTIC_VIEW(
                    {self.uid()}
                    {semantic_view_args_str}
                )
                ORDER BY
                    {order_by_clause}
                LIMIT {group_limit.top}
            )
            """
        ).strip()

        return cte_sql, cte_params

    def _build_group_filter(self, group_limit: GroupLimit) -> str:
        """
        Build a WHERE filter that restricts results to top N groups.
        """
        if len(group_limit.dimensions) == 1:
            dimension_id = self._quote(group_limit.dimensions[0].id)
            return f"{dimension_id} IN (SELECT {dimension_id} FROM top_groups)"

        # Multi-column IN clause
        dimension_tuple = ", ".join(
            self._quote(dim.id) for dim in group_limit.dimensions
        )
        return f"({dimension_tuple}) IN (SELECT {dimension_tuple} FROM top_groups)"

    def _build_case_expression(
        self,
        dimension: Dimension,
        group_condition: str,
    ) -> str:
        """
        Build a CASE expression that replaces non-top values with 'Other'.

        Args:
            dimension: The dimension to build the CASE for
            group_condition: The condition to check if value is in top groups
                            (e.g., "staff_id IN (SELECT staff_id FROM top_groups)")

        Returns:
            SQL CASE expression
        """
        dimension_id = self._quote(dimension.id)
        return f"""CASE
            WHEN {group_condition} THEN {dimension_id}
            ELSE CAST('Other' AS VARCHAR)
        END"""

    def _build_query_with_others(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        where_clause: str,
        order: list[OrderTuple] | None,
        limit: int | None,
        offset: int | None,
        group_limit: GroupLimit,
    ) -> tuple[str, tuple[FilterValues, ...]]:
        """
        Build a query that groups non-top N values as 'Other'.

        This uses a two-stage approach:
        1. CTE to find top N groups
        2. Subquery with CASE expressions to replace non-top values with 'Other'
        3. Outer query to re-aggregate with the new grouping

        Returns:
            Tuple of (SQL query, CTE parameters)
        """
        top_groups_cte, cte_params = self._build_top_groups_cte(
            group_limit,
            where_clause,
        )

        # Determine which dimensions are limited vs non-limited
        limited_dimension_ids = {dim.id for dim in group_limit.dimensions}
        non_limited_dimensions = [
            dim for dim in dimensions if dim.id not in limited_dimension_ids
        ]

        # Build the group condition for CASE expressions
        if len(group_limit.dimensions) == 1:
            dimension_id = self._quote(group_limit.dimensions[0].id)
            group_condition = (
                f"{dimension_id} IN (SELECT {dimension_id} FROM top_groups)"
            )
        else:
            dimension_tuple = ", ".join(
                self._quote(dim.id) for dim in group_limit.dimensions
            )
            group_condition = (
                f"({dimension_tuple}) IN (SELECT {dimension_tuple} FROM top_groups)"
            )

        # Build CASE expressions for limited dimensions
        case_expressions = []
        case_expressions_for_groupby = []
        for dim in group_limit.dimensions:
            case_expr = self._build_case_expression(dim, group_condition)
            alias = self._quote(dim.id)
            case_expressions.append(f"{case_expr} AS {alias}")
            # Store the full CASE expression for GROUP BY (not just alias)
            case_expressions_for_groupby.append(case_expr)

        # Build SELECT for non-limited dimensions (pass through)
        non_limited_selects = [
            f"{self._quote(dim.id)} AS {self._quote(dim.id)}"
            for dim in non_limited_dimensions
        ]

        # Build metric aggregations
        metric_aggregations = [
            f"SUM({self._quote(metric.id)}) AS {self._quote(metric.id)}"
            for metric in metrics
        ]

        # Build the subquery that gets raw data from SEMANTIC_VIEW
        dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in dimensions
        )
        metric_arguments = ", ".join(self._alias_element(metric) for metric in metrics)

        subquery = dedent(
            f"""
            raw_data AS (
                SELECT * FROM SEMANTIC_VIEW(
                    {self.uid()}
                    DIMENSIONS {dimension_arguments}
                    METRICS {metric_arguments}
                    {"WHERE " + where_clause if where_clause else ""}
                )
            )
            """
        ).strip()

        # Build GROUP BY clause (full CASE expressions + non-limited dimensions)
        # We need to repeat the full CASE expressions, not use aliases, because
        # Snowflake may interpret the alias as the original column reference
        group_by_columns = case_expressions_for_groupby + [
            self._quote(dim.id) for dim in non_limited_dimensions
        ]
        group_by_clause = ", ".join(group_by_columns)

        # Build final SELECT columns
        select_columns = case_expressions + non_limited_selects + metric_aggregations
        select_clause = ",\n    ".join(select_columns)

        # Build ORDER BY clause (need to reference the aliased columns)
        # Use default temporal ordering if no explicit order is provided
        effective_order = self._get_default_order(dimensions, order)
        order_clause = self._build_order_clause(effective_order)

        query = dedent(
            f"""
            {top_groups_cte},
            {subquery}
            SELECT
                {select_clause}
            FROM raw_data
            GROUP BY {group_by_clause}
            {"ORDER BY " + order_clause if order_clause else ""}
            {"LIMIT " + str(limit) if limit is not None else ""}
            {"OFFSET " + str(offset) if offset is not None else ""}
            """
        ).strip()

        return query, cte_params

    def _build_query_with_group_limit(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        where_clause: str,
        order: list[OrderTuple] | None,
        limit: int | None,
        offset: int | None,
        group_limit: GroupLimit,
    ) -> tuple[str, tuple[FilterValues, ...]]:
        """
        Build a query with group limiting (top N groups).

        If group_others is True, groups non-top values as 'Other'.
        Otherwise, filters to show only top N groups.

        Returns:
            Tuple of (SQL query, CTE parameters)
        """
        if group_limit.group_others:
            return self._build_query_with_others(
                metrics,
                dimensions,
                where_clause,
                order,
                limit,
                offset,
                group_limit,
            )

        # Standard group limiting: just filter to top N groups
        # We can't use CTE references inside SEMANTIC_VIEW(), so we wrap it
        dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in dimensions
        )
        metric_arguments = ", ".join(self._alias_element(metric) for metric in metrics)
        # Use default temporal ordering if no explicit order is provided
        effective_order = self._get_default_order(dimensions, order)
        order_clause = self._build_order_clause(effective_order)

        top_groups_cte, cte_params = self._build_top_groups_cte(
            group_limit,
            where_clause,
        )
        group_filter = self._build_group_filter(group_limit)

        query = dedent(
            f"""
            {top_groups_cte}
            SELECT * FROM SEMANTIC_VIEW(
                {self.uid()}
                {"DIMENSIONS " + dimension_arguments if dimension_arguments else ""}
                {"METRICS " + metric_arguments if metric_arguments else ""}
                {"WHERE " + where_clause if where_clause else ""}
            ) AS subquery
            WHERE {group_filter}
            {"ORDER BY " + order_clause if order_clause else ""}
            {"LIMIT " + str(limit) if limit is not None else ""}
            {"OFFSET " + str(offset) if offset is not None else ""}
            """
        ).strip()

        return query, cte_params

    __repr__ = uid
