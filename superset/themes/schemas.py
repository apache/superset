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
import logging
from typing import Any

from marshmallow import fields, Schema, validates, ValidationError

from superset.themes.utils import is_valid_theme
from superset.utils import json

logger = logging.getLogger(__name__)


class ImportV1ThemeSchema(Schema):
    theme_name = fields.String(required=True)
    json_data = fields.Raw(required=True)
    uuid = fields.UUID(required=True)
    version = fields.String(required=True)

    @validates("json_data")
    def validate_json_data(self, value: dict[str, Any]) -> None:
        # Convert dict to JSON string for validation
        if isinstance(value, dict):
            json_str = json.dumps(value)
        else:
            json_str = str(value)

        # Parse it back to validate it's valid JSON
        try:
            theme_config = json.loads(json_str) if isinstance(value, str) else value
        except (TypeError, json.JSONDecodeError) as ex:
            raise ValidationError("Invalid JSON configuration") from ex

        # Strict validation for all contexts - ensures consistent data quality
        if not is_valid_theme(theme_config):
            # Add detailed error info for debugging
            logger.error("Theme validation failed. Theme config: %s", theme_config)
            logger.error(
                "Theme type: %s, Algorithm: %s, Has token: %s",
                type(theme_config).__name__,
                theme_config.get("algorithm"),
                "token" in theme_config,
            )
            raise ValidationError("Invalid theme configuration structure")


class ThemeBaseSchema(Schema):
    theme_name = fields.String(required=True, allow_none=False)
    json_data = fields.String(required=True, allow_none=False)

    @validates("theme_name")
    def validate_theme_name(self, value: str) -> None:
        if not value or not value.strip():
            raise ValidationError("Theme name cannot be empty.")

    @validates("json_data")
    def validate_json_data(self, value: str) -> None:
        # Parse JSON string
        try:
            theme_config = json.loads(value)
        except (TypeError, json.JSONDecodeError) as ex:
            raise ValidationError("Invalid JSON configuration") from ex

        # Strict validation for theme creation/updates
        if not is_valid_theme(theme_config):
            raise ValidationError("Invalid theme configuration structure")


class ThemePostSchema(ThemeBaseSchema):
    pass


class ThemePutSchema(ThemeBaseSchema):
    pass


openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a theme"}},
    "get_list": {
        "get": {
            "summary": "Get a list of themes",
            "description": "Gets a list of themes, use Rison or JSON "
            "query parameters for filtering, sorting,"
            " pagination and for selecting specific"
            " columns and metadata.",
        }
    },
    "post": {"post": {"summary": "Create a theme"}},
    "put": {"put": {"summary": "Update a theme"}},
    "delete": {"delete": {"summary": "Delete a theme"}},
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}
