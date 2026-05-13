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

import pytest

import superset.mcp_service.chart.registry as registry_module
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.registry import (
    _RegistryProxy,
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
