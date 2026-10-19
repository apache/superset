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
"""Unit tests for the ``template_params`` helpers in ``superset.models.helpers``."""

from __future__ import annotations

from typing import Any

from superset.jinja_context import RESERVED_TEMPLATE_PARAM_NAMES
from superset.models.helpers import (
    template_params_equivalent,
    template_params_for_access_check,
)


def test_template_params_equivalent_is_type_sensitive() -> None:
    """
    Compared the way execution reads them: JSON scalar types that Jinja
    distinguishes (``1`` vs ``true`` vs ``1.0``) are not equivalent even
    though the parsed dicts are Python-equal, while key order and whitespace
    do not matter.
    """
    assert template_params_equivalent('{"x": 1}', '{"x": true}') is False
    assert template_params_equivalent('{"x": 1}', '{"x": 1.0}') is False
    assert template_params_equivalent('{"x": 0}', '{"x": false}') is False
    # Same values, reserialized / reordered -> equivalent.
    assert template_params_equivalent('{"a": 1, "b": 2}', '{"b": 2, "a": 1}') is True
    assert template_params_equivalent('{ "x":  1 }', '{"x": 1}') is True
    assert template_params_equivalent({"x": 1}, '{"x": 1}') is True
    # Empty / absent are equivalent; unreadable is never equivalent (fail closed).
    assert template_params_equivalent(None, "") is True
    assert template_params_equivalent("{bad", "{bad") is False
    assert template_params_equivalent('{"x": 1}', "{bad") is False


def test_template_params_for_access_check_drops_reserved_names() -> None:
    """
    Names the template processor consumes structurally are never exposed as
    Jinja variables at execution, so they are dropped before a define/repoint
    access check renders the SQL -- keeping the authorized render aligned with
    execution. User params are kept.
    """
    params: dict[str, Any] = dict.fromkeys(RESERVED_TEMPLATE_PARAM_NAMES, "x")
    params["user_var"] = 1
    assert template_params_for_access_check(params) == {"user_var": 1}
    # The reserved set matches BaseTemplateProcessor's structural arguments.
    assert {
        "database",
        "query",
        "table",
        "extra_cache_keys",
        "removed_filters",
        "applied_filters",
    } <= RESERVED_TEMPLATE_PARAM_NAMES
