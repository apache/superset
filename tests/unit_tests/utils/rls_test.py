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
there makes that function return a per-user marker instead of the real
predicates, but this module is wired in as a *cache-key* input only
(``SqlaTable.get_extra_cache_keys``), not as part of the code path that
actually attaches RLS predicates to a query's WHERE clause
(``BaseDatasource.get_sqla_row_level_filters``, consumed directly by
``get_sqla_query``). These tests pin down that separation: a parse failure
in the cache-key helper only ever affects the cache key contribution (kept
distinct per user via the marker), and never "RLS predicates stop being
applied to the query".
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


def test_collect_rls_predicates_for_sql_returns_per_user_sentinel_on_parse_failure(
    mock_database: MagicMock,
) -> None:
    """
    A SQL-parse exception inside ``collect_rls_predicates_for_sql`` is
    swallowed, and the function returns a marker derived from the current
    user's id instead of propagating the exception or silently returning an
    empty list.
    """
    with (
        patch(
            "superset.sql.parse.SQLScript",
            side_effect=ValueError("cannot parse"),
        ),
        patch("superset.utils.rls.get_user_id", return_value=42),
    ):
        result = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )

    assert result == ["rls-predicate-parse-failed-for-user-42"]


def test_parse_failure_produces_different_cache_contributions_for_different_users(
    mock_database: MagicMock,
) -> None:
    """
    Two virtual datasets whose underlying RLS predicates differ (one has a
    predicate, the other has none) would normally contribute different
    strings to the cache key. If SQL parsing fails before predicates are
    even collected, the actual predicate difference never gets a chance to
    be collected -- but each user still contributes a marker scoped to their
    own id, so the two calls don't collapse onto the same cache key
    contribution.
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
        patch(
            "superset.utils.rls.get_user_id",
            side_effect=[1, 2],
        ),
    ):
        result_user_one = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )
        result_user_two = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )

    # get_predicates_for_table was never reached: the parse exception fires
    # first, so the per-user predicate difference never had a chance to be
    # collected in the first place.
    mock_get_predicates.assert_not_called()
    assert result_user_one != result_user_two
    assert result_user_one == ["rls-predicate-parse-failed-for-user-1"]
    assert result_user_two == ["rls-predicate-parse-failed-for-user-2"]


def test_parse_failure_sentinel_distinguishes_guest_tokens_by_rls_scope(
    mock_database: MagicMock,
) -> None:
    """
    ``get_user_id()`` always returns ``None`` for guest users, so keying the
    parse-failure sentinel on it alone would collapse every guest token onto
    the same cache contribution regardless of the RLS rules baked into each
    token. Guest sessions must instead be distinguished by (a hash of) their
    own token's ``rls_rules``, so two guests with different row-level scopes
    never share a cache entry, while two guests with the *same* scope do.
    """

    def _guest_user(rls_rules: list[dict[str, str]]) -> MagicMock:
        guest_user = MagicMock()
        guest_user.guest_token = {"rls_rules": rls_rules}
        return guest_user

    scope_a = [{"dataset": "1", "clause": "tenant_id = 1"}]
    scope_b = [{"dataset": "1", "clause": "tenant_id = 2"}]

    with (
        patch(
            "superset.sql.parse.SQLScript",
            side_effect=ValueError("cannot parse"),
        ),
        patch(
            "superset.utils.rls.security_manager.get_current_guest_user_if_guest",
            side_effect=[
                _guest_user(scope_a),
                _guest_user(scope_b),
                _guest_user(scope_a),
            ],
        ),
    ):
        result_guest_scope_a = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )
        result_guest_scope_b = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )
        result_guest_scope_a_again = collect_rls_predicates_for_sql(
            "SELECT * FROM some_table",
            mock_database,
            catalog=None,
            schema="public",
        )

    assert result_guest_scope_a[0].startswith(
        "rls-predicate-parse-failed-for-user-guest-"
    )
    assert result_guest_scope_a != result_guest_scope_b
    assert result_guest_scope_a == result_guest_scope_a_again


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
