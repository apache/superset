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

"""Tests for the widget contract beyond schemas: behavior, versions, migrators."""

from __future__ import annotations

from typing import Any

import pytest
from pydantic import BaseModel
from superset_core.widgets import PropsVersionError, Widget, WidgetBehavior

from superset.widgets.registry import registry


class _Props(BaseModel):
    title: str = ""


def _widget(**attrs: Any) -> type[Widget]:
    return type(
        "TestWidget",
        (Widget,),
        {"widget_type": "test", "name": "Test", "controls_class": _Props, **attrs},
    )


def test_built_in_widgets_declare_a_consistent_contract() -> None:
    for widget in registry.values():
        widget.validate_contract()
    assert registry["tabs"].behavior.accepted_children == frozenset({"tab"})
    assert registry["filter.bar"].behavior.bounds_filter_scope is False
    assert registry["filter.select"].behavior.filter is True
    assert registry["filter.select"].behavior.filterable is True
    assert registry["echarts"].behavior.emits_filters is True


@pytest.mark.parametrize(
    "behavior, message",
    [
        (WidgetBehavior(grid_columns=12), "only a container"),
        (WidgetBehavior(accepted_children=frozenset({"tab"})), "only a container"),
        (
            WidgetBehavior(container=True, grid_columns=12, child_layout_model=_Props),
            "not both",
        ),
    ],
)
def test_inconsistent_behavior_is_rejected(
    behavior: WidgetBehavior, message: str
) -> None:
    with pytest.raises(ValueError, match=message):
        _widget(behavior=behavior).validate_contract()


def test_a_broken_migrator_chain_is_rejected() -> None:
    with pytest.raises(ValueError, match=r"no migrators from schema versions \[2\]"):
        _widget(schema_version=3, migrators={1: dict}).validate_contract()


def test_props_are_upgraded_through_the_chain() -> None:
    widget = _widget(
        schema_version=3,
        migrators={
            1: lambda props: {"name": props["label"]},
            2: lambda props: {"title": props["name"]},
        },
    )

    assert widget.upgrade_props({"label": "Revenue"}, 1) == {"title": "Revenue"}
    assert widget.upgrade_props({"title": "Revenue"}, 3) == {"title": "Revenue"}


@pytest.mark.parametrize("version", [0, 4])
def test_props_from_unknown_versions_are_refused(version: int) -> None:
    with pytest.raises(PropsVersionError):
        _widget(schema_version=3, migrators={1: dict, 2: dict}).upgrade_props(
            {}, version
        )


def test_a_failing_migrator_is_reported_as_a_version_error() -> None:
    widget = _widget(schema_version=2, migrators={1: lambda props: props["gone"]})

    with pytest.raises(PropsVersionError, match="failed"):
        widget.upgrade_props({}, 1)
