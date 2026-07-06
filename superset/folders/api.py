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
"""REST API for folder management and asset assignment."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from flask import g, request, Response
from flask_appbuilder.api import (
    expose,
    permission_name,
    protect,
    rison as parse_rison,
    safe,
)
from flask_appbuilder.security.sqla.models import Role, User
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.folder.assets import (
    AddFolderAssetsCommand,
    UpdateFolderAssetsCommand,
)
from superset.commands.folder.create import CreateFolderCommand
from superset.commands.folder.delete import DeleteFolderCommand
from superset.commands.folder.exceptions import (
    FolderCreateFailedError,
    FolderDeleteFailedError,
    FolderForbiddenError,
    FolderInvalidError,
    FolderNotFoundError,
    FolderUpdateFailedError,
)
from superset.commands.folder.update import UpdateFolderCommand
from superset.daos.folder import FolderDAO, ResolvedAsset
from superset.daos.folder_permissions import FolderPermissionDAO
from superset.extensions import db, event_logger
from superset.folders.constants import ASSET_TYPE_CONFIGS, DEFAULT_FOLDER_TYPE
from superset.folders.models import Folder
from superset.folders.schemas import (
    FolderAssetSchema,
    FolderAssetsPutSchema,
    FolderContentItemSchema,
    FolderContentsResponseSchema,
    FolderListResponseSchema,
    FolderPinPostSchema,
    FolderPostSchema,
    FolderPutSchema,
    FolderResponseSchema,
    FolderRootResponseSchema,
    FolderSchema,
    FolderSubjectPostSchema,
    FolderSubjectPutSchema,
)
from superset.folders.utils import can_manage_folders
from superset.utils.core import get_user_id
from superset.utils import json as json_utils
from superset.utils.decorators import transaction
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

logger = logging.getLogger(__name__)


def _serialize_user(user: Any) -> dict[str, Any] | None:
    if not user:
        return None
    return {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


def _get_user_permission(folder: Folder) -> str | None:
    """Return the current user's permission level for this folder."""
    if security_manager.is_admin():
        return "editor"
    user_id = get_user_id()
    if not user_id:
        return None
    if FolderPermissionDAO.user_is_folder_editor(user_id, folder.id):
        return "editor"
    if FolderPermissionDAO.user_has_folder_access(user_id, folder.id):
        return "viewer"
    return None


def _get_inherits_permissions(folder: Folder) -> bool:
    """Return whether this folder inherits permissions from its parent."""
    if not folder.extra:
        return True
    extra = json_utils.loads(folder.extra)
    return extra.get("inherits_permissions", True)


def serialize_folder(
    folder: Folder,
    children_count: int | None = None,
    asset_count: int | None = None,
) -> dict[str, Any]:
    """Serialize a folder's metadata for API responses.

    Accepts optional pre-computed counts to avoid N+1 queries. When not
    provided, falls back to relationship access (acceptable for single-folder
    responses but expensive in list views).
    """
    return {
        "type": "folder",
        "id": folder.id,
        "uuid": str(folder.uuid),
        "name": folder.name,
        "description": folder.description,
        "parent_uuid": str(folder.parent.uuid) if folder.parent else None,
        "folder_type": folder.folder_type,
        "is_private": folder.is_private,
        "children_count": (
            children_count if children_count is not None else len(folder.children)
        ),
        "asset_count": (
            asset_count if asset_count is not None else len(folder.objects)
        ),
        "created_on": folder.created_on,
        "changed_on": folder.changed_on,
        "changed_on_humanized": folder.changed_on_humanized,
        "created_by": _serialize_user(folder.created_by),
        "changed_by": _serialize_user(folder.changed_by),
        "user_permission": _get_user_permission(folder),
        "inherits_permissions": _get_inherits_permissions(folder),
        "owners": [],
    }


def serialize_row(kind: str, obj: Any) -> dict[str, Any]:
    """Serialize a contents row (folder or asset) into a uniform-ish item."""
    return serialize_folder(obj) if kind == "folder" else serialize_asset(kind, obj)


def serialize_asset(asset_type: str, asset: Any) -> dict[str, Any]:
    """Serialize a single asset (dashboard/chart/dataset) with column data."""
    config = ASSET_TYPE_CONFIGS[asset_type]
    owners = [
        owner
        for owner in (_serialize_user(o) for o in getattr(asset, "owners", []) or [])
        if owner
    ]
    return {
        "type": asset_type,
        "id": asset.id,
        "uuid": str(asset.uuid) if getattr(asset, "uuid", None) else None,
        "name": getattr(asset, config.title_attr, None),
        "url": getattr(asset, "url", None),
        "changed_on": getattr(asset, "changed_on", None),
        "changed_on_humanized": getattr(asset, "changed_on_humanized", None),
        "changed_by": _serialize_user(getattr(asset, "changed_by", None)),
        "owners": owners,
        # Chart-only columns; ``None`` for other asset kinds.
        "viz_type": getattr(asset, "viz_type", None),
        "datasource_name": (
            asset.datasource_name_text()
            if asset_type == "chart" and callable(
                getattr(asset, "datasource_name_text", None)
            )
            else None
        ),
        "datasource_url": (
            asset.datasource_url()
            if asset_type == "chart" and callable(getattr(asset, "datasource_url", None))
            else None
        ),
        "tags": [
            {"id": t.id, "name": t.name, "type": t.type.value if hasattr(t.type, "value") else t.type}
            for t in getattr(asset, "tags", []) or []
        ],
    }


def serialize_assets(assets: list[ResolvedAsset]) -> list[dict[str, Any]]:
    """Serialize assets, most-recently-changed first."""
    serialized = [serialize_asset(asset_type, asset) for asset_type, asset in assets]
    serialized.sort(key=lambda item: item["changed_on"] or datetime.min, reverse=True)
    return serialized


def _positive_int(key: str, default: int, maximum: int = 100) -> int:
    """Parse a non-negative integer query param, clamped to ``maximum``."""
    raw = request.args.get(key)
    if raw is not None and raw.isdigit():
        return min(int(raw), maximum)
    return default


def _parse_rison_args(rison_args: dict[str, Any]) -> dict[str, Any]:
    """Convert rison-encoded query params into ``get_contents()`` kwargs.

    Expected rison format (matches ``useListViewResource``)::

        {
          "order_column": "changed_on",
          "order_direction": "desc",
          "page": 0,
          "page_size": 25,
          "filters": [
            {"col": "name", "opr": "ct", "value": "sales"},
            {"col": "type", "opr": "in", "value": ["chart", "dashboard"]},
            {"col": "owners", "opr": "rel_m_m", "value": 1},
            {"col": "changed_on", "opr": "gt", "value": "2025-01-01"},
            {"col": "changed_on", "opr": "lt", "value": "2025-12-31"},
            {"col": "viz_type", "opr": "in", "value": ["pie", "bar"]},
            {"col": "dataset", "opr": "in", "value": [1, 2, 3]},
          ]
        }
    """
    result: dict[str, Any] = {
        "search": None,
        "types": None,
        "viz_types": None,
        "datasets": None,
        "tags": None,
        "owners": None,
        "modified_start": None,
        "modified_end": None,
        "page": min(int(rison_args.get("page", 0)), 10000),
        "page_size": min(int(rison_args.get("page_size", 25)), 100),
        "sort_column": rison_args.get("order_column", "changed_on"),
        "sort_order": rison_args.get("order_direction", "desc"),
    }
    for f in rison_args.get("filters", []):
        col = f.get("col")
        opr = f.get("opr")
        val = f.get("value")
        if val is None or val == "":
            continue
        if col == "name" and opr == "ct":
            result["search"] = str(val)[:255]
        elif col == "type" and opr == "in":
            result["types"] = val if isinstance(val, list) else [val]
        elif col == "owners" and opr == "rel_m_m":
            owners = result["owners"] or []
            owners.append(int(val))
            result["owners"] = owners
        elif col == "changed_on":
            try:
                dt = datetime.fromisoformat(str(val))
            except ValueError:
                continue
            if opr == "gt":
                result["modified_start"] = dt
            elif opr == "lt":
                result["modified_end"] = dt
        elif col == "viz_type" and opr == "in":
            result["viz_types"] = val if isinstance(val, list) else [val]
        elif col == "dataset" and opr == "in":
            result["datasets"] = [
                int(v) for v in (val if isinstance(val, list) else [val])
            ]
        elif col == "tags" and opr == "rel_m_m":
            result["tags"] = [
                int(v) for v in (val if isinstance(val, list) else [val])
            ]
    return result


class FolderRestApi(BaseSupersetApi):
    """CRUD and asset assignment for folders."""

    resource_name = "folders"
    class_permission_name = "Folder"
    allow_browser_login = True
    openapi_spec_tag = "Folders"
    openapi_spec_component_schemas = (
        FolderSchema,
        FolderAssetSchema,
        FolderPostSchema,
        FolderPutSchema,
        FolderAssetsPutSchema,
        FolderListResponseSchema,
        FolderResponseSchema,
        FolderContentItemSchema,
        FolderContentsResponseSchema,
        FolderRootResponseSchema,
    )

    add_model_schema = FolderPostSchema()
    edit_model_schema = FolderPutSchema()
    assets_model_schema = FolderAssetsPutSchema()

    @staticmethod
    def _raise_for_folder_access(folder: Folder) -> None:
        """Raise FolderForbiddenError if user cannot view the folder."""

        if security_manager.is_admin():
            return
        user_id = get_user_id()
        if not user_id or not FolderPermissionDAO.user_has_folder_access(
            user_id, folder.id
        ):
            raise FolderForbiddenError()

    @staticmethod
    def _raise_for_folder_edit(folder: Folder) -> None:
        """Raise FolderForbiddenError if user cannot edit the folder."""

        if security_manager.is_admin():
            return
        user_id = get_user_id()
        if not user_id or not FolderPermissionDAO.user_is_folder_editor(
            user_id, folder.id
        ):
            raise FolderForbiddenError()

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_list",
        log_to_statsd=False,
    )
    def get_list(self) -> Response:
        """List folders, optionally filtered by folder type.
        ---
        get:
          summary: List folders
          parameters:
          - in: query
            name: folder_type
            schema:
              type: string
            description: Only return folders of this type.
          responses:
            200:
              description: A list of folders
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FolderListResponseSchema'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        folder_type = request.args.get("folder_type")
        folders = FolderDAO.get_folders(folder_type=folder_type)

        # Non-admins only see folders they have access to
        if not security_manager.is_admin():
            user_id = get_user_id()
            if user_id:
                folders = [
                    f
                    for f in folders
                    if FolderPermissionDAO.user_has_folder_access(user_id, f.id)
                ]
            else:
                folders = []

        # Precompute counts to avoid N+1 queries
        folder_ids = [f.id for f in folders]
        children_counts: dict[int, int] = {}
        asset_counts: dict[int, int] = {}
        if folder_ids:
            from sqlalchemy import func

            for fid, cnt in (
                db.session.query(Folder.parent_id, func.count())
                .filter(Folder.parent_id.in_(folder_ids))
                .group_by(Folder.parent_id)
                .all()
            ):
                children_counts[fid] = cnt
            from superset.folders.models import FolderObject

            for fid, cnt in (
                db.session.query(FolderObject.folder_id, func.count())
                .filter(FolderObject.folder_id.in_(folder_ids))
                .group_by(FolderObject.folder_id)
                .all()
            ):
                asset_counts[fid] = cnt

        result = [
            serialize_folder(
                folder,
                children_count=children_counts.get(folder.id, 0),
                asset_count=asset_counts.get(folder.id, 0),
            )
            for folder in folders
        ]
        return self.response(200, count=len(result), result=result)

    @expose("/assets", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.root_assets",
        log_to_statsd=False,
    )
    @parse_rison()
    def root_assets(self, **kwargs: Any) -> Response:
        """Root view: top-level folders plus unfoldered assets.
        ---
        get:
          summary: Root folder view
          parameters:
          - in: query
            name: folder_type
            schema:
              type: string
              default: analytics
            description: Folder type namespace to scope the view to.
          - in: query
            name: q
            schema:
              type: string
            description: >
              Rison-encoded query parameters (order_column, order_direction,
              page, page_size, filters).
          responses:
            200:
              description: Top-level folders and assets not in any folder
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FolderRootResponseSchema'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        folder_type = request.args.get("folder_type", DEFAULT_FOLDER_TYPE)
        parsed = _parse_rison_args(kwargs.get("rison", {}))
        rows, count = FolderDAO.get_contents(None, folder_type, **parsed)
        return self.response(
            200,
            result=[serialize_row(kind, obj) for kind, obj in rows],
            count=count,
            page=parsed["page"],
            page_size=parsed["page_size"],
        )

    @expose("/<string:folder_uuid>", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get",
        log_to_statsd=False,
    )
    def get(self, folder_uuid: str) -> Response:
        """Get a folder's details.
        ---
        get:
          summary: Get a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          responses:
            200:
              description: Folder details
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FolderResponseSchema'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_access(folder)
        except FolderForbiddenError:
            return self.response_403()
        return self.response(200, result=serialize_folder(folder))

    @expose("/<string:folder_uuid>/assets", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_assets",
        log_to_statsd=False,
    )
    @parse_rison()
    def get_assets(self, folder_uuid: str, **kwargs: Any) -> Response:
        """List the subfolders and assets inside a folder.
        ---
        get:
          summary: Get folder contents
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          - in: query
            name: q
            schema:
              type: string
            description: >
              Rison-encoded query parameters (order_column, order_direction,
              page, page_size, filters).
          responses:
            200:
              description: Subfolders and assets inside the folder
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FolderContentsResponseSchema'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_access(folder)
        except FolderForbiddenError:
            return self.response_403()
        parsed = _parse_rison_args(kwargs.get("rison", {}))
        rows, count = FolderDAO.get_contents(folder, folder.folder_type, **parsed)
        return self.response(
            200,
            folder=serialize_folder(folder),
            result=[serialize_row(kind, obj) for kind, obj in rows],
            count=count,
            page=parsed["page"],
            page_size=parsed["page_size"],
        )

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Create a folder.
        ---
        post:
          summary: Create a folder
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderPostSchema'
          responses:
            201:
              description: The folder was created
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FolderResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not can_manage_folders(g.user):
            return self.response_403()
        try:
            data = self.add_model_schema.load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            folder = CreateFolderCommand(data).run()
            return self.response(
                201,
                id=folder.id,
                uuid=str(folder.uuid),
                result=serialize_folder(folder),
            )
        except FolderInvalidError as ex:
            return self.response(422, message=ex.normalized_messages())
        except FolderCreateFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/<string:folder_uuid>", methods=("PUT",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put",
        log_to_statsd=False,
    )
    @requires_json
    def put(self, folder_uuid: str) -> Response:
        """Update a folder (rename, describe, or move to a new parent).
        ---
        put:
          summary: Update a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderPutSchema'
          responses:
            200:
              description: The folder was updated
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FolderResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not can_manage_folders(g.user):
            return self.response_403()
        try:
            data = self.edit_model_schema.load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            folder = UpdateFolderCommand(folder_uuid, data).run()
            return self.response(200, result=serialize_folder(folder))
        except FolderNotFoundError:
            return self.response_404()
        except FolderForbiddenError:
            return self.response_403()
        except FolderInvalidError as ex:
            return self.response(422, message=ex.normalized_messages())
        except FolderUpdateFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/<string:folder_uuid>", methods=("DELETE",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.delete",
        log_to_statsd=False,
    )
    def delete(self, folder_uuid: str) -> Response:
        """Delete a folder.

        Children are re-parented to the deleted folder's parent and the assets it
        contained become unfoldered.
        ---
        delete:
          summary: Delete a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          responses:
            200:
              description: The folder was deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        if not can_manage_folders(g.user):
            return self.response_403()
        archive_items = request.args.get("archive_items", "").lower() == "true"
        try:
            DeleteFolderCommand(folder_uuid, archive_items).run()
            return self.response(200, message="OK")
        except FolderNotFoundError:
            return self.response_404()
        except FolderForbiddenError:
            return self.response_403()
        except FolderDeleteFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/<string:folder_uuid>/assets", methods=("PUT",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.put_assets",
        log_to_statsd=False,
    )
    @requires_json
    def put_assets(self, folder_uuid: str) -> Response:
        """Assign or move one or more assets into a folder.
        ---
        put:
          summary: Assign assets to a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderAssetsPutSchema'
          responses:
            200:
              description: The folder contents after assignment
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/FolderContentsResponseSchema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not can_manage_folders(g.user):
            return self.response_403()
        try:
            data = self.assets_model_schema.load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            folder = UpdateFolderAssetsCommand(folder_uuid, data["assets"]).run()
            rows, count = FolderDAO.get_contents(folder, folder.folder_type)
            return self.response(
                200,
                folder=serialize_folder(folder),
                result=[serialize_row(kind, obj) for kind, obj in rows],
                count=count,
            )
        except FolderNotFoundError:
            return self.response_404()
        except FolderForbiddenError:
            return self.response_403()
        except FolderInvalidError as ex:
            return self.response(422, message=ex.normalized_messages())
        except FolderUpdateFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/<string:folder_uuid>/assets", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.post_assets",
        log_to_statsd=False,
    )
    @requires_json
    def post_assets(self, folder_uuid: str) -> Response:
        """Add assets to a folder (upsert).

        Assets already in another folder are moved. Existing assets in this
        folder that are not listed are left untouched (unlike PUT which
        replaces the full membership).
        ---
        post:
          summary: Add assets to a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderAssetsPutSchema'
          responses:
            200:
              description: Assets added
            400:
              $ref: '#/components/responses/400'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
        """
        if not can_manage_folders(g.user):
            return self.response_403()
        try:
            data = self.assets_model_schema.load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            AddFolderAssetsCommand(folder_uuid, data["assets"]).run()
            return self.response(200, message="OK")
        except FolderNotFoundError:
            return self.response_404()
        except FolderForbiddenError:
            return self.response_403()
        except FolderInvalidError as ex:
            return self.response(422, message=ex.normalized_messages())
        except FolderUpdateFailedError as ex:
            return self.response_422(message=str(ex))

    @expose("/<string:folder_uuid>/assets", methods=("DELETE",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @transaction()
    def delete_assets(self, folder_uuid: str) -> Response:
        """Remove specific assets from a folder (back to root).
        ---
        delete:
          summary: Remove assets from a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderAssetsPutSchema'
          responses:
            200:
              description: Assets removed
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_edit(folder)
        except FolderForbiddenError:
            return self.response_403()
        import prison

        raw_q = request.args.get("q")
        if not raw_q:
            return self.response(400, message="Missing q parameter")
        try:
            assets = prison.loads(raw_q)
        except Exception:
            return self.response(400, message="Invalid q parameter")
        FolderDAO.remove_assets(folder, assets)
        return self.response(200, message="OK")

    # ------------------------------------------------------------------ #
    # Dashboard charts (rich serialization for expanded rows)
    # ------------------------------------------------------------------ #
    @expose("/dashboard-charts/<int:dashboard_id>", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    def dashboard_charts(self, dashboard_id: int) -> Response:
        """Return a dashboard's charts serialized like folder contents.
        ---
        get:
          summary: Get charts for a dashboard with full metadata
          parameters:
          - in: path
            name: dashboard_id
            required: true
            schema:
              type: integer
          responses:
            200:
              description: Charts with full column data
            404:
              $ref: '#/components/responses/404'
        """
        from superset.commands.dashboard.exceptions import (
            DashboardNotFoundError,
        )
        from superset.daos.dashboard import DashboardDAO

        try:
            slices = DashboardDAO.get_charts_for_dashboard(str(dashboard_id))
        except DashboardNotFoundError:
            return self.response_404()
        return self.response(
            200,
            result=[serialize_asset("chart", s) for s in slices],
        )

    # ------------------------------------------------------------------ #
    # Pins
    # ------------------------------------------------------------------ #
    @expose("/pins", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    def get_pins(self) -> Response:
        """List current user's pins.
        ---
        get:
          summary: List pinned items
          responses:
            200:
              description: Pinned items ordered by position
        """

        pins = FolderDAO.get_pins(g.user.id)
        result = [
            {
                "id": pin.id,
                "object_id": pin.object_id,
                "object_type": pin.object_type,
                "position": pin.position,
                "created_on": pin.created_on,
            }
            for pin in pins
        ]
        return self.response(200, count=len(result), result=result)

    @expose("/pins", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @requires_json
    @transaction()
    def post_pin(self) -> Response:
        """Pin an item.
        ---
        post:
          summary: Pin an item to the Analytics root view
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderPinPostSchema'
          responses:
            201:
              description: Pin created
            400:
              $ref: '#/components/responses/400'
        """

        try:
            data = FolderPinPostSchema().load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        pin = FolderDAO.create_pin(
            user_id=g.user.id,
            object_id=data["object_id"],
            object_type=data["object_type"],
            position=data["position"],
        )
        return self.response(
            201,
            result={
                "id": pin.id,
                "object_id": pin.object_id,
                "object_type": pin.object_type,
                "position": pin.position,
            },
        )

    @expose("/pins/<int:pin_id>", methods=("DELETE",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @transaction()
    def delete_pin(self, pin_id: int) -> Response:
        """Unpin an item.
        ---
        delete:
          summary: Remove a pin
          parameters:
          - in: path
            name: pin_id
            required: true
            schema:
              type: integer
          responses:
            200:
              description: Pin removed
            404:
              $ref: '#/components/responses/404'
        """

        if FolderDAO.delete_pin(pin_id, g.user.id):
            return self.response(200, message="OK")
        return self.response_404()

    # ------------------------------------------------------------------ #
    # Subjects (permissions)
    # ------------------------------------------------------------------ #
    @expose("/<folder_uuid>/subjects", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    def get_subjects(self, folder_uuid: str) -> Response:
        """List all subjects with their permission level.
        ---
        get:
          summary: List folder permissions
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          responses:
            200:
              description: List of subjects
            404:
              $ref: '#/components/responses/404'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_access(folder)
        except FolderForbiddenError:
            return self.response_403()
        subjects = FolderDAO.get_subjects(folder.id)
        return self.response(200, result=subjects)

    @expose("/<folder_uuid>/subjects", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @requires_json
    @transaction()
    def post_subject(self, folder_uuid: str) -> Response:
        """Add a subject to a folder.
        ---
        post:
          summary: Add editor or viewer
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderSubjectPostSchema'
          responses:
            201:
              description: Subject added
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_edit(folder)
        except FolderForbiddenError:
            return self.response_403()
        try:
            data = FolderSubjectPostSchema().load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            FolderDAO.add_subject(folder.id, data["user_id"], data["permission"])
        except ValueError as ex:
            return self.response(422, message=str(ex))
        FolderPermissionDAO.mark_permissions_explicit(folder.id)
        FolderPermissionDAO.push_down_permissions(folder.id)
        return self.response(201, message="OK")

    @expose("/<folder_uuid>/subjects/<int:user_id>", methods=("PUT",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @requires_json
    @transaction()
    def put_subject(self, folder_uuid: str, user_id: int) -> Response:
        """Update a subject's permission level.
        ---
        put:
          summary: Change editor/viewer permission
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          - in: path
            name: user_id
            required: true
            schema:
              type: integer
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/FolderSubjectPutSchema'
          responses:
            200:
              description: Permission updated
            400:
              $ref: '#/components/responses/400'
            404:
              $ref: '#/components/responses/404'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_edit(folder)
        except FolderForbiddenError:
            return self.response_403()
        try:
            data = FolderSubjectPutSchema().load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        FolderDAO.update_subject(folder.id, user_id, data["permission"])
        FolderPermissionDAO.mark_permissions_explicit(folder.id)
        FolderPermissionDAO.push_down_permissions(folder.id)
        return self.response(200, message="OK")

    @expose("/<folder_uuid>/subjects/<int:user_id>", methods=("DELETE",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @transaction()
    def delete_subject(self, folder_uuid: str, user_id: int) -> Response:
        """Remove a subject from a folder.
        ---
        delete:
          summary: Remove editor/viewer
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          - in: path
            name: user_id
            required: true
            schema:
              type: integer
          responses:
            200:
              description: Subject removed
            404:
              $ref: '#/components/responses/404'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_edit(folder)
        except FolderForbiddenError:
            return self.response_403()
        FolderDAO.remove_subject(folder.id, user_id)
        FolderPermissionDAO.mark_permissions_explicit(folder.id)
        FolderPermissionDAO.push_down_permissions(folder.id)
        return self.response(200, message="OK")

    @expose("/<folder_uuid>/available-users", methods=("GET",))
    @protect()
    @safe
    @permission_name("read")
    @statsd_metrics
    def available_users(self, folder_uuid: str) -> Response:
        """Search for users that can be added to a folder.

        Returns non-admin users not already assigned to the folder.
        Only folder editors can call this endpoint.
        ---
        get:
          summary: Search available users for a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          - in: query
            name: q
            schema:
              type: string
            description: Search by email
          - in: query
            name: page
            schema:
              type: integer
              default: 0
          - in: query
            name: page_size
            schema:
              type: integer
              default: 25
          responses:
            200:
              description: List of available users
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            self._raise_for_folder_edit(folder)
        except FolderForbiddenError:
            return self.response_403()

        page = _positive_int("page", 0)
        page_size = _positive_int("page_size", 25)

        assigned_ids = {s["user_id"] for s in FolderDAO.get_subjects(folder.id)}

        query = db.session.query(User).filter(User.active.is_(True))

        if admin_role := security_manager.find_role("Admin"):
            query = query.filter(~User.roles.any(Role.id == admin_role.id))

        if assigned_ids:
            query = query.filter(~User.id.in_(assigned_ids))

        if search := request.args.get("q", "").strip()[:255]:
            like = f"%{search}%"
            query = query.filter(User.email.ilike(like))

        total = query.count()
        users = (
            query.order_by(User.username)
            .offset(page * page_size)
            .limit(page_size)
            .all()
        )

        return self.response(
            200,
            result=[
                {
                    "id": u.id,
                    "email": u.email,
                }
                for u in users
            ],
            count=total,
        )
