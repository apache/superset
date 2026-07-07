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

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

from superset.commands.folder.exceptions import (
    FolderDeleteFailedError,
    FolderForbiddenError,
    FolderNotFoundError,
)
from superset.daos.folder import FolderDAO
from superset.folders.models import Folder
from superset.daos.folder_permissions import FolderPermissionDAO


class DeleteFolderCommand(BaseCommand):
    def __init__(self, folder_id_or_uuid: str, archive_items: bool = False):
        self._id = folder_id_or_uuid
        self._archive_items = archive_items
        self._model: Folder | None = None

    @transaction(on_error=partial(on_error, reraise=FolderDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        FolderDAO.delete_folder(self._model, self._archive_items)

    def validate(self) -> None:
        from superset.utils import json as json_utils

        self._model = FolderDAO.find_by_id_or_uuid(self._id)
        if not self._model:
            raise FolderNotFoundError()

        # "Only Me" folder cannot be deleted
        extra = json_utils.loads(self._model.extra) if self._model.extra else {}
        if extra.get("only_me"):
            raise FolderForbiddenError()

        if not security_manager.is_admin():
            user_id = get_user_id()
            if not user_id or not FolderPermissionDAO.user_is_folder_editor(
                user_id, self._model.id
            ):
                raise FolderForbiddenError()
