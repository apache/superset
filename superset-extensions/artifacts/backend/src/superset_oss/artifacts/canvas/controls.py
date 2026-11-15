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
The artifact widget's props: which artifact a placement shows, and which version.

Props hold only that reference. The files live in the store, and every viewer
receives every widget's props, so code in props would grow the canvas past its
read limits and reach every viewer. The canvas titles the placement with the
widget's name, as it does every other widget, so the props hold no title.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from superset_core.artifacts.store import SHA256_HEX_PATTERN

UUID_PATTERN = (
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


class ArtifactControls(BaseModel):
    """Controls for the ``artifact`` widget."""

    model_config = ConfigDict(populate_by_name=True)

    artifact_id: str = Field(
        title="Artifact",
        description=(
            "The artifact's id, as artifact_create returned it. The artifact's "
            "files live in the artifact store, never in these props."
        ),
        pattern=UUID_PATTERN,
        json_schema_extra={"format": "uuid"},
    )
    version: str | None = Field(
        default=None,
        title="Version",
        description=(
            "A version to pin, as the authoring tools return it. Leave unset to "
            "show the artifact's published version as it changes."
        ),
        # A version is the hash of its tree.
        pattern=SHA256_HEX_PATTERN,
    )
