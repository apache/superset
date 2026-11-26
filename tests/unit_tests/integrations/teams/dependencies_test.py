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
"""Optional dependency discovery must never import Microsoft SDK modules."""

import builtins
from importlib.metadata import PackageNotFoundError
from typing import Any

import pytest

from superset.integrations.teams import dependencies


@pytest.mark.parametrize("installed", [False, True])
def test_dependency_check_uses_metadata_without_importing_sdk(
    monkeypatch: pytest.MonkeyPatch,
    installed: bool,
) -> None:
    """A missing extra is normal; an installed one is detected without importing it."""
    imported = builtins.__import__
    lookups: list[str] = []

    def check_import(name: str, *args: Any, **kwargs: Any) -> Any:
        if name.startswith("microsoft_teams"):
            raise AssertionError("must not import the optional SDK")
        return imported(name, *args, **kwargs)

    def version(name: str) -> str:
        lookups.append(name)
        if not installed:
            raise PackageNotFoundError(name)
        return "2.1.1"

    monkeypatch.setattr(builtins, "__import__", check_import)
    monkeypatch.setattr(dependencies, "version", version)
    assert dependencies.is_teams_sdk_installed() is installed
    assert lookups == ["microsoft-teams-apps"]
