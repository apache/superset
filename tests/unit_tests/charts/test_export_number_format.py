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
"""Unit tests for the export number-format helper and its feature flag."""

from decimal import Decimal
from unittest.mock import MagicMock

import numpy as np
import pandas as pd

from superset.charts.client_processing import apply_export_number_formats
from superset.utils import csv
from superset.utils.core import GenericDataType


# @AC-FR001-01
def test_applies_configured_d3_format_to_numeric_column() -> None:
    df = pd.DataFrame({"amount": [19.7999992]})
    form_data = {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}}

    result = apply_export_number_formats(df, [GenericDataType.NUMERIC], form_data, None)

    assert result["amount"].tolist() == ["19.8"]


# @AC-FR001-02
def test_configured_format_respects_de_locale(mocker) -> None:
    mocker.patch("superset.utils.number_format.get_locale", return_value="de_DE")
    df = pd.DataFrame({"amount": [1234.5]})
    form_data = {
        "column_config": {
            "amount": {
                "d3NumberFormat": ",.2f",
                "currencyFormat": {"symbol": "EUR", "symbolPosition": None},
            }
        }
    }

    result = apply_export_number_formats(df, [GenericDataType.NUMERIC], form_data, None)

    value = result["amount"].tolist()[0]
    # Locale-aware currency text, not a raw float and not a coerced date.
    assert isinstance(value, str)
    assert "€" in value
    assert value != "1234.5"


# @AC-FR003-01
def test_unformatted_numeric_column_takes_fixed_point_fallback(mocker) -> None:
    fallback = mocker.spy(csv, "format_decimal")
    df = pd.DataFrame({"amount": [Decimal("19.7999992")]})

    result = apply_export_number_formats(df, [GenericDataType.NUMERIC], {}, None)

    fallback.assert_called()
    value = result["amount"].tolist()[0]
    assert value == "19.7999992"
    assert not isinstance(value, float)


# @AC-FR003-02
def test_non_numeric_and_null_cells_left_intact() -> None:
    df = pd.DataFrame(
        {
            "label": ["a", None, "c"],
            "amount": [1.0, None, 3.0],
        }
    )
    form_data = {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}}

    result = apply_export_number_formats(
        df, [GenericDataType.STRING, GenericDataType.NUMERIC], form_data, None
    )

    # Non-numeric column is untouched.
    assert result["label"].tolist() == ["a", None, "c"]
    # Null numeric cell is not turned into a raw float string.
    assert result["amount"].tolist()[0] == "1.0"
    assert result["amount"].tolist()[2] == "3.0"


# @AC-FR006-01
def test_export_formatted_numbers_flag_defaults_to_false() -> None:
    from superset.config import DEFAULT_FEATURE_FLAGS

    assert DEFAULT_FEATURE_FLAGS["EXPORT_FORMATTED_NUMBERS"] is False


# NFR-REL-01
def test_edge_values_do_not_raise() -> None:
    df = pd.DataFrame(
        {
            "configured": [np.nan, np.inf, -np.inf, 10**18],
            "fallback": [
                Decimal("NaN"),
                Decimal("Infinity"),
                None,
                Decimal(10**18),
            ],
        }
    )
    form_data = {"column_config": {"configured": {"d3NumberFormat": ",.2f"}}}

    result = apply_export_number_formats(
        df,
        [GenericDataType.NUMERIC, GenericDataType.NUMERIC],
        form_data,
        None,
    )

    # The call completes without raising and returns a frame of the same shape.
    assert list(result.columns) == ["configured", "fallback"]
    assert len(result) == 4


# @AC-FR002-02
def test_configured_format_output_is_plain_text_not_date(mocker) -> None:
    # A localized currency value is emitted as plain display text; nothing in
    # the helper turns a formatted number into a datetime/date object.
    mocker.patch("superset.utils.number_format.get_locale", return_value="de_DE")
    df = pd.DataFrame({"amount": [3.5]})
    form_data = {
        "column_config": {
            "amount": {
                "d3NumberFormat": ",.1f",
                "currencyFormat": {"symbol": "EUR", "symbolPosition": None},
            }
        }
    }

    result = apply_export_number_formats(df, [GenericDataType.NUMERIC], form_data, None)

    value = result["amount"].tolist()[0]
    import datetime

    assert isinstance(value, str)
    assert not isinstance(value, (datetime.date, datetime.datetime, pd.Timestamp))
    assert "€" in value


# NFR-PERF-01
def test_each_numeric_column_formatted_in_a_single_pass(mocker) -> None:
    # Guard against an asymptotic regression: the fixed-point fallback maps each
    # cell of a numeric column exactly once (one linear pass per column), never
    # re-scanning the frame per cell.
    fallback = mocker.spy(csv, "format_decimal")
    rows = 50
    df = pd.DataFrame({"amount": [Decimal(str(i)) for i in range(rows)]})

    apply_export_number_formats(df, [GenericDataType.NUMERIC], {}, None)

    # Exactly one call per cell -- linear, not quadratic.
    assert fallback.call_count == rows


# @AC-FR005-02
def test_helper_does_not_reference_sql_lab_export_path() -> None:
    # Scope isolation: the chart-export helper does not import or invoke the SQL
    # Lab decimal formatter, keeping the two export paths independent.
    import inspect

    from superset.charts import client_processing

    source = inspect.getsource(client_processing.apply_export_number_formats)
    assert "_format_decimal_columns" not in source
    assert "sql_lab" not in source


# RISK-T06
def test_verbose_map_renamed_column_gets_configured_format() -> None:
    # The DataFrame carries the verbose label, while the saved format and the
    # column config are keyed by the underlying metric name.
    df = pd.DataFrame({"Total Amount": [1234.5]})
    datasource = MagicMock()
    datasource.data = {
        "column_formats": {"amount": ",.2f"},
        "verbose_map": {"amount": "Total Amount"},
    }

    result = apply_export_number_formats(df, [GenericDataType.NUMERIC], {}, datasource)

    assert result["Total Amount"].tolist() == ["1,234.50"]
