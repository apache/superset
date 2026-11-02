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
from typing import Any, cast

from marshmallow import fields, Schema
from marshmallow.validate import OneOf, Range

from superset.subjects.types import PrincipalReference, SubjectReference

openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a Subject"}},
    "get_list": {
        "get": {
            "summary": "Get a list of Subjects",
            "description": "Gets a list of Subjects, use Rison or JSON "
            "query parameters for filtering, sorting, "
            "pagination and for selecting specific "
            "columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}


class SubjectSchema(Schema):
    id = fields.Int()
    label = fields.String()
    secondary_label = fields.String()
    img = fields.String()
    extra_search = fields.String()
    type = fields.Integer()
    active = fields.Boolean()


class SubjectResponseSchema(Schema):
    """Compact schema for subject data in API responses."""

    id = fields.Int()
    label = fields.String()
    secondary_label = fields.String()
    img = fields.String()
    type = fields.Integer()


class PrincipalReferenceSchema(Schema):
    type = fields.String(
        required=True, validate=OneOf(["user", "role", "group", "subject"])
    )
    id = fields.Integer(required=True, strict=True, validate=Range(min=1))


class SubjectReferenceField(fields.Field):
    """Accept legacy Subject IDs or explicit principal references on writes.

    Deserialization validates shape only. Resolution belongs in the authorized,
    transactional command, not in schema loading or API documentation generation.
    """

    def __init__(self, **kwargs: Any) -> None:
        metadata = dict(kwargs.pop("metadata", {}) or {})
        metadata["oneOf"] = [
            {"type": "integer", "description": "Subject ID, not a user ID."},
            {
                "type": "object",
                "required": ["type", "id"],
                "additionalProperties": False,
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["user", "role", "group", "subject"],
                    },
                    "id": {"type": "integer", "minimum": 1},
                },
            },
        ]
        super().__init__(metadata=metadata, **kwargs)

    def _deserialize(
        self, value: Any, attr: str | None, data: Any, **kwargs: Any
    ) -> SubjectReference:
        if isinstance(value, dict):
            return cast(PrincipalReference, PrincipalReferenceSchema().load(value))
        # Preserve the existing integer field's coercion/validation behavior.
        return fields.Integer().deserialize(value)
