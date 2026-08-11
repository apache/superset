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
"""Unit tests for the RLS enforcement gate seam and result types."""

import inspect
from dataclasses import fields, is_dataclass
from enum import Enum
from typing import Any

import pytest

from superset.security.rls_enforcement import (
    AccessControlTransform,
    enforce,
    EnforcementDecision,
    EnforcementOutcome,
)


class _ConformingTransform(AccessControlTransform):
    """A minimal implementation used to prove the seam is subclassable."""

    def apply_row_filters(
        self,
        datasource: Any,
        compiled_sql: str,
        identity: Any,
        path: Any,
    ) -> EnforcementDecision:
        return EnforcementDecision(
            outcome=EnforcementOutcome.NOOP,
            sql=compiled_sql,
            applied_filter_count=0,
        )


def test_access_control_transform_row_seam_is_implementable() -> None:
    # @AC-FR005-01
    transform = _ConformingTransform()
    decision = transform.apply_row_filters(object(), "SELECT 1", object(), None)
    assert isinstance(decision, EnforcementDecision)
    assert decision.outcome is EnforcementOutcome.NOOP


def test_apply_column_masks_raises_not_implemented() -> None:
    # @AC-FR005-01
    transform = _ConformingTransform()
    with pytest.raises(NotImplementedError):
        transform.apply_column_masks(object(), "SELECT 1", object(), None)


def test_enforcement_outcome_enum_values() -> None:
    # @AC-FR005-02
    assert issubclass(EnforcementOutcome, Enum)
    names = {member.name for member in EnforcementOutcome}
    assert names == {"APPLIED", "NOOP", "DENIED"}


def test_enforcement_decision_is_dataclass_with_expected_fields() -> None:
    # @AC-FR005-02
    assert is_dataclass(EnforcementDecision)
    field_names = {f.name for f in fields(EnforcementDecision)}
    expected = {
        "outcome",
        "sql",
        "applied_filter_count",
        "denial_class",
        "evidence",
    }
    assert expected <= field_names


def test_enforcement_decision_defaults() -> None:
    # @AC-FR005-02
    decision = EnforcementDecision(
        outcome=EnforcementOutcome.APPLIED,
        sql="SELECT 1 WHERE 1=1",
        applied_filter_count=1,
    )
    assert decision.denial_class is None
    assert decision.applied_filter_count == 1


def test_enforce_has_stable_typed_signature() -> None:
    # @AC-FR005-02
    # eval_str resolves PEP 563 (``from __future__ import annotations``) string
    # annotations back to the real objects the seam commits to.
    signature = inspect.signature(enforce, eval_str=True)
    assert list(signature.parameters) == [
        "datasource",
        "compiled_sql",
        "identity",
        "path",
    ]
    assert signature.return_annotation is EnforcementDecision
    # every parameter carries a type annotation (stable, fully typed seam)
    for parameter in signature.parameters.values():
        assert parameter.annotation is not inspect.Parameter.empty


def test_enforce_classifies_sqla_table_and_returns_sql_unchanged() -> None:
    # @AC-FR005-03
    from unittest.mock import MagicMock

    from superset.connectors.sqla.models import SqlaTable

    datasource = MagicMock(spec=SqlaTable)
    compiled_sql = "SELECT a, b FROM some_table"
    decision = enforce(datasource, compiled_sql, None, "get_query_str_extended")

    assert isinstance(decision, EnforcementDecision)
    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.sql == compiled_sql
    assert decision.applied_filter_count == 0
    assert decision.denial_class is None


def test_enforce_classifies_query_and_returns_sql_unchanged(mocker: Any) -> None:
    # @AC-FR005-03
    from unittest.mock import MagicMock

    import superset.utils.rls as rls_module
    from superset.models.sql_lab import Query
    from superset.sql.parse import RLSMethod

    # A realistic Query datasource: a real engine (so the fail-closed classifier
    # can parse it) whose table has no applicable rule, so the gate is a NOOP.
    datasource = MagicMock(spec=Query)
    database = MagicMock()
    database.id = 1
    database.db_engine_spec.engine = "postgresql"
    database.db_engine_spec.get_rls_method.return_value = RLSMethod.AS_PREDICATE
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    datasource.database = database
    datasource.catalog = None
    datasource.schema = "public"
    mocker.patch.object(rls_module, "get_predicates_for_table", return_value=[])

    compiled_sql = "SELECT a FROM some_table"
    decision = enforce(datasource, compiled_sql, None, "get_query_str_extended")

    assert isinstance(decision, EnforcementDecision)
    assert decision.outcome is EnforcementOutcome.NOOP
    assert decision.sql == compiled_sql
    assert decision.applied_filter_count == 0
    assert decision.denial_class is None


def test_enforce_does_not_mangle_sql_for_unknown_datasource() -> None:
    # @AC-FR005-03
    # An unrecognized datasource kind must still preserve the SQL verbatim
    # (behavior-preserving); it must not raise NotImplementedError.
    compiled_sql = "SELECT * FROM t"
    decision = enforce(object(), compiled_sql, None, "get_query_str_extended")

    assert decision.sql == compiled_sql
    assert decision.outcome is EnforcementOutcome.NOOP
