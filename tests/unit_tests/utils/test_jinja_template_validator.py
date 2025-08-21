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

import pytest

from superset.utils.jinja_template_validator import (
    sanitize_jinja_template,
    validate_jinja_template,
    validate_params_json_with_jinja,
)


def test_validate_jinja_template_valid():
    """Test valid Jinja2 templates."""
    # Simple variable
    is_valid, error = validate_jinja_template("{{ variable }}")
    assert is_valid is True
    assert error is None

    # With filter
    is_valid, error = validate_jinja_template("{{ variable | default('value') }}")
    assert is_valid is True
    assert error is None

    # SQL with Jinja2
    is_valid, error = validate_jinja_template("WHERE date = {{ date }}")
    assert is_valid is True
    assert error is None

    # Empty string
    is_valid, error = validate_jinja_template("")
    assert is_valid is True
    assert error is None


def test_validate_jinja_template_invalid():
    """Test invalid Jinja2 templates with common mistakes."""
    # The "such as" mistake
    is_valid, error = validate_jinja_template("{{ variable such as 'value' }}")
    assert is_valid is False
    assert "Invalid Jinja2 syntax" in error
    assert "Use {{ variable }}" in error or "default" in error

    # Unclosed block
    is_valid, error = validate_jinja_template("{{ variable ")
    assert is_valid is False
    assert "syntax" in error.lower() or "unclosed" in error.lower()

    # Text after closing brace
    is_valid, error = validate_jinja_template("{{ variable }} extra text {{")
    assert is_valid is False
    assert "syntax" in error.lower() or "unexpected" in error.lower()


def test_sanitize_jinja_template():
    """Test template sanitization for common mistakes."""
    # Fix "such as" pattern
    result = sanitize_jinja_template("{{ variable such as 'value' }}")
    assert result == "{{ variable | default('value') }}"

    # Leave valid templates unchanged
    result = sanitize_jinja_template("{{ variable | default('value') }}")
    assert result == "{{ variable | default('value') }}"

    # Handle empty string
    result = sanitize_jinja_template("")
    assert result == ""


def test_validate_params_json_with_jinja():
    """Test the combined JSON + Jinja2 validation function."""
    from marshmallow import ValidationError

    from superset.utils import json

    # Valid JSON with valid templates
    valid_params = {
        "adhoc_filters": [
            {"sqlExpression": "column = {{ variable | default('value') }}"}
        ]
    }
    # Should not raise any exception
    validate_params_json_with_jinja(json.dumps(valid_params))

    # Invalid JSON
    with pytest.raises(ValidationError, match="Invalid JSON"):
        validate_params_json_with_jinja("{invalid json")

    # Valid JSON with invalid Jinja2
    invalid_params = {
        "adhoc_filters": [{"sqlExpression": "column = {{ variable such as 'value' }}"}]
    }
    with pytest.raises(ValidationError, match="Invalid Jinja2 template"):
        validate_params_json_with_jinja(json.dumps(invalid_params))

    # None value should pass
    validate_params_json_with_jinja(None)
