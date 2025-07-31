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
"""Enhanced configuration system for Superset

This module provides the SupersetConfig class and supporting infrastructure
for the new configuration system.
"""

import logging
from typing import Any, Dict, Optional

from flask import Config

logger = logging.getLogger(__name__)


class SupersetConfig(Config):
    """Enhanced configuration class for Superset.

    This class extends Flask's Config class to provide additional features:
    - Rich metadata system for configuration values
    - Database-backed settings support
    - Environment variable integration
    - JSON schema generation for UI forms
    """

    # Metadata is now stored in config_metadata.py
    # This provides a reference to the metadata module

    def __init__(
        self, root_path: Optional[str] = None, defaults: Optional[Dict[str, Any]] = None
    ):
        """Initialize SupersetConfig with enhanced features."""
        super().__init__(root_path, defaults)

    def get_setting_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a configuration setting."""
        try:
            from superset.config_metadata import get_metadata

            metadata = get_metadata(key)
            if metadata:
                return metadata.to_doc_dict()
            return None
        except ImportError:
            return None

    def get_settings_by_category(self, category: str) -> Dict[str, Any]:
        """Get all settings for a specific category."""
        try:
            from superset.config_metadata import CONFIG_METADATA

            return {
                key: metadata.to_doc_dict()
                for key, metadata in CONFIG_METADATA.items()
                if metadata.category == category
            }
        except ImportError:
            return {}

    def validate_setting(self, key: str, value: Any) -> bool:
        """Validate a setting value against its schema."""
        try:
            from superset.config_metadata import validate_config_value

            return validate_config_value(key, value)
        except ImportError:
            return True  # No validation if metadata not available

    def to_json_schema(self) -> Dict[str, Any]:
        """Generate JSON schema for all database settings.

        This can be used to generate forms in the frontend.
        """
        try:
            from superset.config_metadata import CONFIG_METADATA

            properties = {}
            required = []

            for key, metadata in CONFIG_METADATA.items():
                if metadata.deprecated:
                    continue

                property_schema = {
                    "type": metadata._type_to_string().lower(),
                    "title": key.replace("_", " ").title(),
                    "description": metadata.description,
                    "default": metadata.doc_default
                    if metadata.doc_default is not None
                    else metadata._serialize_default(),
                }

                if isinstance(metadata.type, type) and issubclass(
                    metadata.type, (int, float)
                ):
                    if metadata.min_value is not None:
                        property_schema["minimum"] = metadata.min_value
                    if metadata.max_value is not None:
                        property_schema["maximum"] = metadata.max_value

                if metadata.choices is not None:
                    property_schema["enum"] = metadata.choices

                properties[key] = property_schema

            return {
                "type": "object",
                "properties": properties,
                "required": required,
            }
        except ImportError:
            return {"type": "object", "properties": {}, "required": []}

    def get_database_setting(self, key: str, default: Any = None) -> Any:
        """Get a setting value from the database (future implementation)."""
        # This would integrate with the SettingsDAO
        # For now, return the regular config value
        return self.get(key, default)

    def set_database_setting(self, key: str, value: Any) -> bool:
        """Set a setting value in the database (future implementation)."""
        # This would integrate with the SettingsDAO
        # For now, just validate the value
        if not self.validate_setting(key, value):
            return False

        # Would save to database here
        # settings_dao.set_value(key, value)
        return True

    def from_database(self) -> None:
        """Load settings from database (future implementation)."""
        # This would load database-backed settings
        # For now, this is a placeholder
        pass

    def load_from_environment(self, prefix: str = "SUPERSET_") -> bool:
        """Load configuration from environment variables.

        Uses Flask's built-in from_prefixed_env method to load environment
        variables with the SUPERSET__ prefix (note the double underscore).
        This provides automatic JSON parsing and nested dictionary support.

        The double underscore clearly separates the system prefix from the
        configuration key name.

        Examples:
            SUPERSET__ROW_LIMIT=100000
            SUPERSET__SQLLAB_TIMEOUT=60
            SUPERSET__FEATURE_FLAGS='{"ENABLE_TEMPLATE_PROCESSING": true}'
            SUPERSET__FEATURE_FLAGS__ENABLE_TEMPLATE_PROCESSING=true

        Args:
            prefix: The environment variable prefix (default: "SUPERSET_")

        Returns:
            bool: True if any values were loaded
        """
        # Use Flask's built-in method which handles JSON parsing automatically
        # Note: Flask will add one more underscore, so SUPERSET_ becomes SUPERSET__
        return self.from_prefixed_env(prefix)

    def export_settings(self) -> Dict[str, Any]:
        """Export current settings with metadata."""
        result = {}
        for key, schema in self.DATABASE_SETTINGS_SCHEMA.items():
            if key in self:
                result[key] = {"value": self[key], "metadata": schema}
        return result
