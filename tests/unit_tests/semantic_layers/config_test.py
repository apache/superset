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

from typing import ClassVar

import pytest
from pydantic import BaseModel
from superset_core.semantic_layers.config import build_configuration_schema


class _NoOverride(BaseModel):
    b: int = 0
    a: int = 0


class _WithOverride(BaseModel):
    field_order: ClassVar[list[str]] = ["a", "b"]

    b: int = 0
    a: int = 0


class _WithBadOverride(BaseModel):
    field_order: ClassVar[list[str]] = ["a", "c"]

    b: int = 0
    a: int = 0


class _Nested(BaseModel):
    field_order: ClassVar[list[str]] = ["y", "x"]

    x: int = 0
    y: int = 0


class _NestedBase(BaseModel):
    y: int


class _NestedComposed(_NestedBase):
    field_order: ClassVar[list[str]] = ["y", "x"]

    x: int


class _Outer(BaseModel):
    nested: _Nested


class _OuterComposed(BaseModel):
    nested: _NestedComposed


def test_no_field_order_behaves_as_today() -> None:
    # Unchanged behavior: model-field declaration order (b, a), not alphabetical.
    schema = build_configuration_schema(_NoOverride)
    assert list(schema["properties"]) == ["b", "a"]


def test_field_order_override_reorders_properties() -> None:
    schema = build_configuration_schema(_WithOverride)
    assert list(schema["properties"]) == ["a", "b"]


def test_field_order_override_must_be_exact_permutation() -> None:
    with pytest.raises(ValueError, match="field_order"):
        build_configuration_schema(_WithBadOverride)


def test_field_order_applies_to_nested_defs_models() -> None:
    # `_Nested` only ever appears inside `$defs`, never as the top-level
    # `config_class` -- this is the DataBinding-inside-MetricTileControls shape.
    schema = build_configuration_schema(_Outer)
    assert list(schema["$defs"]["_Nested"]["properties"]) == ["y", "x"]


def test_field_order_on_nested_model_with_inherited_field() -> None:
    # `x` is inherited from `_NestedBase` (like DataBinding inheriting
    # `metrics` from MetricControl), so Pydantic's natural field order would
    # put `x` first; the override pins it back.
    schema = build_configuration_schema(_OuterComposed)
    assert list(schema["$defs"]["_NestedComposed"]["properties"]) == ["y", "x"]
    assert schema["$defs"]["_NestedComposed"]["required"] == ["y", "x"]
