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
"""Guest-token ``extras.where`` validation of the empty-filter predicate.

A native Select filter with "Filter value is required" enabled and no value
selected makes the frontend emit an adhoc SQL filter carrying
``EMPTY_FILTER_SQL_EXPRESSION``. The guest-token custom-SQL check must allow
that predicate, or an embedded chart is rejected before the viewer has picked
a value.

These tests are written against the constant rather than its literal value, so
they fail if the security manager's allow-list ever stops tracking the shared
constant the producers read.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

from superset.constants import EMPTY_FILTER_SQL_EXPRESSION
from superset.security.manager import _sql_filters_modified


def _query(where: str) -> MagicMock:
    """One query in a guest request's query context, carrying ``extras.where``."""
    query = MagicMock()
    query.extras = {"where": where}
    query.filters = []
    return query


def _query_context(where: str) -> MagicMock:
    """A guest request's query context with a single query."""
    query_context = MagicMock()
    query_context._from_cache_replay = False
    query_context.queries = [_query(where)]
    return query_context


def _stored_chart(params: dict[str, Any] | None = None) -> MagicMock:
    """A stored chart with no custom SQL of its own to borrow."""
    chart = MagicMock()
    chart.id = 1
    chart.params_dict = params or {}
    return chart


def _sanitized(expression: str) -> str:
    """Mirror ``_sanitize_clause``, which wraps each expression in parens."""
    return f"({expression})"


def test_unselected_required_select_filter_passes_extras_validation() -> None:
    """The empty-filter predicate is not custom SQL a guest may not send."""
    assert (
        _sql_filters_modified(
            _query_context(_sanitized(EMPTY_FILTER_SQL_EXPRESSION)),
            form_data={},
            stored_chart=_stored_chart(),
            stored_query_context=None,
        )
        is False
    )


def test_empty_filter_predicate_is_allowed_alongside_stored_sql() -> None:
    """A required-but-empty filter composes with the chart's own adhoc SQL."""
    stored_sql = "country = 'FR'"
    composed = " AND ".join(
        (_sanitized(stored_sql), _sanitized(EMPTY_FILTER_SQL_EXPRESSION))
    )
    stored_chart = _stored_chart(
        {
            "adhoc_filters": [
                {"expressionType": "SQL", "sqlExpression": stored_sql},
            ]
        }
    )
    assert (
        _sql_filters_modified(
            _query_context(composed),
            form_data={},
            stored_chart=stored_chart,
            stored_query_context=None,
        )
        is False
    )


def test_other_injected_sql_is_still_rejected() -> None:
    """Allowing the sentinel does not open the vector it guards."""
    assert (
        _sql_filters_modified(
            _query_context(_sanitized("1 = 1")),
            form_data={},
            stored_chart=_stored_chart(),
            stored_query_context=None,
        )
        is True
    )
