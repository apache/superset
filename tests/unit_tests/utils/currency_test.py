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

import pandas as pd
import pytest

from superset.common.db_query_status import QueryStatus
from superset.utils.currency import detect_currency, detect_currency_from_df


@pytest.fixture
def mock_datasource() -> MagicMock:
    """Create a mock datasource with currency_code_column configured."""
    datasource = MagicMock()
    datasource.currency_code_column = "currency_code"
    datasource.id = 1
    return datasource


@pytest.fixture
def mock_query_result() -> MagicMock:
    """Create a mock query result."""
    result = MagicMock()
    result.status = QueryStatus.SUCCESS
    return result


def test_detect_currency_returns_none_when_no_currency_column() -> None:
    """Returns None when datasource has no currency_code_column configured."""
    datasource = MagicMock()
    datasource.currency_code_column = None

    result = detect_currency(datasource)

    assert result is None
    datasource.query.assert_not_called()


def test_detect_currency_returns_single_currency(
    mock_datasource: MagicMock,
    mock_query_result: MagicMock,
) -> None:
    """Returns currency code when all filtered data contains single currency."""
    mock_query_result.df = pd.DataFrame({"currency_code": ["USD", "USD", "USD"]})
    mock_datasource.query.return_value = mock_query_result

    result = detect_currency(mock_datasource)

    assert result == "USD"


def test_detect_currency_returns_none_for_multiple_currencies(
    mock_datasource: MagicMock,
    mock_query_result: MagicMock,
) -> None:
    """Returns None when filtered data contains multiple currencies."""
    mock_query_result.df = pd.DataFrame({"currency_code": ["USD", "EUR", "GBP"]})
    mock_datasource.query.return_value = mock_query_result

    result = detect_currency(mock_datasource)

    assert result is None


def test_detect_currency_returns_none_for_empty_dataframe(
    mock_datasource: MagicMock,
    mock_query_result: MagicMock,
) -> None:
    """Returns None when query returns empty dataframe."""
    mock_query_result.df = pd.DataFrame()
    mock_datasource.query.return_value = mock_query_result

    result = detect_currency(mock_datasource)

    assert result is None


def test_detect_currency_returns_none_on_query_failure(
    mock_datasource: MagicMock,
    mock_query_result: MagicMock,
) -> None:
    """Returns None when query fails."""
    mock_query_result.status = QueryStatus.FAILED
    mock_query_result.df = pd.DataFrame()
    mock_datasource.query.return_value = mock_query_result

    result = detect_currency(mock_datasource)

    assert result is None


def test_detect_currency_handles_exception_gracefully(
    mock_datasource: MagicMock,
) -> None:
    """Returns None and logs warning when exception occurs."""
    mock_datasource.query.side_effect = Exception("Database error")

    result = detect_currency(mock_datasource)

    assert result is None


def test_detect_currency_normalizes_to_uppercase(
    mock_datasource: MagicMock,
    mock_query_result: MagicMock,
) -> None:
    """Normalizes currency codes to uppercase."""
    mock_query_result.df = pd.DataFrame({"currency_code": ["usd", "Usd", "USD"]})
    mock_datasource.query.return_value = mock_query_result

    result = detect_currency(mock_datasource)

    assert result == "USD"


def test_detect_currency_ignores_null_values(
    mock_datasource: MagicMock,
    mock_query_result: MagicMock,
) -> None:
    """Ignores null currency values when detecting single currency."""
    mock_query_result.df = pd.DataFrame({"currency_code": ["USD", None, "USD", None]})
    mock_datasource.query.return_value = mock_query_result

    result = detect_currency(mock_datasource)

    assert result == "USD"


def test_detect_currency_returns_none_when_column_missing_from_result(
    mock_datasource: MagicMock,
    mock_query_result: MagicMock,
) -> None:
    """Returns None when currency column is missing from query result."""
    mock_query_result.df = pd.DataFrame({"other_column": ["value"]})
    mock_datasource.query.return_value = mock_query_result

    result = detect_currency(mock_datasource)

    assert result is None


# Tests for detect_currency_from_df


def test_detect_currency_from_df_returns_single_currency() -> None:
    """Returns currency code when all data contains single currency."""
    df = pd.DataFrame({"currency_code": ["USD", "USD", "USD"]})

    result = detect_currency_from_df(df, "currency_code")

    assert result == "USD"


def test_detect_currency_from_df_returns_none_for_multiple_currencies() -> None:
    """Returns None when data contains multiple currencies."""
    df = pd.DataFrame({"currency_code": ["USD", "EUR", "GBP"]})

    result = detect_currency_from_df(df, "currency_code")

    assert result is None


def test_detect_currency_from_df_returns_none_for_empty_dataframe() -> None:
    """Returns None when dataframe is empty."""
    df = pd.DataFrame()

    result = detect_currency_from_df(df, "currency_code")

    assert result is None


def test_detect_currency_from_df_returns_none_for_none_dataframe() -> None:
    """Returns None when dataframe is None."""
    result = detect_currency_from_df(None, "currency_code")

    assert result is None


def test_detect_currency_from_df_returns_none_when_column_missing() -> None:
    """Returns None when currency column is missing from dataframe."""
    df = pd.DataFrame({"other_column": ["value"]})

    result = detect_currency_from_df(df, "currency_code")

    assert result is None


def test_detect_currency_from_df_normalizes_to_uppercase() -> None:
    """Normalizes currency codes to uppercase."""
    df = pd.DataFrame({"currency_code": ["usd", "Usd", "USD"]})

    result = detect_currency_from_df(df, "currency_code")

    assert result == "USD"


def test_detect_currency_from_df_ignores_null_values() -> None:
    """Ignores null currency values when detecting single currency."""
    df = pd.DataFrame({"currency_code": ["USD", None, "USD", None]})

    result = detect_currency_from_df(df, "currency_code")

    assert result == "USD"
