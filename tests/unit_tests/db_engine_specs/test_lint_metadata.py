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

from __future__ import annotations

import ast
import io
import runpy
from pathlib import Path
from textwrap import dedent
from typing import Any

import pytest


@pytest.fixture(scope="module")
def metadata_linter() -> dict[str, Any]:
    """Load the standalone linter without initializing the Superset application."""
    return runpy.run_path(
        str(
            Path(__file__).resolve().parents[3]
            / "superset"
            / "db_engine_specs"
            / "lint_metadata.py"
        )
    )


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("'driver'", "driver"),
        ("42", 42),
        ("True", True),
        ("None", None),
        ("['driver', 42]", ["driver", 42]),
        (
            "{'drivers': ['driver'], 'nested': {'enabled': True}}",
            {"drivers": ["driver"], "nested": {"enabled": True}},
        ),
        ("('driver', 42)", ("driver", 42)),
        ("DatabaseCategory", "DatabaseCategory"),
        ("DatabaseCategory.TRADITIONAL_RDBMS", "DatabaseCategory.TRADITIONAL_RDBMS"),
        ("'driver' + 'name'", "drivername"),
        ("1 + 2", None),
        ("f'{driver}'", "<f-string>"),
        ("unknown()", None),
    ],
)
def test_eval_ast_value_without_legacy_nodes(
    metadata_linter: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
    expression: str,
    expected: Any,
) -> None:
    """Evaluate metadata without the AST aliases removed in Python 3.14."""
    node = ast.parse(expression, mode="eval").body
    monkeypatch.delattr(ast, "Str", raising=False)
    monkeypatch.delattr(ast, "Num", raising=False)
    assert metadata_linter["_eval_ast_value"](node) == expected


def test_discover_engine_metadata_without_legacy_nodes(
    metadata_linter: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Discover real engine metadata without silently marking it unparseable."""
    monkeypatch.delattr(ast, "Str", raising=False)
    monkeypatch.delattr(ast, "Num", raising=False)
    specs = metadata_linter["get_all_engine_specs_ast"]()
    postgres = next(
        spec for spec in specs if spec["class_name"] == "PostgresEngineSpec"
    )
    assert "_unparseable" not in postgres["metadata"]
    assert postgres["metadata"]["categories"]
    assert postgres["metadata"]["pypi_packages"]


def _write_spec(directory: Path, filename: str, code: str) -> Path:
    """Write a Python source file into *directory* and return the path."""
    spec_file = directory / filename
    spec_file.write_text(dedent(code), encoding="utf-8")
    return spec_file


def test_get_all_engine_specs_ast_annotated_attributes(
    metadata_linter: dict[str, Any],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Engine specs with type-annotated engine, engine_name, and metadata
    (inline initializers) are correctly discovered, including when named
    with the *BaseEngineSpec suffix.
    """
    _write_spec(
        tmp_path,
        "_tmp_typed_inline.py",
        """\
        from typing import Any
        from superset.db_engine_specs.base import BaseEngineSpec

        class TypedInlineBaseEngineSpec(BaseEngineSpec):
            engine: str = "typed_engine"
            engine_name: str = "Typed Engine"
            metadata: dict[str, Any] = {
                "description": "A typed engine spec",
            }
        """,
    )

    monkeypatch.setitem(
        metadata_linter["get_all_engine_specs_ast"].__globals__,
        "SPECS_DIR",
        str(tmp_path),
    )

    specs = metadata_linter["get_all_engine_specs_ast"]()
    matching = [s for s in specs if s["class_name"] == "TypedInlineBaseEngineSpec"]
    assert len(matching) == 1
    spec = matching[0]
    assert spec["engine_name"] == "Typed Engine"
    assert spec["metadata"] == {"description": "A typed engine spec"}


def test_get_all_engine_specs_ast_declaration_then_assignment(
    metadata_linter: dict[str, Any],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Regression: a bare annotation `engine: str` followed by a plain
    assignment `engine = "value"` must still be discovered, including
    when named with the *BaseEngineSpec suffix (the scanner must not break
    on the bare annotation or skip the spec as a true base class).
    """
    _write_spec(
        tmp_path,
        "_tmp_typed_decl.py",
        """\
        from typing import Any
        from superset.db_engine_specs.base import BaseEngineSpec

        class DeclThenAssignBaseEngineSpec(BaseEngineSpec):
            engine: str
            engine = "decl_then_assign"
            engine_name: str
            engine_name = "DeclThenAssign"
            metadata: dict[str, Any]
            metadata = {
                "description": "Engine with declaration-then-assignment",
            }
        """,
    )

    monkeypatch.setitem(
        metadata_linter["get_all_engine_specs_ast"].__globals__,
        "SPECS_DIR",
        str(tmp_path),
    )

    specs = metadata_linter["get_all_engine_specs_ast"]()
    matching = [s for s in specs if s["class_name"] == "DeclThenAssignBaseEngineSpec"]
    found_names = [s["class_name"] for s in specs]
    assert len(matching) == 1, (
        f"DeclThenAssignBaseEngineSpec not found; got: {found_names}"
    )
    spec = matching[0]
    assert spec["engine_name"] == "DeclThenAssign"
    assert spec["metadata"] == {
        "description": "Engine with declaration-then-assignment"
    }


def test_get_all_engine_specs_ast_set_and_unary_minus(
    metadata_linter: dict[str, Any],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Regression: ast.Set, ast.Tuple, and unary-minus in metadata values are
    correctly evaluated and preserved in the AST scan.
    """
    _write_spec(
        tmp_path,
        "_tmp_complex_values.py",
        """\
        from typing import Any
        from superset.db_engine_specs.base import BaseEngineSpec

        class ComplexValuesBaseEngineSpec(BaseEngineSpec):
            engine: str = "complex_engine"
            engine_name: str = "Complex Engine"
            metadata: dict[str, Any] = {
                "tags": {"analytics", "warehouse"},
                "pair": ("value", -1),
                "default_port": -1,
                "negative_float": -3.14,
            }
        """,
    )

    monkeypatch.setitem(
        metadata_linter["get_all_engine_specs_ast"].__globals__,
        "SPECS_DIR",
        str(tmp_path),
    )

    specs = metadata_linter["get_all_engine_specs_ast"]()
    matching = [s for s in specs if s["class_name"] == "ComplexValuesBaseEngineSpec"]
    assert len(matching) == 1
    spec = matching[0]
    assert spec["engine_name"] == "Complex Engine"
    assert spec["metadata"] == {
        "tags": {"analytics", "warehouse"},
        "pair": ("value", -1),
        "default_port": -1,
        "negative_float": -3.14,
    }


def test_main_ascii_stdout_utf8_reconfigure(
    metadata_linter: dict[str, Any],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Ensure main() reconfigures an ASCII stdout stream to UTF-8 without raising
    UnicodeEncodeError when outputting Unicode symbols in reports.
    """
    _write_spec(
        tmp_path,
        "_tmp_ascii_spec.py",
        """\
        from typing import Any
        from superset.db_engine_specs.base import BaseEngineSpec

        class AsciiConsoleBaseEngineSpec(BaseEngineSpec):
            engine: str = "ascii_engine"
            engine_name: str = "ASCII Engine"
            metadata: dict[str, Any] = {
                "description": "An engine spec for ascii console testing",
            }
        """,
    )

    monkeypatch.setitem(
        metadata_linter["get_all_engine_specs_ast"].__globals__,
        "SPECS_DIR",
        str(tmp_path),
    )
    monkeypatch.setattr("sys.argv", ["lint_metadata"])

    buffer = io.BytesIO()
    ascii_stdout = io.TextIOWrapper(buffer, encoding="ascii", write_through=True)
    monkeypatch.setattr("sys.stdout", ascii_stdout)

    ret = metadata_linter["main"]()
    assert ret == 0

    decoded = buffer.getvalue().decode("utf-8")
    assert "ASCII Engine" in decoded


def test_main_ascii_stdout_markdown_report(
    metadata_linter: dict[str, Any],
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Ensure main() with --markdown output on an ASCII stream completes
    without UnicodeEncodeError and produces valid UTF-8 output.
    """
    _write_spec(
        tmp_path,
        "_tmp_ascii_md_spec.py",
        """\
        from typing import Any
        from superset.db_engine_specs.base import BaseEngineSpec

        class AsciiMarkdownBaseEngineSpec(BaseEngineSpec):
            engine: str = "ascii_md_engine"
            engine_name: str = "ASCII MD Engine"
            metadata: dict[str, Any] = {
                "description": "An engine spec for ascii markdown testing",
                "categories": ["DatabaseCategory.OTHER"],
                "pypi_packages": ["ascii_pkg"],
                "connection_string": "ascii://localhost",
            }
        """,
    )

    monkeypatch.setitem(
        metadata_linter["get_all_engine_specs_ast"].__globals__,
        "SPECS_DIR",
        str(tmp_path),
    )
    monkeypatch.setattr("sys.argv", ["lint_metadata", "--markdown"])

    buffer = io.BytesIO()
    ascii_stdout = io.TextIOWrapper(buffer, encoding="ascii", write_through=True)
    monkeypatch.setattr("sys.stdout", ascii_stdout)

    ret = metadata_linter["main"]()
    assert ret == 0

    decoded = buffer.getvalue().decode("utf-8")
    assert "ASCII MD Engine" in decoded
    assert "✓" in decoded
