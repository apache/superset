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
"""Marshmallow schemas for the folders REST API."""

from __future__ import annotations

from marshmallow import fields, Schema, validate

from superset.folders.constants import ASSET_TYPES, DEFAULT_FOLDER_TYPE

folder_type_description = "Namespace the folder lives in (e.g. 'analytics')."
parent_uuid_description = (
    "UUID of the parent folder. Omit or set to null to place at the root."
)
asset_type_description = "Kind of asset: one of " + ", ".join(sorted(ASSET_TYPES)) + "."


class FolderAssetRefSchema(Schema):
    """Reference to a single asset to assign to a folder."""

    type = fields.String(
        required=True,
        validate=validate.OneOf(sorted(ASSET_TYPES)),
        metadata={"description": asset_type_description},
    )
    id = fields.Integer(
        required=True, metadata={"description": "Primary key of the asset."}
    )


class FolderPostSchema(Schema):
    """Payload to create a folder."""

    name = fields.String(required=True, validate=validate.Length(min=1, max=250))
    description = fields.String(allow_none=True, load_default=None)
    parent_uuid = fields.String(
        allow_none=True,
        load_default=None,
        metadata={"description": parent_uuid_description},
    )
    folder_type = fields.String(
        load_default=DEFAULT_FOLDER_TYPE,
        validate=validate.Length(min=1, max=50),
        metadata={"description": folder_type_description},
    )
    is_private = fields.Boolean(load_default=False)


class FolderPutSchema(Schema):
    """Payload to update a folder. All fields optional (partial update)."""

    name = fields.String(validate=validate.Length(min=1, max=250))
    description = fields.String(allow_none=True)
    parent_uuid = fields.String(
        allow_none=True, metadata={"description": parent_uuid_description}
    )
    is_private = fields.Boolean()
    sync_permissions = fields.Boolean(load_default=False)


class FolderAssetsPutSchema(Schema):
    """Payload setting a folder's full asset membership.

    ``assets`` is the complete desired set: listed assets are moved into the
    folder, and the folder's current assets not listed are moved back to the
    root. An empty list empties the folder.
    """

    assets = fields.List(fields.Nested(FolderAssetRefSchema), load_default=list)


class FolderUserSchema(Schema):
    id = fields.Integer()
    first_name = fields.String()
    last_name = fields.String()


class FolderSchema(Schema):
    """Folder metadata in responses."""

    id = fields.Integer()
    uuid = fields.String()
    name = fields.String()
    description = fields.String(allow_none=True)
    parent_uuid = fields.String(allow_none=True)
    folder_type = fields.String()
    is_private = fields.Boolean()
    children_count = fields.Integer()
    asset_count = fields.Integer()
    created_on = fields.DateTime()
    changed_on = fields.DateTime()
    created_by = fields.Nested(FolderUserSchema, allow_none=True)
    changed_by = fields.Nested(FolderUserSchema, allow_none=True)


class FolderAssetSchema(Schema):
    """An asset (dashboard/chart/dataset) in responses."""

    type = fields.String()
    id = fields.Integer()
    uuid = fields.String(allow_none=True)
    name = fields.String()
    url = fields.String(allow_none=True)
    changed_on = fields.DateTime(allow_none=True)
    changed_by = fields.Nested(FolderUserSchema, allow_none=True)
    owners = fields.List(fields.Nested(FolderUserSchema))
    # Chart-only columns; null for other asset kinds.
    viz_type = fields.String(allow_none=True)
    database = fields.String(allow_none=True)
    schema = fields.String(allow_none=True)


class FolderContentItemSchema(Schema):
    """A single contents row — a folder or an asset (superset of both shapes)."""

    type = fields.String()
    id = fields.Integer()
    uuid = fields.String(allow_none=True)
    name = fields.String()
    url = fields.String(allow_none=True)
    parent_uuid = fields.String(allow_none=True)
    folder_type = fields.String(allow_none=True)
    is_private = fields.Boolean(allow_none=True)
    children_count = fields.Integer(allow_none=True)
    asset_count = fields.Integer(allow_none=True)
    viz_type = fields.String(allow_none=True)
    database = fields.String(allow_none=True)
    schema = fields.String(allow_none=True)
    changed_on = fields.DateTime(allow_none=True)
    created_on = fields.DateTime(allow_none=True)
    changed_by = fields.Nested(FolderUserSchema, allow_none=True)
    created_by = fields.Nested(FolderUserSchema, allow_none=True)
    owners = fields.List(fields.Nested(FolderUserSchema))


class FolderListResponseSchema(Schema):
    count = fields.Integer()
    result = fields.List(fields.Nested(FolderSchema))


class FolderResponseSchema(Schema):
    result = fields.Nested(FolderSchema)


class FolderContentsResponseSchema(Schema):
    """A page of a folder's contents (subfolders + assets), filtered/paginated."""

    folder = fields.Nested(FolderSchema)
    result = fields.List(fields.Nested(FolderContentItemSchema))
    count = fields.Integer()
    page = fields.Integer()
    page_size = fields.Integer()


class FolderRootResponseSchema(Schema):
    """A page of the root view (top-level folders + unfoldered assets)."""

    result = fields.List(fields.Nested(FolderContentItemSchema))
    count = fields.Integer()
    page = fields.Integer()
    page_size = fields.Integer()


# --- Pin schemas ---

PIN_OBJECT_TYPES = {"folder", "chart", "dashboard"}


class FolderPinPostSchema(Schema):
    """Payload to pin an item."""

    object_id = fields.Integer(required=True)
    object_type = fields.String(
        required=True,
        validate=validate.OneOf(sorted(PIN_OBJECT_TYPES)),
    )
    position = fields.Integer(
        required=True,
        validate=validate.Range(min=1, max=3),
    )


class FolderPinSchema(Schema):
    """A pinned item in responses."""

    id = fields.Integer()
    object_id = fields.Integer()
    object_type = fields.String()
    position = fields.Integer()
    created_on = fields.DateTime(allow_none=True)


class FolderPinListResponseSchema(Schema):
    count = fields.Integer()
    result = fields.List(fields.Nested(FolderPinSchema))


# --- Subject schemas ---

SUBJECT_PERMISSIONS = {"editor", "viewer", "admin"}


class FolderSubjectPostSchema(Schema):
    """Payload to add a user to a folder."""

    user_id = fields.Integer(required=True)
    permission = fields.String(
        required=True,
        validate=validate.OneOf(sorted(SUBJECT_PERMISSIONS)),
    )


class FolderSubjectPutSchema(Schema):
    """Payload to update a subject's permission."""

    permission = fields.String(
        required=True,
        validate=validate.OneOf(sorted(SUBJECT_PERMISSIONS)),
    )


class FolderSubjectSchema(Schema):
    """A user (editor/viewer) in responses."""

    user_id = fields.Integer()
    permission = fields.String()
