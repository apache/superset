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

from collections.abc import Callable
from typing import Any

import pytest
from superset_core.mcp import decorators


def double(value: int) -> int:
    """Doubles the input value."""
    return value * 2


@pytest.fixture
def without_fastmcp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(decorators, "find_spec", lambda name: None)


@pytest.mark.parametrize(
    "apply",
    [
        lambda: decorators.tool(double),
        lambda: decorators.tool()(double),
        lambda: decorators.tool("doubler", tags=["extension"])(double),
        lambda: decorators.tool(name="doubler", class_permission_name="Chart")(double),
        lambda: decorators.prompt(double),
        lambda: decorators.prompt("doubler", title="Doubler")(double),
    ],
    ids=["tool", "tool()", "tool(name)", "tool(kwargs)", "prompt", "prompt(name)"],
)
def test_without_fastmcp_a_decorator_keeps_the_function(
    without_fastmcp: None, apply: Callable[[], Any]
) -> None:
    assert apply() is double


@pytest.mark.parametrize("decorator", [decorators.tool, decorators.prompt])
def test_with_fastmcp_a_decorator_the_host_never_replaced_fails(
    monkeypatch: pytest.MonkeyPatch, decorator: Callable[..., Any]
) -> None:
    monkeypatch.setattr(decorators, "find_spec", lambda name: object())

    with pytest.raises(NotImplementedError, match="not initialized"):
        decorator(double)
