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
from typing import Any

from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.folder.exceptions import (
    FolderCreateFailedError,
    FolderInvalidError,
    FolderNameUniquenessValidationError,
    FolderParentNotFoundValidationError,
    FolderParentTypeMismatchValidationError,
)
from superset.daos.folder import FolderDAO
from superset.folders.models import Folder
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateFolderCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()
        self._parent: Folder | None = None

    @transaction(on_error=partial(on_error, reraise=FolderCreateFailedError))
    def run(self) -> Folder:
        self.validate()
        return FolderDAO.create(
            attributes={
                "name": self._properties["name"],
                "description": self._properties.get("description"),
                "parent_id": self._parent.id if self._parent else None,
                "folder_type": self._properties["folder_type"],
                "is_private": self._properties.get("is_private", False),
            }
        )

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        name = self._properties["name"]
        folder_type = self._properties["folder_type"]

        if parent_uuid := self._properties.get("parent_uuid"):
            self._parent = FolderDAO.find_by_id_or_uuid(parent_uuid)
            if self._parent is None:
                exceptions.append(FolderParentNotFoundValidationError())
            elif self._parent.folder_type != folder_type:
                exceptions.append(FolderParentTypeMismatchValidationError())

        parent_id = self._parent.id if self._parent else None
        if not FolderDAO.validate_name_uniqueness(name, parent_id, folder_type):
            exceptions.append(FolderNameUniquenessValidationError())

        if exceptions:
            raise FolderInvalidError(exceptions=exceptions)
