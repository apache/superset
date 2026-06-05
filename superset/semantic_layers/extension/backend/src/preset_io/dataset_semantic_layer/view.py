from __future__ import annotations

from typing import TYPE_CHECKING

import pyarrow as pa
import sqlglot
from sqlglot import expressions as sqlglot_exp
from superset_core.semantic_layers.types import (
    AdhocExpression,
    AggregationType,
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticQuery,
    SemanticRequest,
    SemanticResult,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature

from .utils import coerce_literal, df_to_arrow

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn

REQUEST_TYPE = "sql"

# Map Superset's GenericDataType (an IntEnum value) to a pyarrow type. Kept
# narrow on purpose — the dataset model only tracks a coarse generic type, so
# anything more specific belongs to the underlying database and is left as
# UTF-8 at the semantic layer boundary.
_GENERIC_TYPE_TO_ARROW: dict[int, pa.DataType] = {
    0: pa.float64(),  # NUMERIC
    1: pa.utf8(),  # STRING
    2: pa.timestamp("us"),  # TEMPORAL
    3: pa.bool_(),  # BOOLEAN
}

# Top-level aggregate AST node → AggregationType. Compound expressions like
# ``SUM(a) + SUM(b)`` fall through to OTHER because they cannot be safely
# rolled up.
_AGG_NODE_MAP: dict[type[sqlglot_exp.Expression], AggregationType] = {
    sqlglot_exp.Sum: AggregationType.SUM,
    sqlglot_exp.Min: AggregationType.MIN,
    sqlglot_exp.Max: AggregationType.MAX,
    sqlglot_exp.Avg: AggregationType.AVG,
}

_OPERATOR_TO_SQLGLOT: dict[Operator, type[sqlglot_exp.Expression]] = {
    Operator.EQUALS: sqlglot_exp.EQ,
    Operator.NOT_EQUALS: sqlglot_exp.NEQ,
    Operator.GREATER_THAN: sqlglot_exp.GT,
    Operator.LESS_THAN: sqlglot_exp.LT,
    Operator.GREATER_THAN_OR_EQUAL: sqlglot_exp.GTE,
    Operator.LESS_THAN_OR_EQUAL: sqlglot_exp.LTE,
    Operator.LIKE: sqlglot_exp.Like,
}


class DatasetSemanticView(SemanticView):
    features = frozenset(
        {
            SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY,
            SemanticViewFeature.GROUP_LIMIT,
            SemanticViewFeature.GROUP_OTHERS,
        }
    )

    def __init__(self, dataset: "SqlaTable") -> None:
        self.dataset = dataset
        self.name = dataset.table_name

        self.dimensions = self.get_dimensions()
        self.metrics = self.get_metrics()

    # ------------------------------------------------------------------
    # Identity & dialect
    # ------------------------------------------------------------------

    def uid(self) -> str:
        return f"dataset:{self.dataset.id}"

    @property
    def _sqlglot_dialect(self) -> str | None:
        # Imported lazily — ``superset.sql.parse`` pulls in a heavy dependency
        # graph that is not needed for unit tests of pure AST building.
        from superset.sql.parse import SQLGLOT_DIALECTS

        engine = self.dataset.database.db_engine_spec.engine
        dialect = SQLGLOT_DIALECTS.get(engine)
        return dialect.value if dialect is not None else None

    # ------------------------------------------------------------------
    # Metadata
    # ------------------------------------------------------------------

    def get_dimensions(self) -> set[Dimension]:
        dimensions: set[Dimension] = set()
        for column in self.dataset.columns:
            if not column.groupby:
                continue
            dimensions.add(
                Dimension(
                    id=column.column_name,
                    name=column.verbose_name or column.column_name,
                    type=self._column_arrow_type(column),
                    definition=column.expression or None,
                    description=column.description or None,
                )
            )
        return dimensions

    def get_metrics(self) -> set[Metric]:
        metrics: set[Metric] = set()
        for metric in self.dataset.metrics:
            metrics.add(
                Metric(
                    id=metric.metric_name,
                    name=metric.verbose_name or metric.metric_name,
                    type=pa.float64(),
                    definition=metric.expression,
                    description=metric.description or None,
                    aggregation=self._aggregation_from_expression(metric.expression),
                )
            )
        return metrics

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

    def _column_arrow_type(self, column: "TableColumn") -> pa.DataType:
        generic = column.type_generic
        if generic is None:
            return pa.utf8()
        return _GENERIC_TYPE_TO_ARROW.get(int(generic), pa.utf8())

    def _aggregation_from_expression(
        self,
        expression: str | None,
    ) -> AggregationType:
        if not expression:
            return AggregationType.OTHER

        try:
            parsed = sqlglot.parse_one(expression, dialect=self._sqlglot_dialect)
        except sqlglot.errors.ParseError:
            return AggregationType.OTHER

        if isinstance(parsed, sqlglot_exp.Count):
            if isinstance(parsed.this, sqlglot_exp.Distinct):
                return AggregationType.COUNT_DISTINCT
            return AggregationType.COUNT

        for node_type, aggregation in _AGG_NODE_MAP.items():
            if isinstance(parsed, node_type):
                return aggregation

        return AggregationType.OTHER

    # ------------------------------------------------------------------
    # AST building
    # ------------------------------------------------------------------

    def _dimension_column(self, dimension: Dimension) -> "TableColumn":
        # Callers (currently only ``_dimension_expression``) check membership
        # before invoking this helper, so the match is guaranteed.
        for column in self.dataset.columns:
            if column.column_name == dimension.id:
                return column
        raise ValueError(  # pragma: no cover - guarded by caller
            f'Dimension "{dimension.id}" is not part of this dataset.'
        )

    def _metric_column(self, metric: Metric) -> "SqlMetric":
        for sql_metric in self.dataset.metrics:
            if sql_metric.metric_name == metric.id:
                return sql_metric
        raise ValueError(f'Metric "{metric.id}" is not part of this dataset.')

    def _dimension_expression(self, dimension: Dimension) -> sqlglot_exp.Expression:
        # Synthesised adhoc dimensions don't correspond to a dataset column;
        # their ``definition`` carries the SQL we should emit.
        dataset_column_names = {col.column_name for col in self.dataset.columns}
        if dimension.id not in dataset_column_names:
            if not dimension.definition:
                raise ValueError(
                    f'Dimension "{dimension.id}" is not part of this dataset.'
                )
            base: sqlglot_exp.Expression = sqlglot.parse_one(
                dimension.definition,
                dialect=self._sqlglot_dialect,
            )
            return self._apply_grain(dimension, base)

        column = self._dimension_column(dimension)
        if column.expression:
            base = sqlglot.parse_one(
                column.expression,
                dialect=self._sqlglot_dialect,
            )
        else:
            base = sqlglot_exp.column(column.column_name, quoted=True)
        return self._apply_grain(dimension, base)

    def _apply_grain(
        self,
        dimension: Dimension,
        base_expr: sqlglot_exp.Expression,
    ) -> sqlglot_exp.Expression:
        """
        Wrap ``base_expr`` in the engine spec's time-grain template when the
        dimension carries a grain. Engines that don't model the requested
        grain return the unwrapped expression — same fallback the legacy path
        uses.
        """
        if dimension.grain is None:
            return base_expr

        engine_spec = self.dataset.database.db_engine_spec
        template = engine_spec.get_time_grain_expressions().get(
            dimension.grain.representation
        )
        if not template:
            return base_expr

        # ``{func}`` / ``{type}`` placeholders (BigQuery, MS SQL) require the
        # engine spec's full ``get_timestamp_expr`` machinery to resolve.
        if "{func}" in template or "{type}" in template:
            import sqlalchemy as sa

            sa_col = sa.column(
                base_expr.sql(dialect=self._sqlglot_dialect),
                is_literal=True,
            )
            tse = engine_spec.get_timestamp_expr(
                sa_col,
                None,
                dimension.grain.representation,
            )
            sql_str = str(
                tse.compile(
                    dialect=self.dataset.database.get_dialect(),
                    compile_kwargs={"literal_binds": True},
                )
            )
            return sqlglot.parse_one(sql_str, dialect=self._sqlglot_dialect)

        col_sql = base_expr.sql(dialect=self._sqlglot_dialect)
        grain_sql = template.replace("{col}", col_sql)
        return sqlglot.parse_one(grain_sql, dialect=self._sqlglot_dialect)

    def _metric_expression(self, metric: Metric) -> sqlglot_exp.Expression:
        sql_metric = self._metric_column(metric)
        return sqlglot.parse_one(sql_metric.expression, dialect=self._sqlglot_dialect)

    def _source_table(self) -> sqlglot_exp.Expression:
        """
        Build the FROM clause. Physical datasets reference the table directly;
        virtual datasets wrap their SQL as a subquery so the rest of the AST
        can treat the source like a table.

        For virtual datasets, RLS rules from the underlying tables referenced
        in ``dataset.sql`` are injected into the inner SQL. When the engine
        spec asks for ``AS_SUBQUERY``-style RLS, the dataset's own RLS
        predicates wrap the source in an extra ``SELECT * FROM … WHERE`` so
        the rest of the AST is unaffected.
        """
        dataset = self.dataset

        if dataset.sql:
            inner_sql = self._rls_apply_to_virtual_sql() or dataset.sql
            inner = sqlglot.parse_one(inner_sql, dialect=self._sqlglot_dialect)
            source: sqlglot_exp.Expression = sqlglot_exp.Subquery(
                this=inner, alias="virtual_dataset"
            )
        else:
            parts = [
                sqlglot_exp.to_identifier(part, quoted=True)
                for part in (dataset.catalog, dataset.schema, dataset.table_name)
                if part
            ]
            if len(parts) == 1:
                source = sqlglot_exp.Table(this=parts[0])
            elif len(parts) == 2:
                source = sqlglot_exp.Table(this=parts[1], db=parts[0])
            else:
                source = sqlglot_exp.Table(this=parts[2], db=parts[1], catalog=parts[0])

        if self._rls_should_wrap_subquery():
            rls_clauses = self._rls_predicates()
            if rls_clauses:
                source = self._wrap_with_rls(source, rls_clauses)

        return source

    # ------------------------------------------------------------------
    # RLS
    # ------------------------------------------------------------------

    def _rls_predicates(self) -> list[str]:
        """Outer RLS predicates for the dataset, rendered as SQL strings."""
        from superset.semantic_layers.rls import render_rls_predicates

        return render_rls_predicates(self.dataset)

    def _rls_apply_to_virtual_sql(self) -> str | None:
        from superset.semantic_layers.rls import apply_rls_to_virtual_sql

        return apply_rls_to_virtual_sql(self.dataset)

    def _rls_should_wrap_subquery(self) -> bool:
        from superset.semantic_layers.rls import get_rls_method
        from superset.sql.parse import RLSMethod

        return get_rls_method(self.dataset) == RLSMethod.AS_SUBQUERY

    def _wrap_with_rls(
        self,
        source: sqlglot_exp.Expression,
        rls_clauses: list[str],
    ) -> sqlglot_exp.Subquery:
        """Wrap ``source`` in ``SELECT * FROM source WHERE <AND-ed RLS>``."""
        parsed = [
            sqlglot.parse_one(clause, dialect=self._sqlglot_dialect)
            for clause in rls_clauses
        ]
        combined = parsed[0]
        for predicate in parsed[1:]:
            combined = sqlglot_exp.And(this=combined, expression=predicate)
        inner = (
            sqlglot_exp.Select()
            .select(sqlglot_exp.Star())
            .from_(source)
            .where(combined)
        )
        return sqlglot_exp.Subquery(this=inner, alias="rls_wrapped")

    def _filter_predicate(self, filter_: Filter) -> sqlglot_exp.Expression:
        if filter_.operator == Operator.ADHOC:
            if not isinstance(filter_.value, str):
                raise ValueError("Adhoc filter value must be a SQL string")
            return sqlglot.parse_one(filter_.value, dialect=self._sqlglot_dialect)

        if filter_.column is None:
            raise ValueError("Native filters require a column")

        if isinstance(filter_.column, Dimension):
            column_expr = self._dimension_expression(filter_.column)
        else:
            column_expr = self._metric_expression(filter_.column)

        operator = filter_.operator

        if operator == Operator.IS_NULL:
            return sqlglot_exp.Is(this=column_expr, expression=sqlglot_exp.Null())
        if operator == Operator.IS_NOT_NULL:
            return sqlglot_exp.Not(
                this=sqlglot_exp.Is(this=column_expr, expression=sqlglot_exp.Null())
            )
        if operator in (Operator.IN, Operator.NOT_IN):
            values = coerce_literal(filter_.value)
            if not isinstance(values, list):
                values = [values]
            expressions = [sqlglot_exp.convert(v) for v in values]
            in_expr = sqlglot_exp.In(this=column_expr, expressions=expressions)
            return (
                sqlglot_exp.Not(this=in_expr)
                if operator == Operator.NOT_IN
                else in_expr
            )
        if operator == Operator.NOT_LIKE:
            return sqlglot_exp.Not(
                this=sqlglot_exp.Like(
                    this=column_expr,
                    expression=sqlglot_exp.convert(filter_.value),
                )
            )

        sqlglot_op_cls = _OPERATOR_TO_SQLGLOT.get(operator)
        if sqlglot_op_cls is None:
            raise ValueError(f"Unsupported operator: {operator}")
        return sqlglot_op_cls(
            this=column_expr,
            expression=sqlglot_exp.convert(filter_.value),
        )

    def _combine_predicates(
        self,
        filters: set[Filter],
    ) -> sqlglot_exp.Expression | None:
        if not filters:
            return None
        # Sort to make the resulting SQL deterministic. Filter's default
        # tuple ordering eventually compares ``Dimension`` instances, which
        # are not orderable, so use a stable string key instead.
        ordered = sorted(
            filters,
            key=lambda f: (
                f.type.value,
                f.column.id if f.column is not None else "",
                f.operator.value,
                repr(f.value),
            ),
        )
        combined = self._filter_predicate(ordered[0])
        for filter_ in ordered[1:]:
            combined = sqlglot_exp.And(
                this=combined,
                expression=self._filter_predicate(filter_),
            )
        return combined

    def _order_expression(
        self,
        element: Metric | Dimension | AdhocExpression,
        direction: OrderDirection,
    ) -> sqlglot_exp.Ordered:
        if isinstance(element, AdhocExpression):
            inner = sqlglot.parse_one(
                element.definition,
                dialect=self._sqlglot_dialect,
            )
        else:
            inner = sqlglot_exp.column(element.id, quoted=True)
        return sqlglot_exp.Ordered(this=inner, desc=direction == OrderDirection.DESC)

    def _build_ast(self, query: SemanticQuery) -> sqlglot_exp.Select:
        if query.limit is None and query.offset is not None:
            raise ValueError("Offset cannot be set without limit")

        filters = query.filters or set()
        where_filters = {f for f in filters if f.type == PredicateType.WHERE}
        having_filters = {f for f in filters if f.type == PredicateType.HAVING}

        # Add the dataset's outer RLS predicates as ADHOC where-filters when
        # the engine wants AS_PREDICATE-style RLS. AS_SUBQUERY-style RLS is
        # handled in ``_source_table`` instead.
        if not self._rls_should_wrap_subquery():
            for clause in self._rls_predicates():
                where_filters = where_filters | {
                    Filter(
                        type=PredicateType.WHERE,
                        column=None,
                        operator=Operator.ADHOC,
                        value=clause,
                    )
                }

        if query.group_limit is not None and query.group_limit.group_others:
            return self._build_with_others(query, where_filters, having_filters)
        if query.group_limit is not None:
            return self._build_with_group_limit(query, where_filters, having_filters)
        return self._build_plain(query, where_filters, having_filters)

    def _build_plain(
        self,
        query: SemanticQuery,
        where_filters: set[Filter],
        having_filters: set[Filter],
    ) -> sqlglot_exp.Select:
        projections: list[sqlglot_exp.Expression] = []
        for dimension in query.dimensions:
            projections.append(
                sqlglot_exp.alias_(
                    self._dimension_expression(dimension),
                    dimension.id,
                    quoted=True,
                )
            )
        for metric in query.metrics:
            projections.append(
                sqlglot_exp.alias_(
                    self._metric_expression(metric),
                    metric.id,
                    quoted=True,
                )
            )

        select = (
            sqlglot_exp.Select()
            .select(*projections, append=False)
            .from_(self._source_table())
        )

        if where_predicate := self._combine_predicates(where_filters):
            select = select.where(where_predicate)

        # GROUP BY when aggregating: any metric is an aggregate, so all
        # non-aggregate dimensions need to be in GROUP BY. For grain-bucketed
        # dimensions we GROUP BY the full bucketed expression because dialects
        # disagree on whether SELECT aliases are visible in GROUP BY.
        if query.metrics and query.dimensions:
            group_by_columns = [
                (
                    self._dimension_expression(dimension)
                    if dimension.grain is not None
                    else sqlglot_exp.column(dimension.id, quoted=True)
                )
                for dimension in query.dimensions
            ]
            select = select.group_by(*group_by_columns)

        if having_predicate := self._combine_predicates(having_filters):
            select = select.having(having_predicate)

        if query.order:
            ordered = [
                self._order_expression(element, direction)
                for element, direction in query.order
            ]
            select = select.order_by(*ordered)

        if query.limit is not None:
            select = select.limit(query.limit)
        if query.offset is not None:
            select = select.offset(query.offset)

        return select

    # ------------------------------------------------------------------
    # Group limit (top N) helpers
    # ------------------------------------------------------------------

    def _top_groups_cte_select(
        self,
        group_limit: GroupLimit,
        main_where_filters: set[Filter],
    ) -> sqlglot_exp.Select:
        """
        Build the SELECT that powers the ``top_groups`` CTE.

        The CTE projects only the limited dimensions. The ordering metric, when
        present, is evaluated inline in ORDER BY so it does not leak into the
        CTE's column list.
        """
        if group_limit.filters is not None:
            if any(f.type == PredicateType.HAVING for f in group_limit.filters):
                raise ValueError(
                    "HAVING filters are not supported in group_limit.filters"
                )
            cte_where_filters = {
                f for f in group_limit.filters if f.type == PredicateType.WHERE
            }
        else:
            cte_where_filters = main_where_filters

        dim_projections = [
            sqlglot_exp.alias_(
                self._dimension_expression(dim),
                dim.id,
                quoted=True,
            )
            for dim in group_limit.dimensions
        ]
        select = (
            sqlglot_exp.Select()
            .select(*dim_projections, append=False)
            .from_(self._source_table())
        )

        if where_predicate := self._combine_predicates(cte_where_filters):
            select = select.where(where_predicate)

        # When ordering by a metric we need an aggregation; GROUP BY the
        # limited dimensions so each combination collapses to a single row.
        # Use full expressions for grain-bucketed dims (alias resolution in
        # GROUP BY isn't portable).
        if group_limit.metric is not None:
            select = select.group_by(
                *[
                    (
                        self._dimension_expression(dim)
                        if dim.grain is not None
                        else sqlglot_exp.column(dim.id, quoted=True)
                    )
                    for dim in group_limit.dimensions
                ]
            )
            order_expr: sqlglot_exp.Expression = self._metric_expression(
                group_limit.metric
            )
        else:
            order_expr = sqlglot_exp.column(
                group_limit.dimensions[0].id,
                quoted=True,
            )

        select = select.order_by(
            sqlglot_exp.Ordered(
                this=order_expr,
                desc=group_limit.direction == OrderDirection.DESC,
            )
        )
        return select.limit(group_limit.top)

    def _top_groups_in_predicate(
        self,
        group_limit: GroupLimit,
    ) -> sqlglot_exp.Expression:
        """
        Build a predicate restricting the limited dimensions to the rows of the
        ``top_groups`` CTE. Single dimension uses scalar IN; multiple use a
        row-tuple IN. The subquery is wrapped in ``Subquery`` so sqlglot emits
        the surrounding parentheses.
        """
        cte_table = sqlglot_exp.to_identifier("top_groups")
        dim_columns = [
            sqlglot_exp.column(dim.id, quoted=True)
            for dim in group_limit.dimensions
        ]
        subquery = sqlglot_exp.Subquery(
            this=(
                sqlglot_exp.Select()
                .select(*dim_columns)
                .from_(cte_table)
            )
        )
        if len(dim_columns) == 1:
            return sqlglot_exp.In(this=dim_columns[0], query=subquery)
        return sqlglot_exp.In(
            this=sqlglot_exp.Tuple(expressions=dim_columns),
            query=subquery,
        )

    def _build_with_group_limit(
        self,
        query: SemanticQuery,
        where_filters: set[Filter],
        having_filters: set[Filter],
    ) -> sqlglot_exp.Select:
        """
        Restrict the main query to rows whose limited-dimension values appear
        in the ``top_groups`` CTE.
        """
        select = self._build_plain(query, where_filters, having_filters)
        select = select.where(self._top_groups_in_predicate(query.group_limit))

        cte_select = self._top_groups_cte_select(query.group_limit, where_filters)
        return select.with_("top_groups", as_=cte_select)

    def _build_with_others(
        self,
        query: SemanticQuery,
        where_filters: set[Filter],
        having_filters: set[Filter],
    ) -> sqlglot_exp.Select:
        """
        Bucket non-top values into ``'Other'`` for the limited dimensions and
        re-aggregate against the bucketed groups. Non-additive metrics stay
        correct because we re-evaluate the original metric expression instead
        of summing previously aggregated rows.
        """
        group_limit = query.group_limit
        limited_dim_ids = {dim.id for dim in group_limit.dimensions}
        in_predicate = self._top_groups_in_predicate(group_limit)

        def dim_expr(dim: Dimension) -> sqlglot_exp.Expression:
            """Underlying expression for a dimension, with CASE for limited ones."""
            base = self._dimension_expression(dim)
            if dim.id not in limited_dim_ids:
                return base
            return sqlglot_exp.Case(
                ifs=[sqlglot_exp.If(this=in_predicate.copy(), true=base)],
                default=sqlglot_exp.Literal.string("Other"),
            )

        projections: list[sqlglot_exp.Expression] = []
        for dim in query.dimensions:
            projections.append(sqlglot_exp.alias_(dim_expr(dim), dim.id, quoted=True))
        for metric in query.metrics:
            projections.append(
                sqlglot_exp.alias_(
                    self._metric_expression(metric),
                    metric.id,
                    quoted=True,
                )
            )

        select = (
            sqlglot_exp.Select()
            .select(*projections, append=False)
            .from_(self._source_table())
        )

        if where_predicate := self._combine_predicates(where_filters):
            select = select.where(where_predicate)

        # GROUP BY the full expressions (not the aliases). Dialects disagree on
        # whether GROUP BY can reference a SELECT alias, and using the full
        # expression here side-steps that ambiguity for the CASE columns.
        if query.metrics and query.dimensions:
            select = select.group_by(
                *[dim_expr(dim) for dim in query.dimensions]
            )

        if having_predicate := self._combine_predicates(having_filters):
            select = select.having(having_predicate)

        if query.order:
            ordered = [
                self._order_expression(element, direction)
                for element, direction in query.order
            ]
            select = select.order_by(*ordered)

        if query.limit is not None:
            select = select.limit(query.limit)
        if query.offset is not None:
            select = select.offset(query.offset)

        cte_select = self._top_groups_cte_select(group_limit, where_filters)
        return select.with_("top_groups", as_=cte_select)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compile_query(self, query: SemanticQuery) -> str:
        """Return the SQL for ``query`` in the dataset's database dialect."""
        return self._build_ast(query).sql(dialect=self._sqlglot_dialect)

    def get_values(
        self,
        dimension: Dimension,
        filters: set[Filter] | None = None,
    ) -> SemanticResult:
        where_filters = {
            f for f in (filters or set()) if f.type == PredicateType.WHERE
        }
        # Add outer RLS predicates as ADHOC filters; AS_SUBQUERY-mode RLS is
        # wrapped into ``_source_table`` already.
        if not self._rls_should_wrap_subquery():
            for clause in self._rls_predicates():
                where_filters.add(
                    Filter(
                        type=PredicateType.WHERE,
                        column=None,
                        operator=Operator.ADHOC,
                        value=clause,
                    )
                )
        where = self._combine_predicates(where_filters)
        select = (
            sqlglot_exp.Select()
            .distinct()
            .select(
                sqlglot_exp.alias_(
                    self._dimension_expression(dimension),
                    dimension.id,
                    quoted=True,
                )
            )
            .from_(self._source_table())
        )
        if where is not None:
            select = select.where(where)

        sql = select.sql(dialect=self._sqlglot_dialect)
        df = self.dataset.database.get_df(
            sql,
            catalog=self.dataset.catalog,
            schema=self.dataset.schema,
        )
        return SemanticResult(
            requests=[SemanticRequest(REQUEST_TYPE, sql)],
            results=df_to_arrow(df),
        )

    def get_table(self, query: SemanticQuery) -> SemanticResult:
        if not query.metrics and not query.dimensions:
            return SemanticResult(requests=[], results=pa.table({}))

        sql = self.compile_query(query)
        df = self.dataset.database.get_df(
            sql,
            catalog=self.dataset.catalog,
            schema=self.dataset.schema,
        )

        # Map alias columns back to dimension/metric *names* so the result uses
        # human-friendly labels instead of internal IDs.
        rename: dict[str, str] = {}
        for dimension in query.dimensions:
            rename[dimension.id] = dimension.name
        for metric in query.metrics:
            rename[metric.id] = metric.name
        if df is not None and not df.empty and rename:
            df = df.rename(columns=rename)

        return SemanticResult(
            requests=[SemanticRequest(REQUEST_TYPE, sql)],
            results=df_to_arrow(df),
        )

    def get_row_count(self, query: SemanticQuery) -> SemanticResult:
        if not query.metrics and not query.dimensions:
            return SemanticResult(requests=[], results=pa.table({"COUNT": [0]}))

        inner = self._build_ast(query)
        count_select = (
            sqlglot_exp.Select()
            .select(
                sqlglot_exp.alias_(
                    sqlglot_exp.Count(this=sqlglot_exp.Star()),
                    "COUNT",
                    quoted=True,
                )
            )
            .from_(sqlglot_exp.Subquery(this=inner, alias="subquery"))
        )
        sql = count_select.sql(dialect=self._sqlglot_dialect)
        df = self.dataset.database.get_df(
            sql,
            catalog=self.dataset.catalog,
            schema=self.dataset.schema,
        )

        return SemanticResult(
            requests=[SemanticRequest(REQUEST_TYPE, sql)],
            results=df_to_arrow(df),
        )

    __repr__ = uid
