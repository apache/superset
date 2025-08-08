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
from typing import Any, Optional, Union

import prison
from flask import request

logger = logging.getLogger(__name__)


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

    # Comparison operators mapping to SQL operators
    OPERATORS = {
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
            # Get from request args
            filter_string = request.args.get("f")

        if not filter_string:
            return []

        try:
            # Parse Rison to Python object
            filters_obj = prison.loads(filter_string)

            # Convert to adhoc_filters
            return self._convert_to_adhoc_filters(filters_obj)

        except Exception:
            logger.warning(
                f"Failed to parse Rison filters: {filter_string}", exc_info=True
            )
            # Return empty list on parse error to not break the request
            return []

    def _convert_to_adhoc_filters(
        self, filters_obj: Union[dict[str, Any], list[Any], Any]
    ) -> list[dict[str, Any]]:
        """
        Convert parsed Rison object to adhoc_filters format.

        Args:
            filters_obj: Parsed Rison object

        Returns:
            List of adhoc_filter dictionaries
        """
        if not isinstance(filters_obj, dict):
            return []

        adhoc_filters = []

        for key, value in filters_obj.items():
            # Handle special operators
            if key == "OR":
                # OR operator creates a single filter with OR clause
                or_filters = self._handle_or_operator(value)
                adhoc_filters.extend(or_filters)
            elif key == "NOT":
                # NOT operator negates the contained filter
                not_filters = self._handle_not_operator(value)
                adhoc_filters.extend(not_filters)
            else:
                # Regular field filter
                filter_dict = self._create_filter(key, value)
                if filter_dict:
                    adhoc_filters.append(filter_dict)

        return adhoc_filters

    def _create_filter(
        self, column: str, value: Any, negate: bool = False
    ) -> Optional[dict[str, Any]]:
        """
        Create a single adhoc_filter dictionary.

        Args:
            column: Column name
            value: Filter value (can be scalar, list, or operator dict)
            negate: Whether to negate the filter

        Returns:
            adhoc_filter dictionary or None if invalid
        """
        # Base filter structure
        filter_dict: dict[str, Any] = {
            "expressionType": "SIMPLE",
            "clause": "WHERE",
            "subject": column,
        }

        # Handle different value types
        if isinstance(value, list):
            # List means IN operator
            filter_dict["operator"] = "NOT IN" if negate else "IN"
            filter_dict["comparator"] = value

        elif isinstance(value, dict):
            # Dictionary contains operator and value
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
            # Simple scalar value
            filter_dict["operator"] = "!=" if negate else "=="
            filter_dict["comparator"] = value

        return filter_dict

    def _parse_operator_dict(
        self, op_dict: dict[str, Any]
    ) -> Optional[tuple[str, Any]]:
        """
        Parse operator dictionary like {gt: 100} or {between: [1, 10]}.

        Args:
            op_dict: Operator dictionary

        Returns:
            Tuple of (operator, comparator) or None
        """
        if not op_dict:
            return None

        # Get first key-value pair (should only be one)
        for op_key, op_value in op_dict.items():
            if op_key in self.OPERATORS:
                operator = self.OPERATORS[op_key]

                # Special handling for BETWEEN
                if (
                    operator == "BETWEEN"
                    and isinstance(op_value, list)
                    and len(op_value) == 2
                ):
                    return operator, op_value

                return operator, op_value
            elif op_key == "in":
                # Explicit IN operator
                return "IN", op_value if isinstance(op_value, list) else [op_value]
            elif op_key == "nin":
                # NOT IN operator
                return "NOT IN", op_value if isinstance(op_value, list) else [op_value]

        return None

    def _handle_or_operator(self, or_value: Any) -> list[dict[str, Any]]:
        """
        Handle OR operator by creating appropriate filters.

        Note: Superset's adhoc_filters don't directly support OR between different
        fields in SIMPLE mode. This creates a SQL expression instead.

        Args:
            or_value: Value of OR operator (usually a list)

        Returns:
            List containing SQL expression filter
        """
        if not isinstance(or_value, list):
            return []

        # Build SQL expression for OR
        sql_parts = []

        for item in or_value:
            if isinstance(item, dict):
                for col, val in item.items():
                    if col not in ["OR", "NOT"]:  # Skip nested operators for now
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
        """
        Build a SQL condition string for a single column-value pair.

        Args:
            column: Column name
            value: Value (can be scalar, list, or operator dict)

        Returns:
            SQL condition string or None
        """
        if isinstance(value, list):
            # IN clause
            values_str = ", ".join(
                [f"'{v}'" if isinstance(v, str) else str(v) for v in value]
            )
            return f"{column} IN ({values_str})"

        elif isinstance(value, dict):
            # Operator
            operator_info = self._parse_operator_dict(value)
            if operator_info:
                op, comp = operator_info
                if op == "BETWEEN" and isinstance(comp, list):
                    return f"{column} BETWEEN '{comp[0]}' AND '{comp[1]}'"
                elif op == "LIKE":
                    return f"{column} LIKE '{comp}'"
                else:
                    comp_str = f"'{comp}'" if isinstance(comp, str) else str(comp)
                    return f"{column} {op} {comp_str}"

        else:
            # Simple equality
            val_str = f"'{value}'" if isinstance(value, str) else str(value)
            return f"{column} = {val_str}"

        return None

    def _handle_not_operator(self, not_value: Any) -> list[dict[str, Any]]:
        """
        Handle NOT operator by negating the contained filter.

        Args:
            not_value: Value to negate

        Returns:
            List of negated filters
        """
        if isinstance(not_value, dict):
            filters = []
            for col, val in not_value.items():
                if col not in ["OR", "NOT"]:  # Skip nested operators
                    filter_dict = self._create_filter(col, val, negate=True)
                    if filter_dict:
                        filters.append(filter_dict)
            return filters

        return []


def merge_rison_filters(form_data: dict[str, Any]) -> None:
    """
    Merge Rison filters from 'f' parameter into form_data.

    This function modifies form_data in place, adding parsed filters
    to the adhoc_filters list.

    Args:
        form_data: Form data dictionary to modify
    """
    parser = RisonFilterParser()

    if rison_filters := parser.parse():
        # Get existing adhoc_filters or create empty list
        existing_filters = form_data.get("adhoc_filters", [])

        # Add new filters
        form_data["adhoc_filters"] = existing_filters + rison_filters

        logger.info(f"Added {len(rison_filters)} filters from Rison parameter")
