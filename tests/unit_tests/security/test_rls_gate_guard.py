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
"""Architectural guard: no datasource-execution path bypasses the RLS gate.

Row-level security for chart / datasource rendering is enforced at a single
structural chokepoint: ``ExploreMixin.get_query_str_extended`` compiles the SQL
and routes it through the enforcement gate (``enforce``). Every data-retrieval
entry point on ``ExploreMixin`` and its concrete subclasses (``SqlaTable`` and
``Query``) funnels through that method, so enforcement is inherited *by
construction* rather than by a per-method opt-in.

These tests encode that invariant so it cannot silently erode:

* **Chokepoint uniqueness** — the gate (``enforce``) is invoked from exactly one
  method, ``get_query_str_extended``; a second, independent call site would mean
  more than one enforcement door to keep in sync.

* **Execution-path coverage (call-graph)** — every method on ``ExploreMixin``
  that transitively reaches a SQL-execution sink (a warehouse read/execute such
  as ``get_df``, ``read_sql_query``, ``run_with_sampling_read_limit_retry`` or a
  connection ``execute``) must also transitively apply row-level security: either
  through the gate (``get_query_str_extended`` -> ``enforce``) or through the
  legacy in-query injection (``get_sqla_row_level_filters``). A future refactor
  that adds a new execution path reaching a sink with *neither* — an unfiltered
  datasource read — turns this guard RED.

* **Behavioral coverage** — driving each public execution seam (``query``,
  ``exc_query``, ``get_query_str``) invokes the gate exactly once, tagged with
  the ``get_query_str_extended`` call-site path.

* **No bypass switch (FR-14)** — the gate call in ``get_query_str_extended`` is
  unconditional: it is not guarded by any feature flag, config lookup or
  attribute toggle that could turn chart-path enforcement off.

The call-graph guard is source/AST based (it inspects the real class body), so a
new bypass introduced by editing the production source is what makes it fail —
it is not pinned to a hand-maintained method list. Authenticity is demonstrated
in the task record by mutation: inserting a synthetic unfiltered execution path
turns the guard RED; reverting restores GREEN.
"""

from __future__ import annotations

import ast
import inspect
import textwrap
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture

from superset.models.helpers import ExploreMixin
from superset.security.rls_enforcement import EnforcementDecision, EnforcementOutcome

# The single method that is permitted to invoke the enforcement gate.
GATE_CHOKEPOINT = "get_query_str_extended"

# The name of the enforcement gate callable as referenced inside helpers.py.
GATE_CALLABLE = "enforce"

# Legacy in-query RLS injection: methods that build their own statement rather
# than routing through the gate apply row filters through this seam instead.
LEGACY_RLS_APPLY = "get_sqla_row_level_filters"

# SQL-execution sinks: an ``ExploreMixin`` method that (transitively) calls one
# of these hands a statement to the warehouse for execution. Any such method is
# a datasource-execution path and must apply RLS before it reaches the sink.
SQL_EXECUTION_SINKS = frozenset(
    {
        "get_df",
        "read_sql_query",
        "run_with_sampling_read_limit_retry",
        "execute",
    }
)

# Nodes that satisfy the "RLS was applied" obligation for a datasource read.
RLS_APPLICATION_NODES = frozenset({GATE_CHOKEPOINT, GATE_CALLABLE, LEGACY_RLS_APPLY})

COMPILED_SQL = "SELECT col FROM governed_table"


# ---------------------------------------------------------------------------
# AST helpers: build a per-method call inventory for ExploreMixin's own body.
# ---------------------------------------------------------------------------
def _explore_mixin_methods() -> dict[str, set[str]]:
    """Map each ``ExploreMixin`` method name to the set of names it calls.

    A "call" is recorded for a bare function reference (``enforce(...)``) or an
    attribute/self call (``self.query(...)`` -> ``query``,
    ``self.database.get_df(...)`` -> ``get_df``). This is intentionally
    name-based: it captures the method / sink identity that the invariant reasons
    about without needing type inference.
    """
    source = textwrap.dedent(inspect.getsource(ExploreMixin))
    tree = ast.parse(source)
    class_def = next(
        node for node in tree.body if isinstance(node, ast.ClassDef)
    )

    methods: dict[str, set[str]] = {}
    for item in class_def.body:
        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            methods[item.name] = _called_names(item)
    return methods


def _called_names(func: ast.AST) -> set[str]:
    """Collect the callee names referenced anywhere inside ``func``."""
    names: set[str] = set()
    for node in ast.walk(func):
        if not isinstance(node, ast.Call):
            continue
        callee = node.func
        if isinstance(callee, ast.Name):
            names.add(callee.id)
        elif isinstance(callee, ast.Attribute):
            names.add(callee.attr)
    return names


def _reaches(
    method: str,
    targets: frozenset[str] | set[str],
    methods: dict[str, set[str]],
    _seen: set[str] | None = None,
) -> bool:
    """Whether ``method`` transitively calls any name in ``targets``.

    Traverses ``self``-method calls within ``ExploreMixin`` (and direct name
    references) until a target is reached or the local call graph is exhausted.
    """
    if _seen is None:
        _seen = set()
    if method in _seen or method not in methods:
        return False
    _seen.add(method)

    calls = methods[method]
    if calls & set(targets):
        return True
    return any(
        _reaches(callee, targets, methods, _seen)
        for callee in calls
        if callee in methods
    )


# ---------------------------------------------------------------------------
# Structural guard: the gate has exactly one call site.
# ---------------------------------------------------------------------------
def test_gate_has_single_call_site() -> None:
    # @AC-FR005-01
    # The enforcement gate must be invoked from exactly one method — the
    # chokepoint. More than one door means more than one place a future edit has
    # to keep enforcing; zero means the gate was removed entirely.
    methods = _explore_mixin_methods()
    callers = {
        name for name, calls in methods.items() if GATE_CALLABLE in calls
    }
    assert callers == {GATE_CHOKEPOINT}, (
        "The RLS gate must be invoked from exactly one ExploreMixin method "
        f"({GATE_CHOKEPOINT!r}); found call sites: {sorted(callers)}"
    )


# ---------------------------------------------------------------------------
# Structural guard: every execution path applies RLS before reaching a sink.
# ---------------------------------------------------------------------------
def test_every_execution_path_applies_rls_before_sink() -> None:
    # @AC-FR005-01
    # Enumerate every ExploreMixin method that transitively reaches a SQL
    # execution sink, and assert each also transitively applies RLS — through the
    # gate or through the legacy in-query injection. A new unfiltered read path
    # would appear here as a sink-reaching method that applies neither.
    methods = _explore_mixin_methods()

    execution_paths = {
        name
        for name in methods
        if _reaches(name, SQL_EXECUTION_SINKS, methods)
    }
    # Sanity: the known datasource execution seams must be recognised as such, so
    # the guard is provably exercising real paths (not an empty set that passes
    # vacuously).
    assert {"query", "values_for_column"} <= execution_paths

    unfiltered = {
        name
        for name in execution_paths
        if not _reaches(name, RLS_APPLICATION_NODES, methods)
    }
    assert not unfiltered, (
        "These ExploreMixin methods reach a SQL execution sink without applying "
        "row-level security (neither the enforcement gate nor "
        f"{LEGACY_RLS_APPLY!r}): {sorted(unfiltered)}. Every datasource read must "
        "route through the RLS gate or inject row filters before execution."
    )


def test_primary_render_path_routes_through_gate() -> None:
    # @AC-FR005-01
    # The dataframe render seam (query) must reach the gate specifically (not
    # merely the legacy injection): this is the chart-render path the fix
    # governs.
    methods = _explore_mixin_methods()
    assert _reaches("query", {GATE_CHOKEPOINT}, methods)
    assert _reaches("get_query_str", {GATE_CHOKEPOINT}, methods)
    assert _reaches("exc_query", {GATE_CHOKEPOINT}, methods)


# ---------------------------------------------------------------------------
# Structural guard: the gate call is unconditional (no bypass switch, FR-14).
# ---------------------------------------------------------------------------
def test_gate_call_is_unconditional() -> None:
    # @AC-FR014-01
    # FR-14: no chart-path enforcement bypass flag. The enforce() call in the
    # chokepoint must not sit under any branch (feature flag, config lookup,
    # attribute toggle) that could skip it. Assert the gate call is at the method
    # body's top level, not nested inside an if/try/with/loop guard.
    source = textwrap.dedent(inspect.getsource(ExploreMixin.get_query_str_extended))
    func = ast.parse(source).body[0]
    assert isinstance(func, (ast.FunctionDef, ast.AsyncFunctionDef))

    # Control-flow constructs whose bodies may be skipped at runtime. A gate call
    # reachable only from inside one of these is a conditional bypass.
    skippable = (ast.If, ast.Try, ast.While, ast.For, ast.AsyncFor)

    def _is_gate_call(node: ast.AST) -> bool:
        return (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == GATE_CALLABLE
        )

    def _find_unconditional_gate(stmts: list[ast.stmt]) -> bool:
        """Whether a gate call exists that no skippable branch guards.

        Descends only through non-skippable statements (plain expressions,
        assignments, and unconditional ``with`` blocks). If it has to cross an
        ``if``/``try``/loop boundary to reach the gate call, that call does not
        count as unconditional.
        """
        for stmt in stmts:
            for node in ast.walk(stmt):
                if _is_gate_call(node):
                    break
            else:
                continue  # no gate call anywhere under this statement
            if isinstance(stmt, skippable):
                continue  # gate call sits behind a skippable branch — ignore
            if isinstance(stmt, (ast.With, ast.AsyncWith)):
                if _find_unconditional_gate(stmt.body):
                    return True
                continue
            # A plain statement (expr / assignment) directly holding the call.
            if any(_is_gate_call(node) for node in ast.walk(stmt)):
                return True
        return False

    assert _find_unconditional_gate(func.body), (
        "enforce() must be called unconditionally in "
        f"{GATE_CHOKEPOINT}; a gate call reachable only inside a conditional "
        "branch (if / try / loop) would be a bypass switch (FR-14)."
    )


# ---------------------------------------------------------------------------
# Behavioral guard: driving each public seam invokes the gate exactly once.
# ---------------------------------------------------------------------------
class _FakeDatasource(ExploreMixin):
    """Minimal ``ExploreMixin`` overriding the properties the seams read."""

    sql: Any = None
    catalog: Any = None
    schema: Any = None
    database: Any = None

    @property
    def db_engine_spec(self) -> Any:
        spec = MagicMock()
        spec.engine = "__test_engine__"
        return spec


def _make_datasource() -> ExploreMixin:
    datasource = _FakeDatasource()
    datasource.sql = None

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
    database.get_df = MagicMock(return_value=pd.DataFrame({"col": [1]}))
    datasource.database = database

    return datasource


def _noop() -> EnforcementDecision:
    return EnforcementDecision(outcome=EnforcementOutcome.NOOP, sql=COMPILED_SQL)


def _spy_gate(mocker: MockerFixture) -> Any:
    return mocker.patch(
        "superset.models.helpers.enforce", return_value=_noop()
    )


@pytest.mark.parametrize(
    "drive",
    [
        pytest.param(lambda ds: ds.query({}), id="query"),
        pytest.param(lambda ds: ds.exc_query({}), id="exc_query"),
        pytest.param(lambda ds: ds.get_query_str({}), id="get_query_str"),
    ],
)
def test_public_execution_seam_invokes_gate_once(
    mocker: MockerFixture, drive: Any
) -> None:
    # @AC-FR005-01
    spy = _spy_gate(mocker)
    datasource = _make_datasource()

    drive(datasource)

    assert spy.call_count == 1
    args, _ = spy.call_args
    assert args[0] is datasource
    assert args[1] == COMPILED_SQL
    assert args[3] == GATE_CHOKEPOINT


def test_concrete_subclasses_inherit_the_chokepoint() -> None:
    # @AC-FR014-01
    # SqlaTable and Query are the concrete ExploreMixin datasources on the chart
    # path. Neither may override get_query_str_extended with its own body — that
    # would be a parallel door outside the gate. They must resolve the chokepoint
    # to ExploreMixin's implementation.
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.sql_lab import Query

    for cls in (SqlaTable, Query):
        assert issubclass(cls, ExploreMixin)
        resolved = inspect.getattr_static(cls, GATE_CHOKEPOINT)
        own = ExploreMixin.__dict__[GATE_CHOKEPOINT]
        assert resolved is own, (
            f"{cls.__name__} must inherit {GATE_CHOKEPOINT} from ExploreMixin; "
            "overriding it risks a datasource-execution path outside the gate."
        )
