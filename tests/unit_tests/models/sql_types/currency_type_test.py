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
"""Tests for CurrencyType - a custom SQLAlchemy type for metric currency."""

from unittest.mock import MagicMock

import pytest

from superset.models.sql_types.base import CurrencyType


@pytest.fixture
def currency_type() -> CurrencyType:
    """Create a CurrencyType instance for testing."""
    return CurrencyType()


@pytest.fixture
def mock_dialect() -> MagicMock:
    """Create a mock SQLAlchemy dialect."""
    return MagicMock()


def test_process_result_value_with_none(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that None values are returned as-is."""
    result = currency_type.process_result_value(None, mock_dialect)
    assert result is None


def test_process_result_value_with_dict(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that dict values are returned as-is."""
    value = {"symbol": "USD", "symbolPosition": "prefix"}
    result = currency_type.process_result_value(value, mock_dialect)
    assert result == {"symbol": "USD", "symbolPosition": "prefix"}


def test_process_result_value_with_empty_dict(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that empty dict values are returned as-is."""
    result = currency_type.process_result_value({}, mock_dialect)
    assert result == {}


def test_process_result_value_with_json_string(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that JSON string values are parsed to dict."""
    value = '{"symbol": "EUR", "symbolPosition": "suffix"}'
    result = currency_type.process_result_value(value, mock_dialect)
    assert result == {"symbol": "EUR", "symbolPosition": "suffix"}


def test_process_result_value_with_python_dict_string(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that Python dict string (single quotes) values are parsed to dict."""
    value = "{'symbol': 'GBP', 'symbolPosition': 'prefix'}"
    result = currency_type.process_result_value(value, mock_dialect)
    assert result == {"symbol": "GBP", "symbolPosition": "prefix"}


def test_process_result_value_with_double_encoded_json_string(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that double-encoded JSON strings are parsed to dict."""
    value = '"{\\"symbol\\": \\"EUR\\", \\"symbolPosition\\": \\"suffix\\"}"'
    result = currency_type.process_result_value(value, mock_dialect)
    assert result == {"symbol": "EUR", "symbolPosition": "suffix"}


def test_process_result_value_with_malformed_string(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that malformed string values return empty dict."""
    value = "not valid json at all"
    result = currency_type.process_result_value(value, mock_dialect)
    assert result == {}


def test_process_result_value_with_empty_string(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that empty string values return empty dict."""
    result = currency_type.process_result_value("", mock_dialect)
    assert result == {}


def test_process_result_value_with_partial_json_string(
    currency_type: CurrencyType, mock_dialect: MagicMock
) -> None:
    """Test that partial JSON string (only symbol) is parsed correctly."""
    value = '{"symbol": "JPY"}'
    result = currency_type.process_result_value(value, mock_dialect)
    assert result == {"symbol": "JPY"}


def test_cache_ok_is_true(currency_type: CurrencyType) -> None:
    """Test that cache_ok is True for SQLAlchemy compatibility."""
    assert currency_type.cache_ok is True


def test_impl_is_json(currency_type: CurrencyType) -> None:
    """Test that the underlying implementation is JSON type."""
    from sqlalchemy.types import JSON

    impl = currency_type.impl
    if isinstance(impl, type):
        assert issubclass(impl, JSON)
    else:
        assert isinstance(impl, JSON)
