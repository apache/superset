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
from typing import Any, Dict

from superset.themes.types import ThemeMode, ThemeSettingsKey


def _is_valid_theme_mode(mode: str) -> bool:
    """Check if a string is a valid theme mode"""
    try:
        ThemeMode(mode)
        return True
    except ValueError:
        return False


def _is_valid_algorithm(algorithm: Any) -> bool:
    """Helper function to validate theme algorithm"""
    if isinstance(algorithm, str):
        return _is_valid_theme_mode(algorithm) or algorithm == ThemeMode.SYSTEM
    elif isinstance(algorithm, list):
        return all(
            isinstance(alg, str) and _is_valid_theme_mode(alg) for alg in algorithm
        )
    else:
        return False


def is_valid_theme(theme: Dict[str, Any]) -> bool:
    """Check if a theme is valid"""
    try:
        if not isinstance(theme, dict):
            return False

        # Empty dict is valid
        if not theme:
            return True

        # Validate each field type
        validations = [
            ("token", dict),
            ("components", dict),
            ("hashed", bool),
            ("inherit", bool),
        ]

        for field, expected_type in validations:
            if field in theme and not isinstance(theme[field], expected_type):
                return False

        # Validate algorithm field separately due to its complexity
        if "algorithm" in theme and not _is_valid_algorithm(theme["algorithm"]):
            return False

        return True
    except Exception:
        return False


def is_valid_theme_settings(settings: Dict[str, Any]) -> bool:
    """Check if theme settings are valid"""
    try:
        if not isinstance(settings, dict):
            return False

        # Empty dict is valid
        if not settings:
            return True

        # Check if all keys are valid
        valid_keys = {setting.value for setting in ThemeSettingsKey}
        for key in settings.keys():
            if key not in valid_keys:
                return False

        # Type check values - all must be booleans
        for _key, value in settings.items():
            if not isinstance(value, bool):
                return False

        return True
    except Exception:
        return False
