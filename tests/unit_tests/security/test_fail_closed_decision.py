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
"""Fail-closed surfacing tests: a DENIED enforcement decision at the chart
render chokepoint must raise ``ROW_LEVEL_SECURITY_UNRESOLVABLE`` (403), never
yield unfiltered SQL or a silent-empty result, and must not consult any bypass
feature flag (``RLS_IN_SQLLAB``) on the chart path.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.errors import SupersetErrorType
from superset.exceptions import SupersetSecurityException
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


def test_error_type_row_level_security_unresolvable_exists() -> None:
    # @AC-FR002-01
    assert SupersetErrorType.ROW_LEVEL_SECURITY_UNRESOLVABLE.value == (
        "ROW_LEVEL_SECURITY_UNRESOLVABLE"
    )


def test_denied_decision_raises_new_error_type(mocker: MockerFixture) -> None:
    # @AC-FR002-02
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=COMPILED_SQL,
            denial_class="parse_failure",
        ),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException) as exc_info:
        datasource.get_query_str_extended({}, mutate=False)

    assert (
        exc_info.value.error.error_type
        is SupersetErrorType.ROW_LEVEL_SECURITY_UNRESOLVABLE
    )


def test_denied_maps_to_403_not_500(mocker: MockerFixture) -> None:
    # @AC-FR002-03
    # SupersetSecurityException carries status 403; a governed deny must surface
    # as an authorization failure, not a generic 500.
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=COMPILED_SQL,
            denial_class="unsupported_dialect",
        ),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException) as exc_info:
        datasource.get_query_str_extended({}, mutate=False)

    assert exc_info.value.status == 403


def test_denied_never_returns_unfiltered_sql(mocker: MockerFixture) -> None:
    # @AC-FR002-04
    # The render must raise, not fall through to a QueryStringExtended carrying
    # the unfiltered compiled SQL (no unfiltered render, no silent-empty result).
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=COMPILED_SQL,
            denial_class="cross_db_ref",
        ),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException):
        datasource.get_query_str_extended({}, mutate=False)


def test_denial_payload_does_not_leak_sql_or_predicates(
    mocker: MockerFixture,
) -> None:
    # @AC-FR002-05
    # F1-review FR-001: the raised denial must not echo the governed SQL or the
    # denial_class internals into the user-facing message.
    governed_sql = "SELECT secret FROM tenant_secrets WHERE tenant_id = 42"
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=governed_sql,
            denial_class="alias_shadow",
        ),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException) as exc_info:
        datasource.get_query_str_extended({}, mutate=False)

    message = exc_info.value.error.message
    assert "tenant_secrets" not in message
    assert "tenant_id" not in message
    assert "alias_shadow" not in message


def test_chart_path_does_not_read_rls_in_sqllab_flag(
    mocker: MockerFixture,
) -> None:
    # @AC-FR014-01
    # Negative / no-bypass: toggling RLS_IN_SQLLAB must not convert a governed
    # DENIED chart render into an APPLIED/NOOP (silent) render. The chart gate is
    # unconditional; the SQL-Lab feature flag has no effect here.
    from superset.extensions import feature_flag_manager

    flag_spy = mocker.patch.object(
        feature_flag_manager,
        "is_feature_enabled",
        return_value=True,
    )
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.DENIED,
            sql=COMPILED_SQL,
            denial_class="parse_failure",
        ),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException):
        datasource.get_query_str_extended({}, mutate=False)

    # The deny outcome does not branch on any feature flag; if the gate consulted
    # RLS_IN_SQLLAB it would appear here.
    for call in flag_spy.call_args_list:
        assert "RLS_IN_SQLLAB" not in call.args


def test_no_bypass_flag_referenced_on_chart_enforcement_path() -> None:
    # @AC-FR014-02
    # Source-grep assertion: neither the enforcement gate nor the shared rewriter
    # reads RLS_IN_SQLLAB (that flag governs only the SQL-Lab path).
    import inspect

    import superset.security.rls_enforcement as gate
    import superset.utils.rls as rls_module

    for module in (gate, rls_module):
        source = inspect.getsource(module)
        assert "RLS_IN_SQLLAB" not in source


def test_resolvable_governed_query_still_renders_applied(
    mocker: MockerFixture,
) -> None:
    # @AC-FR002-06
    # Regression: an APPLIED decision renders the rewritten SQL (no over-deny).
    applied_sql = COMPILED_SQL + " WHERE tenant_id = 7"
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.APPLIED,
            sql=applied_sql,
            applied_filter_count=1,
        ),
    )
    datasource = _make_datasource()

    result = datasource.get_query_str_extended({}, mutate=False)

    assert isinstance(result, QueryStringExtended)
    assert result.sql == applied_sql


def test_no_rule_query_still_noops(mocker: MockerFixture) -> None:
    # @AC-FR002-07
    # Regression: a NOOP decision renders the original SQL untouched.
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL
        ),
    )
    datasource = _make_datasource()

    result = datasource.get_query_str_extended({}, mutate=False)

    assert result.sql == COMPILED_SQL
