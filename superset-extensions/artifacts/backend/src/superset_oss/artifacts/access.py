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
Who may do what with an artifact: what its saved widget allows the caller.

An artifact's identity is one saved widget of the artifact type, whose UUID
is the artifact's id. Reading the artifact follows the widget's access rules,
and changing it, its editors. The pure pieces (the authoring handlers, the
frames, the data seam) ask through ``ArtifactAccess``; the entry point plugs
in the implementation on the widgets table (``canvas.widgets``).
"""

from __future__ import annotations

from typing import Protocol

from superset_oss.artifacts.errors import artifact_not_found


class ArtifactAccess(Protocol):
    """What the caller may do with an artifact, as its widget says."""

    def register(self, artifact_id: str, name: str, editor: str) -> None:
        """
        Save the widget of a new artifact, ``artifact_id``, named ``name``,
        with the user ``editor`` as its editor.
        """
        ...

    def can_read(self, artifact_id: str) -> bool:
        """Whether the caller may read the artifact: open it, view its files."""
        ...

    def can_edit(self, artifact_id: str) -> bool:
        """Whether the caller may change the artifact: write its files, publish it."""
        ...


def require_read(access: ArtifactAccess, artifact_id: str) -> None:
    """``ARTIFACT_NOT_FOUND`` unless the caller may read the artifact."""
    if not access.can_read(artifact_id):
        raise artifact_not_found(artifact_id)


def require_edit(access: ArtifactAccess, artifact_id: str) -> None:
    """``ARTIFACT_NOT_FOUND`` unless the caller may change the artifact."""
    if not access.can_edit(artifact_id):
        raise artifact_not_found(artifact_id)
