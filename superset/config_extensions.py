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

    # Rich metadata for configuration values
    # This replaces scattered comments with structured documentation
    DATABASE_SETTINGS_SCHEMA = {
        "ROW_LIMIT": {
            "type": "integer",
            "minimum": 1,
            "maximum": 1000000,
            "default": 50000,
            "title": "Row Limit",
            "description": "Maximum number of rows returned from queries",
            "category": "performance",
            "impact": "medium",
            "requires_restart": False,
            "documentation_url": "https://superset.apache.org/docs/configuration/databases",
        },
        "SAMPLES_ROW_LIMIT": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10000,
            "default": 1000,
            "title": "Samples Row Limit",
            "description": "Default row limit when requesting samples from datasource",
            "category": "performance",
            "impact": "low",
            "requires_restart": False,
        },
        "NATIVE_FILTER_DEFAULT_ROW_LIMIT": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10000,
            "default": 1000,
            "title": "Native Filter Default Row Limit",
            "description": "Default row limit for native filters",
            "category": "performance",
            "impact": "low",
            "requires_restart": False,
        },
        "SQLLAB_TIMEOUT": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3600,
            "default": 30,
            "title": "SQL Lab Timeout",
            "description": "Timeout duration for SQL Lab synchronous queries (seconds)",
            "category": "performance",
            "impact": "high",
            "requires_restart": False,
        },
        "FEATURE_FLAGS": {
            "type": "object",
            "default": {},
            "title": "Feature Flags",
            "description": "Feature flags to enable/disable functionality",
            "category": "features",
            "impact": "high",
            "requires_restart": True,
        },
        "DEFAULT_FEATURE_FLAGS": {
            "type": "object",
            "default": {},
            "title": "Default Feature Flags",
            "description": "Default feature flags (read-only)",
            "category": "features",
            "impact": "high",
            "requires_restart": True,
            "readonly": True,
        },
        "THEME_DEFAULT": {
            "type": "object",
            "default": {},
            "title": "Default Theme",
            "description": "Default theme configuration (Ant Design format)",
            "category": "ui",
            "impact": "medium",
            "requires_restart": False,
        },
        "THEME_DARK": {
            "type": "object",
            "default": {},
            "title": "Dark Theme",
            "description": "Dark theme configuration (Ant Design format)",
            "category": "ui",
            "impact": "medium",
            "requires_restart": False,
        },
        "THEME_SETTINGS": {
            "type": "object",
            "default": {},
            "title": "Theme Settings",
            "description": "Theme behavior and user preference settings",
            "category": "ui",
            "impact": "medium",
            "requires_restart": False,
        },
    }

    def __init__(
        self, root_path: Optional[str] = None, defaults: Optional[Dict[str, Any]] = None
    ):
        """Initialize SupersetConfig with enhanced features."""
        super().__init__(root_path, defaults)

    def get_setting_metadata(self, key: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a configuration setting."""
        return self.DATABASE_SETTINGS_SCHEMA.get(key)

    def get_settings_by_category(self, category: str) -> Dict[str, Any]:
        """Get all settings for a specific category."""
        return {
            key: schema
            for key, schema in self.DATABASE_SETTINGS_SCHEMA.items()
            if schema.get("category") == category
        }

    def validate_setting(self, key: str, value: Any) -> bool:
        """Validate a setting value against its schema."""
        schema = self.get_setting_metadata(key)
        if not schema:
            return True  # No schema means any value is valid

        # Basic type validation
        expected_type = schema.get("type")
        if expected_type == "integer" and not isinstance(value, int):
            return False
        elif expected_type == "string" and not isinstance(value, str):
            return False
        elif expected_type == "boolean" and not isinstance(value, bool):
            return False
        elif expected_type == "object" and not isinstance(value, dict):
            return False

        # Range validation for integers
        if expected_type == "integer":
            minimum = schema.get("minimum")
            maximum = schema.get("maximum")
            if minimum is not None and value < minimum:
                return False
            if maximum is not None and value > maximum:
                return False

        return True

    def to_json_schema(self) -> Dict[str, Any]:
        """Generate JSON schema for all database settings.

        This can be used to generate forms in the frontend.
        """
        properties = {}
        required = []

        for key, schema in self.DATABASE_SETTINGS_SCHEMA.items():
            if schema.get("readonly"):
                continue

            property_schema = {
                "type": schema["type"],
                "title": schema.get("title", key),
                "description": schema.get("description", ""),
                "default": schema.get("default"),
            }

            if schema["type"] == "integer":
                if "minimum" in schema:
                    property_schema["minimum"] = schema["minimum"]
                if "maximum" in schema:
                    property_schema["maximum"] = schema["maximum"]

            properties[key] = property_schema

            if schema.get("required", False):
                required.append(key)

        return {
            "type": "object",
            "properties": properties,
            "required": required,
        }

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
