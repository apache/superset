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
    registrations = Counter(
        ast.unparse(node.args[0])
        for node in ast.walk(init_views)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "appbuilder"
        and node.func.attr == "add_api"
        and node.args
    )

    assert registrations["LogRestApi"] == 1
    duplicates = {api: count for api, count in registrations.items() if count > 1}
    assert not duplicates, f"Duplicate API registrations: {duplicates}"
