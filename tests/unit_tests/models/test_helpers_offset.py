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
import ast
from pathlib import Path

HELPERS_PATH = (
    Path(__file__).resolve().parents[3] / "superset" / "models" / "helpers.py"
)


def _uses_allows_offset_fetch(node: ast.AST) -> bool:
    """True if any attribute access on `node` references 'allows_offset_fetch'."""
    return any(
        isinstance(child, ast.Attribute) and child.attr == "allows_offset_fetch"
        for child in ast.walk(node)
    )


def _is_qry_offset_assignment(stmt: ast.AST) -> bool:
    """True if stmt is `qry = qry.offset(...)` (any LHS, call to `.offset`)."""
    if not isinstance(stmt, ast.Assign):
        return False
    call = stmt.value
    if not isinstance(call, ast.Call):
        return False
    func = call.func
    return isinstance(func, ast.Attribute) and func.attr == "offset"


def test_helpers_guards_offset_with_allows_offset_fetch_flag() -> None:
    """
    Regression guard: the `.offset()` call in get_sqla_query must be wrapped
    in an `if` that checks `allows_offset_fetch`. Without this guard,
    engines that do not support OFFSET (Elasticsearch SQL) crash drill-
    to-detail on page 2+.

    We parse the AST rather than grep the source so the test survives
    Black-style reformatting and trivial refactors.
    """
    source = HELPERS_PATH.read_text()
    assert "allows_offset_fetch" in source, (
        "helpers.py no longer references allows_offset_fetch; the OFFSET "
        "guard is gone — Elasticsearch drill-to-detail will crash on page 2+."
    )

    tree = ast.parse(source)
    unguarded: list[int] = []

    class Visitor(ast.NodeVisitor):
        def __init__(self) -> None:
            self._in_guarded_if = 0

        def visit_If(self, node: ast.If) -> None:  # noqa: N802
            if _uses_allows_offset_fetch(node.test):
                self._in_guarded_if += 1
                for child in node.body:
                    self.visit(child)
                self._in_guarded_if -= 1
                for child in node.orelse:
                    self.visit(child)
            else:
                self.generic_visit(node)

        def visit_Assign(self, node: ast.Assign) -> None:  # noqa: N802
            if _is_qry_offset_assignment(node) and self._in_guarded_if == 0:
                unguarded.append(node.lineno)
            self.generic_visit(node)

    Visitor().visit(tree)
    assert not unguarded, (
        f"Unguarded .offset() call(s) in helpers.py at line(s) {unguarded}. "
        "Wrap with `if ... allows_offset_fetch:` to prevent OFFSET emission "
        "on engines that cannot parse it (e.g. Elasticsearch SQL)."
    )
