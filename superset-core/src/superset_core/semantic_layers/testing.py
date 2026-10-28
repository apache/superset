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

"""Opt-in pytest support for provider tests without a Superset application.

Load with ``pytest_plugins = ["superset_core.semantic_layers.testing"]``.
Install ``apache-superset-core[testing]`` for pytest support; importing the
provider SDK itself does not require pytest.
"""

from collections.abc import Callable
from typing import TypeVar

import pytest

from superset_core.semantic_layers import decorators

_T = TypeVar("_T")


def _registration(
    id: str, name: str, description: str | None = None
) -> Callable[[_T], _T]:
    """Set display metadata without registering the class with any host."""

    def decorate(provider: _T) -> _T:
        # The decorator adds metadata; the input type need not declare it.
        setattr(provider, "name", name)  # noqa: B010
        setattr(provider, "description", description)  # noqa: B010
        return provider

    return decorate


@pytest.fixture
def semantic_layer_registration(monkeypatch: pytest.MonkeyPatch) -> None:
    """Allow provider imports during a test without initializing a host.

    Request this fixture before importing modules that use ``@semantic_layer``;
    top-level provider imports in test modules run before fixtures. The fixture
    replaces only the SDK decorator, and pytest restores it after the test.
    Decorated classes retain their assigned name and description, as in the host.
    Already-imported aliases are not patched. It does not emulate registration,
    namespacing, duplicate detection or extension lifecycle. Test those in a host
    integration lane. Use in isolated provider test processes, not a live host.
    """
    monkeypatch.setattr(decorators, "semantic_layer", _registration)
