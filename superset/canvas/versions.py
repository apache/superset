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
"""Reading canvas versions: the saves captured by version history."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from superset import is_feature_enabled, security_manager
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasVersionNotFoundError,
)
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.models.canvas import Canvas
from superset.versioning.queries import get_version


def version_snapshot(canvas: Canvas, version_uuid: UUID) -> dict[str, Any]:
    """
    The canvas as ``version_uuid`` saved it, with its definition parsed. Like
    the rest of version history, only the canvas' editors may read it.
    """
    if not is_feature_enabled("VERSION_HISTORY"):
        raise CanvasVersionNotFoundError()
    try:
        security_manager.raise_for_editorship(canvas)
    except SupersetSecurityException as ex:
        raise CanvasForbiddenError() from ex
    snapshot = get_version(Canvas, canvas.uuid, version_uuid, entity=canvas)
    if snapshot is None or snapshot.get("definition") is None:
        raise CanvasVersionNotFoundError()
    snapshot["definition"] = CanvasDAO.parse(snapshot["definition"])
    return snapshot
