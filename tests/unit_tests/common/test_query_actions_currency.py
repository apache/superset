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
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from superset.common.query_actions import _detect_currency


@pytest.fixture
def mock_query_context() -> MagicMock:
    """Create a mock QueryContext with AUTO currency format."""
    context = MagicMock()
    context.form_data = {"currency_format": {"symbol": "AUTO"}}
    return context


@pytest.fixture
def mock_query_obj() -> MagicMock:
    """Create a mock QueryObject with filter attributes."""
    obj = MagicMock()
    obj.filter = []
    obj.granularity = None
    obj.from_dttm = None
    obj.to_dttm = None
    obj.extras = {}
    return obj


@pytest.fixture
def mock_datasource() -> MagicMock:
    """Create a mock datasource with currency column."""
    ds = MagicMock()
    ds.currency_code_column = "currency_code"
    return ds


def test_detect_currency_returns_none_when_form_data_is_none(
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    """Returns None when query context has no form_data."""
    context = MagicMock()
    context.form_data = None

    result = _detect_currency(context, mock_query_obj, mock_datasource)

    assert result is None


def test_detect_currency_returns_none_when_currency_format_not_dict(
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    """Returns None when currency_format is not a dict."""
    context = MagicMock()
    context.form_data = {"currency_format": "invalid"}

    result = _detect_currency(context, mock_query_obj, mock_datasource)

    assert result is None


def test_detect_currency_returns_none_when_symbol_not_auto(
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    """Returns None when currency_format.symbol is not AUTO."""
    context = MagicMock()
    context.form_data = {"currency_format": {"symbol": "USD"}}

    result = _detect_currency(context, mock_query_obj, mock_datasource)

    assert result is None


def test_detect_currency_returns_none_when_no_currency_column(
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
) -> None:
    """Returns None when datasource has no currency_code_column."""
    datasource = MagicMock()
    datasource.currency_code_column = None

    result = _detect_currency(mock_query_context, mock_query_obj, datasource)

    assert result is None


@patch("superset.common.query_actions.detect_currency_from_df")
def test_detect_currency_uses_dataframe_when_column_present(
    mock_detect_from_df: MagicMock,
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    """Uses detect_currency_from_df when df contains currency column."""
    df = pd.DataFrame({"currency_code": ["USD", "USD"]})
    mock_detect_from_df.return_value = "USD"

    result = _detect_currency(mock_query_context, mock_query_obj, mock_datasource, df)

    assert result == "USD"
    mock_detect_from_df.assert_called_once_with(df, "currency_code")


@patch("superset.common.query_actions.detect_currency")
def test_detect_currency_queries_datasource_when_no_df(
    mock_detect: MagicMock,
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    """Queries datasource when df is None."""
    mock_detect.return_value = "EUR"

    result = _detect_currency(mock_query_context, mock_query_obj, mock_datasource)

    assert result == "EUR"
    mock_detect.assert_called_once_with(
        datasource=mock_datasource,
        filters=mock_query_obj.filter,
        granularity=mock_query_obj.granularity,
        from_dttm=mock_query_obj.from_dttm,
        to_dttm=mock_query_obj.to_dttm,
        extras=mock_query_obj.extras,
    )


@patch("superset.common.query_actions.detect_currency")
def test_detect_currency_queries_datasource_when_column_not_in_df(
    mock_detect: MagicMock,
    mock_query_context: MagicMock,
    mock_query_obj: MagicMock,
    mock_datasource: MagicMock,
) -> None:
    """Falls back to query when df doesn't have currency column."""
    df = pd.DataFrame({"other_column": ["value"]})
    mock_detect.return_value = "GBP"

    result = _detect_currency(mock_query_context, mock_query_obj, mock_datasource, df)

    assert result == "GBP"
    mock_detect.assert_called_once()
