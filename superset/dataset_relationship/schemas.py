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
"""Marshmallow schemas for Dataset Relationship REST API.

Provides request/response validation for create, update, and read
operations on :class:`DatasetRelationship` resources.
"""
from __future__ import annotations

from flask_babel import lazy_gettext as _
from marshmallow import fields, Schema, validates_schema, ValidationError
from marshmallow.validate import Length, OneOf, Range

from superset.models.dataset_relationships import (
    COLUMN_OPERATORS,
    JOIN_TYPES,
    RELATIONSHIP_TYPES,
)

# ---------------------------------------------------------------------------
# Rison schemas for query-string parameters
# ---------------------------------------------------------------------------
get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}

openapi_spec_methods_override = {
    "get_list": {
        "get": {
            "summary": "Get a list of dataset relationships",
            "description": (
                "Gets a list of dataset relationships. Use Rison or JSON "
                "query parameters for filtering, sorting, pagination and "
                "for selecting specific columns and metadata."
            ),
        }
    },
    "info": {
        "get": {
            "summary": "Get metadata information about the dataset relationship API",
        }
    },
}


# ---------------------------------------------------------------------------
# Nested column schema – shared between POST and PUT
# ---------------------------------------------------------------------------
class DatasetRelationshipColumnPostSchema(Schema):
    """Schema for a single column-pair mapping when creating a relationship."""

    source_column_name = fields.String(
        required=True,
        validate=Length(min=1, max=255),
        metadata={"description": "Column name in the source dataset"},
    )
    target_column_name = fields.String(
        required=True,
        validate=Length(min=1, max=255),
        metadata={"description": "Column name in the target dataset"},
    )
    operator = fields.String(
        load_default="=",
        validate=OneOf(COLUMN_OPERATORS),
        metadata={"description": "Comparison operator for the join condition"},
    )
    ordinal = fields.Integer(
        load_default=0,
        validate=Range(min=0),
        metadata={"description": "Position in multi-column join (0-based)"},
    )


class DatasetRelationshipColumnPutSchema(Schema):
    """Schema for a single column-pair mapping when updating a relationship."""

    id = fields.Integer(
        required=False,
        metadata={"description": "ID of an existing column mapping (optional)"},
    )
    source_column_name = fields.String(
        required=True,
        validate=Length(min=1, max=255),
        metadata={"description": "Column name in the source dataset"},
    )
    target_column_name = fields.String(
        required=True,
        validate=Length(min=1, max=255),
        metadata={"description": "Column name in the target dataset"},
    )
    operator = fields.String(
        load_default="=",
        validate=OneOf(COLUMN_OPERATORS),
        metadata={"description": "Comparison operator for the join condition"},
    )
    ordinal = fields.Integer(
        load_default=0,
        validate=Range(min=0),
        metadata={"description": "Position in multi-column join (0-based)"},
    )


class DatasetRelationshipColumnGetSchema(Schema):
    """Read-only schema for column-pair mappings returned by GET endpoints."""

    id = fields.Integer(metadata={"description": "Column mapping ID"})
    source_column_name = fields.String(
        metadata={"description": "Column name in the source dataset"},
    )
    target_column_name = fields.String(
        metadata={"description": "Column name in the target dataset"},
    )
    operator = fields.String(
        metadata={"description": "Comparison operator for the join condition"},
    )
    ordinal = fields.Integer(
        metadata={"description": "Position in multi-column join (0-based)"},
    )


# ---------------------------------------------------------------------------
# Main relationship schemas
# ---------------------------------------------------------------------------
class DatasetRelationshipPostSchema(Schema):
    """Validates the request body for ``POST /api/v1/dataset_relationship/``."""

    source_dataset_id = fields.Integer(
        required=True,
        metadata={"description": "ID of the source dataset"},
    )
    target_dataset_id = fields.Integer(
        required=True,
        metadata={"description": "ID of the target dataset"},
    )
    relationship_type = fields.String(
        required=True,
        validate=OneOf(RELATIONSHIP_TYPES),
        metadata={
            "description": "Cardinality of the relationship",
            "example": "many_to_one",
        },
    )
    join_type = fields.String(
        load_default="LEFT",
        validate=OneOf(JOIN_TYPES),
        metadata={
            "description": "SQL join type to use",
            "example": "LEFT",
        },
    )
    is_active = fields.Boolean(
        load_default=True,
        metadata={"description": "Whether the relationship is active"},
    )
    name = fields.String(
        allow_none=True,
        validate=Length(max=255),
        metadata={"description": "Human-readable name for the relationship"},
    )
    description = fields.String(
        allow_none=True,
        metadata={"description": "Free-text description"},
    )
    columns = fields.List(
        fields.Nested(DatasetRelationshipColumnPostSchema),
        required=True,
        validate=Length(min=1),
        metadata={
            "description": "Column pair mappings that form the join condition"
        },
    )

    @validates_schema
    def validate_not_self_reference(self, data: dict, **kwargs: object) -> None:  # type: ignore[override]
        if data.get("source_dataset_id") == data.get("target_dataset_id"):
            raise ValidationError(
                str(_("Source and target dataset cannot be the same")),
                field_name="target_dataset_id",
            )


class DatasetRelationshipPutSchema(Schema):
    """Validates the request body for ``PUT /api/v1/dataset_relationship/<pk>``."""

    source_dataset_id = fields.Integer(
        metadata={"description": "ID of the source dataset"},
    )
    target_dataset_id = fields.Integer(
        metadata={"description": "ID of the target dataset"},
    )
    relationship_type = fields.String(
        validate=OneOf(RELATIONSHIP_TYPES),
        metadata={
            "description": "Cardinality of the relationship",
            "example": "many_to_one",
        },
    )
    join_type = fields.String(
        validate=OneOf(JOIN_TYPES),
        metadata={
            "description": "SQL join type to use",
            "example": "LEFT",
        },
    )
    is_active = fields.Boolean(
        metadata={"description": "Whether the relationship is active"},
    )
    name = fields.String(
        allow_none=True,
        validate=Length(max=255),
        metadata={"description": "Human-readable name for the relationship"},
    )
    description = fields.String(
        allow_none=True,
        metadata={"description": "Free-text description"},
    )
    columns = fields.List(
        fields.Nested(DatasetRelationshipColumnPutSchema),
        validate=Length(min=1),
        metadata={
            "description": "Column pair mappings that form the join condition"
        },
    )


class DatasetRelationshipGetSchema(Schema):
    """Read-only schema returned by GET endpoints."""

    id = fields.Integer(metadata={"description": "Relationship ID"})
    uuid = fields.String(metadata={"description": "UUID of the relationship"})
    source_dataset_id = fields.Integer(
        metadata={"description": "ID of the source dataset"},
    )
    target_dataset_id = fields.Integer(
        metadata={"description": "ID of the target dataset"},
    )
    relationship_type = fields.String(
        metadata={"description": "Cardinality of the relationship"},
    )
    join_type = fields.String(
        metadata={"description": "SQL join type"},
    )
    is_cross_database = fields.Boolean(
        metadata={"description": "Whether datasets live in different databases"},
    )
    is_active = fields.Boolean(
        metadata={"description": "Whether the relationship is active"},
    )
    name = fields.String(
        allow_none=True,
        metadata={"description": "Human-readable name"},
    )
    description = fields.String(
        allow_none=True,
        metadata={"description": "Free-text description"},
    )
    columns = fields.List(
        fields.Nested(DatasetRelationshipColumnGetSchema),
        metadata={"description": "Column pair mappings"},
    )
    created_on = fields.DateTime(
        metadata={"description": "Creation timestamp"},
    )
    changed_on = fields.DateTime(
        metadata={"description": "Last modification timestamp"},
    )
    created_by_fk = fields.Integer(
        metadata={"description": "User ID who created this relationship"},
    )
    changed_by_fk = fields.Integer(
        metadata={"description": "User ID who last modified this relationship"},
    )
