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
from typing import Any

import pytest

from superset.canvas.definition.upgrades import (
    DefinitionVersionError,
    upgrade_definition,
)


def add_title(definition: dict[str, Any]) -> dict[str, Any]:
    return {**definition, "title": "untitled"}


def rename_title(definition: dict[str, Any]) -> dict[str, Any]:
    definition["name"] = definition.pop("title")
    return definition


UPGRADES = {1: add_title, 2: rename_title}


def test_current_definition_is_returned_as_is() -> None:
    definition = {"version": 3}

    assert upgrade_definition(definition, current=3, upgrades=UPGRADES) is definition


def test_older_definition_runs_every_upgrade_in_order() -> None:
    stored = {"version": 1, "nodes": {}}

    upgraded = upgrade_definition(stored, current=3, upgrades=UPGRADES)

    assert upgraded == {"version": 3, "nodes": {}, "name": "untitled"}
    assert stored == {"version": 1, "nodes": {}}


def test_newer_definition_is_refused() -> None:
    with pytest.raises(DefinitionVersionError, match="Upgrade Superset"):
        upgrade_definition({"version": 4}, current=3, upgrades=UPGRADES)


@pytest.mark.parametrize("version", [0, "1", True, None])
def test_malformed_version_is_refused(version: Any) -> None:
    with pytest.raises(DefinitionVersionError, match="Unsupported"):
        upgrade_definition({"version": version}, current=3, upgrades=UPGRADES)
