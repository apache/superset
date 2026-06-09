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

from flask import request, Response
from flask_appbuilder.api import expose, permission_name, protect, safe
from marshmallow import ValidationError

from superset.commands.folder.assets import UpdateFolderAssetsCommand
from superset.commands.folder.create import CreateFolderCommand
from superset.commands.folder.delete import DeleteFolderCommand
from superset.commands.folder.exceptions import (
    FolderCreateFailedError,
    FolderDeleteFailedError,
    FolderInvalidError,
    FolderNotFoundError,
    FolderUpdateFailedError,
)
from superset.commands.folder.update import UpdateFolderCommand
from superset.daos.folder import FolderDAO, ResolvedAsset
from superset.extensions import db, event_logger
from superset.folders.constants import ASSET_TYPE_CONFIGS, DEFAULT_FOLDER_TYPE
from superset.folders.models import Folder
from superset.folders.schemas import (
    FolderAssetSchema,
    FolderAssetsPutSchema,
    FolderContentItemSchema,
    FolderContentsResponseSchema,
    FolderListResponseSchema,
    FolderPostSchema,
    FolderPutSchema,
    FolderResponseSchema,
    FolderRootResponseSchema,
    FolderSchema,
)
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


def serialize_folder(folder: Folder) -> dict[str, Any]:
    """Serialize a folder's metadata for API responses."""
    return {
        # Discriminates folder rows from asset rows in the unified contents list.
        "type": "folder",
        "id": folder.id,
        "uuid": str(folder.uuid),
        "name": folder.name,
        "description": folder.description,
        "parent_uuid": str(folder.parent.uuid) if folder.parent else None,
        "folder_type": folder.folder_type,
        "is_private": folder.is_private,
        "children_count": len(folder.children),
        "asset_count": len(folder.objects),
        "created_on": folder.created_on,
        "changed_on": folder.changed_on,
        "created_by": _serialize_user(folder.created_by),
        "changed_by": _serialize_user(folder.changed_by),
        # Folders have no owners; present for a uniform contents row shape.
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
    # Chart-only: resolve the backing dataset's database/schema for the columns.
    datasource = getattr(asset, "datasource", None)
    return {
        "type": asset_type,
        "id": asset.id,
        "uuid": str(asset.uuid) if getattr(asset, "uuid", None) else None,
        "name": getattr(asset, config.title_attr, None),
        "url": getattr(asset, "url", None),
        "changed_on": getattr(asset, "changed_on", None),
        "changed_by": _serialize_user(getattr(asset, "changed_by", None)),
        "owners": owners,
        # Chart-only columns; ``None`` for other asset kinds.
        "viz_type": getattr(asset, "viz_type", None),
        "database": getattr(datasource, "database_name", None) if datasource else None,
        "schema": getattr(datasource, "schema", None) if datasource else None,
    }


def serialize_assets(assets: list[ResolvedAsset]) -> list[dict[str, Any]]:
    """Serialize assets, most-recently-changed first."""
    serialized = [serialize_asset(asset_type, asset) for asset_type, asset in assets]
    serialized.sort(key=lambda item: item["changed_on"] or datetime.min, reverse=True)
    return serialized


def _parse_contents_filters() -> dict[str, Any]:
    """Parse the filtering/pagination query params for the contents endpoints.

    Tolerant of malformed input — unparseable filters are ignored rather than
    raising, and pagination falls back to sensible defaults.
    """
    args = request.args

    def csv(key: str) -> list[str] | None:
        raw = args.get(key)
        values = [v.strip() for v in raw.split(",") if v.strip()] if raw else []
        return values or None

    def csv_int(key: str) -> list[int] | None:
        values = csv(key)
        if not values:
            return None
        ints = [int(v) for v in values if v.lstrip("-").isdigit()]
        return ints or None

    def dt(key: str) -> datetime | None:
        raw = args.get(key)
        if not raw:
            return None
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None

    def positive_int(key: str, default: int) -> int:
        raw = args.get(key)
        if raw is not None and raw.isdigit():
            return int(raw)
        return default

    return {
        "search": args.get("search") or None,
        "types": csv("types"),
        "viz_types": csv("viz_types"),
        "datasets": csv_int("datasets"),
        "owners": csv_int("owners"),
        "modified_start": dt("modified_start"),
        "modified_end": dt("modified_end"),
        "page": positive_int("page", 0),
        "page_size": positive_int("page_size", 25),
    }


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
        result = [serialize_folder(folder) for folder in folders]
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
    def root_assets(self) -> Response:
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
        filters = _parse_contents_filters()
        rows, count = FolderDAO.get_contents(None, folder_type, **filters)
        return self.response(
            200,
            result=[serialize_row(kind, obj) for kind, obj in rows],
            count=count,
            page=filters["page"],
            page_size=filters["page_size"],
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
    def get_assets(self, folder_uuid: str) -> Response:
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
        filters = _parse_contents_filters()
        rows, count = FolderDAO.get_contents(folder, folder.folder_type, **filters)
        return self.response(
            200,
            folder=serialize_folder(folder),
            result=[serialize_row(kind, obj) for kind, obj in rows],
            count=count,
            page=filters["page"],
            page_size=filters["page_size"],
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
        try:
            data = self.edit_model_schema.load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            folder = UpdateFolderCommand(folder_uuid, data).run()
            return self.response(200, result=serialize_folder(folder))
        except FolderNotFoundError:
            return self.response_404()
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
        try:
            DeleteFolderCommand(folder_uuid).run()
            return self.response(200, message="OK")
        except FolderNotFoundError:
            return self.response_404()
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
        except FolderInvalidError as ex:
            return self.response(422, message=ex.normalized_messages())
        except FolderUpdateFailedError as ex:
            return self.response_422(message=str(ex))

    @expose(
        "/<string:folder_uuid>/assets/<string:asset_type>/<int:asset_id>",
        methods=("PUT",),
    )
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    def put_single_asset(
        self, folder_uuid: str, asset_type: str, asset_id: int
    ) -> Response:
        """Move a single asset into a folder (upsert).
        ---
        put:
          summary: Move one asset into a folder
          parameters:
          - in: path
            name: folder_uuid
            required: true
            schema:
              type: string
          - in: path
            name: asset_type
            required: true
            schema:
              type: string
              enum: [chart, dashboard, dataset]
          - in: path
            name: asset_id
            required: true
            schema:
              type: integer
          responses:
            200:
              description: Asset moved
            404:
              $ref: '#/components/responses/404'
        """
        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        if not FolderDAO.asset_exists(asset_type, asset_id):
            return self.response_404()
        FolderDAO.assign_assets(folder, [{"type": asset_type, "id": asset_id}])
        db.session.commit()
        return self.response(200, message="OK")

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
        from flask import g

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
        from flask import g

        from superset.folders.schemas import FolderPinPostSchema

        try:
            data = FolderPinPostSchema().load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            pin = FolderDAO.create_pin(
                user_id=g.user.id,
                object_id=data["object_id"],
                object_type=data["object_type"],
                position=data["position"],
            )
            db.session.commit()
            return self.response(
                201,
                result={
                    "id": pin.id,
                    "object_id": pin.object_id,
                    "object_type": pin.object_type,
                    "position": pin.position,
                },
            )
        except Exception as ex:
            db.session.rollback()
            return self.response(400, message=str(ex))

    @expose("/pins/<int:pin_id>", methods=("DELETE",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
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
        from flask import g

        if FolderDAO.delete_pin(pin_id, g.user.id):
            db.session.commit()
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
        subjects = FolderDAO.get_subjects(folder.id)
        return self.response(200, result=subjects)

    @expose("/<folder_uuid>/subjects", methods=("POST",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @requires_json
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
        from superset.folders.schemas import FolderSubjectPostSchema

        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            data = FolderSubjectPostSchema().load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        try:
            FolderDAO.add_subject(folder.id, data["user_id"], data["permission"])
            db.session.commit()
            return self.response(201, message="OK")
        except Exception as ex:
            db.session.rollback()
            return self.response(400, message=str(ex))

    @expose("/<folder_uuid>/subjects/<int:user_id>", methods=("PUT",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
    @requires_json
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
        from superset.folders.schemas import FolderSubjectPutSchema

        folder = FolderDAO.get_by_uuid(folder_uuid)
        if not folder:
            return self.response_404()
        try:
            data = FolderSubjectPutSchema().load(request.json)
        except ValidationError as ex:
            return self.response(400, message=ex.messages)
        FolderDAO.update_subject(folder.id, user_id, data["permission"])
        db.session.commit()
        return self.response(200, message="OK")

    @expose("/<folder_uuid>/subjects/<int:user_id>", methods=("DELETE",))
    @protect()
    @safe
    @permission_name("write")
    @statsd_metrics
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
        FolderDAO.remove_subject(folder.id, user_id)
        db.session.commit()
        return self.response(200, message="OK")
