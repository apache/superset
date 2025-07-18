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
from marshmallow import fields, Schema, validate


class SettingCreateSchema(Schema):
    """Schema for creating a new setting."""

    key = fields.String(required=True, validate=validate.Length(min=1, max=255))
    value = fields.Raw(required=True)
    namespace = fields.String(allow_none=True, validate=validate.Length(max=100))


class SettingUpdateSchema(Schema):
    """Schema for updating an existing setting."""

    value = fields.Raw(required=True)
    namespace = fields.String(allow_none=True, validate=validate.Length(max=100))


class SettingResponseSchema(Schema):
    """Schema for setting response."""

    key = fields.String()
    value = fields.Raw()
    namespace = fields.String(allow_none=True)
    created_on = fields.DateTime()
    changed_on = fields.DateTime()
    created_by = fields.Nested("UserSchema", only=["id", "first_name", "last_name"])
    changed_by = fields.Nested("UserSchema", only=["id", "first_name", "last_name"])
    metadata = fields.Dict(allow_none=True)  # Configuration metadata if available
    source = fields.String(
        allow_none=True
    )  # Source of the setting (database, env, defaults)


class SettingListResponseSchema(Schema):
    """Schema for listing settings."""

    result = fields.List(fields.Nested(SettingResponseSchema))
    count = fields.Integer()


class SettingMetadataSchema(Schema):
    """Schema for configuration metadata."""

    title = fields.String()
    description = fields.String()
    type = fields.String()
    category = fields.String()
    impact = fields.String()
    requires_restart = fields.Boolean()
    default = fields.Raw()
    minimum = fields.Integer(allow_none=True)
    maximum = fields.Integer(allow_none=True)
    readonly = fields.Boolean()
    documentation_url = fields.String(allow_none=True)


class SettingValidationSchema(Schema):
    """Schema for setting validation."""

    key = fields.String(required=True)
    value = fields.Raw(required=True)
    valid = fields.Boolean()
    errors = fields.List(fields.String())
    metadata = fields.Nested(SettingMetadataSchema, allow_none=True)


# Query schemas for API endpoints
setting_get_schema = {
    "type": "object",
    "properties": {
        "include_metadata": {"type": "boolean"},
        "include_source": {"type": "boolean"},
    },
}

setting_list_schema = {
    "type": "object",
    "properties": {
        "namespace": {"type": "string"},
        "category": {"type": "string"},
        "include_metadata": {"type": "boolean"},
        "include_source": {"type": "boolean"},
    },
}

setting_validate_schema = {
    "type": "object",
    "properties": {
        "key": {"type": "string"},
        "value": {},  # Any type
    },
    "required": ["key", "value"],
}
