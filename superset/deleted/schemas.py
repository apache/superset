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
"""Marshmallow schemas (and a rison JSON-schema) for the aggregated
deleted items endpoint (``GET /api/v1/deleted/``).

"Deleted" in the URL and the public class names refers to
**soft-deleted** rows — entities where
``SoftDeleteMixin.deleted_at IS NOT NULL``. The shorter path keeps the
public API surface concise while the internal ``SoftDeleteMixin`` /
``SKIP_VISIBILITY_FILTER`` / ``skip_visibility_filter`` plumbing
retains its explicit ``soft_*`` naming to stay unambiguous inside the
codebase.
"""

from __future__ import annotations

from marshmallow import fields, Schema

DELETED_TYPES = ("chart", "dashboard", "dataset")
SORT_COLUMNS = ("deleted_at", "deleted_by", "type", "name")
SORT_DIRECTIONS = ("asc", "desc")


# Rison-decoded query schema for ``GET /api/v1/deleted/?q=(...)``.
# FAB's ``@rison(schema)`` decorator validates the decoded rison object
# against this JSON-schema before the endpoint body runs; malformed
# payloads yield an automatic 400.
get_deleted_schema = {
    "type": "object",
    "properties": {
        "types": {
            "type": "array",
            "items": {"type": "string", "enum": list(DELETED_TYPES)},
        },
        "search": {"type": "string"},
        "deleted_from": {"type": "string", "format": "date-time"},
        "deleted_to": {"type": "string", "format": "date-time"},
        "order_column": {"type": "string", "enum": list(SORT_COLUMNS)},
        "order_direction": {"type": "string", "enum": list(SORT_DIRECTIONS)},
        "page": {"type": "integer", "minimum": 0},
        "page_size": {"type": "integer", "minimum": 1, "maximum": 100},
    },
    "additionalProperties": False,
}


class DeletedByUserSchema(Schema):
    """User who performed the soft-delete.

    Sourced by joining ``AuditMixinNullable.changed_by_fk`` to
    ``ab_user`` (see FR-014 and the Attribution Design Constraint in
    the spec). Always nullable at the row level because rows deleted
    outside a request context (CLI, Celery) may have no user stamped.
    """

    id = fields.Integer(metadata={"description": "Internal user id"})
    username = fields.String(metadata={"description": "Unique username"})
    first_name = fields.String(metadata={"description": "User first name"})
    last_name = fields.String(metadata={"description": "User last name"})


class DeletedListItemSchema(Schema):
    """One row in the aggregated deleted-items response."""

    type = fields.String(
        required=True,
        metadata={"description": "One of 'chart', 'dashboard', 'dataset'"},
    )
    id = fields.Integer(
        required=True,
        metadata={"description": "Entity primary key"},
    )
    uuid = fields.String(
        required=True,
        metadata={"description": "Entity UUID; use in subsequent restore calls"},
    )
    name = fields.String(
        required=True,
        metadata={
            "description": (
                "Normalised display name — slice_name / dashboard_title / "
                "table_name depending on type"
            )
        },
    )
    deleted_at = fields.DateTime(
        required=True,
        metadata={"description": "ISO-8601 timestamp when the row was soft-deleted"},
    )
    deleted_by = fields.Nested(
        DeletedByUserSchema,
        allow_none=True,
        metadata={
            "description": (
                "User who performed the soft-delete (from changed_by_fk). "
                "May be null for rows deleted outside a request context."
            )
        },
    )


class DeletedListResponseSchema(Schema):
    """Envelope for the aggregated deleted-items response."""

    result = fields.List(
        fields.Nested(DeletedListItemSchema),
        required=True,
    )
    count = fields.Integer(
        required=True,
        metadata={
            "description": (
                "Total matching rows across all pages after filters and "
                "row-level access have been applied; independent of "
                "`page` / `page_size`."
            )
        },
    )
