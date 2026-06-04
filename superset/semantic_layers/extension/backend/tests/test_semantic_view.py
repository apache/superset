# flake8: noqa: E501

from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from preset_io.dataset_semantic_layer import DatasetSemanticView
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    GroupLimit,
    Metric,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticQuery,
)
from superset_core.semantic_layers.view import SemanticViewFeature
from superset.utils.core import GenericDataType


def _make_column(name, generic_type=GenericDataType.STRING, expression=None) -> MagicMock:
    column = MagicMock(spec=[])
    column.column_name = name
    column.verbose_name = None
    column.description = None
    column.expression = expression
    column.groupby = True
    column.type_generic = generic_type
    return column


def _make_metric(name, expression) -> MagicMock:
    metric = MagicMock(spec=[])
    metric.metric_name = name
    metric.verbose_name = None
    metric.description = None
    metric.expression = expression
    return metric


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
    ds.columns = [
        _make_column("country"),
        _make_column("status"),
        _make_column("amount", generic_type=GenericDataType.NUMERIC),
    ]
    ds.metrics = [
        _make_metric("order_count", "COUNT(*)"),
        _make_metric("total_amount", "SUM(amount)"),
        _make_metric("unique_customers", "COUNT(DISTINCT customer_id)"),
    ]
    return ds


def test_dimensions_and_metrics(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)

    assert {d.id for d in view.dimensions} == {"country", "status", "amount"}
    assert {m.id for m in view.metrics} == {"order_count", "total_amount", "unique_customers"}

    aggregations = {m.id: m.aggregation.value for m in view.metrics}
    assert aggregations["order_count"] == "COUNT"
    assert aggregations["total_amount"] == "SUM"
    assert aggregations["unique_customers"] == "COUNT_DISTINCT"


def test_compile_query_groups_and_orders(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            order=[(total, OrderDirection.DESC)],
            limit=10,
        )
    )

    # Compiled in PostgreSQL dialect — identifiers double-quoted, ORDER BY
    # picks up the dialect's default null handling.
    assert sql == (
        'SELECT "country" AS "country", SUM(amount) AS "total_amount" '
        'FROM "public"."orders" '
        'GROUP BY "country" '
        'ORDER BY "total_amount" DESC NULLS LAST '
        'LIMIT 10'
    )


def test_compile_query_with_filters(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    status = next(d for d in view.dimensions if d.id == "status")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            filters={
                Filter(
                    type=PredicateType.WHERE,
                    column=status,
                    operator=Operator.IN,
                    value=frozenset({"open", "closed"}),
                ),
            },
        )
    )

    assert sql.startswith(
        'SELECT "country" AS "country", SUM(amount) AS "total_amount" '
        'FROM "public"."orders" '
        'WHERE "status" IN ('
    )
    assert 'GROUP BY "country"' in sql


def test_compile_query_dialect_switches_with_engine(dataset: MagicMock) -> None:
    dataset.database.db_engine_spec.engine = "mysql"
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(metrics=[total], dimensions=[country], limit=5)
    )
    # MySQL uses backticks rather than double quotes — proves the dialect
    # mapping is consulted per-dataset.
    assert "`country`" in sql
    assert "`orders`" in sql


def test_get_table_executes_via_database(dataset: MagicMock) -> None:
    import pandas as pd

    dataset.database.get_df.return_value = pd.DataFrame(
        {"country": ["FR"], "total_amount": [42.0]}
    )

    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")

    result = view.get_table(
        SemanticQuery(metrics=[total], dimensions=[country])
    )

    dataset.database.get_df.assert_called_once()
    sql_arg = dataset.database.get_df.call_args.args[0]
    assert "FROM" in sql_arg
    assert result.results.num_rows == 1
    assert "country" in result.results.column_names


def test_features_advertised(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    assert SemanticViewFeature.GROUP_LIMIT in view.features
    assert SemanticViewFeature.GROUP_OTHERS in view.features


def test_group_limit_single_dimension(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            group_limit=GroupLimit(
                dimensions=[country],
                top=5,
                metric=total,
                direction=OrderDirection.DESC,
            ),
        )
    )

    assert sql == (
        'WITH top_groups AS ('
        'SELECT "country" AS "country" FROM "public"."orders" '
        'GROUP BY "country" '
        'ORDER BY SUM(amount) DESC NULLS LAST LIMIT 5'
        ') '
        'SELECT "country" AS "country", SUM(amount) AS "total_amount" '
        'FROM "public"."orders" '
        'WHERE "country" IN (SELECT "country" FROM top_groups) '
        'GROUP BY "country"'
    )


def test_group_limit_multi_dimension_uses_tuple_in(dataset: MagicMock) -> None:
    # Add a second groupable dim.
    extra = MagicMock(spec=[])
    extra.column_name = "state"
    extra.verbose_name = None
    extra.description = None
    extra.expression = None
    extra.groupby = True
    extra.type_generic = GenericDataType.STRING
    dataset.columns = list(dataset.columns) + [extra]

    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    state = next(d for d in view.dimensions if d.id == "state")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country, state],
            group_limit=GroupLimit(
                dimensions=[country, state],
                top=3,
                metric=total,
                direction=OrderDirection.DESC,
            ),
        )
    )

    assert '("country", "state") IN (SELECT "country", "state" FROM top_groups)' in sql


def test_group_limit_without_metric_orders_by_first_dim(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            group_limit=GroupLimit(
                dimensions=[country],
                top=10,
                metric=None,
                direction=OrderDirection.ASC,
            ),
        )
    )

    # No GROUP BY in the CTE since there's no aggregation to do.
    assert (
        'WITH top_groups AS ('
        'SELECT "country" AS "country" FROM "public"."orders" '
        'ORDER BY "country" ASC LIMIT 10'
        ')'
    ) in sql


def test_group_others_buckets_with_case(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            group_limit=GroupLimit(
                dimensions=[country],
                top=5,
                metric=total,
                direction=OrderDirection.DESC,
                group_others=True,
            ),
        )
    )

    expected_case = (
        'CASE WHEN "country" IN (SELECT "country" FROM top_groups) '
        'THEN "country" ELSE \'Other\' END'
    )
    assert sql == (
        'WITH top_groups AS ('
        'SELECT "country" AS "country" FROM "public"."orders" '
        'GROUP BY "country" '
        'ORDER BY SUM(amount) DESC NULLS LAST LIMIT 5'
        ') '
        f'SELECT {expected_case} AS "country", '
        'SUM(amount) AS "total_amount" '
        'FROM "public"."orders" '
        f'GROUP BY {expected_case}'
    )


def test_group_limit_separate_cte_filters(dataset: MagicMock) -> None:
    day_col = MagicMock(spec=[])
    day_col.column_name = "day"
    day_col.verbose_name = None
    day_col.description = None
    day_col.expression = None
    day_col.groupby = True
    day_col.type_generic = GenericDataType.TEMPORAL
    dataset.columns = list(dataset.columns) + [day_col]

    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    day = next(d for d in view.dimensions if d.id == "day")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            filters={
                Filter(
                    type=PredicateType.WHERE,
                    column=day,
                    operator=Operator.GREATER_THAN_OR_EQUAL,
                    value="2024-01-01",
                ),
            },
            group_limit=GroupLimit(
                dimensions=[country],
                top=5,
                metric=total,
                direction=OrderDirection.DESC,
                filters={
                    Filter(
                        type=PredicateType.WHERE,
                        column=day,
                        operator=Operator.GREATER_THAN_OR_EQUAL,
                        value="2023-12-01",
                    ),
                },
            ),
        )
    )

    # CTE uses the wider date range, main query uses the narrower one.
    assert '"day" >= \'2023-12-01\'' in sql.split("SELECT \"country\" AS \"country\", SUM")[0]
    assert '"day" >= \'2024-01-01\'' in sql.split("SELECT \"country\" AS \"country\", SUM")[1]


def test_virtual_dataset_uses_subquery(dataset: MagicMock) -> None:
    dataset.sql = "SELECT * FROM orders WHERE deleted_at IS NULL"
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    assert "FROM (SELECT * FROM orders WHERE deleted_at IS NULL)" in sql
