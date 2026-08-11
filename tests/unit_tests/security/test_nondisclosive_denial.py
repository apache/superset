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
"""Non-disclosive denial payload + timing-safety (FR-11, NFR-2).

A DENIED enforcement decision surfaced at the chart render chokepoint must hand
the CLIENT a fixed, generic message that carries NO governed metadata — no table
names, no denial_class, no rule identifiers, no row counts, no SQL fragment, and
no "a rule exists for you" signal. The full detail (denial_class, tables) is
retained server-side (log record) for the F5 evidence sink. The deny decision is
structural (classifier), never data-dependent: the query executor is not touched
on the DENIED path.
"""

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.errors import SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import ExploreMixin, QueryStringExtended
from superset.security.rls_enforcement import (
    DENIAL_MESSAGE,
    EnforcementDecision,
    EnforcementOutcome,
)

COMPILED_SQL = "SELECT secret FROM tenant_secrets WHERE tenant_id = 42"

DENIAL_CLASSES = (
    "parse_failure",
    "unsupported_dialect",
    "dynamic_sql",
    "cross_db_ref",
    "alias_shadow",
    "semantic_mismatch",
)


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


def _deny(denial_class: str, sql: str = COMPILED_SQL) -> EnforcementDecision:
    return EnforcementDecision(
        outcome=EnforcementOutcome.DENIED,
        sql=sql,
        denial_class=denial_class,
    )


# ---------------------------------------------------------------------------
# Payload non-disclosure — the client message is the fixed constant and carries
# none of: table name, denial_class, rule id, row count, SQL text.
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("denial_class", DENIAL_CLASSES)
def test_denial_message_is_fixed_constant(
    denial_class: str, mocker: MockerFixture
) -> None:
    # @AC-FR011-01
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=_deny(denial_class),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException) as exc_info:
        datasource.get_query_str_extended({}, mutate=False)

    message = exc_info.value.error.message
    assert message == DENIAL_MESSAGE
    # No governed metadata leaks into the client-facing message.
    assert "tenant_secrets" not in message
    assert "tenant_id" not in message
    assert "secret" not in message
    assert denial_class not in message
    assert "42" not in message
    assert "SELECT" not in message


def test_denial_message_carries_no_rule_existence_signal(
    mocker: MockerFixture,
) -> None:
    # @AC-FR011-02
    # Two distinct denial classes — one that implies a rule exists for the
    # identity (alias_shadow) and one that is merely unresolvable structurally
    # (parse_failure) — must produce the IDENTICAL client payload.
    datasource_a = _make_datasource()
    mocker.patch(
        "superset.models.helpers.enforce", return_value=_deny("alias_shadow")
    )
    with pytest.raises(SupersetSecurityException) as exc_a:
        datasource_a.get_query_str_extended({}, mutate=False)

    datasource_b = _make_datasource()
    mocker.patch(
        "superset.models.helpers.enforce", return_value=_deny("parse_failure")
    )
    with pytest.raises(SupersetSecurityException) as exc_b:
        datasource_b.get_query_str_extended({}, mutate=False)

    assert exc_a.value.error.message == exc_b.value.error.message == DENIAL_MESSAGE
    assert exc_a.value.error.error_type is exc_b.value.error.error_type


def test_denial_message_is_generic_and_non_empty() -> None:
    # @AC-FR011-03
    # The fixed copy is a real user-facing security message, not a placeholder,
    # and does not name any FR-3 denial class.
    text = str(DENIAL_MESSAGE)
    assert text.strip()
    for denial_class in DENIAL_CLASSES:
        assert denial_class not in text


# ---------------------------------------------------------------------------
# Detail-goes-server-side — denial_class detail is retained for the F5 evidence
# sink via a server-side log record (non-disclosure is client-only, not loss).
# ---------------------------------------------------------------------------
def test_denial_class_detail_logged_server_side(
    mocker: MockerFixture, caplog: pytest.LogCaptureFixture
) -> None:
    # @AC-FR011-04
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=_deny("alias_shadow"),
    )
    datasource = _make_datasource()

    with caplog.at_level(logging.WARNING, logger="superset.models.helpers"):
        with pytest.raises(SupersetSecurityException):
            datasource.get_query_str_extended({}, mutate=False)

    server_text = caplog.text
    # The sensitive denial_class is available server-side for evidence.
    assert "alias_shadow" in server_text


# ---------------------------------------------------------------------------
# Timing / data-independence — the DENIED path does not execute the query or
# inspect result rows; the deny decision is structural, not content-dependent.
# ---------------------------------------------------------------------------
def test_denied_path_does_not_execute_query(mocker: MockerFixture) -> None:
    # @AC-FR011-05
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=_deny("cross_db_ref"),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException):
        datasource.get_query_str_extended({}, mutate=False)

    # The deny short-circuits before any SQL is handed to the executor: the
    # render must not even reach the config-mutation step that precedes running.
    datasource.database.mutate_sql_based_on_config.assert_not_called()


def test_two_denials_identical_payload_no_timing_branch(
    mocker: MockerFixture,
) -> None:
    # @AC-FR011-06
    # A denial where a rule exists for the identity (alias_shadow) and one where
    # the query is simply unresolvable (parse_failure) go through the identical
    # code path — no branch inspects row data before denying.
    for denial_class in ("alias_shadow", "parse_failure"):
        mocker.patch(
            "superset.models.helpers.enforce",
            return_value=_deny(denial_class),
        )
        datasource = _make_datasource()
        with pytest.raises(SupersetSecurityException) as exc_info:
            datasource.get_query_str_extended({}, mutate=False)
        assert exc_info.value.error.message == DENIAL_MESSAGE
        datasource.database.mutate_sql_based_on_config.assert_not_called()


# ---------------------------------------------------------------------------
# Regression — resolvable governed query still APPLIED; no-rule still NOOP.
# ---------------------------------------------------------------------------
def test_applied_still_renders_rewritten_sql(mocker: MockerFixture) -> None:
    # @AC-FR011-07
    applied_sql = COMPILED_SQL + " AND tenant_id = 7"
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


def test_noop_still_renders_verbatim(mocker: MockerFixture) -> None:
    # @AC-FR011-08
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=EnforcementDecision(
            outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL
        ),
    )
    datasource = _make_datasource()

    result = datasource.get_query_str_extended({}, mutate=False)

    assert result.sql == COMPILED_SQL


def test_denied_error_type_unchanged(mocker: MockerFixture) -> None:
    # @AC-FR011-09
    # Non-disclosure changes only the message, not the structured error type.
    mocker.patch(
        "superset.models.helpers.enforce",
        return_value=_deny("parse_failure"),
    )
    datasource = _make_datasource()

    with pytest.raises(SupersetSecurityException) as exc_info:
        datasource.get_query_str_extended({}, mutate=False)

    assert (
        exc_info.value.error.error_type
        is SupersetErrorType.ROW_LEVEL_SECURITY_UNRESOLVABLE
    )
