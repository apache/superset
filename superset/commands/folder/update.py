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
import logging
from functools import partial
from typing import Any, Optional

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.folder.exceptions import (
    FolderCycleValidationError,
    FolderInvalidError,
    FolderNameUniquenessValidationError,
    FolderNotFoundError,
    FolderParentNotFoundValidationError,
    FolderParentTypeMismatchValidationError,
    FolderUpdateFailedError,
)
from superset.daos.folder import FolderDAO
from superset.folders.models import Folder
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateFolderCommand(BaseCommand):
    def __init__(self, folder_id_or_uuid: str, data: dict[str, Any]):
        self._id = folder_id_or_uuid
        self._properties = data.copy()
        self._model: Optional[Folder] = None
        self._parent_changed = False
        self._new_parent_id: Optional[int] = None

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

        return FolderDAO.update(self._model, attributes)

    def validate(self) -> None:
        self._model = FolderDAO.find_by_id_or_uuid(self._id)
        if not self._model:
            raise FolderNotFoundError()

        exceptions: list[ValidationError] = []
        new_parent_id = self._model.parent_id

        if "parent_uuid" in self._properties:
            self._parent_changed = True
            parent_uuid = self._properties["parent_uuid"]
            parent: Optional[Folder] = None
            if parent_uuid:
                parent = FolderDAO.find_by_id_or_uuid(parent_uuid)
                if parent is None:
                    exceptions.append(FolderParentNotFoundValidationError())
                elif parent.folder_type != self._model.folder_type:
                    exceptions.append(FolderParentTypeMismatchValidationError())
                elif FolderDAO.is_descendant(parent, self._model):
                    exceptions.append(FolderCycleValidationError())
            new_parent_id = parent.id if parent else None
            self._new_parent_id = new_parent_id

        new_name = self._properties.get("name", self._model.name)
        if new_name != self._model.name or new_parent_id != self._model.parent_id:
            if not FolderDAO.validate_name_uniqueness(
                new_name,
                new_parent_id,
                self._model.folder_type,
                exclude_id=self._model.id,
            ):
                exceptions.append(FolderNameUniquenessValidationError())

        if exceptions:
            raise FolderInvalidError(exceptions=exceptions)
