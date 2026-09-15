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

"""Tests for the chart type plugin registry."""

import sys
import threading
from types import ModuleType

import pytest

import superset.mcp_service.chart.registry as registry_module
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.registry import (
    _RegistryProxy,
    _reset_for_testing,
    all_types,
    display_name_for_viz_type,
    get,
    get_registry,
    is_registered,
    register,
)


@pytest.fixture(autouse=True)
def _isolated_registry(monkeypatch):
    """Run each test against a clean registry without touching the real one."""
    monkeypatch.setattr(registry_module, "_REGISTRY", {})
    monkeypatch.setattr(registry_module, "_plugins_loaded", True)
    monkeypatch.setattr(registry_module, "_plugins_load_failed", False)


class _FakePlugin(BaseChartPlugin):
    chart_type = "fake"
    display_name = "Fake Chart"
    native_viz_types = {"fake_viz": "Fake Viz"}


class _AnotherPlugin(BaseChartPlugin):
    chart_type = "another"
    display_name = "Another Chart"
    native_viz_types = {"another_viz": "Another Viz"}


def test_register_adds_plugin():
    plugin = _FakePlugin()
    register(plugin)
    assert get("fake") is plugin


def test_get_returns_none_for_unknown():
    assert get("nonexistent") is None


def test_all_types_returns_registered_keys():
    register(_FakePlugin())
    register(_AnotherPlugin())
    types = all_types()
    assert "fake" in types
    assert "another" in types


def test_all_types_insertion_order():
    register(_FakePlugin())
    register(_AnotherPlugin())
    types = all_types()
    assert types.index("fake") < types.index("another")


def test_is_registered_true_for_known():
    register(_FakePlugin())
    assert is_registered("fake") is True


def test_is_registered_false_for_unknown():
    assert is_registered("nonexistent") is False


def test_register_warns_on_duplicate(caplog):
    register(_FakePlugin())
    with caplog.at_level("WARNING"):
        register(_FakePlugin())
    assert "Overwriting" in caplog.text


def test_register_warns_on_viz_type_collision(caplog):
    register(_FakePlugin())

    class _CollidingPlugin(BaseChartPlugin):
        chart_type = "colliding"
        display_name = "Colliding Chart"
        native_viz_types = {"fake_viz": "Shadowed Viz", "own_viz": "Own Viz"}

    with caplog.at_level("WARNING"):
        register(_CollidingPlugin())
    assert "already claimed by" in caplog.text
    assert "fake_viz" in caplog.text
    # Earlier registration wins in display-name lookups
    assert display_name_for_viz_type("fake_viz") == "Fake Viz"


def test_register_same_plugin_no_collision_warning(caplog):
    register(_FakePlugin())
    with caplog.at_level("WARNING"):
        register(_FakePlugin())
    assert "already claimed by" not in caplog.text


def test_register_raises_for_empty_chart_type():
    class _BadPlugin(BaseChartPlugin):
        chart_type = ""

    with pytest.raises(ValueError, match="non-empty chart_type"):
        register(_BadPlugin())


def test_display_name_for_viz_type_found():
    register(_FakePlugin())
    assert display_name_for_viz_type("fake_viz") == "Fake Viz"


def test_display_name_for_viz_type_not_found():
    register(_FakePlugin())
    assert display_name_for_viz_type("unknown_viz") is None


def test_display_name_searches_all_plugins():
    register(_FakePlugin())
    register(_AnotherPlugin())
    assert display_name_for_viz_type("another_viz") == "Another Viz"


def test_get_registry_returns_proxy():
    assert isinstance(get_registry(), _RegistryProxy)


def test_plugins_lock_allows_register_during_lazy_import():
    """The registry lock is re-entrant for plugin registration during import."""
    assert isinstance(registry_module._plugins_lock, type(threading.RLock()))


def test_registry_proxy_get():
    plugin = _FakePlugin()
    register(plugin)
    assert get_registry().get("fake") is plugin


def test_registry_proxy_all_types():
    register(_FakePlugin())
    assert "fake" in get_registry().all_types()


def test_registry_proxy_is_registered():
    register(_FakePlugin())
    assert get_registry().is_registered("fake") is True
    assert get_registry().is_registered("missing") is False


def test_registry_proxy_display_name_for_viz_type():
    register(_FakePlugin())
    assert get_registry().display_name_for_viz_type("fake_viz") == "Fake Viz"
    assert get_registry().display_name_for_viz_type("unknown") is None


def test_ensure_plugins_loaded_skips_when_load_failed(monkeypatch):
    """_ensure_plugins_loaded returns immediately when _plugins_load_failed is set."""
    from superset.mcp_service.chart.registry import _ensure_plugins_loaded

    monkeypatch.setattr(registry_module, "_plugins_loaded", False)
    monkeypatch.setattr(registry_module, "_plugins_load_failed", True)

    # If the function tried to import, the real plugins module would load and flip
    # _plugins_loaded to True. The circuit breaker should prevent that.
    _ensure_plugins_loaded()

    assert registry_module._plugins_loaded is False


def test_ensure_plugins_loaded_sets_failed_flag_on_error(monkeypatch):
    """A failed import sets _plugins_load_failed so subsequent calls are no-ops."""
    from unittest.mock import patch

    from superset.mcp_service.chart.registry import _ensure_plugins_loaded

    monkeypatch.setattr(registry_module, "_plugins_loaded", False)
    monkeypatch.setattr(registry_module, "_plugins_load_failed", False)
    monkeypatch.setattr(registry_module, "_plugins_lock", threading.Lock())

    # Setting the module to None in sys.modules causes ImportError on import.
    with patch.dict("sys.modules", {"superset.mcp_service.chart.plugins": None}):
        _ensure_plugins_loaded()

    assert registry_module._plugins_load_failed is True
    assert registry_module._plugins_loaded is False


def test_ensure_plugins_loaded_rolls_back_partial_registration(monkeypatch):
    """A failed lazy import restores the registry to its previous state."""
    from superset.mcp_service.chart.registry import _ensure_plugins_loaded

    original_import = __import__
    existing_plugin = _FakePlugin()
    partial_plugin = _AnotherPlugin()

    monkeypatch.setattr(registry_module, "_REGISTRY", {"fake": existing_plugin})
    monkeypatch.setattr(registry_module, "_plugins_loaded", False)
    monkeypatch.setattr(registry_module, "_plugins_load_failed", False)

    def fail_plugin_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "superset.mcp_service.chart.plugins":
            register(partial_plugin)
            raise RuntimeError("plugin import failed")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr("builtins.__import__", fail_plugin_import)

    _ensure_plugins_loaded()

    assert registry_module._plugins_load_failed is True
    assert registry_module._REGISTRY == {"fake": existing_plugin}


def test_reset_for_testing_clears_cached_plugins_package(monkeypatch):
    """Reset removes the plugins package so lazy loading can re-run registration."""
    module_name = "superset.mcp_service.chart.plugins"

    monkeypatch.setitem(sys.modules, module_name, ModuleType(module_name))
    monkeypatch.setattr(registry_module, "_REGISTRY", {"fake": _FakePlugin()})
    monkeypatch.setattr(registry_module, "_plugins_loaded", True)
    monkeypatch.setattr(registry_module, "_plugins_load_failed", True)

    _reset_for_testing()

    assert registry_module._REGISTRY == {}
    assert registry_module._plugins_loaded is False
    assert registry_module._plugins_load_failed is False
    assert module_name not in sys.modules
