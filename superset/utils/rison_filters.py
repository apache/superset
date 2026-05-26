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
"""
Parser for Rison URL filters that converts simplified filter syntax
to Superset's adhoc_filters format.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Optional, Union

import prison
from flask import has_request_context, request

logger = logging.getLogger(__name__)

# SQL identifiers permitted in URL-supplied filter columns. Restricted to
# alphanumeric/underscore (optionally schema-qualified) so OR-path SQL
# generation never interpolates an attacker-controlled identifier verbatim.
_SAFE_IDENTIFIER_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$")


def _safe_identifier(name: Any) -> Optional[str]:
    if isinstance(name, str) and _SAFE_IDENTIFIER_RE.match(name):
        return name
    return None


def _quote_sql_literal(value: Any) -> Optional[str]:
    """Quote a scalar value safely for SQL string interpolation.

    - Strings: single-quoted with `'` escaped as `''` (SQL standard).
    - Numeric / bool: rendered bare.
    - Anything else (None, dict, list, etc.): rejected.
    """
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return "'" + value.replace("'", "''") + "'"
    return None


class RisonFilterParser:
    """
    Parse Rison filter syntax from URL parameter 'f' and convert to adhoc_filters.

    Supports:
    - Simple equality: f=(country:USA)
    - Lists (IN): f=(country:!(USA,Canada))
    - NOT operator: f=(NOT:(country:USA))
    - OR operator: f=(OR:!(condition1,condition2))
    - Comparison operators: f=(sales:(gt:100000))
    - BETWEEN: f=(date:(between:!(2024-01-01,2024-12-31)))
    - LIKE: f=(name:(like:'%smith%'))
    """

    OPERATORS: dict[str, str] = {
        "gt": ">",
        "gte": ">=",
        "lt": "<",
        "lte": "<=",
        "between": "BETWEEN",
        "like": "LIKE",
        "ilike": "ILIKE",
        "ne": "!=",
        "eq": "==",
    }

    def parse(self, filter_string: Optional[str] = None) -> list[dict[str, Any]]:
        """
        Parse Rison filter string and convert to adhoc_filters format.

        Args:
            filter_string: Rison-encoded filter string, or None to get from request

        Returns:
            List of adhoc_filter dictionaries
        """
        if filter_string is None:
            # Callers outside a Flask request context (CLI, async tasks, tests)
            # would otherwise hit a RuntimeError on `request.args` access.
            if not has_request_context():
                return []
            filter_string = request.args.get("f")

        if not filter_string:
            return []

        try:
            filters_obj = prison.loads(filter_string)
            return self._convert_to_adhoc_filters(filters_obj)
        except Exception:
            logger.warning(
                "Failed to parse Rison filters: %s", filter_string, exc_info=True
            )
            return []

    def _convert_to_adhoc_filters(
        self, filters_obj: Union[dict[str, Any], list[Any], Any]
    ) -> list[dict[str, Any]]:
        if not isinstance(filters_obj, dict):
            return []

        adhoc_filters: list[dict[str, Any]] = []

        for key, value in filters_obj.items():
            if key == "OR":
                adhoc_filters.extend(self._handle_or_operator(value))
            elif key == "NOT":
                adhoc_filters.extend(self._handle_not_operator(value))
            else:
                filter_dict = self._create_filter(key, value)
                if filter_dict:
                    adhoc_filters.append(filter_dict)

        return adhoc_filters

    def _create_filter(
        self, column: str, value: Any, negate: bool = False
    ) -> Optional[dict[str, Any]]:
        filter_dict: dict[str, Any] = {
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": column,
        }

        if isinstance(value, list):
            filter_dict["operator"] = "NOT IN" if negate else "IN"
            filter_dict["comparator"] = value
        elif isinstance(value, dict):
            operator_info = self._parse_operator_dict(value)
            if operator_info:
                operator, comparator = operator_info
                if negate and operator == "==":
                    operator = "!="
                elif negate and operator == "IN":
                    operator = "NOT IN"
                filter_dict["operator"] = operator
                filter_dict["comparator"] = comparator
            else:
                return None
        else:
            filter_dict["operator"] = "!=" if negate else "=="
            filter_dict["comparator"] = value

        return filter_dict

    def _parse_operator_dict(
        self, op_dict: dict[str, Any]
    ) -> Optional[tuple[str, Any]]:
        if not op_dict:
            return None

        for op_key, op_value in op_dict.items():
            if op_key in self.OPERATORS:
                operator = self.OPERATORS[op_key]
                if (
                    operator == "BETWEEN"
                    and isinstance(op_value, list)
                    and len(op_value) == 2
                ):
                    return operator, op_value
                return operator, op_value
            if op_key == "in":
                return "IN", op_value if isinstance(op_value, list) else [op_value]
            if op_key == "nin":
                return "NOT IN", op_value if isinstance(op_value, list) else [op_value]

        return None

    def _handle_or_operator(self, or_value: Any) -> list[dict[str, Any]]:
        if not isinstance(or_value, list):
            return []

        sql_parts: list[str] = []

        for item in or_value:
            if isinstance(item, dict):
                for col, val in item.items():
                    if col not in ("OR", "NOT"):
                        sql_part = self._build_sql_condition(col, val)
                        if sql_part:
                            sql_parts.append(sql_part)

        if sql_parts:
            return [
                {
                    "expressionType": "SQL",
                    "clause": "WHERE",
                    "sqlExpression": f"({' OR '.join(sql_parts)})",
                }
            ]

        return []

    def _build_sql_condition(self, column: str, value: Any) -> Optional[str]:
        # URL-supplied columns flow directly into a raw SQL expression in the
        # OR path, so the identifier must match a strict whitelist or we drop
        # the whole condition. Likewise, string literals get `'` escaped to
        # `''` and unrecognised value types are rejected outright.
        safe_column = _safe_identifier(column)
        if safe_column is None:
            logger.warning("Rejecting URL filter with unsafe column: %r", column)
            return None

        if isinstance(value, list):
            quoted = [_quote_sql_literal(v) for v in value]
            if any(q is None for q in quoted):
                return None
            return f"{safe_column} IN ({', '.join(quoted)})"  # type: ignore[arg-type]

        if isinstance(value, dict):
            operator_info = self._parse_operator_dict(value)
            if operator_info:
                op, comp = operator_info
                if op == "BETWEEN" and isinstance(comp, list) and len(comp) == 2:
                    lo = _quote_sql_literal(comp[0])
                    hi = _quote_sql_literal(comp[1])
                    if lo is None or hi is None:
                        return None
                    return f"{safe_column} BETWEEN {lo} AND {hi}"
                comp_str = _quote_sql_literal(comp)
                if comp_str is None:
                    return None
                return f"{safe_column} {op} {comp_str}"
            return None

        val_str = _quote_sql_literal(value)
        if val_str is None:
            return None
        return f"{safe_column} = {val_str}"

    def _handle_not_operator(self, not_value: Any) -> list[dict[str, Any]]:
        if isinstance(not_value, dict):
            filters: list[dict[str, Any]] = []
            for col, val in not_value.items():
                if col not in ("OR", "NOT"):
                    filter_dict = self._create_filter(col, val, negate=True)
                    if filter_dict:
                        filters.append(filter_dict)
            return filters

        return []


def merge_rison_filters(form_data: dict[str, Any]) -> None:
    """
    Merge Rison filters from 'f' parameter into form_data.
    Modifies form_data in place.
    """
    parser = RisonFilterParser()

    if rison_filters := parser.parse():
        existing_filters = form_data.get("adhoc_filters", [])
        form_data["adhoc_filters"] = existing_filters + rison_filters
        logger.info("Added %d filters from Rison parameter", len(rison_filters))
