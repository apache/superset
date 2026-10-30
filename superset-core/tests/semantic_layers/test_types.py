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

import copy
import pickle
from dataclasses import replace

import pyarrow as pa
import pytest
from superset_core.semantic_layers.types import (
    Dimension,
    Metric,
    null_placement,
    NullPlacement,
    OrderDirection,
    OrderTerm,
    SemanticQuery,
)


def test_dimension_metadata_is_not_part_of_identity() -> None:
    first = Dimension(
        "sales.region",
        "region",
        pa.utf8(),
        verbose_name="Region",
        metadata={"display_name": "Region"},
    )
    second = Dimension(
        "sales.region",
        "region",
        pa.utf8(),
        verbose_name="Sales region",
        metadata={"display_name": "Sales region"},
    )

    assert first == second
    assert {first, second} == {first}


def test_metric_metadata_is_not_part_of_identity() -> None:
    first = Metric(
        "sales.total_revenue",
        "total_revenue",
        pa.float64(),
        "SUM(revenue)",
        verbose_name="Total revenue",
        d3format="$,.2f",
        metadata={"unit": {"kind": "currency", "code": "USD"}},
    )
    second = Metric(
        "sales.total_revenue",
        "total_revenue",
        pa.float64(),
        "SUM(revenue)",
        verbose_name="Revenue",
        d3format=",.0f",
        metadata={"unit": {"kind": "currency", "code": "EUR"}},
    )

    assert first == second
    assert {first, second} == {first}


def test_metric_accepts_superset_presentation_fields() -> None:
    metric = Metric(
        "sales.total_revenue",
        "total_revenue",
        pa.float64(),
        "SUM(revenue)",
        verbose_name="Total revenue",
        d3format="$,.2f",
    )

    assert metric.verbose_name == "Total revenue"
    assert metric.d3format == "$,.2f"


def test_dimension_accepts_superset_presentation_fields() -> None:
    dimension = Dimension(
        "sales.region",
        "region",
        pa.utf8(),
        verbose_name="Region",
    )

    assert dimension.verbose_name == "Region"


def test_metadata_defaults_are_not_shared() -> None:
    first = Metric("first", "first", pa.int64(), "COUNT(*)")
    second = Metric("second", "second", pa.int64(), "COUNT(*)")

    first.metadata["display_name"] = "First"

    assert second.metadata == {}


ORDER_DATE = Dimension("orders.order_date", "order_date", pa.date32())


def test_order_term_reads_like_a_plain_pair() -> None:
    term = OrderTerm(ORDER_DATE, OrderDirection.ASC, NullPlacement.LAST)

    member, direction = term

    assert (member, direction) == (ORDER_DATE, OrderDirection.ASC)
    assert len(term) == 2
    assert term[0] is ORDER_DATE
    assert isinstance(term, tuple)
    assert null_placement(term) is NullPlacement.LAST
    assert null_placement((ORDER_DATE, OrderDirection.ASC)) is None


def test_order_term_without_placement_equals_the_plain_pair() -> None:
    pair = (ORDER_DATE, OrderDirection.ASC)
    term = OrderTerm(ORDER_DATE, OrderDirection.ASC)

    assert term == pair
    assert pair == term
    assert hash(term) == hash(pair)
    assert {term, pair} == {pair}


@pytest.mark.parametrize("nulls", list(NullPlacement))
def test_order_term_placement_distinguishes_it_from_the_plain_pair(
    nulls: NullPlacement,
) -> None:
    pair = (ORDER_DATE, OrderDirection.ASC)
    term = OrderTerm(ORDER_DATE, OrderDirection.ASC, nulls)

    assert term != pair
    assert pair != term
    assert not term == pair  # noqa: SIM201
    assert term != OrderTerm(ORDER_DATE, OrderDirection.ASC)
    assert term == OrderTerm(ORDER_DATE, OrderDirection.ASC, nulls)
    assert len({term, pair, OrderTerm(ORDER_DATE, OrderDirection.ASC, nulls)}) == 2
    assert SemanticQuery([], [ORDER_DATE], order=[term]) != SemanticQuery(
        [], [ORDER_DATE], order=[pair]
    )


def test_order_term_survives_copy_and_pickle() -> None:
    term = OrderTerm(ORDER_DATE, OrderDirection.DESC, NullPlacement.FIRST)
    query = replace(SemanticQuery([], [ORDER_DATE], order=[term]))

    for restored in (
        copy.copy(term),
        copy.deepcopy(term),
        pickle.loads(pickle.dumps(term)),  # noqa: S301
        *(query.order or []),
    ):
        assert type(restored) is OrderTerm
        assert restored == term
        assert null_placement(restored) is NullPlacement.FIRST


def test_order_term_is_immutable_and_validated() -> None:
    term = OrderTerm(ORDER_DATE, OrderDirection.ASC, NullPlacement.LAST)

    with pytest.raises(AttributeError):
        term.nulls = None
    with pytest.raises(TypeError):
        OrderTerm(ORDER_DATE, "ASC")  # type: ignore[arg-type]
    with pytest.raises(TypeError):
        OrderTerm(ORDER_DATE, OrderDirection.ASC, "LAST")  # type: ignore[arg-type]
    assert repr(term) == (
        f"OrderTerm({ORDER_DATE!r}, {OrderDirection.ASC!r}, "
        f"nulls={NullPlacement.LAST!r})"
    )
