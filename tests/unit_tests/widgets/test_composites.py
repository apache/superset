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
from __future__ import annotations

from types import MappingProxyType

import pytest
from pydantic import BaseModel
from superset_core.widgets import (
    composite_control,
    list_composite_controls,
    MetricControl,
)
from superset_core.widgets.composites import _registry


def test_metric_control_is_registered() -> None:
    info = list_composite_controls()["metric"]
    assert info.name == "metric"
    assert info.model is MetricControl


def test_metric_control_declares_metric_multi_field() -> None:
    schema = MetricControl.model_json_schema()
    assert schema["properties"]["metrics"]["x-control"] == "metric-multi"


def test_list_composite_controls_is_read_only() -> None:
    result = list_composite_controls()
    assert isinstance(result, MappingProxyType)
    with pytest.raises(TypeError):
        result["metric"] = None  # type: ignore[index]


def test_composite_control_registers_new_entry() -> None:
    @composite_control(name="test-only", title="Test Only", description="...")
    class _TestOnly(BaseModel):
        value: int = 0

    try:
        info = list_composite_controls()["test-only"]
        assert info.title == "Test Only"
        assert info.model is _TestOnly
    finally:
        _registry.pop("test-only", None)


def test_composite_control_duplicate_name_raises() -> None:
    @composite_control(name="dup-test", title="Dup", description="...")
    class _First(BaseModel):
        value: int = 0

    try:
        with pytest.raises(ValueError, match="already registered"):

            @composite_control(name="dup-test", title="Dup2", description="...")
            class _Second(BaseModel):
                value: int = 0

    finally:
        _registry.pop("dup-test", None)
