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
from __future__ import annotations

from functools import partial
from typing import Any

from marshmallow import ValidationError
from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

from superset.commands.folder.exceptions import (
    FolderCycleValidationError,
    FolderForbiddenError,
    FolderInvalidError,
    FolderNameUniquenessValidationError,
    FolderNotFoundError,
    FolderParentNotFoundValidationError,
    FolderParentTypeMismatchValidationError,
    FolderUpdateFailedError,
)
from superset.daos.folder import FolderDAO
from superset.folders.models import Folder
from superset.daos.folder_permissions import FolderPermissionDAO


class UpdateFolderCommand(BaseCommand):
    def __init__(self, folder_id_or_uuid: str, data: dict[str, Any]):
        self._id = folder_id_or_uuid
        self._properties = data.copy()
        self._model: Folder | None = None
        self._parent_changed = False
        self._new_parent_id: int | None = None

    @transaction(on_error=partial(on_error, reraise=FolderUpdateFailedError))
    def run(self) -> Folder:
        self.validate()
        assert self._model

        attributes: dict[str, Any] = {}
        if "name" in self._properties:
            attributes["name"] = self._properties["name"]
        if "description" in self._properties:
            attributes["description"] = self._properties["description"]
        if "is_private" in self._properties:
            attributes["is_private"] = self._properties["is_private"]
        if self._parent_changed:
            attributes["parent_id"] = self._new_parent_id

        folder = FolderDAO.update(self._model, attributes)

        # When moving to a new parent: copy permissions and remove root pins
        if self._parent_changed and self._new_parent_id is not None:
            FolderPermissionDAO.copy_permissions_to_subfolder(
                self._new_parent_id, folder.id
            )
            from superset.folders.models import FolderPin

            db.session.query(FolderPin).filter(
                FolderPin.folder_id == folder.id,
            ).delete()

        # Sync permissions from parent when requested
        if self._properties.get("sync_permissions") and folder.parent_id:
            FolderPermissionDAO.copy_permissions_to_subfolder(
                folder.parent_id, folder.id
            )
            FolderPermissionDAO.push_down_permissions(folder.id)

        return folder

    def _validate_parent(self, exceptions: list[ValidationError]) -> int | None:
        """Validate and resolve parent_uuid, returning the new parent_id."""
        new_parent_id = self._model.parent_id  # type: ignore[union-attr]
        if "parent_uuid" not in self._properties:
            return new_parent_id

        self._parent_changed = True
        parent: Folder | None = None
        if parent_uuid := self._properties["parent_uuid"]:
            parent = FolderDAO.find_by_id_or_uuid(parent_uuid)
            if parent is None:
                exceptions.append(FolderParentNotFoundValidationError())
            elif parent.folder_type != self._model.folder_type:  # type: ignore[union-attr]
                exceptions.append(FolderParentTypeMismatchValidationError())
            elif FolderDAO.is_descendant(parent, self._model):  # type: ignore[arg-type]
                exceptions.append(FolderCycleValidationError())
            elif not security_manager.is_admin():
                user_id = get_user_id()
                if not user_id or not FolderPermissionDAO.user_is_folder_editor(user_id, parent.id):
                    raise FolderForbiddenError()
        new_parent_id = parent.id if parent else None
        self._new_parent_id = new_parent_id
        return new_parent_id

    def validate(self) -> None:
        from superset.utils import json as json_utils

        self._model = FolderDAO.find_by_id_or_uuid(self._id)
        if not self._model:
            raise FolderNotFoundError()

        if not security_manager.is_admin():
            user_id = get_user_id()
            if not user_id or not FolderPermissionDAO.user_is_folder_editor(
                user_id, self._model.id
            ):
                raise FolderForbiddenError()

        # "Only Me" folder: reject name/parent changes (sync_permissions is allowed)
        extra = json_utils.loads(self._model.extra) if self._model.extra else {}
        if extra.get("only_me"):
            if "name" in self._properties or "parent_uuid" in self._properties:
                raise FolderForbiddenError()

        # Private folders cannot be moved into other folders
        if self._model.is_private and "parent_uuid" in self._properties:
            raise FolderForbiddenError()

        exceptions: list[ValidationError] = []
        new_parent_id = self._validate_parent(exceptions)

        new_name = self._properties.get("name", self._model.name)
        if new_name != self._model.name or new_parent_id != self._model.parent_id:
            resolved = FolderDAO.resolve_name_conflict(
                new_name,
                new_parent_id,
                self._model.folder_type,
                exclude_id=self._model.id,
            )
            if resolved != new_name:
                self._properties["name"] = resolved

        if exceptions:
            raise FolderInvalidError(exceptions=exceptions)
