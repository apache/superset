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

"""
The TypeScript SDK's copies of these contracts, checked against them.

``@superset-oss/artifacts-sdk`` declares the capability names and the shape
of ``manifest.json`` again, for the browser. These tests read its sources and
fail when the two halves drift apart: a field, a literal or a capability that
one side has and the other doesn't, or a field that is optional on one side
only. They read the declarations as text, so they rely on the sources' plain
layout (one field per line, two-space indentation).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import get_args

from pydantic import BaseModel
from superset_artifacts_sdk import manifest
from superset_artifacts_sdk.capabilities import Capability

SDK_SOURCES = Path(__file__).resolve().parents[2] / "browser" / "src"

_INTERFACE = re.compile(
    r"^export interface (\w+) \{\n(.*?)^\}", re.MULTILINE | re.DOTALL
)
_FIELD = re.compile(r"^  (\w+)(\??):", re.MULTILINE)
_STRING_LITERAL = re.compile(r"'([^']*)'")


def _source(name: str) -> str:
    return (SDK_SOURCES / name).read_text(encoding="utf-8")


def _declaration(source: str, pattern: str) -> str:
    match = re.search(pattern, source, re.MULTILINE | re.DOTALL)
    assert match, f"no declaration matches {pattern!r}"
    return match.group(1)


def _union(source: str, name: str) -> set[str]:
    """The string literals of an exported union type."""
    return set(
        _STRING_LITERAL.findall(_declaration(source, rf"^export type {name} =(.*?);"))
    )


def _ts_interfaces(source: str) -> dict[str, dict[str, bool]]:
    """Each exported interface's fields, mapped to whether they are optional."""
    return {
        name: {field: optional == "?" for field, optional in _FIELD.findall(body)}
        for name, body in _INTERFACE.findall(source)
    }


def _manifest_models() -> dict[str, type[BaseModel]]:
    """The public pydantic models that make up ``manifest.json``."""
    return {
        name: value
        for name, value in vars(manifest).items()
        if isinstance(value, type)
        and issubclass(value, BaseModel)
        and value.__module__ == manifest.__name__
        and not name.startswith("_")
    }


def test_capabilities_match() -> None:
    body = _declaration(
        _source("capabilities.ts"), r"^export const Capability = \{\n(.*?)^\} as const;"
    )
    declared = dict(re.findall(r"^  (\w+): '([^']*)',", body, re.MULTILINE))
    assert declared == {capability.name: capability.value for capability in Capability}


def test_manifest_interfaces_match_the_models() -> None:
    """Same models, same fields, and a field is optional on both sides or neither."""
    interfaces = _ts_interfaces(_source("manifest.ts"))
    models = _manifest_models()
    assert set(interfaces) == set(models)
    for name, model in models.items():
        fields = {
            info.alias or field: not info.is_required()
            for field, info in model.model_fields.items()
        }
        assert interfaces[name] == fields, name


def test_manifest_literals_match() -> None:
    source = _source("manifest.ts")
    assert _union(source, "ParameterType") == set(get_args(manifest.ParameterType))
    assert _union(source, "EventKind") == set(get_args(manifest.EventKind))
    sources = _declaration(source, r"^export type BindingSource =(.*?);")
    assert set(re.findall(r"\b[A-Z]\w+\b", sources)) == {
        model.__name__ for model in get_args(get_args(manifest.BindingSource)[0])
    }


def test_manifest_constants_match() -> None:
    source = _source("manifest.ts")
    assert f"export const MANIFEST_VERSION = '{manifest.MANIFEST_VERSION}';" in source
    assert f"export const MANIFEST_FILE = '{manifest.MANIFEST_FILE}';" in source
