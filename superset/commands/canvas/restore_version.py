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
"""Restore a canvas to an earlier version."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import partial
from uuid import UUID

from sqlalchemy_continuum import version_class

from superset import db, security_manager
from superset.canvas.versions import version_definition
from superset.commands.base import BaseCommand
from superset.commands.canvas.apply_ops import publish_canvas_changed
from superset.commands.canvas.exceptions import (
    CanvasForbiddenError,
    CanvasNotFoundError,
    CanvasUpdateFailedError,
    CanvasVersionNotFoundError,
)
from superset.daos.canvas import CanvasDAO
from superset.exceptions import SupersetSecurityException
from superset.models.canvas import Canvas
from superset.models.core import Theme
from superset.utils import json
from superset.utils.decorators import on_error, transaction
from superset.versioning.baseline import OPERATION_DELETE
from superset.versioning.queries import resolve_version
from superset.versioning.utils import capture_enabled

# Fields a restore takes from the version. Sharing and external management
# stay as they are now; the slug and theme are restored when still valid.
RESTORED_FIELDS = (
    "title",
    "description",
    "css",
    "certified_by",
    "certification_details",
)


@dataclass(frozen=True)
class RestoreResult:
    revision: int
    # Placements of widgets that were deleted, or that the user may no longer
    # place, since the version; they are left out of the restored canvas.
    skipped_placements: list[str] = field(default_factory=list)


class RestoreCanvasVersionCommand(BaseCommand):
    """
    Make an earlier version the canvas' latest one. The restore is itself a
    save, captured as a new version, so nothing in the history is lost.

    It bumps the revision and clears the operation log, so open drafts can no
    longer be committed and clients reload the whole definition instead of
    replaying changes.
    """

    def __init__(self, canvas_uuid: UUID, version_uuid: UUID) -> None:
        self._uuid = canvas_uuid
        self._version_uuid = version_uuid
        self._canvas_id = 0

    def run(self) -> RestoreResult:
        result = self._restore()
        publish_canvas_changed(self._canvas_id)
        return result

    @transaction(on_error=partial(on_error, reraise=CanvasUpdateFailedError))
    def _restore(self) -> RestoreResult:
        session = db.session()
        if not session.in_transaction():
            session.begin()
        self.validate()
        canvas = CanvasDAO.lock(self._canvas_id)

        resolved = resolve_version(
            Canvas, self._uuid, self._version_uuid, entity=canvas
        )
        if resolved is None:
            raise CanvasVersionNotFoundError()
        version_number, transaction_id = resolved
        target = (
            db.session.query(version_class(Canvas))
            .filter_by(id=canvas.id, uuid=canvas.uuid, transaction_id=transaction_id)
            .one_or_none()
        )
        if target is None or target.operation_type == OPERATION_DELETE:
            raise CanvasVersionNotFoundError()

        definition, skipped = version_definition(canvas, target.definition)
        self._stamp_restore(canvas, self._version_uuid, version_number)
        for name in RESTORED_FIELDS:
            setattr(canvas, name, getattr(target, name))
        if not target.slug or not CanvasDAO.slug_in_use(target.slug, canvas.id):
            canvas.slug = target.slug
        if target.theme_id is None or db.session.get(Theme, target.theme_id):
            canvas.theme_id = target.theme_id
        canvas.definition = json.dumps(definition)
        canvas.definition_version = definition["version"]
        canvas.revision += 1
        CanvasDAO.prune(canvas.id)
        return RestoreResult(revision=canvas.revision, skipped_placements=skipped)

    def validate(self) -> None:
        # Without capture the restore would be an untracked overwrite.
        if not capture_enabled(db.session()):
            raise CanvasNotFoundError()
        canvas = CanvasDAO.find_by_id_or_uuid(str(self._uuid))
        if canvas is None:
            raise CanvasNotFoundError()
        try:
            security_manager.raise_for_editorship(canvas)
        except SupersetSecurityException as ex:
            raise CanvasForbiddenError() from ex
        # Its source of truth is elsewhere, and would overwrite the restore.
        if canvas.is_managed_externally:
            raise CanvasForbiddenError()
        self._canvas_id = canvas.id

    @staticmethod
    def _stamp_restore(canvas: Canvas, version_uuid: UUID, version_number: int) -> None:
        """Mark the save as a restore, so history shows "Restored version N"."""
        # pylint: disable=import-outside-toplevel
        from superset.versioning.changes import (
            ACTION_KIND_KEY,
            ACTION_KIND_RESTORE,
            ACTION_META_KEY,
            build_action_headline,
        )

        db.session.info[ACTION_KIND_KEY] = ACTION_KIND_RESTORE
        db.session.info[ACTION_META_KEY] = build_action_headline(
            "canvas",
            canvas.id,
            {"version_uuid": str(version_uuid), "version_number": version_number},
        )
