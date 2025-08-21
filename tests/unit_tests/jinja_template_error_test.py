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

from unittest.mock import MagicMock

import pytest

from superset.errors import SupersetErrorType
from superset.exceptions import SupersetSyntaxErrorException
from superset.jinja_context import BaseTemplateProcessor
from superset.utils import json


def create_mock_processor():
    """Create a BaseTemplateProcessor with mocked database"""
    mock_database = MagicMock()
    mock_database.db_engine_spec = MagicMock()
    return BaseTemplateProcessor(database=mock_database)


def test_jinja2_syntax_error_general():
    """Test handling of general Jinja2 syntax errors"""
    processor = create_mock_processor()
    template = "SELECT * WHERE column = {{ variable such as 'default' }}"

    with pytest.raises(SupersetSyntaxErrorException) as exc_info:
        processor.process_template(template)

    # Check the exception details
    exception = exc_info.value
    assert len(exception.errors) == 1
    error = exception.errors[0]

    # Verify error message contains helpful guidance
    assert "Jinja2 template error" in error.message
    assert "TemplateSyntaxError" in error.message
    assert "check your template syntax" in error.message
    assert "Original error:" in error.message

    # Verify error type and status
    assert error.error_type == SupersetErrorType.GENERIC_COMMAND_ERROR
    assert exception.status == 422

    # Verify extra data includes template snippet
    assert "template" in error.extra
    assert error.extra["template"][:50] == template[:50]


def test_jinja2_syntax_error_unclosed_block():
    """Test handling of unclosed Jinja2 blocks"""
    processor = create_mock_processor()
    template = "SELECT * WHERE column = {{ variable "

    with pytest.raises(SupersetSyntaxErrorException) as exc_info:
        processor.process_template(template)

    exception = exc_info.value
    error = exception.errors[0]

    # Should get general syntax error with helpful guidance
    assert "Jinja2 template error" in error.message
    assert "TemplateSyntaxError" in error.message
    assert "check your template syntax" in error.message


def test_jinja2_syntax_error_unexpected_end():
    """Test handling of unexpected end of template"""
    processor = create_mock_processor()
    template = "SELECT * WHERE {% if condition"

    with pytest.raises(SupersetSyntaxErrorException) as exc_info:
        processor.process_template(template)

    exception = exc_info.value
    error = exception.errors[0]

    # Should get general syntax error with helpful guidance
    assert "Jinja2 template error" in error.message
    assert "TemplateSyntaxError" in error.message


def test_datadog_structured_logging_data():
    """Test that errors include structured data for Datadog logging"""
    # We can't easily mock the logger due to module-level instantiation,
    # but we can test that the error includes the structured data we need
    processor = create_mock_processor()
    template = "SELECT * WHERE column = {{ variable such as 'default' }}"

    with pytest.raises(SupersetSyntaxErrorException) as exc_info:
        processor.process_template(template)

    exception = exc_info.value
    error = exception.errors[0]

    # Verify error contains structured data that would be useful for Datadog
    assert error.error_type == SupersetErrorType.GENERIC_COMMAND_ERROR
    assert "template" in error.extra
    assert "line" in error.extra
    assert error.extra["template"] == template[:500]  # Truncated for logging

    # The actual logging happens inside the function - we can see it in captured logs
    # This is sufficient to verify the functionality is working


def test_valid_jinja2_template_passes():
    """Test that valid templates work correctly"""
    processor = create_mock_processor()
    valid_templates = [
        "SELECT * WHERE column = {{ variable }}",
        "SELECT * WHERE column = {{ variable | default('value') }}",
        "SELECT * WHERE column = {{ variable or 'value' }}",
        "{% if condition %}SELECT * {% endif %}",
    ]

    for template in valid_templates:
        # Should not raise any exception
        result = processor.process_template(template)
        assert result is not None


def test_api_response_format():
    """Test that the API response format is correct for template errors"""
    processor = create_mock_processor()
    template = "SELECT * WHERE column = {{ variable such as 'default' }}"

    with pytest.raises(SupersetSyntaxErrorException) as exc_info:
        processor.process_template(template)

    exception = exc_info.value

    # Simulate what the API error handler would do
    errors_dict = [
        {
            "message": error.message,
            "error_type": error.error_type.name,
            "level": error.level.name,
            "extra": error.extra,
        }
        for error in exception.errors
    ]

    # This is what would be sent to the client
    response_data = {"errors": errors_dict}

    # Verify the structure
    assert "errors" in response_data
    assert len(response_data["errors"]) == 1

    error_data = response_data["errors"][0]
    assert "message" in error_data
    assert "error_type" in error_data
    assert "level" in error_data
    assert "extra" in error_data

    # Verify it's JSON serializable (important for API responses)
    json_str = json.dumps(response_data)
    assert json_str is not None


def test_chart_params_validation():
    """Test that chart params with invalid Jinja2 are rejected"""
    from marshmallow import ValidationError

    from superset.utils.jinja_template_validator import (
        validate_jinja_template_in_params,
    )

    # Invalid template in adhoc_filters
    invalid_params = {
        "adhoc_filters": [
            {
                "sqlExpression": "column = {{ variable such as 'value' }}",
                "clause": "WHERE",
            }
        ]
    }

    with pytest.raises(ValidationError) as exc_info:
        validate_jinja_template_in_params(invalid_params)

    error_msg = str(exc_info.value)
    assert "Invalid Jinja2 template" in error_msg


def test_chart_params_validation_passes_valid():
    """Test that valid Jinja2 templates pass validation"""
    from superset.utils.jinja_template_validator import (
        validate_jinja_template_in_params,
    )

    valid_params = {
        "adhoc_filters": [
            {
                "sqlExpression": "column = {{ variable | default('value') }}",
                "clause": "WHERE",
            }
        ],
        "where": "date >= {{ from_date }}",
    }

    # Should not raise any exception
    validate_jinja_template_in_params(valid_params)


def test_jinja2_client_template_error():
    """Test handling of client-side Jinja2 template errors"""
    from unittest.mock import patch

    from jinja2 import UndefinedError

    processor = create_mock_processor()
    template = "SELECT * FROM table"

    # Mock the Environment.from_string to raise a client error
    with patch.object(
        processor.env, "from_string", side_effect=UndefinedError("Variable not defined")
    ):
        with pytest.raises(SupersetSyntaxErrorException) as exc_info:
            processor.process_template(template)

        exception = exc_info.value
        error = exception.errors[0]

        # Should get client error message (422)
        assert "Jinja2 template error" in error.message
        assert "UndefinedError" in error.message
        assert "check your template syntax" in error.message
        assert "Variable not defined" in error.message
        assert exception.status == 422

        # Verify it includes exception type info
        assert "UndefinedError" in error.extra.get("exception_type", "")


def test_jinja2_security_error():
    """Test handling of SecurityError as client error with proper exception type"""
    from unittest.mock import patch

    from jinja2.exceptions import SecurityError

    processor = create_mock_processor()
    template = "SELECT * FROM table"

    # Mock the Environment.from_string to raise a security error
    with patch.object(
        processor.env, "from_string", side_effect=SecurityError("Access denied")
    ):
        with pytest.raises(SupersetSyntaxErrorException) as exc_info:
            processor.process_template(template)

        exception = exc_info.value
        error = exception.errors[0]

        # Should get client error message with SecurityError type
        assert "Jinja2 template error" in error.message
        assert "SecurityError" in error.message
        assert "Access denied" in error.message
        assert exception.status == 422


def test_jinja2_server_template_error():
    """Test handling of server-side Jinja2 template errors"""
    from unittest.mock import patch

    from superset.exceptions import SupersetTemplateException

    processor = create_mock_processor()
    template = "SELECT * FROM table"

    # Mock the Environment.from_string to raise a server error
    with patch.object(
        processor.env, "from_string", side_effect=MemoryError("Out of memory")
    ):
        with pytest.raises(SupersetTemplateException) as exc_info:
            processor.process_template(template)

        exception = exc_info.value

        # Should get server error message (500)
        assert "Internal error processing Jinja2 template" in str(exception)
        assert "contact your administrator" in str(exception)
        assert "Out of memory" in str(exception)
