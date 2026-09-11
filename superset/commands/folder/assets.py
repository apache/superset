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
from superset import security_manager
from superset.commands.base import BaseCommand
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

from superset.commands.folder.exceptions import (
    FolderAssetNotFoundValidationError,
    FolderAssetTypeValidationError,
    FolderForbiddenError,
    FolderInvalidError,
    FolderNotFoundError,
    FolderUpdateFailedError,
)
from superset.folders.constants import ASSET_TYPE_CONFIGS, asset_types_for_folder_type
from superset.daos.folder import FolderDAO
from superset.folders.models import Folder
from superset.daos.folder_permissions import FolderPermissionDAO


def _validate_folder_assets(
    folder_id_or_uuid: str, assets: list[dict[str, Any]]
) -> Folder:
    """Validate folder existence, editor permissions, and asset references."""
    model = FolderDAO.find_by_id_or_uuid(folder_id_or_uuid)
    if not model:
        raise FolderNotFoundError()

    if not security_manager.is_admin():
        user_id = get_user_id()
        if not user_id or not FolderPermissionDAO.user_is_folder_editor(
            user_id, model.id
        ):
            raise FolderForbiddenError()

    exceptions: list[ValidationError] = []
    allowed = set(asset_types_for_folder_type(model.folder_type))
    is_admin = security_manager.is_admin()
    for asset in assets:
        asset_type = asset["type"]
        if asset_type not in allowed:
            exceptions.append(
                FolderAssetTypeValidationError(asset_type, model.folder_type)
            )
        elif not FolderDAO.asset_exists(asset_type, asset["id"]):
            exceptions.append(
                FolderAssetNotFoundValidationError(asset_type, asset["id"])
            )
        elif not is_admin:
            from superset.extensions import db

            config = ASSET_TYPE_CONFIGS[asset_type]
            asset_obj = db.session.get(config.model, asset["id"])
            if asset_obj:
                try:
                    if asset_type == "dashboard":
                        security_manager.raise_for_access(dashboard=asset_obj)
                    elif asset_type == "chart":
                        security_manager.raise_for_access(chart=asset_obj)
                except Exception as ex:
                    raise FolderForbiddenError() from ex

    if exceptions:
        raise FolderInvalidError(exceptions=exceptions)

    return model


class UpdateFolderAssetsCommand(BaseCommand):
    """Set a folder's asset membership.

    ``assets`` is the full desired membership: listed assets are moved into the
    folder (from wherever they were), and any of the folder's current assets not
    in the list are moved back to the root. An empty list empties the folder.
    """

    def __init__(self, folder_id_or_uuid: str, assets: list[dict[str, Any]]):
        self._id = folder_id_or_uuid
        self._assets = assets
        self._model: Folder | None = None

    @transaction(on_error=partial(on_error, reraise=FolderUpdateFailedError))
    def run(self) -> Folder:
        self.validate()
        assert self._model
        FolderDAO.set_assets(self._model, self._assets)
        return self._model

    def validate(self) -> None:
        self._model = _validate_folder_assets(self._id, self._assets)


class AddFolderAssetsCommand(BaseCommand):
    """Add assets to a folder (upsert).

    Assets already in another folder are moved. Assets already in this folder
    are left as-is. Unlike ``UpdateFolderAssetsCommand``, existing assets in
    the folder that are not listed are **not** removed.
    """

    def __init__(self, folder_id_or_uuid: str, assets: list[dict[str, Any]]):
        self._id = folder_id_or_uuid
        self._assets = assets
        self._model: Folder | None = None

    @transaction(on_error=partial(on_error, reraise=FolderUpdateFailedError))
    def run(self) -> Folder:
        self.validate()
        assert self._model
        FolderDAO.assign_assets(self._model, self._assets)
        return self._model

    def validate(self) -> None:
        self._model = _validate_folder_assets(self._id, self._assets)
