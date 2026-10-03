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

"""Structural checks for API registration without bootstrapping the application."""

import ast
from collections import Counter
from pathlib import Path
from textwrap import dedent

import pytest


def _count_api_registrations(node: ast.AST) -> Counter[str]:
    """Count registrations, taking the maximum across exclusive if/else arms."""
    if isinstance(node, ast.If):
        body = Counter[str]()
        otherwise = Counter[str]()
        for statement in node.body:
            body.update(_count_api_registrations(statement))
        for statement in node.orelse:
            otherwise.update(_count_api_registrations(statement))
        return _count_api_registrations(node.test) + (body | otherwise)

    registrations = Counter[str]()
    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "appbuilder"
        and node.func.attr == "add_api"
        and node.args
    ):
        registrations[ast.unparse(node.args[0])] += 1
    for child in ast.iter_child_nodes(node):
        registrations.update(_count_api_registrations(child))
    return registrations


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        (
            """
            appbuilder.add_api(LogRestApi)
            appbuilder.add_api(LogRestApi)
            """,
            2,
        ),
        (
            """
            if enabled:
                appbuilder.add_api(LogRestApi)
            else:
                appbuilder.add_api(LogRestApi)
            """,
            1,
        ),
        (
            """
            appbuilder.add_api(LogRestApi)
            if enabled:
                appbuilder.add_api(LogRestApi)
            """,
            2,
        ),
    ],
    ids=["unconditional-duplicate", "exclusive-branches", "conditional-duplicate"],
)
def test_count_api_registrations(source: str, expected: int) -> None:
    """Distinguish duplicate registrations from mutually exclusive alternatives."""
    registrations = _count_api_registrations(ast.parse(dedent(source)))
    assert registrations["LogRestApi"] == expected


def test_init_views_registers_each_api_once() -> None:
    """Keep API registrations unique, including feature-flagged registrations."""
    source = (
        Path(__file__).resolve().parents[3]
        / "superset"
        / "initialization"
        / "__init__.py"
    )
    module = ast.parse(source.read_text(encoding="utf-8"))
    initializer = next(
        node
        for node in module.body
        if isinstance(node, ast.ClassDef) and node.name == "SupersetAppInitializer"
    )
    init_views = next(
        node
        for node in initializer.body
        if isinstance(node, ast.FunctionDef) and node.name == "init_views"
    )
    registrations = _count_api_registrations(init_views)

    assert registrations["LogRestApi"] == 1
    duplicates = {api: count for api, count in registrations.items() if count > 1}
    assert not duplicates, f"Duplicate API registrations: {duplicates}"
