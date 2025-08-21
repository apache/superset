"""
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
"""

import re
from typing import Any, Dict, Optional, Tuple

from jinja2 import TemplateSyntaxError
from jinja2.sandbox import SandboxedEnvironment
from marshmallow import ValidationError

from superset.utils import json


def validate_jinja_template(template_str: str) -> Tuple[bool, Optional[str]]:
    """
    Validates Jinja2 template syntax.

    Returns:
        Tuple of (is_valid, error_message)
        If valid: (True, None)
        If invalid: (False, "Error description")
    """
    if not template_str:
        return True, None

    try:
        env = SandboxedEnvironment()
        env.from_string(template_str)

        return True, None

    except TemplateSyntaxError as e:
        error_msg = str(e)

        if "expected token 'end of print statement'" in error_msg:
            if "such" in template_str.lower():
                return False, (
                    "Invalid Jinja2 syntax. Found text after variable name. "
                    "Use {{ variable }} for simple variables or "
                    "{{ variable | default('value') }} for defaults. "
                    f"Error: {error_msg}"
                )
            return False, (
                "Invalid Jinja2 syntax. "
                "Check that all {{ }} blocks are properly closed. "
                f"Error: {error_msg}"
            )
        elif "unexpected end of template" in error_msg:
            return False, (
                "Unclosed Jinja2 block. "
                "Make sure all {{ and {% blocks have closing }} and %. "
                f"Error: {error_msg}"
            )
        elif "expected token" in error_msg:
            return False, (f"Invalid Jinja2 syntax. {error_msg}")
        else:
            return False, f"Template syntax error: {error_msg}"

    except Exception as e:
        return False, f"Template validation error: {str(e)}"


def sanitize_jinja_template(template_str: str) -> str:
    """
    Attempts to fix common Jinja2 template mistakes.

    This is a best-effort function that tries to fix obvious errors.
    """
    if not template_str:
        return template_str

    pattern = r"\{\{\s*(\w+)\s+such\s+as\s+([^}]+?)\s*\}\}"
    template_str = re.sub(pattern, r"{{ \1 | default(\2) }}", template_str)

    return template_str


def _check_filter_sql_expression(sql_expression: str) -> None:
    """Check SQL expression for valid Jinja2."""
    is_valid, error_msg = validate_jinja_template(sql_expression)
    if not is_valid:
        raise ValidationError(f"Invalid Jinja2 template in SQL filter: {error_msg}")


def _check_filter_clause(clause: str) -> None:
    """Check filter clause for valid Jinja2."""
    if "{{" in clause:
        is_valid, error_msg = validate_jinja_template(clause)
        if not is_valid:
            raise ValidationError(
                f"Invalid Jinja2 template in WHERE clause: {error_msg}"
            )


def _check_filter_dict(filter_dict: Dict[str, Any]) -> None:
    """Check SQL expressions in a filter dictionary."""
    if not isinstance(filter_dict, dict):
        return

    # Check the sqlExpression field for custom SQL filters
    if sql_expression := filter_dict.get("sqlExpression"):
        _check_filter_sql_expression(sql_expression)

    # Check the clause field (for WHERE clauses)
    if clause := filter_dict.get("clause"):
        _check_filter_clause(clause)


def validate_jinja_template_in_params(params: Dict[str, Any]) -> None:
    """
    Validates Jinja2 templates in chart parameters.
    This function checks adhoc_filters and other fields that might contain Jinja2.
    """
    # Check adhoc_filters
    if adhoc_filters := params.get("adhoc_filters", []):
        for filter_item in adhoc_filters:
            _check_filter_dict(filter_item)

    # Check extra_filters
    if extra_filters := params.get("extra_filters", []):
        for filter_item in extra_filters:
            _check_filter_dict(filter_item)

    # Check where clause
    if where_clause := params.get("where"):
        _check_filter_clause(where_clause)


def validate_params_json_with_jinja(value: str | None) -> None:
    """
    Validates that params is valid JSON and contains valid Jinja2 templates.
    """
    if value is None:
        return

    # First validate JSON
    try:
        params = json.loads(value)
    except (json.JSONDecodeError, TypeError) as ex:
        raise ValidationError("Invalid JSON") from ex

    # Then validate Jinja2 templates within the params
    try:
        validate_jinja_template_in_params(params)
    except ValidationError:
        raise
    except Exception as ex:
        raise ValidationError(f"Template validation error: {str(ex)}") from ex
