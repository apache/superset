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
"""Element-level array filter operators (Contains Any/All, Is empty/not empty)."""

from __future__ import annotations

from typing import Any, cast

import pytest
from flask import Flask
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.superset_typing import QueryObjectDict
from superset.utils.core import FilterOperator


def _make_dataset(mocker: MockerFixture) -> SqlaTable:
    database = Database(id=1, database_name="test_db", sqlalchemy_uri="sqlite://")
    columns = [
        TableColumn(column_name="skills", type="Array(String)"),
        TableColumn(column_name="scores", type="Array(Int32)"),
        TableColumn(column_name="city", type="VARCHAR(100)"),
    ]
    dataset = SqlaTable(
        table_name="jobs",
        columns=columns,
        database=database,
        metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )
    return dataset


def _clickhouse(mocker: MockerFixture, dataset: SqlaTable) -> None:
    # Imported lazily: clickhouse.py touches app.config at import time.
    from superset.db_engine_specs.clickhouse import ClickHouseEngineSpec

    mocker.patch.object(
        SqlaTable, "db_engine_spec", new=property(lambda self: ClickHouseEngineSpec)
    )


def _filter_query(filters: list[dict[str, Any]]) -> QueryObjectDict:
    return cast(
        QueryObjectDict,
        {
            "granularity": None,
            "from_dttm": None,
            "to_dttm": None,
            "is_timeseries": False,
            "groupby": ["city"],
            "metrics": ["count"],
            "filter": filters,
            "columns": [],
        },
    )


def _sql(dataset: SqlaTable, filters: list[dict[str, Any]]) -> str:
    return dataset.get_query_str_extended(
        _filter_query(filters), mutate=False
    ).sql.lower()


def test_contains_any_generates_hasany(mocker: MockerFixture, app: Flask) -> None:
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [
                {
                    "col": "skills",
                    "op": FilterOperator.CONTAINS_ANY.value,
                    "val": ["Driver", "Cook"],
                }
            ],
        )
    assert "hasany(skills, array('driver', 'cook'))" in sql


def test_contains_any_numeric_array_coerces_values(
    mocker: MockerFixture, app: Flask
) -> None:
    """Values for a numeric array must render as numbers, not quoted strings."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [
                {
                    "col": "scores",
                    "op": FilterOperator.CONTAINS_ANY.value,
                    "val": ["5", "6"],
                }
            ],
        )
    assert "hasany(scores, array(5, 6))" in sql
    assert "'5'" not in sql


def test_equals_numeric_array_coerces_values(mocker: MockerFixture, app: Flask) -> None:
    """Whole-array equality on a numeric array coerces the parsed literal."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [
                {
                    "col": "scores",
                    "op": FilterOperator.EQUALS.value,
                    "val": "[5, 6]",
                }
            ],
        )
    assert "scores = array(5, 6)" in sql


def test_contains_all_generates_hasall(mocker: MockerFixture, app: Flask) -> None:
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [
                {
                    "col": "skills",
                    "op": FilterOperator.CONTAINS_ALL.value,
                    "val": ["Driver", "Cook"],
                }
            ],
        )
    assert "hasall(skills, array('driver', 'cook'))" in sql


def test_is_empty_generates_length_zero(mocker: MockerFixture, app: Flask) -> None:
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(dataset, [{"col": "skills", "op": FilterOperator.IS_EMPTY.value}])
    assert "length(skills) = 0" in sql


def test_is_not_empty_generates_length_gt_zero(
    mocker: MockerFixture, app: Flask
) -> None:
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset, [{"col": "skills", "op": FilterOperator.IS_NOT_EMPTY.value}]
        )
    assert "length(skills) > 0" in sql


def test_contains_resolves_to_hasany(mocker: MockerFixture, app: Flask) -> None:
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [
                {
                    "col": "skills",
                    "op": FilterOperator.CONTAINS_ANY.value,
                    "val": ["Driver"],
                }
            ],
        )
    assert "hasany(skills" in sql


def test_element_op_on_scalar_column_raises(mocker: MockerFixture, app: Flask) -> None:
    """CONTAINS_ANY on a scalar column is rejected on an array-capable engine."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            _sql(
                dataset,
                [
                    {
                        "col": "city",
                        "op": FilterOperator.CONTAINS_ANY.value,
                        "val": ["NYC"],
                    }
                ],
            )


def test_element_op_unsupported_engine_raises(
    mocker: MockerFixture, app: Flask
) -> None:
    """On an engine without array support (sqlite) the array op is rejected."""
    dataset = _make_dataset(mocker)
    with app.test_request_context():  # noqa: SIM117
        with pytest.raises(QueryObjectValidationError):
            _sql(dataset, [{"col": "skills", "op": FilterOperator.IS_EMPTY.value}])


def test_equals_on_array_parses_literal(mocker: MockerFixture, app: Flask) -> None:
    """A pasted array literal for = is parsed into col = array(...)."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [
                {
                    "col": "skills",
                    "op": FilterOperator.EQUALS.value,
                    "val": "['Driver', 'Cook']",
                }
            ],
        )
    assert "skills = array('driver', 'cook')" in sql


def test_equals_on_array_plain_value_fallback(
    mocker: MockerFixture, app: Flask
) -> None:
    """A plain (non-bracketed) value becomes a single-element array."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [{"col": "skills", "op": FilterOperator.EQUALS.value, "val": "Driver"}],
        )
    assert "skills = array('driver')" in sql


def test_in_on_array_parses_literals(mocker: MockerFixture, app: Flask) -> None:
    """Whole-array IN parses each pasted array literal into its own array."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(
            dataset,
            [
                {
                    "col": "skills",
                    "op": FilterOperator.IN.value,
                    "val": ["['Driver']", "['Cook']"],
                }
            ],
        )
    assert "skills in (array('driver'), array('cook'))" in sql


@pytest.mark.parametrize(
    "flt, negated_sql",
    [
        pytest.param(
            {
                "col": "skills",
                "op": FilterOperator.NOT_EQUALS.value,
                "val": "['Driver', 'Cook']",
            },
            "skills != array('driver', 'cook')",
            id="not-equals",
        ),
        pytest.param(
            {
                "col": "skills",
                "op": FilterOperator.NOT_EQUALS.value,
                "val": "Driver",
            },
            "skills != array('driver')",
            id="not-equals-plain-value",
        ),
        pytest.param(
            {
                "col": "skills",
                "op": FilterOperator.NOT_EQUALS.value,
                "val": "[]",
            },
            "skills != array()",
            id="not-equals-empty-array",
        ),
        pytest.param(
            {
                "col": "scores",
                "op": FilterOperator.NOT_EQUALS.value,
                "val": "[0]",
            },
            "scores != array(0)",
            id="not-equals-zero-element",
        ),
        pytest.param(
            {
                "col": "skills",
                "op": FilterOperator.NOT_IN.value,
                "val": ["['Driver']", "['Cook']"],
            },
            "skills not in (array('driver'), array('cook'))",
            id="not-in",
        ),
        # Raw (non-string) values: the array literal comes from ``val`` itself,
        # never from the scalar operand, which would collapse ``[]`` to NULL and
        # ``[0]`` to the falsy ``0``. Every one of these is a real array.
        pytest.param(
            {"col": "skills", "op": FilterOperator.NOT_EQUALS.value, "val": []},
            "skills != array()",
            id="not-equals-raw-empty-list",
        ),
        pytest.param(
            {"col": "scores", "op": FilterOperator.NOT_EQUALS.value, "val": [0]},
            "scores != array(0)",
            id="not-equals-raw-zero-list",
        ),
        pytest.param(
            {"col": "skills", "op": FilterOperator.NOT_EQUALS.value, "val": [None]},
            "skills != array(null)",
            id="not-equals-raw-null-element",
        ),
        pytest.param(
            {"col": "skills", "op": FilterOperator.NOT_IN.value, "val": [[]]},
            "skills not in (array())",
            id="not-in-raw-empty-array",
        ),
        pytest.param(
            {"col": "scores", "op": FilterOperator.NOT_IN.value, "val": [[0]]},
            "scores not in (array(0))",
            id="not-in-raw-zero-array",
        ),
        pytest.param(
            {"col": "scores", "op": FilterOperator.NOT_IN.value, "val": [0]},
            "scores not in (array(0))",
            id="not-in-raw-zero-candidate",
        ),
        pytest.param(
            {"col": "skills", "op": FilterOperator.NOT_IN.value, "val": []},
            "skills not in (",
            id="not-in-raw-empty-candidate-list",
        ),
    ],
)
def test_negated_whole_array_filter_keeps_null_arrays(
    mocker: MockerFixture, app: Flask, flt: dict[str, Any], negated_sql: str
) -> None:
    """
    Whole-array ``!=`` and ``NOT IN`` only exclude the arrays they name, so a
    row whose array column is NULL is kept. These are compile-level checks: an
    array comparison cannot run on SQLite, and array elements (not the arrays
    themselves) are the only nullable part of a ClickHouse array, so this is
    defensive coverage of the same policy as the scalar operators.
    """
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(dataset, [flt])
    assert negated_sql in sql
    assert f"{flt['col']} is null" in sql


@pytest.mark.parametrize(
    "flt",
    [
        pytest.param(
            {"col": "skills", "op": FilterOperator.EQUALS.value, "val": "['Driver']"},
            id="equals",
        ),
        pytest.param(
            {"col": "skills", "op": FilterOperator.IN.value, "val": ["['Driver']"]},
            id="in",
        ),
        pytest.param(
            {
                "col": "skills",
                "op": FilterOperator.CONTAINS_ANY.value,
                "val": ["Driver"],
            },
            id="contains-any",
        ),
    ],
)
def test_non_negated_whole_array_filter_has_no_null_check(
    mocker: MockerFixture, app: Flask, flt: dict[str, Any]
) -> None:
    """Operators that are not negations do not gain a NULL check."""
    dataset = _make_dataset(mocker)
    _clickhouse(mocker, dataset)
    with app.test_request_context():
        sql = _sql(dataset, [flt])
    assert "is null" not in sql
