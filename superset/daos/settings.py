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
from __future__ import annotations

from typing import Any, Dict, Optional

from superset.daos.base import BaseDAO
from superset.models.core import Settings
from superset.utils import json


class SettingsDAO(BaseDAO[Settings]):
    """
    Data Access Object for Settings model.

    Provides methods to manage configuration settings stored in the database.
    """

    id_column_name = "key"  # Settings uses 'key' as primary key, not 'id'

    @classmethod
    def find_by_key(cls, key: str) -> Optional[Settings]:
        """Find a setting by its key."""
        return cls.find_by_id(key)

    @classmethod
    def get_value(cls, key: str, default: Any = None) -> Any:
        """
        Get the parsed value for a setting key.

        Args:
            key: The setting key
            default: Default value if setting not found

        Returns:
            The parsed JSON value or default
        """
        if setting := cls.find_by_key(key):
            try:
                return json.loads(setting.json_data)
            except json.JSONDecodeError:
                return setting.json_data
        return default

    @classmethod
    def set_value(
        cls,
        key: str,
        value: Any,
        namespace: Optional[str] = None,
        is_sensitive: bool = False,
    ) -> Settings:
        """
        Set a setting value.

        Args:
            key: The setting key
            value: The value to set (will be JSON serialized)
            namespace: Optional namespace for organizing settings
            is_sensitive: Whether this setting contains sensitive data

        Returns:
            The Settings object
        """
        json_value = json.dumps(value)

        if setting := cls.find_by_key(key):
            # Update existing setting
            setting.json_data = json_value
            if namespace is not None:
                setting.namespace = namespace
            setting.is_sensitive = is_sensitive
            return cls.update(setting)
        else:
            # Create new setting
            return cls.create(
                attributes={
                    "key": key,
                    "json_data": json_value,
                    "namespace": namespace,
                    "is_sensitive": is_sensitive,
                }
            )

    @classmethod
    def get_all_as_dict(cls) -> Dict[str, Any]:
        """
        Get all settings as a dictionary with parsed values.

        Returns:
            Dictionary mapping setting keys to their parsed values
        """
        settings = cls.find_all()
        result = {}

        for setting in settings:
            try:
                result[setting.key] = json.loads(setting.json_data)
            except json.JSONDecodeError:
                result[setting.key] = setting.json_data

        return result

    @classmethod
    def get_by_namespace(cls, namespace: str) -> Dict[str, Any]:
        """
        Get all settings in a specific namespace.

        Args:
            namespace: The namespace to filter by

        Returns:
            Dictionary mapping setting keys to their parsed values
        """

        from superset.extensions import db

        settings = (
            db.session.query(Settings).filter(Settings.namespace == namespace).all()
        )
        result = {}

        for setting in settings:
            try:
                result[setting.key] = json.loads(setting.json_data)
            except json.JSONDecodeError:
                result[setting.key] = setting.json_data

        return result

    @classmethod
    def delete_by_key(cls, key: str) -> bool:
        """
        Delete a setting by key.

        Args:
            key: The setting key to delete

        Returns:
            True if setting was deleted, False if not found
        """
        if setting := cls.find_by_key(key):
            cls.delete([setting])
            return True
        return False
