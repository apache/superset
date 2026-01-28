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
"""Base SQL types for Superset models."""

from __future__ import annotations

# pylint: disable=abstract-method
import ast
from typing import Any

from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import JSON, TypeDecorator

from superset.utils import json


def _try_parse_currency(value: str) -> Any | None:
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        pass

    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError):
        return None


def parse_currency_string(value: str) -> dict[str, Any]:
    if not value:
        return {}

    current: Any = value
    for _ in range(2):
        if isinstance(current, dict):
            return current
        if not isinstance(current, str):
            return {}

        parsed = _try_parse_currency(current)
        if parsed is None:
            return {}
        if isinstance(parsed, str):
            current = parsed
            continue
        if isinstance(parsed, dict):
            return parsed
        return {}

    return {}


class CurrencyType(TypeDecorator):
    """
    Custom SQLAlchemy type for metric currency that ensures string values
    are parsed to dicts when read from the database.

    This handles legacy data that was stored as stringified JSON before
    the currency column was migrated from VARCHAR to JSON type. Some data
    may have been double-encoded or stored with Python dict formatting.

    Example problematic values this handles:
    - '{"symbol": "USD", "symbolPosition": "prefix"}'  (JSON string)
    - "{'symbol': 'EUR', 'symbolPosition': 'suffix'}"  (Python dict string)
    """

    impl = JSON
    cache_ok = True

    def process_result_value(
        self, value: Any, dialect: Dialect
    ) -> dict[str, Any] | None:
        """
        Process value when reading from database.

        Ensures the returned value is always a dict (or None), even if
        the stored value is a string representation of a dict.

        Args:
            value: The value from the database (could be None, dict, or string)
            dialect: The SQLAlchemy dialect being used

        Returns:
            A dict representing the currency configuration, or None
        """
        if value is None:
            return None

        if isinstance(value, str):
            return parse_currency_string(value)

        return value
