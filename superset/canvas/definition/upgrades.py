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
Upgrading stored definitions to the current schema version.

Every change to the definition schema bumps ``DEFINITION_VERSION`` and adds an
upgrade from the previous version to ``UPGRADES``. Definitions are upgraded
when loaded; the next write stores the upgraded form. A definition newer than
this server understands is refused rather than read with a partial schema.
"""

from __future__ import annotations

import copy
from collections.abc import Callable, Mapping
from typing import Any

from superset.canvas.definition.schemas import DEFINITION_VERSION

Upgrade = Callable[[dict[str, Any]], dict[str, Any]]

# Upgrades keyed by the version they upgrade from; each returns the definition
# at the next version.
UPGRADES: dict[int, Upgrade] = {}


class DefinitionVersionError(ValueError):
    def __init__(self, version: object, current: int) -> None:
        self.version = version
        self.current = current
        if isinstance(version, int) and version > current:
            message = (
                f"This canvas was saved with definition version {version}; this "
                f"Superset supports up to {current}. Upgrade Superset to open it."
            )
        else:
            message = f"Unsupported canvas definition version {version!r}"
        super().__init__(message)


def upgrade_definition(
    definition: dict[str, Any],
    current: int = DEFINITION_VERSION,
    upgrades: Mapping[int, Upgrade] | None = None,
) -> dict[str, Any]:
    """Return ``definition`` at version ``current``, upgrading it if older."""
    upgrades = UPGRADES if upgrades is None else upgrades
    version = definition.get("version", 1)
    if not isinstance(version, int) or isinstance(version, bool):
        raise DefinitionVersionError(version, current)
    if version > current or version < 1:
        raise DefinitionVersionError(version, current)
    if version == current:
        return definition
    upgraded = copy.deepcopy(definition)
    while version < current:
        upgraded = upgrades[version](upgraded)
        version += 1
        upgraded["version"] = version
    return upgraded
