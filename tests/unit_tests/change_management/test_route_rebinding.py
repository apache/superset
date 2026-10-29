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
"""A gate on a routed method has to reach the route, not just the class.

``POST /datasource/save/`` was gated, reported as gated by
``patched_targets()``, and ungated in fact (S-01). Flask-AppBuilder's
``create_blueprint`` registers a **bound method object**
(``attr = getattr(self, attr_name)``), and ``init_views()`` runs before
extensions load -- so the route kept a reference to the original function
and the class patch never reached it.

These tests reproduce the production order explicitly: register the route
first, patch second. The suite's own conftest does the opposite, which is
exactly why nothing caught this.
"""

from typing import Any

import pytest
from asset_approval import install
from asset_approval.install import gate_method, rebind_registered_routes


class _App:
    """Only the attribute ``rebind_registered_routes`` reads."""

    def __init__(self) -> None:
        self.view_functions: dict[str, Any] = {}


@pytest.fixture
def host(monkeypatch: pytest.MonkeyPatch) -> Any:
    """A routed host class, gated the way the real bindings gate one."""
    # A fresh registry per test: the module-level list is process-wide.
    monkeypatch.setattr(install, "_method_gates", [])
    monkeypatch.setattr(install, "_patched", [])

    class Routed:
        def save(self) -> str:
            return "written"

    monkeypatch.setattr(install, "_resolve", lambda _p, _c: Routed)
    monkeypatch.setattr(install, "_gate_applies", lambda: True)
    return Routed


def test_a_route_registered_before_the_patch_stays_ungated(
    host: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The bug itself: patching the class does not reach the route."""
    routed = host
    instance = routed()
    app = _App()
    # Flask-AppBuilder registers the bound method, now.
    app.view_functions["Host.save"] = instance.save

    refused: list[str] = []
    gate_method("m", "Host", "save", lambda *_a, **_k: refused.append("gated"))

    # The class really is patched ...
    assert getattr(routed.save, "__asset_approval_gate__", False) is True
    # ... and the route still calls the original.
    assert app.view_functions["Host.save"]() == "written"
    assert refused == []


def test_rebinding_puts_the_gate_in_front_of_the_route(host: Any) -> None:
    routed = host
    instance = routed()
    app = _App()
    app.view_functions["Host.save"] = instance.save

    refused: list[str] = []
    gate_method("m", "Host", "save", lambda *_a, **_k: refused.append("gated"))

    assert rebind_registered_routes(app) == ["Host.save"]
    assert app.view_functions["Host.save"]() == "written"
    assert refused == ["gated"], "the gate did not run before the body"


def test_rebinding_marks_the_route_so_a_boot_check_can_see_it(host: Any) -> None:
    routed = host
    instance = routed()
    app = _App()
    app.view_functions["Host.save"] = instance.save
    gate_method("m", "Host", "save", lambda *_a, **_k: None)
    rebind_registered_routes(app)

    assert app.view_functions["Host.save"].__asset_approval_gate__ is True


def test_rebinding_leaves_unrelated_routes_alone(host: Any) -> None:
    routed = host
    instance = routed()
    app = _App()

    class Sibling:
        def save(self) -> str:
            return "other"

    sibling = Sibling()
    app.view_functions["Host.save"] = instance.save
    app.view_functions["Sibling.save"] = sibling.save

    gate_method("m", "Host", "save", lambda *_a, **_k: None)
    rebound = rebind_registered_routes(app)

    assert rebound == ["Host.save"]
    # ``is`` would never hold: a bound method is built fresh on each access.
    assert app.view_functions["Sibling.save"].__func__ is Sibling.save
    assert (
        getattr(app.view_functions["Sibling.save"], "__asset_approval_gate__", False)
        is False
    )


def test_rebinding_is_safe_to_run_twice(host: Any) -> None:
    # Installing twice must not stack a second gate in front of the first.
    routed = host
    instance = routed()
    app = _App()
    app.view_functions["Host.save"] = instance.save

    refused: list[str] = []
    gate_method("m", "Host", "save", lambda *_a, **_k: refused.append("gated"))
    rebind_registered_routes(app)
    assert rebind_registered_routes(app) == []

    app.view_functions["Host.save"]()
    assert refused == ["gated"]


def test_a_plain_function_route_is_skipped_rather_than_broken(
    host: Any,  # noqa: ARG001  -- the fixture installs the gate
) -> None:
    # Flask-AppBuilder wraps a handler in a closure when the view declares
    # before-request hooks. There is nothing to match there, and guessing
    # would replace a route we do not understand.
    app = _App()

    def wrapped() -> str:
        return "wrapped"

    app.view_functions["Host.save"] = wrapped
    gate_method("m", "Host", "save", lambda *_a, **_k: None)

    assert rebind_registered_routes(app) == []
    assert app.view_functions["Host.save"] is wrapped
