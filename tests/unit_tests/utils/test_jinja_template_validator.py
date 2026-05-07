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
    JinjaValidationError,
    validate_jinja_template,
    validate_params_json_with_jinja,
)


def test_validate_jinja_template_valid():
    """Test valid Jinja2 templates."""
    # Simple variable - should not raise any exception
    validate_jinja_template("{{ variable }}")

    # With filter - should not raise any exception
    validate_jinja_template("{{ variable | default('value') }}")

    # SQL with Jinja2 - should not raise any exception
    validate_jinja_template("WHERE date = {{ date }}")

    # Empty string - should not raise any exception
    validate_jinja_template("")


def test_validate_jinja_template_invalid():
    """Test invalid Jinja2 templates with common mistakes."""
    # The "such as" mistake
    with pytest.raises(JinjaValidationError) as exc_info:
        validate_jinja_template("{{ variable such as 'value' }}")
    error = exc_info.value.message
    assert "Invalid Jinja2 template syntax" in error
    assert "expected token" in error

    # Unclosed block
    with pytest.raises(JinjaValidationError) as exc_info:
        validate_jinja_template("{{ variable ")
    error = exc_info.value.message
    assert "Invalid Jinja2 template syntax" in error

    # Text after closing brace
    with pytest.raises(JinjaValidationError) as exc_info:
        validate_jinja_template("{{ variable }} extra text {{")
    error = exc_info.value.message
    assert "Invalid Jinja2 template syntax" in error


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
