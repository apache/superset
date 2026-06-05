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

# pylint: disable=invalid-name

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.semantic_layers.rls import (
    apply_rls_to_virtual_sql,
    get_rls_method,
    render_rls_predicates,
)
from superset.sql.parse import RLSMethod


def _make_dataset(
    *,
    sql: str | None = None,
    rls_clauses: list | None = None,
) -> MagicMock:
    ds = MagicMock()
    ds.id = 1
    ds.catalog = None
    ds.schema = "public"
    ds.sql = sql
    ds.database.db_engine_spec.engine = "postgresql"
    ds.database.get_default_schema.return_value = "public"
    ds.get_sqla_row_level_filters.return_value = rls_clauses or []
    return ds


def test_get_rls_method_delegates_to_engine_spec() -> None:
    ds = _make_dataset()
    ds.database.db_engine_spec.get_rls_method.return_value = RLSMethod.AS_SUBQUERY
    assert get_rls_method(ds) == RLSMethod.AS_SUBQUERY


def test_render_rls_predicates_empty_when_no_rules() -> None:
    ds = _make_dataset()
    assert render_rls_predicates(ds) == []


def test_render_rls_predicates_compiles_each_clause() -> None:
    clause1 = MagicMock()
    clause1.compile.return_value = "tenant_id = 7"
    clause2 = MagicMock()
    clause2.compile.return_value = "deleted = false"
    ds = _make_dataset(rls_clauses=[clause1, clause2])

    result = render_rls_predicates(ds)
    assert result == ["tenant_id = 7", "deleted = false"]
    # Each clause is compiled with literal_binds so values are inlined.
    for clause in (clause1, clause2):
        kwargs = clause.compile.call_args.kwargs
        assert kwargs["compile_kwargs"] == {"literal_binds": True}


def test_apply_rls_to_virtual_sql_returns_none_for_physical(mocker: MockerFixture) -> None:
    ds = _make_dataset()
    assert apply_rls_to_virtual_sql(ds) is None


def test_apply_rls_to_virtual_sql_returns_none_when_no_rls_applied(
    mocker: MockerFixture,
) -> None:
    ds = _make_dataset(sql="SELECT * FROM raw_orders")
    # apply_rls returns False → no predicates were injected.
    mocker.patch("superset.semantic_layers.rls.apply_rls", return_value=False)
    assert apply_rls_to_virtual_sql(ds) is None


def test_apply_rls_to_virtual_sql_returns_rewritten_when_applied(
    mocker: MockerFixture,
) -> None:
    ds = _make_dataset(sql="SELECT * FROM raw_orders")
    fake_script = MagicMock()
    fake_statement = MagicMock()
    fake_script.statements = [fake_statement]
    fake_script.format.return_value = "SELECT * FROM raw_orders WHERE x = 1"
    mocker.patch(
        "superset.semantic_layers.rls.SQLScript",
        return_value=fake_script,
    )
    mocker.patch("superset.semantic_layers.rls.apply_rls", return_value=True)

    result = apply_rls_to_virtual_sql(ds)
    assert result == "SELECT * FROM raw_orders WHERE x = 1"


def test_apply_rls_to_virtual_sql_swallows_parse_error(mocker: MockerFixture) -> None:
    ds = _make_dataset(sql="totally invalid sql")
    mocker.patch(
        "superset.semantic_layers.rls.SQLScript",
        side_effect=Exception("parse error"),
    )
    assert apply_rls_to_virtual_sql(ds) is None


def test_apply_rls_to_virtual_sql_swallows_apply_error(mocker: MockerFixture) -> None:
    ds = _make_dataset(sql="SELECT * FROM raw_orders")
    fake_script = MagicMock()
    fake_script.statements = [MagicMock()]
    mocker.patch(
        "superset.semantic_layers.rls.SQLScript",
        return_value=fake_script,
    )
    mocker.patch(
        "superset.semantic_layers.rls.apply_rls",
        side_effect=Exception("boom"),
    )
    assert apply_rls_to_virtual_sql(ds) is None


def test_apply_rls_to_virtual_sql_uses_default_schema_when_dataset_schema_missing(
    mocker: MockerFixture,
) -> None:
    ds = _make_dataset(sql="SELECT * FROM raw_orders")
    ds.schema = None
    fake_script = MagicMock()
    fake_statement = MagicMock()
    fake_script.statements = [fake_statement]
    mocker.patch(
        "superset.semantic_layers.rls.SQLScript",
        return_value=fake_script,
    )
    apply_rls_mock = mocker.patch(
        "superset.semantic_layers.rls.apply_rls",
        return_value=False,
    )

    apply_rls_to_virtual_sql(ds)
    # default_schema was "public" from get_default_schema; that should be the
    # schema arg passed to apply_rls.
    args, kwargs = apply_rls_mock.call_args
    assert args[2] == "public" or kwargs.get("schema") == "public"


def test_render_rls_predicates_uses_dialect_for_compile() -> None:
    clause = MagicMock()
    clause.compile.return_value = "x = 1"
    ds = _make_dataset(rls_clauses=[clause])

    render_rls_predicates(ds)
    kwargs = clause.compile.call_args.kwargs
    # Verify the dialect from the database is passed (not asserting identity,
    # just that ``dialect=`` got a value).
    assert "dialect" in kwargs
