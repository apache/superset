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
import runpy
from pathlib import Path
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
