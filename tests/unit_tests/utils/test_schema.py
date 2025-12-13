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

"""Unit tests for schema validation utilities."""

import pytest
from marshmallow import ValidationError

from superset.utils import json
from superset.utils.schema import (
    OneOfCaseInsensitive,
    validate_json,
    validate_query_context_metadata,
)


def test_validate_json_valid() -> None:
    """Test validate_json with valid JSON string."""
    valid_json = '{"key": "value", "number": 123}'
    # Should not raise any exception
    validate_json(valid_json)


def test_validate_json_valid_bytes() -> None:
    """Test validate_json with valid JSON bytes."""
    valid_json = b'{"key": "value", "number": 123}'
    # Should not raise any exception
    validate_json(valid_json)


def test_validate_json_invalid() -> None:
    """Test validate_json with invalid JSON."""
    invalid_json = '{"key": "value", "number": 123'
    with pytest.raises(ValidationError) as exc_info:
        validate_json(invalid_json)
    assert "JSON not valid" in str(exc_info.value)


def test_validate_json_empty_string() -> None:
    """Test validate_json with empty string - empty strings are allowed."""
    # Empty strings do not raise an error because validate_json has early return
    validate_json("")  # Should not raise any exception


def test_validate_json_whitespace_only() -> None:
    """Test validate_json with whitespace-only string."""
    with pytest.raises(ValidationError) as exc_info:
        validate_json("   ")
    assert "JSON not valid" in str(exc_info.value)


def test_validate_json_not_json() -> None:
    """Test validate_json with non-JSON string."""
    not_json = "this is not json"
    with pytest.raises(ValidationError) as exc_info:
        validate_json(not_json)
    assert "JSON not valid" in str(exc_info.value)


def test_validate_query_context_metadata_none() -> None:
    """Test validate_query_context_metadata allows None values."""
    # Should not raise any exception for None
    validate_query_context_metadata(None)


def test_validate_query_context_metadata_valid() -> None:
    """Test validate_query_context_metadata with valid query context."""
    valid_query_context = json.dumps(
        {
            "datasource": {"type": "table", "id": 1},
            "queries": [{"metrics": ["count"], "columns": []}],
        },
    )
    # Should not raise any exception
    validate_query_context_metadata(valid_query_context)


def test_validate_query_context_metadata_valid_bytes() -> None:
    """Test validate_query_context_metadata with valid query context as bytes."""
    valid_query_context = json.dumps(
        {
            "datasource": {"type": "table", "id": 1},
            "queries": [{"metrics": ["count"], "columns": []}],
        },
    ).encode("utf-8")
    # Should not raise any exception
    validate_query_context_metadata(valid_query_context)


def test_validate_query_context_metadata_invalid_json() -> None:
    """Test validate_query_context_metadata with invalid JSON."""
    invalid_json = '{"datasource": {"type": "table"'
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(invalid_json)
    assert "JSON not valid" in str(exc_info.value)


def test_validate_query_context_metadata_not_dict() -> None:
    """Test validate_query_context_metadata with non-dict JSON."""
    not_dict = json.dumps(["array", "values"])
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(not_dict)
    assert "Query context must be a valid JSON object" in str(exc_info.value)


def test_validate_query_context_metadata_missing_datasource() -> None:
    """Test validate_query_context_metadata with missing datasource field."""
    missing_datasource = json.dumps(
        {"queries": [{"metrics": ["count"], "columns": []}]},
    )
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(missing_datasource)
    error_message = str(exc_info.value)
    assert "Query context is missing required fields" in error_message
    assert "datasource" in error_message


def test_validate_query_context_metadata_missing_queries() -> None:
    """Test validate_query_context_metadata with missing queries field."""
    missing_queries = json.dumps({"datasource": {"type": "table", "id": 1}})
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(missing_queries)
    error_message = str(exc_info.value)
    assert "Query context is missing required fields" in error_message
    assert "queries" in error_message


def test_validate_query_context_metadata_missing_both_fields() -> None:
    """Test validate_query_context_metadata with both required fields missing."""
    empty_context = json.dumps({})
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(empty_context)
    error_message = str(exc_info.value)
    assert "Query context is missing required fields" in error_message
    assert "datasource" in error_message
    assert "queries" in error_message


def test_validate_query_context_metadata_extra_fields() -> None:
    """Test validate_query_context_metadata allows extra fields."""
    context_with_extras = json.dumps(
        {
            "datasource": {"type": "table", "id": 1},
            "queries": [{"metrics": ["count"], "columns": []}],
            "extra_field": "extra_value",
            "another_field": 123,
        },
    )
    # Should not raise any exception - extra fields are allowed
    validate_query_context_metadata(context_with_extras)


def test_validate_query_context_metadata_empty_values() -> None:
    """Test validate_query_context_metadata with empty but present values."""
    context_with_empty = json.dumps(
        {
            "datasource": {},
            "queries": [],
        },
    )
    # Should not raise any exception - fields exist even if empty
    validate_query_context_metadata(context_with_empty)


def test_validate_query_context_metadata_null_datasource() -> None:
    """Test validate_query_context_metadata with null datasource value."""
    context_with_null = json.dumps(
        {
            "datasource": None,
            "queries": [{"metrics": ["count"]}],
        },
    )
    # Should not raise any exception - field exists even if null
    validate_query_context_metadata(context_with_null)


def test_validate_query_context_metadata_null_queries() -> None:
    """Test validate_query_context_metadata with null queries value."""
    context_with_null = json.dumps(
        {
            "datasource": {"type": "table", "id": 1},
            "queries": None,
        },
    )
    # Should not raise any exception - field exists even if null
    validate_query_context_metadata(context_with_null)


def test_validate_query_context_metadata_empty_string() -> None:
    """Test validate_query_context_metadata with empty string."""
    # Empty string should be treated as None and not raise error
    validate_query_context_metadata("")


def test_validate_query_context_metadata_whitespace() -> None:
    """Test validate_query_context_metadata with whitespace-only string."""
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata("   ")
    assert "JSON not valid" in str(exc_info.value)


def test_validate_query_context_metadata_string_value() -> None:
    """Test validate_query_context_metadata with plain string instead of JSON object."""
    plain_string = json.dumps("just a string")
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(plain_string)
    assert "Query context must be a valid JSON object" in str(exc_info.value)


def test_validate_query_context_metadata_number_value() -> None:
    """Test validate_query_context_metadata with number instead of JSON object."""
    number_value = json.dumps(12345)
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(number_value)
    assert "Query context must be a valid JSON object" in str(exc_info.value)


def test_validate_query_context_metadata_boolean_value() -> None:
    """Test validate_query_context_metadata with boolean instead of JSON object."""
    bool_value = json.dumps(True)
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(bool_value)
    assert "Query context must be a valid JSON object" in str(exc_info.value)


def test_validate_query_context_metadata_complex_nested_structure() -> None:
    """Test validate_query_context_metadata with complex nested structure."""
    complex_context = json.dumps(
        {
            "datasource": {
                "type": "table",
                "id": 1,
                "schema": "public",
                "table_name": "my_table",
                "columns": [
                    {"name": "col1", "type": "VARCHAR"},
                    {"name": "col2", "type": "INTEGER"},
                ],
            },
            "queries": [
                {
                    "metrics": ["count", "sum", "avg"],
                    "columns": ["col1", "col2"],
                    "filters": [{"col": "col1", "op": "==", "val": "value"}],
                    "orderby": [["col1", True]],
                    "extras": {"where": "col1 IS NOT NULL"},
                },
            ],
            "result_format": "json",
            "result_type": "full",
        },
    )
    # Should not raise any exception - has required fields plus extras
    validate_query_context_metadata(complex_context)


def test_one_of_case_insensitive_valid_lowercase() -> None:
    """Test OneOfCaseInsensitive validator with lowercase value."""
    validator = OneOfCaseInsensitive(["Option1", "Option2", "Option3"])
    result = validator("option1")
    assert result == "option1"


def test_one_of_case_insensitive_valid_uppercase() -> None:
    """Test OneOfCaseInsensitive validator with uppercase value."""
    validator = OneOfCaseInsensitive(["Option1", "Option2", "Option3"])
    result = validator("OPTION2")
    assert result == "OPTION2"


def test_one_of_case_insensitive_valid_mixed_case() -> None:
    """Test OneOfCaseInsensitive validator with mixed case value."""
    validator = OneOfCaseInsensitive(["Option1", "Option2", "Option3"])
    result = validator("OpTiOn3")
    assert result == "OpTiOn3"


def test_one_of_case_insensitive_invalid() -> None:
    """Test OneOfCaseInsensitive validator with invalid value."""
    validator = OneOfCaseInsensitive(["Option1", "Option2", "Option3"])
    with pytest.raises(ValidationError):
        validator("invalid")


def test_one_of_case_insensitive_non_string_valid() -> None:
    """Test OneOfCaseInsensitive validator with non-string valid value."""
    validator = OneOfCaseInsensitive([1, 2, 3])
    result = validator(2)
    assert result == 2


def test_one_of_case_insensitive_non_string_invalid() -> None:
    """Test OneOfCaseInsensitive validator with non-string invalid value."""
    validator = OneOfCaseInsensitive([1, 2, 3])
    with pytest.raises(ValidationError):
        validator(4)


def test_one_of_case_insensitive_mixed_types() -> None:
    """Test OneOfCaseInsensitive validator with mixed types in choices."""
    validator = OneOfCaseInsensitive(["Option1", 2, "Option3"])
    result = validator("option1")
    assert result == "option1"
    result = validator(2)
    assert result == 2


def test_one_of_case_insensitive_type_error() -> None:
    """Test OneOfCaseInsensitive validator with incomparable types."""
    validator = OneOfCaseInsensitive(["Option1", "Option2"])
    # Passing a dict or other non-comparable type should raise ValidationError
    with pytest.raises(ValidationError):
        validator({"key": "value"})
