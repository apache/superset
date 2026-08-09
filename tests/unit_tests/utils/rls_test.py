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
"""
Traces the exact scope of the fallback in
``superset.utils.rls.collect_rls_predicates_for_sql``: a SQL-parse failure
there makes that function return ``[]``, but this module is wired in as a
*cache-key* input only (``SqlaTable.get_extra_cache_keys``), not as part of
the code path that actually attaches RLS predicates to a query's WHERE
clause (``BaseDatasource.get_sqla_row_level_filters``, consumed directly by
``get_sqla_query``). These tests pin down that separation so a parse
failure in the cache-key helper is understood as "two differently-RLS-scoped
virtual-dataset queries can compute the same cache key contribution", not as
"RLS predicates stop being applied to the query".
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import Flask
from sqlalchemy.sql.elements import TextClause

from superset.connectors.sqla.models import BaseDatasource
from superset.utils.rls import collect_rls_predicates_for_sql


@pytest.fixture
def mock_database() -> MagicMock:
    database = MagicMock()
    database.db_engine_spec.engine = "sqlite"
    database.get_default_catalog.return_value = None
    return database


def test_collect_rls_predicates_for_sql_returns_empty_list_on_parse_failure(
    mock_database: MagicMock,
) -> None:
    """
    A SQL-parse exception inside ``collect_rls_predicates_for_sql`` is
    swallowed and the function returns ``[]`` instead of propagating.
    """
    with patch(
        "superset.sql.parse.SQLScript",
        side_effect=ValueError("cannot parse"),
    ):
        result = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )

    assert result == []


def test_parse_failure_collapses_differently_scoped_rls_into_same_cache_contribution(
    mock_database: MagicMock,
) -> None:
    """
    Two virtual datasets whose underlying RLS predicates differ (one has a
    predicate, the other has none) would normally contribute different
    strings to the cache key. If SQL parsing fails before predicates are
    even collected, both calls collapse to the same ``[]`` contribution,
    regardless of what predicates would otherwise have differentiated them.
    This is the mechanism behind the cache-key-collision concern: the
    fallback erases the very information the cache key exists to capture.
    """
    with (
        patch(
            "superset.sql.parse.SQLScript",
            side_effect=ValueError("cannot parse"),
        ),
        patch(
            "superset.utils.rls.get_predicates_for_table",
            side_effect=[["tenant_id = 1"], []],
        ) as mock_get_predicates,
    ):
        result_scoped_user = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )
        result_unscoped_user = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )

    # get_predicates_for_table was never reached: the parse exception fires
    # first, so the per-user predicate difference never had a chance to be
    # collected in the first place.
    mock_get_predicates.assert_not_called()
    assert result_scoped_user == [] == result_unscoped_user


def test_real_rls_enforcement_does_not_go_through_the_cache_key_helper(
    app: Flask,
) -> None:
    """
    ``get_sqla_row_level_filters`` -- the method ``get_sqla_query`` actually
    calls to build a query's WHERE clause -- reaches the RLS rules directly
    via ``security_manager.get_rls_filters`` and never touches
    ``collect_rls_predicates_for_sql``. So even in a request where SQL
    parsing inside the cache-key helper fails, the predicate is still
    attached to the real, executed query: the failure mode is confined to
    the cache key, not the query itself.
    """
    datasource = MagicMock(spec=BaseDatasource)
    datasource.get_template_processor.return_value = MagicMock()
    datasource.get_template_processor.return_value.process_template = lambda x: x
    datasource.text = lambda x: TextClause(x)

    configured_filter = MagicMock()
    configured_filter.clause = "tenant_id = 1"
    configured_filter.group_key = None

    with (
        patch(
            "superset.connectors.sqla.models.security_manager.get_rls_filters",
            return_value=[configured_filter],
        ),
        patch(
            "superset.connectors.sqla.models.is_feature_enabled",
            return_value=False,
        ),
        patch(
            "superset.utils.rls.collect_rls_predicates_for_sql",
            side_effect=AssertionError(
                "get_sqla_row_level_filters must not call the cache-key helper"
            ),
        ),
    ):
        filters = BaseDatasource.get_sqla_row_level_filters(datasource)

    assert len(filters) == 1
    assert "tenant_id" in str(filters[0])
