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

from superset.themes.types import ThemeMode


def _is_valid_theme_mode(mode: str) -> bool:
    """Validate if a string represents a valid theme mode.

    Args:
    mode: String to validate against ThemeMode enum

    Returns:
    bool: True if mode is a valid ThemeMode value, False otherwise
    """
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
    """Validate theme dictionary structure and types.

    A valid theme can be empty or must contain properly typed fields:

    token (dict)
    components (dict)
    hashed (bool)
    inherit (bool)
    algorithm (str or list of str matching ThemeMode)
    Returns:
    bool: True if theme structure is valid, False otherwise
    """
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
