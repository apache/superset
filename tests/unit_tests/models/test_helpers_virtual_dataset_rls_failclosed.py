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
"""Fail-closed regression for the SqlaTable virtual-dataset inner-SQL RLS path.

FR-001 / ISSUE-002 (F2 feature review, CRITICAL fail-open): ``get_from_clause``
applies RLS to a virtual dataset's inner SQL via ``superset.utils.rls.apply_rls``
wrapped in ``try/except Exception``. Historically ANY failure was swallowed and
the ORIGINAL, unfiltered SQL was rendered ("best-effort"). Because the
enforcement gate returns NOOP for SqlaTable (trusting this upstream injection),
there was no second net -> an RLS bypass for a governed virtual dataset.

These tests pin the fail-closed contract: an ``apply_rls`` failure DENIES with a
non-disclosive ``ROW_LEVEL_SECURITY_UNRESOLVABLE`` instead of rendering
unfiltered, while the ungoverned (returns ``False``) and applied (returns
``True``) paths are unchanged.
"""

from __future__ import annotations

from typing import Any

import pytest

from superset.errors import SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import ExploreMixin
from superset.security.rls_enforcement import DENIAL_MESSAGE

VIRTUAL_SQL = "SELECT col FROM governed_orders"


def _make_virtual_datasource() -> ExploreMixin:
    """A virtual (``sql``-backed) datasource wired to a sqlite engine spec."""
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    class _FakeDatasource(ExploreMixin):
        """Minimal ``ExploreMixin`` exposing only what ``get_from_clause`` reads.

        ``db_engine_spec`` is a plain class attribute so it shadows the abstract
        property that ``ExploreMixin`` raises ``NotImplementedError`` from.
        """

        sql: Any = None
        catalog: Any = None
        schema: Any = None
        database: Any = None
        id: Any = None
        db_engine_spec: Any = SqliteEngineSpec

    datasource = _FakeDatasource()
    datasource.sql = VIRTUAL_SQL
    datasource.catalog = None
    datasource.schema = "main"
    datasource.id = 7

    class _DB:
        db_engine_spec = SqliteEngineSpec

        def get_default_schema(self, _catalog: Any) -> str:
            return "main"

    datasource.database = _DB()  # type: ignore[assignment]
    return datasource


# @AC-FR002-01
def test_apply_rls_failure_denies_and_does_not_render_unfiltered(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """FAIL-CLOSED: when ``apply_rls`` raises for a governed virtual dataset,
    ``get_from_clause`` must raise a non-disclosive
    ``ROW_LEVEL_SECURITY_UNRESOLVABLE`` denial rather than return the original,
    unfiltered from-clause."""

    leaky_table = "governed_orders"
    leaky_sql_fragment = "col FROM governed_orders"

    def _boom(*_args: Any, **_kwargs: Any) -> bool:
        raise ValueError(
            f"stored RLS clause unparseable for {leaky_table}: {leaky_sql_fragment}"
        )

    monkeypatch.setattr("superset.models.helpers.apply_rls", _boom)

    datasource = _make_virtual_datasource()

    with pytest.raises(SupersetSecurityException) as exc_info:
        datasource.get_from_clause()

    error = exc_info.value.error
    assert error.error_type == SupersetErrorType.ROW_LEVEL_SECURITY_UNRESOLVABLE
    # Client message is the fixed, non-disclosive constant...
    assert error.message == str(DENIAL_MESSAGE)
    # ...and leaks NO table name, SQL, or exception detail.
    assert leaky_table not in error.message
    assert leaky_sql_fragment not in error.message
    assert "unparseable" not in error.message


# @AC-FR002-02
def test_ungoverned_dataset_not_denied_and_sql_unchanged(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """NO OVER-DENY: when ``apply_rls`` returns ``False`` for every statement
    (ungoverned -- no RLS rule), ``get_from_clause`` returns normally and the
    inner SQL is untouched (no denial, no round-trip reformat)."""

    def _no_rule(*_args: Any, **_kwargs: Any) -> bool:
        return False

    monkeypatch.setattr("superset.models.helpers.apply_rls", _no_rule)

    datasource = _make_virtual_datasource()

    from_clause, cte = datasource.get_from_clause()

    assert from_clause is not None
    # The rendered inner SQL still carries the original relation, unfiltered by
    # design because the dataset provably carries no RLS predicate.
    assert "governed_orders" in str(from_clause)


# @AC-FR002-03
def test_apply_rls_true_reformats_sql(monkeypatch: pytest.MonkeyPatch) -> None:
    """APPLIED still works: when ``apply_rls`` reports ``True`` for a statement,
    ``get_from_clause`` reformats via ``parsed_script.format()`` (the predicate
    the real ``apply_rls`` would have injected into the statement is preserved)."""

    def _apply(database: Any, catalog: Any, schema: Any, statement: Any, **_k: Any):
        # Emulate the real apply_rls contract: it mutates the parsed statement in
        # place and returns True when a predicate was injected. Rewrite the
        # statement's WHERE so the reformatted SQL is observably filtered.
        statement._parsed = statement._parsed.where("tenant_id = 3")
        return True

    monkeypatch.setattr("superset.models.helpers.apply_rls", _apply)

    datasource = _make_virtual_datasource()

    from_clause, _cte = datasource.get_from_clause()

    rendered = str(from_clause)
    assert "tenant_id" in rendered


# @AC-FR002-04
def test_security_exception_from_inside_try_propagates_unwrapped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A ``SupersetSecurityException`` raised INSIDE the try must propagate
    unchanged -- not be caught and re-wrapped (which would double-log and could
    mask its original error_type)."""
    from superset.errors import ErrorLevel, SupersetError

    sentinel = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="original security error",
            level=ErrorLevel.ERROR,
        )
    )

    def _raise_security(*_args: Any, **_kwargs: Any) -> bool:
        raise sentinel

    monkeypatch.setattr("superset.models.helpers.apply_rls", _raise_security)

    datasource = _make_virtual_datasource()

    with pytest.raises(SupersetSecurityException) as exc_info:
        datasource.get_from_clause()

    # Same exception object, unchanged error_type -- not wrapped into the
    # ROW_LEVEL_SECURITY_UNRESOLVABLE denial.
    assert exc_info.value is sentinel
    assert (
        exc_info.value.error.error_type
        == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
    )
