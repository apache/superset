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

"""Tests for registry plugin filtering (configure / is_enabled / get / all_types)."""

import pytest

import superset.mcp_service.chart.registry as registry_module
from superset.mcp_service.chart.plugin import BaseChartPlugin
from superset.mcp_service.chart.registry import (
    _PluginFilterConfig,
    all_types,
    configure,
    display_name_for_viz_type,
    get,
    is_enabled,
    is_registered,
    register,
)


@pytest.fixture(autouse=True)
def _isolated_registry(monkeypatch):
    """Isolated registry with two known plugins and a clean filter for each test."""
    monkeypatch.setattr(registry_module, "_REGISTRY", {})
    monkeypatch.setattr(registry_module, "_plugins_loaded", True)
    monkeypatch.setattr(registry_module, "_filter_config", _PluginFilterConfig())
    register(_AlphaPlugin())
    register(_BetaPlugin())


class _AlphaPlugin(BaseChartPlugin):
    chart_type = "alpha"
    display_name = "Alpha Chart"
    native_viz_types = {"alpha_viz": "Alpha Viz"}


class _BetaPlugin(BaseChartPlugin):
    chart_type = "beta"
    display_name = "Beta Chart"
    native_viz_types = {"beta_viz": "Beta Viz"}


# ---------------------------------------------------------------------------
# Static deny-list tests
# ---------------------------------------------------------------------------


def test_get_returns_plugin_when_enabled():
    assert get("alpha") is not None
    assert get("beta") is not None


def test_get_returns_none_for_disabled_plugin():
    configure(disabled={"alpha"})
    assert get("alpha") is None


def test_get_still_returns_other_plugins_when_one_is_disabled():
    configure(disabled={"alpha"})
    assert get("beta") is not None


def test_all_types_excludes_disabled():
    configure(disabled={"alpha"})
    types = all_types()
    assert "alpha" not in types
    assert "beta" in types


def test_all_types_empty_when_all_disabled():
    configure(disabled={"alpha", "beta"})
    assert all_types() == []


def test_is_registered_ignores_deny_list():
    configure(disabled={"alpha"})
    assert is_registered("alpha") is True


def test_is_enabled_returns_false_for_disabled():
    configure(disabled={"alpha"})
    assert is_enabled("alpha") is False


def test_is_enabled_returns_true_when_not_disabled():
    configure(disabled={"alpha"})
    assert is_enabled("beta") is True


def test_is_enabled_returns_false_for_unknown():
    assert is_enabled("nonexistent") is False


# ---------------------------------------------------------------------------
# configure() accepts different iterable shapes
# ---------------------------------------------------------------------------


def test_configure_accepts_list():
    configure(disabled=["alpha"])
    assert get("alpha") is None


def test_configure_accepts_tuple():
    configure(disabled=("alpha",))
    assert get("alpha") is None


def test_configure_accepts_frozenset():
    configure(disabled=frozenset({"alpha"}))
    assert get("alpha") is None


def test_configure_accepts_none_disabled():
    configure(disabled=None)
    assert get("alpha") is not None


def test_configure_rejects_noncallable_enabled_func():
    with pytest.raises(TypeError):
        configure(enabled_func="not_a_callable")


# ---------------------------------------------------------------------------
# Dynamic callable hook tests
# ---------------------------------------------------------------------------


def test_enabled_func_overrides_deny_list():
    # alpha is in deny-list but callable says True → should be visible
    configure(disabled={"alpha"}, enabled_func=lambda ct: ct == "alpha")
    assert get("alpha") is not None


def test_enabled_func_can_disable_plugin():
    configure(enabled_func=lambda ct: ct != "beta")
    assert get("beta") is None
    assert get("alpha") is not None


def test_enabled_func_called_per_lookup():
    calls = []

    def hook(ct: str) -> bool:
        calls.append(ct)
        return True

    configure(enabled_func=hook)
    get("alpha")
    get("alpha")
    assert calls.count("alpha") == 2


def test_enabled_func_exception_fails_closed(caplog):
    import logging

    def bad_hook(ct: str) -> bool:
        raise RuntimeError("Harness down")

    configure(enabled_func=bad_hook)
    with caplog.at_level(logging.WARNING, logger="superset.mcp_service.chart.registry"):
        result = get("alpha")

    assert result is None  # fail closed
    assert "failing closed" in caplog.text.lower() or "alpha" in caplog.text


def test_enabled_func_all_types_respects_hook():
    configure(enabled_func=lambda ct: ct == "alpha")
    assert all_types() == ["alpha"]


# ---------------------------------------------------------------------------
# display_name_for_viz_type is NOT filtered
# ---------------------------------------------------------------------------


def test_display_name_unaffected_by_deny_list():
    configure(disabled={"alpha"})
    # Even though alpha is disabled, its viz_type should still resolve
    assert display_name_for_viz_type("alpha_viz") == "Alpha Viz"


def test_display_name_unaffected_by_callable():
    configure(enabled_func=lambda ct: False)
    assert display_name_for_viz_type("beta_viz") == "Beta Viz"


# ---------------------------------------------------------------------------
# configure() atomicity: replacing config is visible to next lookup
# ---------------------------------------------------------------------------


def test_reconfigure_replaces_previous_filter():
    configure(disabled={"alpha"})
    assert get("alpha") is None
    configure(disabled=set())
    assert get("alpha") is not None


def test_reconfigure_with_func_then_none_falls_back_to_deny_list():
    configure(enabled_func=lambda ct: False)
    assert get("alpha") is None

    configure(disabled={"beta"}, enabled_func=None)
    assert get("alpha") is not None
    assert get("beta") is None
