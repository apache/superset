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
"""Unit tests for the server-side CDL validator."""

from copy import deepcopy
from typing import Any

from superset.mcp_service.canvas.validation import build_cdl_schema, validate_cdl


def _example() -> dict[str, Any]:
    return deepcopy(build_cdl_schema()["example"])


def test_schema_example_is_valid() -> None:
    assert validate_cdl(_example()) == []


def test_rejects_function_string_in_option() -> None:
    definition = _example()
    definition["tree"]["children"][2]["option"]["tooltip"] = {
        "formatter": "(v) => v.toFixed(2)"
    }
    errors = validate_cdl(definition)
    assert any("no-code invariant" in e for e in errors)
    assert any("must be a declarative object" in e for e in errors)


def test_rejects_undeclared_variable() -> None:
    definition = _example()
    definition["tree"]["children"][1]["children"][0]["bind"]["value"] = "$nope"
    errors = validate_cdl(definition)
    assert any("undeclared variable" in e for e in errors)


def test_rejects_javascript_url_in_open_url() -> None:
    definition = _example()
    definition["tree"]["children"][0] = {
        "id": "link",
        "type": "Button",
        "props": {"children": "Go"},
        "on": {"click": [{"action": "openUrl", "url": "javascript:alert(1)"}]},
    }
    errors = validate_cdl(definition)
    assert any("http(s) only" in e for e in errors)


def test_rejects_children_on_non_container() -> None:
    definition = _example()
    definition["tree"]["children"][0]["children"] = [
        {"id": "x", "type": "Markdown", "props": {"text": "no"}}
    ]
    errors = validate_cdl(definition)
    assert any("cannot have children" in e for e in errors)


def test_rejects_unknown_node_type() -> None:
    definition = _example()
    definition["tree"]["children"][0]["type"] = "NotAThing"
    errors = validate_cdl(definition)
    assert any("unknown node type" in e for e in errors)


def test_missing_tree_is_reported() -> None:
    assert validate_cdl({"cdlVersion": 2, "variables": {}}) == [
        "tree (root node) is required"
    ]
