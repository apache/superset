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

"""NULL membership must preserve fact rows before provider aggregation."""

from dataclasses import FrozenInstanceError, replace
from datetime import datetime
from typing import cast
from unittest.mock import MagicMock, patch

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    Dimension,
    Filter,
    FilterExpression,
    Operator,
    OrFilter,
    PredicateType,
    SemanticQuery,
)
from superset_core.semantic_layers.view import SemanticView, SemanticViewFeature

from superset.exceptions import QueryObjectValidationError
from superset.semantic_layers.mapper import (
    _convert_query_object_filter,
    _validate_filter_features,
    get_results,
    map_query_object,
    ValidatedQueryObject,
)
from superset.superset_typing import FilterValues

CATEGORY: Dimension = Dimension(
    id="category", name="category", type=pa.string(), definition="category"
)


def _matches(expression: FilterExpression, value: str | None) -> bool:
    """Evaluate leaf SQL truth independently; grouped children are disjunctions."""
    if isinstance(expression, OrFilter):
        return any(_matches(child, value) for child in expression.filters)
    if expression.operator == Operator.IS_NULL:
        return value is None
    if expression.operator == Operator.IS_NOT_NULL:
        return value is not None
    if value is None:
        return False
    if expression.operator == Operator.EQUALS:
        return value == expression.value
    if expression.operator == Operator.NOT_EQUALS:
        return expression.value is not None and value != expression.value
    assert isinstance(expression.value, frozenset)
    if expression.operator == Operator.IN:
        return value in expression.value
    assert expression.operator == Operator.NOT_IN
    return None not in expression.value and value not in expression.value


@pytest.mark.parametrize(
    "operator,value,expected",
    [
        ("==", None, [None]),
        ("==", "<NULL>", [None]),
        ("==", [None], [None]),
        ("==", [], [None]),
        ("==", ["a", "b"], ["a"]),
        ("IN", ("a", "<NULL>"), [None, "a"]),
        ("!=", ["<NULL>"], ["a", "b"]),
        ("IN", ["<NULL>"], [None]),
        ("IN", ["a", "<NULL>"], [None, "a"]),
        ("NOT IN", ["a", "<NULL>"], ["b"]),
        ("!=", None, ["a", "b"]),
        ("IN", [None], [None]),
        ("NOT IN", [None], ["a", "b"]),
        ("IN", ["a", None], [None, "a"]),
        ("NOT IN", ["a", None], ["b"]),
        ("IN", [None, "a", None, "a"], [None, "a"]),
        ("NOT IN", [None, "a", None, "a"], ["b"]),
        ("IN", ["a"], ["a"]),
        ("NOT IN", ["a"], ["b"]),
        ("==", "a", ["a"]),
        ("!=", "a", ["b"]),
    ],
)
def test_null_filter_row_membership(
    operator: str, value: FilterValues | None, expected: list[str | None]
) -> None:
    """NULL/a/b facts distinguish SQL UNKNOWN from the selected NULL member."""
    expressions: set[FilterExpression] | None = _convert_query_object_filter(
        {"col": "category", "op": operator, "val": value}, {"category": CATEGORY}
    )
    assert expressions
    rows: list[str | None] = [None, "a", "b"]
    actual: list[str | None] = [
        row for row in rows if all(_matches(item, row) for item in expressions)
    ]
    assert actual == expected


@pytest.mark.parametrize("operator", ["IN", "NOT IN"])
def test_empty_membership_is_rejected(operator: str) -> None:
    """Empty membership is a query validation error, never dialect-specific SQL."""
    with pytest.raises(QueryObjectValidationError, match="empty"):
        _convert_query_object_filter(
            {"col": "category", "op": operator, "val": []}, {"category": CATEGORY}
        )


@pytest.mark.parametrize("is_rowcount", [False, True])
def test_legacy_provider_rejects_mixed_null_membership(is_rowcount: bool) -> None:
    """Do not send an unsupported group or silently narrow legacy results."""
    datasource: MagicMock = MagicMock()
    datasource.implementation.features = frozenset()
    datasource.implementation.get_dimensions.return_value = {CATEGORY}
    datasource.implementation.get_metrics.return_value = set()
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource,
        columns=["category"],
        filters=[{"col": "category", "op": "IN", "val": ["a", None]}],
    )
    query.is_rowcount = is_rowcount
    with pytest.raises(QueryObjectValidationError, match="Select NULL separately"):
        get_results(query)
    datasource.implementation.get_table.assert_not_called()
    datasource.implementation.get_row_count.assert_not_called()


@pytest.mark.parametrize("stage", [PredicateType.WHERE, PredicateType.HAVING])
def test_or_group_is_hashable_and_keeps_predicate_stage(stage: PredicateType) -> None:
    """OR leaves retain their common evaluation stage and identity."""
    leaf: Filter = Filter(stage, CATEGORY, Operator.IN, frozenset({"a"}))
    null: Filter = Filter(stage, CATEGORY, Operator.IS_NULL, None)
    group: OrFilter = OrFilter(frozenset({leaf, null}))
    assert len({group, OrFilter(frozenset({null, leaf}))}) == 1
    assert {child.type for child in group.filters} == {stage}
    with pytest.raises(FrozenInstanceError):
        group.filters = frozenset()  # type: ignore[misc]  # Exercise runtime freezing.


@pytest.mark.parametrize(
    "invalid", [frozenset(), frozenset({1}), {1, 2}, frozenset({1, 2})]
)
def test_or_group_rejects_invalid_children(invalid: object) -> None:
    """Runtime validation keeps malformed groups out of provider readers."""
    with pytest.raises(ValueError, match="OrFilter"):
        OrFilter(cast(frozenset[Filter], invalid))


def test_or_group_rejects_nested_or_mixed_stage_children() -> None:
    """Flattening nested groups or mixing WHERE/HAVING would change the query."""
    leaf: Filter = Filter(PredicateType.WHERE, CATEGORY, Operator.IS_NULL, None)
    other: Filter = replace(leaf, operator=Operator.IS_NOT_NULL)
    with pytest.raises(ValueError, match="predicate stage"):
        OrFilter(frozenset({leaf, replace(other, type=PredicateType.HAVING)}))
    nested: OrFilter = OrFilter(frozenset({leaf, other}))
    with pytest.raises(ValueError, match="leaves"):
        OrFilter(cast(frozenset[Filter], frozenset({leaf, nested})))


def test_or_filters_are_disabled_by_default() -> None:
    """Existing providers must opt in before receiving grouped predicates."""
    assert SemanticViewFeature.OR_FILTERS not in SemanticView.features


def test_capable_provider_receives_groups_in_main_offset_and_group_limit() -> None:
    """No inner query may silently lose the NULL member before ranking groups."""
    timestamp: Dimension = Dimension(
        id="ts", name="ts", type=pa.timestamp("s"), definition="ts"
    )
    datasource: MagicMock = MagicMock()
    datasource.fetch_values_predicate = None
    datasource.implementation.features = frozenset({SemanticViewFeature.OR_FILTERS})
    datasource.implementation.get_dimensions.return_value = {CATEGORY, timestamp}
    datasource.implementation.get_metrics.return_value = set()
    query: ValidatedQueryObject = ValidatedQueryObject(
        datasource=datasource,
        columns=["category", "ts"],
        granularity="ts",
        filters=[{"col": "category", "op": "IN", "val": ["a", None]}],
        series_columns=["category"],
        series_limit=1,
        from_dttm=datetime(2020, 1, 1),
        to_dttm=datetime(2020, 2, 1),
        inner_from_dttm=datetime(2020, 1, 2),
        inner_to_dttm=datetime(2020, 2, 2),
        time_offsets=["1 month ago"],
    )
    queries: list[SemanticQuery] = map_query_object(query)
    assert len(queries) == 2
    mapped: SemanticQuery
    lower: datetime
    upper: datetime
    for mapped, lower, upper in zip(
        queries,
        [datetime(2020, 1, 1), datetime(2019, 12, 1)],
        [datetime(2020, 2, 1), datetime(2020, 1, 1)],
        strict=True,
    ):
        assert mapped.filters is not None
        assert len(mapped.filters) == 3
        groups: set[OrFilter] = {
            item for item in mapped.filters if isinstance(item, OrFilter)
        }
        assert len(groups) == 1
        assert (
            Filter(
                PredicateType.WHERE, timestamp, Operator.GREATER_THAN_OR_EQUAL, lower
            )
            in mapped.filters
        )
        assert (
            Filter(PredicateType.WHERE, timestamp, Operator.LESS_THAN, upper)
            in mapped.filters
        )
        assert mapped.group_limit is not None
        assert mapped.group_limit.filters == groups | {
            Filter(
                PredicateType.WHERE,
                timestamp,
                Operator.GREATER_THAN_OR_EQUAL,
                datetime(2020, 1, 2),
            ),
            Filter(
                PredicateType.WHERE, timestamp, Operator.LESS_THAN, datetime(2020, 2, 2)
            ),
        }


def test_group_filter_capability_check_covers_missing_and_leaf_only_filters() -> None:
    """Legacy providers retain all leaf-only paths but never receive OR groups."""
    leaf: Filter = Filter(PredicateType.WHERE, CATEGORY, Operator.IS_NULL, None)
    group: OrFilter = OrFilter(
        frozenset({leaf, replace(leaf, operator=Operator.IS_NOT_NULL)})
    )
    _validate_filter_features(None, frozenset())
    _validate_filter_features({leaf}, frozenset())
    with pytest.raises(QueryObjectValidationError, match="Select NULL separately"):
        _validate_filter_features({group}, frozenset())
    _validate_filter_features({group}, frozenset({SemanticViewFeature.OR_FILTERS}))
    _validate_filter_features({group}, frozenset({"OR_FILTERS"}))


@pytest.mark.parametrize(
    "dtype,value,expected", [(pa.int64(), "0", 0), (pa.bool_(), "false", False)]
)
def test_mixed_null_membership_preserves_scalar_coercion(
    dtype: pa.DataType, value: str, expected: int | bool
) -> None:
    """NULL splitting must not turn numeric zero or false into missing values."""
    dimension: Dimension = replace(CATEGORY, type=dtype)
    expressions: set[FilterExpression] | None = _convert_query_object_filter(
        {"col": "category", "op": "IN", "val": [value, "<NULL>"]},
        {"category": dimension},
    )
    assert expressions is not None
    group: FilterExpression = next(iter(expressions))
    assert isinstance(group, OrFilter)
    assert (
        Filter(PredicateType.WHERE, dimension, Operator.IN, frozenset({expected}))
        in group.filters
    )
    assert (
        Filter(PredicateType.WHERE, dimension, Operator.IS_NULL, None) in group.filters
    )


def test_null_disjunction_stays_conjoined_with_other_filters() -> None:
    """The top-level set is AND, not a flattened list of OR leaves."""
    expressions: set[FilterExpression] | None = _convert_query_object_filter(
        {"col": "category", "op": "IN", "val": ["a", None]}, {"category": CATEGORY}
    )
    assert expressions is not None
    expressions.add(Filter(PredicateType.WHERE, CATEGORY, Operator.IS_NOT_NULL, None))
    rows: list[str | None] = [None, "a", "b"]
    assert [
        row for row in rows if all(_matches(item, row) for item in expressions)
    ] == ["a"]


@pytest.mark.parametrize(
    "operator", [">", "<", ">=", "<=", "LIKE", "NOT LIKE", "ILIKE", "NOT ILIKE"]
)
@pytest.mark.parametrize("value", [None, [None], "<NULL>", []])
def test_comparison_requires_non_null_operand(
    operator: str, value: FilterValues | None
) -> None:
    """Invalid MCP and chart comparisons fail before provider execution."""
    with pytest.raises(QueryObjectValidationError, match="Must specify a value"):
        _convert_query_object_filter(
            {"col": "category", "op": operator, "val": value}, {"category": CATEGORY}
        )


@pytest.mark.parametrize("value", [[0, False], [False, 0]])
def test_integer_membership_checks_every_value_before_deduplicating(
    value: FilterValues,
) -> None:
    """A boolean must not disappear behind an equal integer before validation."""
    with pytest.raises(ValueError, match="Invalid integer value"):
        _convert_query_object_filter(
            {"col": "category", "op": "IN", "val": value},
            {"category": replace(CATEGORY, type=pa.int64())},
        )


@pytest.mark.parametrize(
    "operator,value", [("==", "<empty string>"), ("IN", ["<empty string>"])]
)
def test_ui_empty_string_sentinel(operator: str, value: FilterValues) -> None:
    """Explore membership and drill-by equality retain empty-string facts."""
    expressions: set[FilterExpression] | None = _convert_query_object_filter(
        {"col": "category", "op": operator, "val": value}, {"category": CATEGORY}
    )
    assert expressions
    assert all(_matches(item, "") for item in expressions)
    assert not all(_matches(item, None) for item in expressions)


@pytest.mark.parametrize("semantic_annotation", [False, True])
def test_annotation_parent_cache_versions_semantic_rows(
    semantic_annotation: bool,
) -> None:
    """A SQL parent must not serve semantic annotation rows from the old protocol."""
    from superset.common.query_context_processor import QueryContextProcessor
    from superset.common.query_object import QueryObject
    from superset.semantic_layers.models import SemanticView as SemanticViewModel

    context: MagicMock = MagicMock()
    context.datasource.uid = "1__table"
    context.datasource.changed_on = None
    context.datasource.get_extra_cache_keys.return_value = []
    processor: QueryContextProcessor = QueryContextProcessor(context)
    annotation_source: SemanticViewModel | MagicMock = (
        SemanticViewModel() if semantic_annotation else MagicMock(type="table")
    )
    query: QueryObject = QueryObject(
        columns=["category"],
        annotation_layers=[
            {
                "sourceType": "table",
                "annotationType": "TIME_SERIES",
                "name": "annotation",
                "value": 1,
            }
        ],
    )
    with (
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=MagicMock(datasource=annotation_source),
        ),
        patch(
            "superset.common.query_context_processor.security_manager.get_rls_cache_key",
            return_value=[],
        ),
        patch("superset.common.query_context_processor.get_user_id", return_value=7),
    ):
        actual: str | None = processor.query_cache_key(query)
        with patch.object(
            processor,
            "_annotation_cache_context",
            return_value={"user_id": 7, "source_rls": {"1": []}},
        ):
            legacy: str | None = processor.query_cache_key(query)
    assert (actual != legacy) is semantic_annotation
