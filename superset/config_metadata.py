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
"""Configuration metadata for Apache Superset.

This module contains the authoritative metadata for all configuration
settings in Superset. It serves as the single source of truth for:

1. Configuration documentation
2. Type information
3. Validation rules
4. Default values
5. Environment variable mappings

The metadata can reference actual Python objects (non-serializable)
and provides an export mechanism for documentation generation.
"""

from datetime import timedelta
from typing import Any, Callable, Dict, List, Optional, Type, Union

from superset.stats_logger import DummyStatsLogger
from superset.utils.log import DBEventLogger
from superset.utils.logging_configurator import DefaultLoggingConfigurator


class ConfigMetadata:
    """Metadata for a configuration setting."""

    def __init__(
        self,
        key: str,
        type: Type,
        default: Any,
        description: str,
        category: str = "general",
        impact: str = "medium",
        requires_restart: bool = False,
        min_value: Optional[Union[int, float]] = None,
        max_value: Optional[Union[int, float]] = None,
        choices: Optional[List[Any]] = None,
        example: Optional[str] = None,
        documentation_url: Optional[str] = None,
        deprecated: bool = False,
        deprecated_message: Optional[str] = None,
        validator: Optional[Callable[[Any], bool]] = None,
        converter: Optional[Callable[[Any], Any]] = None,
        serializable: bool = True,
        doc_default: Optional[Any] = None,
    ):
        """Initialize configuration metadata.

        Args:
            key: Configuration key name
            type: Python type of the configuration value
            default: Default value
            description: Human-readable description
            category: Category for grouping (performance, security, etc.)
            impact: Impact level (low, medium, high)
            requires_restart: Whether changing requires restart
            min_value: Minimum value for numeric types
            max_value: Maximum value for numeric types
            choices: List of valid choices
            example: Example usage
            documentation_url: Link to detailed docs
            deprecated: Whether this setting is deprecated
            deprecated_message: Message for deprecated settings
            validator: Custom validation function
            converter: Function to convert from env var or other format
            serializable: Whether the value can be JSON serialized
            doc_default: Alternative default for documentation (if not serializable)
        """
        self.key = key
        self.type = type
        self.default = default
        self.description = description
        self.category = category
        self.impact = impact
        self.requires_restart = requires_restart
        self.min_value = min_value
        self.max_value = max_value
        self.choices = choices
        self.example = example
        self.documentation_url = documentation_url
        self.deprecated = deprecated
        self.deprecated_message = deprecated_message
        self.validator = validator
        self.converter = converter
        self.serializable = serializable
        self.doc_default = doc_default

    def to_doc_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for documentation export."""
        return {
            "key": self.key,
            "type": self._type_to_string(),
            "default": self.doc_default
            if self.doc_default is not None
            else self._serialize_default(),
            "description": self.description,
            "category": self.category,
            "impact": self.impact,
            "requires_restart": self.requires_restart,
            "min_value": self.min_value,
            "max_value": self.max_value,
            "choices": self.choices,
            "example": self.example,
            "documentation_url": self.documentation_url,
            "deprecated": self.deprecated,
            "deprecated_message": self.deprecated_message,
            "env_var": f"SUPERSET__{self.key}",
        }

    def _type_to_string(self) -> str:
        """Convert Python type to string representation."""
        if hasattr(self.type, "__name__"):
            return self.type.__name__
        return str(self.type)

    def _serialize_default(self) -> Any:
        """Serialize default value for documentation."""
        if not self.serializable:
            return f"<{self._type_to_string()} instance>"
        if callable(self.default):
            return "<function>"
        if self.default is None:
            return None
        if isinstance(self.default, (str, int, float, bool, list, dict)):
            return self.default
        return str(self.default)


# Configuration metadata registry
CONFIG_METADATA: Dict[str, ConfigMetadata] = {
    # Performance settings
    "ROW_LIMIT": ConfigMetadata(
        key="ROW_LIMIT",
        type=int,
        default=50000,
        description="Maximum number of rows returned for any query or data request. "
        "This is a hard limit to prevent memory issues and ensure reasonable response times.",
        category="performance",
        impact="medium",
        requires_restart=False,
        min_value=1,
        max_value=1000000,
        example="export SUPERSET__ROW_LIMIT=100000",
    ),
    "SAMPLES_ROW_LIMIT": ConfigMetadata(
        key="SAMPLES_ROW_LIMIT",
        type=int,
        default=1000,
        description="Default row limit when requesting samples from datasource. "
        "Used in dataset exploration and SQL Lab table preview.",
        category="performance",
        impact="low",
        requires_restart=False,
        min_value=1,
        max_value=10000,
    ),
    "SQLLAB_TIMEOUT": ConfigMetadata(
        key="SQLLAB_TIMEOUT",
        type=int,
        default=30,
        description="Timeout duration for SQL Lab synchronous queries in seconds. "
        "Queries taking longer will be killed. For async queries, see SQLLAB_ASYNC_TIME_LIMIT_SEC.",
        category="performance",
        impact="high",
        requires_restart=False,
        min_value=1,
        max_value=3600,
        converter=lambda x: int(x) if isinstance(x, str) else x,
    ),
    "SQLLAB_ASYNC_TIME_LIMIT_SEC": ConfigMetadata(
        key="SQLLAB_ASYNC_TIME_LIMIT_SEC",
        type=int,
        default=int(timedelta(hours=6).total_seconds()),
        description="Maximum duration for SQL Lab async queries in seconds. "
        "This is enforced by Celery workers.",
        category="performance",
        impact="high",
        requires_restart=True,
        min_value=60,
        max_value=86400,  # 24 hours
        doc_default=21600,  # 6 hours
    ),
    # Security settings
    "SECRET_KEY": ConfigMetadata(
        key="SECRET_KEY",
        type=str,
        default="CHANGE_ME_SECRET_KEY",
        description="**CRITICAL**: Secret key for signing cookies and CSRF tokens. "
        "**Must be changed** from default in production. Generate with: "
        "`openssl rand -base64 42`",
        category="security",
        impact="high",
        requires_restart=True,
        example='export SUPERSET__SECRET_KEY="$(openssl rand -base64 42)"',
        documentation_url="https://superset.apache.org/docs/configuration/security",
    ),
    "WTF_CSRF_ENABLED": ConfigMetadata(
        key="WTF_CSRF_ENABLED",
        type=bool,
        default=True,
        description="Enable CSRF protection. Should always be True in production. "
        "Only disable for testing or if you have your own CSRF protection.",
        category="security",
        impact="high",
        requires_restart=True,
    ),
    # Feature flags
    "FEATURE_FLAGS": ConfigMetadata(
        key="FEATURE_FLAGS",
        type=dict,
        default={},
        description="Feature flags to enable/disable functionality. "
        "Can be set as JSON in environment or as nested values.",
        category="features",
        impact="high",
        requires_restart=True,
        example="export SUPERSET__FEATURE_FLAGS='{\"ENABLE_TEMPLATE_PROCESSING\": true}'",
    ),
    # UI/Theme settings
    "THEME_DEFAULT": ConfigMetadata(
        key="THEME_DEFAULT",
        type=dict,
        default={},
        description="Default theme configuration in Ant Design format. "
        "Customize colors, fonts, and other design tokens.",
        category="ui",
        impact="medium",
        requires_restart=False,
        example='export SUPERSET__THEME_DEFAULT__token__colorPrimary="#1890ff"',
        documentation_url="https://ant.design/docs/react/customize-theme",
    ),
    # Logging
    "STATS_LOGGER": ConfigMetadata(
        key="STATS_LOGGER",
        type=DummyStatsLogger,
        default=DummyStatsLogger(),
        description="Statistics logger instance for metrics collection. "
        "Use StatsdStatsLogger for production metrics.",
        category="logging",
        impact="low",
        requires_restart=True,
        serializable=False,
        doc_default="<DummyStatsLogger instance>",
    ),
    "EVENT_LOGGER": ConfigMetadata(
        key="EVENT_LOGGER",
        type=DBEventLogger,
        default=DBEventLogger(),
        description="Event logger for audit trails and user activity tracking. "
        "DBEventLogger stores in database, StdOutEventLogger for debugging.",
        category="logging",
        impact="medium",
        requires_restart=True,
        serializable=False,
        doc_default="<DBEventLogger instance>",
    ),
    "LOGGING_CONFIGURATOR": ConfigMetadata(
        key="LOGGING_CONFIGURATOR",
        type=DefaultLoggingConfigurator,
        default=DefaultLoggingConfigurator(),
        description="Logging configuration handler. Customize to integrate with "
        "your logging infrastructure.",
        category="logging",
        impact="medium",
        requires_restart=True,
        serializable=False,
        doc_default="<DefaultLoggingConfigurator instance>",
    ),
    # Add more configuration metadata as needed...
}


def export_for_documentation() -> Dict[str, Any]:
    """Export metadata in JSON-serializable format for documentation.

    Returns:
        Dictionary with all settings metadata suitable for JSON export
    """
    all_settings = []
    by_category = {}

    for key, metadata in CONFIG_METADATA.items():
        doc_dict = metadata.to_doc_dict()
        all_settings.append(doc_dict)

        category = metadata.category
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(doc_dict)

    # Sort settings within each category
    for category in by_category:
        by_category[category].sort(key=lambda x: x["key"])

    all_settings.sort(key=lambda x: x["key"])

    return {
        "all_settings": all_settings,
        "by_category": by_category,
        "categories": sorted(by_category.keys()),
        "metadata": {
            "total_configs": len(all_settings),
            "description": "Superset configuration metadata",
            "generated_from": "config_metadata.py",
        },
    }


def get_metadata(key: str) -> Optional[ConfigMetadata]:
    """Get metadata for a specific configuration key.

    Args:
        key: Configuration key name

    Returns:
        ConfigMetadata instance or None if not found
    """
    return CONFIG_METADATA.get(key)


def validate_config_value(key: str, value: Any) -> bool:
    """Validate a configuration value against its metadata.

    Args:
        key: Configuration key name
        value: Value to validate

    Returns:
        True if valid, False otherwise
    """
    metadata = get_metadata(key)
    if not metadata:
        return True  # No metadata means any value is valid

    # Type check
    if not isinstance(value, metadata.type):
        return False

    # Range check for numeric types
    if isinstance(value, (int, float)):
        if metadata.min_value is not None and value < metadata.min_value:
            return False
        if metadata.max_value is not None and value > metadata.max_value:
            return False

    # Choice validation
    if metadata.choices is not None and value not in metadata.choices:
        return False

    # Custom validator
    if metadata.validator is not None:
        return metadata.validator(value)

    return True
