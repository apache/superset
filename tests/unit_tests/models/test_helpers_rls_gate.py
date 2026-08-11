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
"""Tests that the query chokepoint routes every render through the RLS gate."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from pytest_mock import MockerFixture

from superset.models.helpers import ExploreMixin, QueryStringExtended
from superset.security.rls_enforcement import EnforcementDecision, EnforcementOutcome

COMPILED_SQL = "SELECT col FROM governed_table"


class _FakeDatasource(ExploreMixin):
    """Minimal ``ExploreMixin`` overriding the abstract properties it reads."""

    sql: Any = None
    catalog: Any = None
    schema: Any = None
    database: Any = None


def _make_datasource(sql: Any = None) -> ExploreMixin:
    """Build a minimal ``ExploreMixin`` whose collaborators are stubbed.

    Only the pieces ``get_query_str_extended`` touches are supplied, so the test
    exercises the chokepoint wiring without a real ORM datasource.
    """

    datasource = _FakeDatasource()
    datasource.sql = sql

    sqlaq = MagicMock()
    sqlaq.cte = None
    sqlaq.applied_template_filters = []
    sqlaq.applied_filter_columns = []
    sqlaq.rejected_filter_columns = []
    sqlaq.labels_expected = []
    sqlaq.prequeries = []
    datasource.get_sqla_query = MagicMock(return_value=sqlaq)  # type: ignore

    database = MagicMock()
    database.compile_sqla_query = MagicMock(return_value=COMPILED_SQL)
    database.mutate_sql_based_on_config = MagicMock(side_effect=lambda s: s)
    datasource.database = database

    return datasource


def test_gate_invoked_exactly_once_per_render(mocker: MockerFixture) -> None:
    # @AC-FR005-04
    spy = mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL
        ),
    )
    datasource = _make_datasource()

    datasource.get_query_str_extended({}, mutate=False)

    assert spy.call_count == 1


def test_gate_receives_compiled_sql_and_call_site_path(
    mocker: MockerFixture,
) -> None:
    # @AC-FR005-04
    spy = mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL
        ),
    )
    datasource = _make_datasource()

    datasource.get_query_str_extended({}, mutate=False)

    args, _ = spy.call_args
    # datasource, compiled_sql, identity, path
    assert args[0] is datasource
    assert args[1] == COMPILED_SQL
    assert args[3] == "get_query_str_extended"


def test_result_uses_gate_sql_unchanged_for_noop(mocker: MockerFixture) -> None:
    # @AC-FR005-04
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL
        ),
    )
    datasource = _make_datasource()

    result = datasource.get_query_str_extended({}, mutate=False)

    assert isinstance(result, QueryStringExtended)
    assert result.sql == COMPILED_SQL


def test_gate_sql_flows_into_result(mocker: MockerFixture) -> None:
    # @AC-FR005-04
    # The chokepoint must return the gate's SQL, not the raw compiled SQL, so a
    # future APPLIED rewrite reaches every consumer. No silent mangling: the
    # returned SQL is exactly what the gate handed back.
    enforced_sql = COMPILED_SQL + " WHERE tenant_id = 7"
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.APPLIED,
            sql=enforced_sql,
            applied_filter_count=1,
        ),
    )
    datasource = _make_datasource()

    result = datasource.get_query_str_extended({}, mutate=False)

    assert result.sql == enforced_sql


def test_gate_invoked_for_virtual_query_datasource(
    mocker: MockerFixture,
) -> None:
    # @AC-FR005-04
    # Cross-datasource-kind: an ad-hoc (virtual) render must also route through
    # the gate exactly once.
    spy = mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL
        ),
    )
    datasource = _make_datasource(sql="SELECT col FROM governed_table")

    result = datasource.get_query_str_extended({}, mutate=False)

    assert spy.call_count == 1
    assert result.sql == COMPILED_SQL
