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
from typing import Any, Dict, Optional

from flask import current_app, request
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import ValidationError

from superset.config_extensions import SupersetConfig
from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.daos.settings import SettingsDAO
from superset.models.core import Settings
from superset.settings.schemas import (
    SettingCreateSchema,
    SettingListResponseSchema,
    SettingResponseSchema,
    SettingUpdateSchema,
)
from superset.views.base_api import BaseSupersetModelRestApi

logger = logging.getLogger(__name__)


class SettingsRestApi(BaseSupersetModelRestApi):
    """REST API for configuration settings management."""

    datamodel = SQLAInterface(Settings)
    resource_name = "settings"
    allow_browser_login = True

    # Only allow specific methods
    include_route_methods = {
        "get_list",
        "get",
        "post",
        "put",
        "delete",
        "info",
    }

    # Schemas for serialization/deserialization
    list_schema = SettingListResponseSchema()
    show_schema = SettingResponseSchema()
    add_schema = SettingCreateSchema()
    edit_schema = SettingUpdateSchema()

    # Permissions - only admins can read/write settings
    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP.copy()
    method_permission_name.update(
        {
            "get_list": "can_read",
            "get": "can_read",
            "post": "can_write",
            "put": "can_write",
            "delete": "can_write",
            "validate": "can_read",
            "metadata": "can_read",
            "effective_config": "can_read",
        }
    )

    # Only Admin role can access settings
    class_permission_name = "Settings"

    def _get_setting_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a configuration setting."""
        if isinstance(current_app.config, SupersetConfig):
            return current_app.config.get_setting_metadata(key)
        return None

    def _get_setting_source(self, key: str) -> str:
        """Determine where a setting value comes from."""
        import os

        # Check if it's from environment variables
        env_key = f"SUPERSET__{key}"
        if env_key in os.environ:
            return f"environment ({env_key})"

        # Check if it's from superset_config.py
        try:
            import superset_config

            if hasattr(superset_config, key):
                return "superset_config.py"
        except ImportError:
            pass

        # Check if it's in database
        if SettingsDAO.find_by_key(key):
            return "database"

        # Otherwise it's from defaults
        return "config_defaults.py"

    def _is_setting_allowed_in_database(self, key: str) -> bool:
        """Check if a setting is allowed to be stored in the database."""
        metadata = self._get_setting_metadata(key)
        if not metadata:
            return False

        # Only allow settings that don't require restart and aren't readonly
        return not metadata.get("requires_restart", True) and not metadata.get(
            "readonly", False
        )

    def _validate_setting_value(self, key: str, value: Any) -> tuple[bool, list[str]]:
        """Validate a setting value against its metadata."""
        metadata = self._get_setting_metadata(key)
        if not metadata:
            return True, []

        if isinstance(current_app.config, SupersetConfig):
            if current_app.config.validate_setting(key, value):
                return True, []
            else:
                return False, [
                    f"Value does not match expected type or constraints for {key}"
                ]

        return True, []

    @expose("/", methods=["GET"])
    @protect()
    @safe
    def get_list(self) -> str:
        """Get list of all database settings."""
        # Parse query parameters
        args = request.args
        namespace = args.get("namespace")
        category = args.get("category")
        include_metadata = args.get("include_metadata", "false").lower() == "true"
        include_source = args.get("include_source", "false").lower() == "true"

        # Get settings from database
        if namespace:
            settings = SettingsDAO.get_by_namespace(namespace)
        else:
            settings = SettingsDAO.get_all_as_dict()

        # Build response
        result = []
        for key, value in settings.items():
            setting_data = {
                "key": key,
                "value": value,
                "namespace": namespace,  # This would need to be fetched from the model
            }

            if include_metadata:
                setting_data["metadata"] = self._get_setting_metadata(key)

            if include_source:
                setting_data["source"] = self._get_setting_source(key)

            # Filter by category if specified
            if category:
                metadata = self._get_setting_metadata(key)
                if not metadata or metadata.get("category") != category:
                    continue

            result.append(setting_data)

        return self.response(200, result=result, count=len(result))

    @expose("/<pk>", methods=["GET"])
    @protect()
    @safe
    def get(self, pk: str) -> str:
        """Get a specific setting by key."""
        # Parse query parameters
        args = request.args
        include_metadata = args.get("include_metadata", "false").lower() == "true"
        include_source = args.get("include_source", "false").lower() == "true"

        # Get setting value
        value = SettingsDAO.get_value(pk)
        if value is None:
            return self.response_404()

        # Build response
        setting_data = {
            "key": pk,
            "value": value,
        }

        if include_metadata:
            setting_data["metadata"] = self._get_setting_metadata(pk)

        if include_source:
            setting_data["source"] = self._get_setting_source(pk)

        return self.response(200, **setting_data)

    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self) -> str:
        """Create a new setting."""
        try:
            item = self.add_schema.load(request.json)
        except ValidationError as error:
            return self.response_422(message=error.messages)

        key = item["key"]
        value = item["value"]
        namespace = item.get("namespace")

        # Check if setting is allowed in database
        if not self._is_setting_allowed_in_database(key):
            return self.response_422(
                message=f"Setting '{key}' cannot be stored in database. "
                f"It may require a restart or be read-only."
            )

        # Validate value
        is_valid, errors = self._validate_setting_value(key, value)
        if not is_valid:
            return self.response_422(message={"validation_errors": errors})

        # Check if setting already exists
        if SettingsDAO.find_by_key(key):
            return self.response_422(
                message=f"Setting '{key}' already exists. Use PUT to update."
            )

        # Create setting
        try:
            SettingsDAO.set_value(key, value, namespace)
            return self.response(201, key=key, value=value)
        except Exception as ex:
            logger.exception("Error creating setting")
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(self, pk: str) -> str:
        """Update an existing setting."""
        try:
            item = self.edit_schema.load(request.json)
        except ValidationError as error:
            return self.response_422(message=error.messages)

        value = item["value"]
        namespace = item.get("namespace")

        # Check if setting is allowed in database
        if not self._is_setting_allowed_in_database(pk):
            return self.response_422(
                message=f"Setting '{pk}' cannot be stored in database. "
                f"It may require a restart or be read-only."
            )

        # Validate value
        is_valid, errors = self._validate_setting_value(pk, value)
        if not is_valid:
            return self.response_422(message={"validation_errors": errors})

        # Update setting
        try:
            SettingsDAO.set_value(pk, value, namespace)
            return self.response(200, key=pk, value=value)
        except Exception as ex:
            logger.exception("Error updating setting")
            return self.response_422(message=str(ex))

    @expose("/<pk>", methods=["DELETE"])
    @protect()
    @safe
    def delete(self, pk: str) -> str:
        """Delete a setting."""
        # Check if setting exists
        if not SettingsDAO.find_by_key(pk):
            return self.response_404()

        # Delete setting
        try:
            SettingsDAO.delete_by_key(pk)
            return self.response(200, message=f"Setting '{pk}' deleted")
        except Exception as ex:
            logger.exception("Error deleting setting")
            return self.response_422(message=str(ex))

    @expose("/validate", methods=["POST"])
    @protect()
    @safe
    def validate(self) -> str:
        """Validate a setting value without saving it."""
        if not request.json:
            return self.response_400()

        key = request.json.get("key")
        value = request.json.get("value")

        if not key:
            return self.response_422(message="Key is required")

        # Get metadata
        metadata = self._get_setting_metadata(key)

        # Validate value
        is_valid, errors = self._validate_setting_value(key, value)

        # Check if allowed in database
        allowed_in_db = self._is_setting_allowed_in_database(key)

        response_data = {
            "key": key,
            "value": value,
            "valid": is_valid,
            "errors": errors,
            "metadata": metadata,
            "allowed_in_database": allowed_in_db,
        }

        return self.response(200, **response_data)

    @expose("/metadata", methods=["GET"])
    @protect()
    @safe
    def metadata(self) -> str:
        """Get metadata for all documented settings."""
        if not isinstance(current_app.config, SupersetConfig):
            return self.response(200, metadata={})

        metadata = current_app.config.DATABASE_SETTINGS_SCHEMA

        # Filter by category if specified
        if category := request.args.get("category"):
            metadata = current_app.config.get_settings_by_category(category)

        return self.response(200, metadata=metadata)

    @expose("/effective_config", methods=["GET"])
    @protect()
    @safe
    def effective_config(self) -> str:
        """Get effective configuration (database + env + defaults)."""
        # Get current config values
        config_dict = {}

        # Get documented settings
        if isinstance(current_app.config, SupersetConfig):
            for key in current_app.config.DATABASE_SETTINGS_SCHEMA:
                if key in current_app.config:
                    config_dict[key] = {
                        "value": current_app.config[key],
                        "source": self._get_setting_source(key),
                        "metadata": self._get_setting_metadata(key),
                    }

        # Add database settings
        db_settings = SettingsDAO.get_all_as_dict()
        for key, value in db_settings.items():
            if key not in config_dict:
                config_dict[key] = {
                    "value": value,
                    "source": "database",
                    "metadata": self._get_setting_metadata(key),
                }

        return self.response(200, config=config_dict)
