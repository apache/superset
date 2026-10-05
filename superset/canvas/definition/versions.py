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
The definition format version.

Every change to the definition format bumps ``DEFINITION_VERSION`` and ships
an Alembic migration that rewrites stored definitions, with a downgrade that
converts them back, so stored definitions are always at the current version.
The migration also clears ``canvas_ops``: logged operations are in the old
format and can't be checked for overlap, so open clients get ``stale`` and
reload.
Additive changes ship expand/contract across two releases. Anything at another
version, such as a definition from a newer server or an old export, is refused
rather than read with the wrong schema.
"""

from __future__ import annotations

from typing import Any

from superset.canvas.definition.schemas import DEFINITION_VERSION


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


def check_definition_version(
    definition: dict[str, Any], current: int = DEFINITION_VERSION
) -> dict[str, Any]:
    """Return ``definition`` if it is at version ``current``; refuse it otherwise."""
    version = definition.get("version", current)
    if isinstance(version, bool) or version != current:
        raise DefinitionVersionError(version, current)
    return definition
