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

from typing import Any, Dict

from jinja2 import TemplateSyntaxError
from jinja2.sandbox import SandboxedEnvironment
from marshmallow import ValidationError

from superset.utils import json


class JinjaValidationError(Exception):
    """Exception raised when Jinja2 template validation fails."""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


def validate_jinja_template(template_str: str) -> None:
    """
    Validates Jinja2 template syntax.

    Args:
        template_str: The template string to validate

    Raises:
        JinjaValidationError: If the template syntax is invalid
    """
    if not template_str:
        return

    try:
        env = SandboxedEnvironment()
        env.from_string(template_str)
    except TemplateSyntaxError as e:
        raise JinjaValidationError(f"Invalid Jinja2 template syntax: {str(e)}") from e
    except Exception as e:
        raise JinjaValidationError(f"Template validation error: {str(e)}") from e


def _check_filter_sql_expression(sql_expression: str) -> None:
    """Check SQL expression for valid Jinja2."""
    try:
        validate_jinja_template(sql_expression)
    except JinjaValidationError as e:
        raise ValidationError(
            f"Invalid Jinja2 template in SQL filter: {e.message}"
        ) from e


def _check_filter_clause(clause: str) -> None:
    """Check filter clause for valid Jinja2."""
    if "{{" in clause:
        try:
            validate_jinja_template(clause)
        except JinjaValidationError as e:
            raise ValidationError(
                f"Invalid Jinja2 template in WHERE clause: {e.message}"
            ) from e


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
