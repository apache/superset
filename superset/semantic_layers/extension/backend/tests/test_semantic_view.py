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


@pytest.fixture(autouse=True)
def stub_rls_module(monkeypatch: pytest.MonkeyPatch):
    """
    Stub ``superset.semantic_layers.rls`` so tests don't need a Flask app.
    Individual tests can override these by re-monkeypatching the module's
    attributes.
    """
    import sys
    import types

    from superset.sql.parse import RLSMethod

    rls_stub = types.ModuleType("superset.semantic_layers.rls")
    rls_stub.render_rls_predicates = lambda dataset: []
    rls_stub.apply_rls_to_virtual_sql = lambda dataset: None
    rls_stub.get_rls_method = lambda dataset: RLSMethod.AS_PREDICATE
    monkeypatch.setitem(sys.modules, "superset.semantic_layers.rls", rls_stub)
    yield rls_stub


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


# ---------------------------------------------------------------------------
# Metadata edge cases
# ---------------------------------------------------------------------------


def test_non_groupable_columns_are_skipped(dataset: MagicMock) -> None:
    non_groupable = _make_column("hidden")
    non_groupable.groupby = False
    dataset.columns = list(dataset.columns) + [non_groupable]
    view = DatasetSemanticView(dataset)
    assert "hidden" not in {d.id for d in view.dimensions}


def test_column_with_no_type_generic_falls_back_to_utf8(dataset: MagicMock) -> None:
    untyped = _make_column("mystery", generic_type=None)
    dataset.columns = [untyped]
    dataset.metrics = []
    view = DatasetSemanticView(dataset)
    dim = next(iter(view.dimensions))
    assert dim.type == pa.utf8()


def test_calculated_dimension_uses_expression(dataset: MagicMock) -> None:
    calc = _make_column("upper_country", expression="UPPER(country)")
    dataset.columns = list(dataset.columns) + [calc]
    view = DatasetSemanticView(dataset)
    calc_dim = next(d for d in view.dimensions if d.id == "upper_country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[calc_dim]))
    # The expression is inlined where the column reference would otherwise
    # sit. sqlglot re-renders the parsed expression with its own quoting rules
    # (none for unquoted identifiers).
    assert 'UPPER(country) AS "upper_country"' in sql


def test_aggregation_inference_edge_cases(dataset: MagicMock) -> None:
    dataset.metrics = [
        _make_metric("blank", ""),
        _make_metric("broken", "SUM("),  # parse error
        _make_metric("composite", "SUM(a) + SUM(b)"),  # not a top-level agg
    ]
    view = DatasetSemanticView(dataset)
    aggs = {m.id: m.aggregation.value for m in view.metrics}
    assert aggs["blank"] == "OTHER"
    assert aggs["broken"] == "OTHER"
    assert aggs["composite"] == "OTHER"


def test_compatible_helpers_return_full_sets(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    # No filtering — the dataset view treats every dimension/metric as compatible.
    assert view.get_compatible_metrics(set(), set()) == view.metrics
    assert view.get_compatible_dimensions(set(), set()) == view.dimensions


# ---------------------------------------------------------------------------
# Source-table shapes
# ---------------------------------------------------------------------------


def test_source_table_without_schema(dataset: MagicMock) -> None:
    dataset.schema = None
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    assert 'FROM "orders"' in sql
    assert '"public"' not in sql


def test_source_table_with_catalog(dataset: MagicMock) -> None:
    dataset.catalog = "warehouse"
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    assert 'FROM "warehouse"."public"."orders"' in sql


# ---------------------------------------------------------------------------
# Filter operators
# ---------------------------------------------------------------------------


def _where(view: DatasetSemanticView, filter_: Filter) -> str:
    country = next(d for d in view.dimensions if d.id == "country")
    return view.compile_query(
        SemanticQuery(metrics=[], dimensions=[country], filters={filter_})
    )


def test_filter_is_null(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    status = next(d for d in view.dimensions if d.id == "status")
    sql = _where(
        view,
        Filter(
            type=PredicateType.WHERE,
            column=status,
            operator=Operator.IS_NULL,
            value=None,
        ),
    )
    assert '"status" IS NULL' in sql


def test_filter_is_not_null(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    status = next(d for d in view.dimensions if d.id == "status")
    sql = _where(
        view,
        Filter(
            type=PredicateType.WHERE,
            column=status,
            operator=Operator.IS_NOT_NULL,
            value=None,
        ),
    )
    assert 'NOT "status" IS NULL' in sql


def test_filter_not_in_uses_scalar_value(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    status = next(d for d in view.dimensions if d.id == "status")
    sql = _where(
        view,
        Filter(
            type=PredicateType.WHERE,
            column=status,
            operator=Operator.NOT_IN,
            value="open",
        ),
    )
    assert 'NOT "status" IN (\'open\')' in sql


def test_filter_not_like(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    status = next(d for d in view.dimensions if d.id == "status")
    sql = _where(
        view,
        Filter(
            type=PredicateType.WHERE,
            column=status,
            operator=Operator.NOT_LIKE,
            value="open%",
        ),
    )
    assert 'NOT "status" LIKE \'open%\'' in sql


def test_filter_on_metric_column(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")
    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            filters={
                Filter(
                    type=PredicateType.HAVING,
                    column=total,
                    operator=Operator.GREATER_THAN,
                    value=100,
                ),
            },
        )
    )
    assert "HAVING SUM(amount) > 100" in sql


def test_adhoc_filter_with_sql_string(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    sql = view.compile_query(
        SemanticQuery(
            metrics=[],
            dimensions=[country],
            filters={
                Filter(
                    type=PredicateType.WHERE,
                    column=None,
                    operator=Operator.ADHOC,
                    value="country LIKE 'F%'",
                ),
            },
        )
    )
    assert "WHERE country LIKE 'F%'" in sql


def test_adhoc_filter_must_be_string(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    with pytest.raises(ValueError, match="Adhoc filter value must be a SQL string"):
        view._filter_predicate(
            Filter(
                type=PredicateType.WHERE,
                column=None,
                operator=Operator.ADHOC,
                value=123,
            )
        )


def test_native_filter_requires_column(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    with pytest.raises(ValueError, match="Native filters require a column"):
        view._filter_predicate(
            Filter(
                type=PredicateType.WHERE,
                column=None,
                operator=Operator.EQUALS,
                value="x",
            )
        )


def test_unsupported_operator_raises(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    status = next(d for d in view.dimensions if d.id == "status")
    # ``TEMPORAL_RANGE`` is a Superset-level operator that the semantic view
    # doesn't model — use a fake operator that doesn't appear anywhere.
    fake_op = MagicMock()
    fake_op.__eq__ = lambda self, other: False
    with pytest.raises(ValueError, match="Unsupported operator"):
        view._filter_predicate(
            Filter(
                type=PredicateType.WHERE,
                column=status,
                operator=fake_op,
                value="x",
            )
        )


def test_multiple_filters_combined_with_and(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    status = next(d for d in view.dimensions if d.id == "status")
    sql = view.compile_query(
        SemanticQuery(
            metrics=[],
            dimensions=[country],
            filters={
                Filter(
                    type=PredicateType.WHERE,
                    column=status,
                    operator=Operator.EQUALS,
                    value="open",
                ),
                Filter(
                    type=PredicateType.WHERE,
                    column=country,
                    operator=Operator.EQUALS,
                    value="FR",
                ),
            },
        )
    )
    assert " AND " in sql


def test_unknown_dimension_raises(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    ghost = Dimension(id="ghost", name="ghost", type=pa.utf8())
    with pytest.raises(ValueError, match='Dimension "ghost"'):
        view._dimension_expression(ghost)


def test_unknown_metric_raises(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    ghost = Metric(id="ghost", name="ghost", type=pa.float64(), definition="x")
    with pytest.raises(ValueError, match='Metric "ghost"'):
        view._metric_expression(ghost)


# ---------------------------------------------------------------------------
# Order by / limit / offset
# ---------------------------------------------------------------------------


def test_offset_requires_limit(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    with pytest.raises(ValueError, match="Offset cannot be set without limit"):
        view.compile_query(
            SemanticQuery(metrics=[], dimensions=[country], offset=10)
        )


def test_limit_and_offset_emit(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    sql = view.compile_query(
        SemanticQuery(metrics=[], dimensions=[country], limit=5, offset=10)
    )
    assert "LIMIT 5" in sql
    assert "OFFSET 10" in sql


def test_adhoc_order_by(dataset: MagicMock) -> None:
    from superset_core.semantic_layers.types import AdhocExpression

    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    sql = view.compile_query(
        SemanticQuery(
            metrics=[],
            dimensions=[country],
            order=[
                (
                    AdhocExpression(id="custom", definition="LENGTH(country)"),
                    OrderDirection.ASC,
                ),
            ],
        )
    )
    assert "ORDER BY LENGTH(country) ASC" in sql


# ---------------------------------------------------------------------------
# Group limit / others edge cases
# ---------------------------------------------------------------------------


def test_group_limit_filters_reject_having(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")
    with pytest.raises(
        ValueError, match="HAVING filters are not supported in group_limit.filters"
    ):
        view.compile_query(
            SemanticQuery(
                metrics=[total],
                dimensions=[country],
                group_limit=GroupLimit(
                    dimensions=[country],
                    top=5,
                    metric=total,
                    direction=OrderDirection.DESC,
                    filters={
                        Filter(
                            type=PredicateType.HAVING,
                            column=total,
                            operator=Operator.GREATER_THAN,
                            value=0,
                        ),
                    },
                ),
            )
        )


def test_group_others_keeps_non_limited_dim_as_is(dataset: MagicMock) -> None:
    extra = _make_column("state")
    dataset.columns = list(dataset.columns) + [extra]
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    state = next(d for d in view.dimensions if d.id == "state")
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country, state],
            filters={
                Filter(
                    type=PredicateType.WHERE,
                    column=state,
                    operator=Operator.EQUALS,
                    value="CA",
                ),
            },
            order=[(total, OrderDirection.DESC)],
            limit=20,
            offset=5,
            group_limit=GroupLimit(
                dimensions=[country],
                top=5,
                metric=total,
                direction=OrderDirection.DESC,
                group_others=True,
            ),
        )
    )
    # Non-limited dimension still references the bare column, not a CASE.
    assert '"state" AS "state"' in sql
    assert "WHERE \"state\" = 'CA'" in sql
    assert "ORDER BY" in sql
    assert "LIMIT 20" in sql
    assert "OFFSET 5" in sql


def test_group_others_with_having(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")
    sql = view.compile_query(
        SemanticQuery(
            metrics=[total],
            dimensions=[country],
            filters={
                Filter(
                    type=PredicateType.HAVING,
                    column=total,
                    operator=Operator.GREATER_THAN,
                    value=0,
                ),
            },
            group_limit=GroupLimit(
                dimensions=[country],
                top=5,
                metric=total,
                direction=OrderDirection.DESC,
                group_others=True,
            ),
        )
    )
    assert "HAVING SUM(amount) > 0" in sql


# ---------------------------------------------------------------------------
# Public API: get_values / get_table / get_row_count
# ---------------------------------------------------------------------------


def test_get_values_returns_distinct(dataset: MagicMock) -> None:
    import pandas as pd

    dataset.database.get_df.return_value = pd.DataFrame({"country": ["FR", "DE"]})
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    status = next(d for d in view.dimensions if d.id == "status")

    result = view.get_values(
        country,
        filters={
            Filter(
                type=PredicateType.WHERE,
                column=status,
                operator=Operator.EQUALS,
                value="open",
            ),
        },
    )
    sql_arg = dataset.database.get_df.call_args.args[0]
    assert "SELECT DISTINCT" in sql_arg
    assert "\"status\" = 'open'" in sql_arg
    assert result.results.num_rows == 2


def test_get_values_no_filters(dataset: MagicMock) -> None:
    import pandas as pd

    dataset.database.get_df.return_value = pd.DataFrame({"country": []})
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    result = view.get_values(country)
    assert "WHERE" not in dataset.database.get_df.call_args.args[0]
    assert result.results.num_rows == 0


def test_get_table_empty_query_returns_empty_table(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    result = view.get_table(SemanticQuery(metrics=[], dimensions=[]))
    assert result.requests == []
    assert result.results.num_rows == 0


def test_get_table_renames_columns_to_dimension_names(dataset: MagicMock) -> None:
    import pandas as pd

    # Give the dimension a verbose name so id != name.
    dataset.columns[0].verbose_name = "Country Name"
    dataset.database.get_df.return_value = pd.DataFrame(
        {"country": ["FR"], "total_amount": [42.0]}
    )
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    total = next(m for m in view.metrics if m.id == "total_amount")

    result = view.get_table(
        SemanticQuery(metrics=[total], dimensions=[country])
    )
    assert "Country Name" in result.results.column_names


def test_get_row_count_empty_query(dataset: MagicMock) -> None:
    view = DatasetSemanticView(dataset)
    result = view.get_row_count(SemanticQuery(metrics=[], dimensions=[]))
    assert result.results.to_pydict() == {"COUNT": [0]}


def test_get_row_count_wraps_query(dataset: MagicMock) -> None:
    import pandas as pd

    dataset.database.get_df.return_value = pd.DataFrame({"COUNT": [3]})
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    result = view.get_row_count(
        SemanticQuery(metrics=[], dimensions=[country])
    )
    sql_arg = dataset.database.get_df.call_args.args[0]
    assert "COUNT(*)" in sql_arg
    assert "FROM (" in sql_arg
    assert result.results.to_pydict()["COUNT"][0] == 3


# ---------------------------------------------------------------------------
# RLS
# ---------------------------------------------------------------------------


def test_rls_as_predicate_appended_to_where(dataset: MagicMock, stub_rls_module) -> None:
    stub_rls_module.render_rls_predicates = lambda ds: ["tenant_id = 7"]
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    assert 'WHERE tenant_id = 7' in sql


def test_rls_as_predicate_combined_with_existing_filter(
    dataset: MagicMock,
    stub_rls_module,
) -> None:
    stub_rls_module.render_rls_predicates = lambda ds: ["tenant_id = 7"]
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    status = next(d for d in view.dimensions if d.id == "status")

    sql = view.compile_query(
        SemanticQuery(
            metrics=[],
            dimensions=[country],
            filters={
                Filter(
                    type=PredicateType.WHERE,
                    column=status,
                    operator=Operator.EQUALS,
                    value="open",
                ),
            },
        )
    )
    assert "tenant_id = 7" in sql
    assert "\"status\" = 'open'" in sql
    assert " AND " in sql


def test_rls_multiple_clauses_anded(dataset: MagicMock, stub_rls_module) -> None:
    stub_rls_module.render_rls_predicates = lambda ds: ["a = 1", "b = 2"]
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    # Both clauses present, AND-ed.
    assert "a = 1" in sql
    assert "b = 2" in sql


def test_rls_as_subquery_multiple_clauses_anded(
    dataset: MagicMock,
    stub_rls_module,
) -> None:
    """Subquery-wrap mode AND-s multiple RLS clauses inside the wrap."""
    from superset.sql.parse import RLSMethod

    stub_rls_module.get_rls_method = lambda ds: RLSMethod.AS_SUBQUERY
    stub_rls_module.render_rls_predicates = lambda ds: ["a = 1", "b = 2"]
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    assert "a = 1" in sql
    assert "b = 2" in sql
    assert " AND " in sql


def test_adhoc_dimension_compiles_via_definition(dataset: MagicMock) -> None:
    """An adhoc dimension (no matching column, but with a ``definition``) is
    parsed and emitted as the SELECT expression."""
    adhoc = Dimension(
        id="upper_country",
        name="upper_country",
        type=pa.null(),
        definition="UPPER(country)",
    )
    view = DatasetSemanticView(dataset)
    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[adhoc]))
    assert 'UPPER(country) AS "upper_country"' in sql


def test_rls_as_subquery_wraps_source(dataset: MagicMock, stub_rls_module) -> None:
    from superset.sql.parse import RLSMethod

    stub_rls_module.get_rls_method = lambda ds: RLSMethod.AS_SUBQUERY
    stub_rls_module.render_rls_predicates = lambda ds: ["tenant_id = 7"]
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    # Source wrapped in a subquery containing the RLS predicate; no top-level WHERE.
    assert "FROM (SELECT * FROM" in sql
    assert "WHERE tenant_id = 7" in sql
    assert sql.count(" WHERE ") == 1  # only the wrap, not also outer


def test_rls_as_subquery_no_wrap_when_no_predicates(
    dataset: MagicMock,
    stub_rls_module,
) -> None:
    from superset.sql.parse import RLSMethod

    stub_rls_module.get_rls_method = lambda ds: RLSMethod.AS_SUBQUERY
    stub_rls_module.render_rls_predicates = lambda ds: []
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    # No RLS rules → no wrap, plain table reference.
    assert 'FROM "public"."orders"' in sql
    assert "rls_wrapped" not in sql


def test_rls_virtual_dataset_inner_apply(dataset: MagicMock, stub_rls_module) -> None:
    dataset.sql = "SELECT * FROM raw_orders"
    stub_rls_module.apply_rls_to_virtual_sql = (
        lambda ds: "SELECT * FROM raw_orders WHERE tenant_id = 7"
    )
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    assert "raw_orders WHERE tenant_id = 7" in sql


def test_rls_virtual_dataset_no_inner_change_falls_back(
    dataset: MagicMock,
    stub_rls_module,
) -> None:
    dataset.sql = "SELECT * FROM raw_orders"
    stub_rls_module.apply_rls_to_virtual_sql = lambda ds: None
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[country]))
    assert "FROM (SELECT * FROM raw_orders)" in sql


# ---------------------------------------------------------------------------
# Time grain
# ---------------------------------------------------------------------------


def _engine_spec_with_grain_map(grain_map: dict) -> MagicMock:
    spec = MagicMock()
    spec.engine = "postgresql"
    spec.get_time_grain_expressions.return_value = grain_map
    return spec


def test_grain_simple_template_buckets_dimension(dataset: MagicMock) -> None:
    """``{col}``-only templates are formatted directly and reparsed."""
    import dataclasses
    from superset_core.semantic_layers.types import Grains

    dataset.database.db_engine_spec = _engine_spec_with_grain_map(
        {"P1D": "DATE_TRUNC('day', {col})"}
    )
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    grained = dataclasses.replace(country, grain=Grains.DAY)
    total = next(m for m in view.metrics if m.id == "total_amount")

    sql = view.compile_query(
        SemanticQuery(metrics=[total], dimensions=[grained])
    )
    # sqlglot normalizes the time-unit literal's case for Postgres.
    assert 'DATE_TRUNC(\'DAY\', "country") AS "country"' in sql
    # GROUP BY uses the full bucketed expression, not the alias.
    assert 'GROUP BY DATE_TRUNC(\'DAY\', "country")' in sql


def test_grain_unsupported_falls_back_to_raw(dataset: MagicMock) -> None:
    """When the engine doesn't model the requested grain, no wrap is applied."""
    import dataclasses
    from superset_core.semantic_layers.types import Grain, Grains

    # The map is empty → no template matches.
    dataset.database.db_engine_spec = _engine_spec_with_grain_map({})
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    grained = dataclasses.replace(country, grain=Grains.DAY)

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[grained]))
    assert 'SELECT "country" AS "country"' in sql
    assert "DATE_TRUNC" not in sql


def test_grain_func_placeholder_uses_engine_spec(
    dataset: MagicMock,
    mocker,
) -> None:
    """``{func}``/``{type}`` placeholders defer to engine spec's get_timestamp_expr."""
    import dataclasses
    from superset_core.semantic_layers.types import Grains

    fake_spec = _engine_spec_with_grain_map({"P1D": "{func}({col}, DAY)"})
    # get_timestamp_expr is the engine spec's escape hatch; return a fake
    # SQLAlchemy expression whose str() form is the rendered SQL.
    fake_te = MagicMock()
    fake_te.compile.return_value = 'TIMESTAMP_TRUNC("country", DAY)'
    fake_spec.get_timestamp_expr.return_value = fake_te
    dataset.database.db_engine_spec = fake_spec

    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")
    grained = dataclasses.replace(country, grain=Grains.DAY)

    view.compile_query(SemanticQuery(metrics=[], dimensions=[grained]))
    # The placeholder path must consult the engine spec's get_timestamp_expr
    # rather than substituting directly. We don't assert on the rendered SQL
    # because sqlglot may canonicalize non-native function names per dialect.
    fake_spec.get_timestamp_expr.assert_called_once()


def test_grain_applied_to_calculated_dimension(dataset: MagicMock) -> None:
    """Grain wraps a calculated column's expression, not a bare column."""
    import dataclasses
    from superset_core.semantic_layers.types import Grains

    calc = _make_column("created_at_minus_1", expression="created_at - INTERVAL 1 DAY")
    dataset.columns = list(dataset.columns) + [calc]
    dataset.database.db_engine_spec = _engine_spec_with_grain_map(
        {"P1D": "DATE_TRUNC('day', {col})"}
    )

    view = DatasetSemanticView(dataset)
    dim = next(d for d in view.dimensions if d.id == "created_at_minus_1")
    grained = dataclasses.replace(dim, grain=Grains.DAY)

    sql = view.compile_query(SemanticQuery(metrics=[], dimensions=[grained]))
    # The grain wraps the calculated expression; sqlglot re-renders the
    # interval literal so we check the structural pieces individually.
    assert "DATE_TRUNC('DAY'," in sql
    assert "created_at - INTERVAL" in sql


def test_rls_applied_to_get_values(dataset: MagicMock, stub_rls_module) -> None:
    import pandas as pd

    stub_rls_module.render_rls_predicates = lambda ds: ["tenant_id = 7"]
    dataset.database.get_df.return_value = pd.DataFrame({"country": []})
    view = DatasetSemanticView(dataset)
    country = next(d for d in view.dimensions if d.id == "country")

    view.get_values(country)
    sql_arg = dataset.database.get_df.call_args.args[0]
    assert "tenant_id = 7" in sql_arg
