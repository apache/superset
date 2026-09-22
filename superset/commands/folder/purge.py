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
from superset.commands.folder.exceptions import (
    FolderDeleteFailedError,
    FolderForbiddenError,
    FolderNotDeletedError,
    FolderNotFoundError,
)
from superset.daos.folder import FolderDAO
from superset.extensions import db
from superset.folders.constants import ASSET_TYPE_CONFIGS
from superset.folders.models import Folder, FolderObject
from superset.models.helpers import skip_visibility_filter
from superset.utils.decorators import on_error, transaction


class PurgeFolderCommand(BaseCommand):
    """Permanently delete a soft-deleted folder and its descendants."""

    def __init__(self, folder_id_or_uuid: str):
        self._id = folder_id_or_uuid
        self._model: Folder | None = None

    @transaction(on_error=partial(on_error, reraise=FolderDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model

        with skip_visibility_filter(db.session, Folder):
            folders_to_delete: list[Folder] = []
            stack = [self._model]
            while stack:
                current = stack.pop()
                folders_to_delete.append(current)
                stack.extend(current.children)

            for folder in folders_to_delete:
                for link in list(folder.objects):
                    for _name, config in ASSET_TYPE_CONFIGS.items():
                        asset_id = getattr(link, config.fk_column)
                        if asset_id is not None:
                            with skip_visibility_filter(
                                db.session, config.model
                            ):
                                asset = db.session.get(config.model, asset_id)
                            if asset:
                                db.session.delete(asset)
                            break
                db.session.query(FolderObject).filter(
                    FolderObject.folder_id == folder.id,
                ).delete(synchronize_session=False)

            for folder in reversed(folders_to_delete):
                db.session.delete(folder)

    def validate(self) -> None:
        with skip_visibility_filter(db.session, Folder):
            self._model = FolderDAO.find_by_id_or_uuid(self._id)

        if not self._model:
            raise FolderNotFoundError()

        if self._model.deleted_at is None:
            raise FolderNotDeletedError()

        if not security_manager.is_admin():
            raise FolderForbiddenError()
