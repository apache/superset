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
Who may open an artifact on a standalone page, and the version they get.

The page and the frame link it fetches run the same check, so that the page
opens for exactly those whose frame would load.
"""

from __future__ import annotations

from superset_core.artifacts.authoring import AuthoringErrorCode
from superset_oss.artifacts.errors import ArtifactError
from superset_oss.artifacts.frames.access import choose_version, ServedVersion
from superset_oss.artifacts.store.filestore import ArtifactFileStore


def standalone_version(
    store: ArtifactFileStore, actor: str, artifact_id: str
) -> ServedVersion:
    """
    The version of ``artifact_id`` that a standalone page shows ``actor``.

    Only owners open the page until artifacts have viewers of their own:
    anyone else gets ``ARTIFACT_NOT_FOUND``, as for an artifact that doesn't
    exist, so that the answer doesn't tell whether it does.
    """
    served = choose_version(store, actor, artifact_id)
    if not served.can_edit:
        raise ArtifactError(
            AuthoringErrorCode.ARTIFACT_NOT_FOUND,
            f"artifact {artifact_id!r} not found",
        )
    return served
