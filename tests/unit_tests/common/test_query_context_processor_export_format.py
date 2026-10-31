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
"""Integration tests for number-formatted CSV/XLSX export in get_data()."""

import io
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, cast

import pandas as pd

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.utils.core import GenericDataType
from tests.unit_tests.conftest import with_feature_flags


def _make_processor(
    result_format: ChartDataResultFormat,
    form_data: dict[str, Any],
    datasource_data: dict[str, Any] | None = None,
    result_type: ChartDataResultType = ChartDataResultType.FULL,
) -> QueryContextProcessor:
    datasource = SimpleNamespace(data=datasource_data or {})
    context = SimpleNamespace(
        datasource=datasource,
        result_format=result_format,
        result_type=result_type,
        form_data=form_data,
    )
    return QueryContextProcessor(cast(QueryContext, context))


def _csv_text(payload: str | bytes | list[dict[str, Any]]) -> str:
    # get_data() is typed as a union over export formats; the CSV branch always
    # returns bytes, so narrow before decoding.
    assert isinstance(payload, bytes)
    return payload.decode("utf-8-sig")


def _read_xlsx_column(
    payload: str | bytes | list[dict[str, Any]], column: str
) -> list[Any]:
    # The XLSX branch of get_data() always returns bytes; narrow the union.
    assert isinstance(payload, bytes)
    frame = pd.read_excel(io.BytesIO(payload))
    return frame[column].tolist()


# @AC-FR001-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_csv_export_applies_configured_number_format(app_context: None) -> None:
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}},
    )
    df = pd.DataFrame({"amount": [19.7999992]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    assert "19.8" in text
    assert "19.7999992" not in text


# @AC-FR001-03
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_csv_export_unformattable_value_takes_fixed_point_fallback(
    app_context: None,
) -> None:
    processor = _make_processor(ChartDataResultFormat.CSV, {})
    df = pd.DataFrame({"amount": [Decimal("19.7999992")]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    # Exact fixed-point text, never a float repr / scientific notation.
    assert "19.7999992" in text
    assert "e" not in text.lower().split("amount")[-1]


# @AC-FR002-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_xlsx_export_matches_csv_for_shared_column(app_context: None) -> None:
    form_data = {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}}

    csv_processor = _make_processor(ChartDataResultFormat.CSV, form_data)
    csv_result = csv_processor.get_data(
        pd.DataFrame({"amount": [19.7999992]}), [GenericDataType.NUMERIC]
    )
    csv_value = _csv_text(csv_result).splitlines()[1].strip()

    xlsx_processor = _make_processor(ChartDataResultFormat.XLSX, form_data)
    xlsx_result = xlsx_processor.get_data(
        pd.DataFrame({"amount": [19.7999992]}), [GenericDataType.NUMERIC]
    )
    xlsx_value = _read_xlsx_column(xlsx_result, "amount")[0]

    # Both formats display 19.8 for the same source value; the formatted text is
    # now kept as a string in XLSX too, so the configured decimals survive.
    assert str(xlsx_value) == csv_value == "19.8"


# @AC-FR004-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_csv_escapes_formatted_formula_prefixed_value(app_context: None) -> None:
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {"column_config": {"amount": {"d3NumberFormat": "+,.1f"}}},
    )
    df = pd.DataFrame({"amount": [19.7999992]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    # The formatter emits "+19.8"; escaping (which runs after formatting)
    # must prefix the formula-like value with a single quote.
    assert "'+19.8" in text


# @AC-FR004-02
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_xlsx_quotes_formatted_formula_prefixed_value(app_context: None) -> None:
    processor = _make_processor(
        ChartDataResultFormat.XLSX,
        {"column_config": {"amount": {"d3NumberFormat": "+,.2f"}}},
    )
    df = pd.DataFrame({"amount": [1234567.891]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    # The formatter emits "+1,234,567.89"; formula-quoting (which runs after
    # formatting) must prefix the formula-like value with a single quote.
    value = _read_xlsx_column(result, "amount")[0]
    assert value == "'+1,234,567.89"


# @AC-FR006-02
def test_flag_off_csv_and_xlsx_byte_identical(app_context: None) -> None:
    form_data = {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}}

    csv_processor = _make_processor(ChartDataResultFormat.CSV, form_data)
    csv_result = csv_processor.get_data(
        pd.DataFrame({"amount": [19.7999992]}), [GenericDataType.NUMERIC]
    )
    # Flag defaults to False: the raw float survives unformatted.
    assert b"19.7999992" in csv_result
    assert b"19.8" not in csv_result

    xlsx_processor = _make_processor(ChartDataResultFormat.XLSX, form_data)
    xlsx_result = xlsx_processor.get_data(
        pd.DataFrame({"amount": [19.7999992]}), [GenericDataType.NUMERIC]
    )
    assert _read_xlsx_column(xlsx_result, "amount")[0] == 19.7999992


# @AC-FR005-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_json_result_unchanged_by_formatting_stage(app_context: None) -> None:
    processor = _make_processor(
        ChartDataResultFormat.JSON,
        {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}},
    )
    df = pd.DataFrame({"amount": [19.7999992]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    # JSON path returns records before the table_like formatting stage.
    assert result == [{"amount": 19.7999992}]


# @AC-FR001-02
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_csv_export_de_locale_formats_consistently(app_context: None, mocker) -> None:
    # A ``de`` request locale drives the currency symbol position; the d3 number
    # grammar itself is locale-independent, matching the frontend d3-format.
    mocker.patch("superset.utils.number_format.get_locale", return_value="de_DE")
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {
            "column_config": {
                "amount": {
                    "d3NumberFormat": ",.2f",
                    "currencyFormat": {"symbol": "EUR", "symbolPosition": None},
                }
            }
        },
    )
    df = pd.DataFrame({"amount": [1234.5]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    # Consistent localized currency text: no raw float survives, and the value
    # is not coerced to a date.
    assert "€" in text
    assert "1234.5" not in text
    assert "1,234.50" in text
    assert "Mai" not in text


# @AC-FR002-02
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_xlsx_export_de_locale_value_not_date_coerced(
    app_context: None, mocker
) -> None:
    # A localized currency value stays a string through the XLSX text path;
    # ``apply_column_types`` cannot re-coerce it to a number (or a date).
    mocker.patch("superset.utils.number_format.get_locale", return_value="de_DE")
    processor = _make_processor(
        ChartDataResultFormat.XLSX,
        {
            "column_config": {
                "amount": {
                    "d3NumberFormat": ",.2f",
                    "currencyFormat": {"symbol": "EUR", "symbolPosition": None},
                }
            }
        },
    )
    df = pd.DataFrame({"amount": [1234.5]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    value = _read_xlsx_column(result, "amount")[0]
    # The cell is the formatted string, never a datetime and never "03. Mai".
    assert isinstance(value, str)
    assert "€" in value
    assert "1,234.50" in value
    assert not isinstance(value, pd.Timestamp)
    assert "Mai" not in value


# @AC-FR005-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_arrow_result_byte_identical_with_flag_on(app_context: None) -> None:
    form_data = {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}}
    source = pd.DataFrame({"amount": [19.7999992]})

    on_processor = _make_processor(ChartDataResultFormat.ARROW, form_data)
    on_bytes = on_processor.get_data(source.copy(), [GenericDataType.NUMERIC])

    # Re-serialize the untouched frame independently: the formatting stage runs
    # only on the table_like branch, so Arrow must be byte-for-byte identical.
    reference = QueryContextProcessor._to_arrow_ipc(source.copy())

    assert isinstance(on_bytes, bytes)
    assert on_bytes == reference


# @AC-FR005-01
def test_arrow_result_identical_regardless_of_flag(app_context: None) -> None:
    # The flag-off Arrow bytes equal the independently serialized reference too,
    # confirming the stage never touches the Arrow branch in either state.
    form_data = {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}}
    source = pd.DataFrame({"amount": [19.7999992]})

    off_processor = _make_processor(ChartDataResultFormat.ARROW, form_data)
    off_bytes = off_processor.get_data(source.copy(), [GenericDataType.NUMERIC])
    reference = QueryContextProcessor._to_arrow_ipc(source.copy())

    assert off_bytes == reference


# @AC-FR005-02
def test_sql_lab_decimal_formatting_path_is_untouched() -> None:
    # Scope guard: the SQL Lab export helper keeps its own decimal handling and
    # never routes through the new chart-export helper.
    import inspect

    from superset.commands.sql_lab import export as sql_lab_export

    source = inspect.getsource(sql_lab_export)
    assert "apply_export_number_formats" not in source
    assert "EXPORT_FORMATTED_NUMBERS" not in source

    # And its behavior is unchanged: a finite decimal becomes fixed-point text
    # while floats/ints/None keep their types, with no d3 formatting applied.
    df = pd.DataFrame(
        {"amount": [Decimal("19.7999992"), 3.0, None]},
        dtype=object,
    )

    sql_lab_export._format_decimal_columns(df)

    values = df["amount"].tolist()
    assert values[0] == "19.7999992"
    assert values[1] == 3.0
    assert values[2] is None


# @AC-FR003-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_csv_export_null_nan_inf_pass_through(app_context: None) -> None:
    # Edge values through the full export path: no raise, nulls stay blank, and
    # a configured column still renders its finite cells.
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {"column_config": {"amount": {"d3NumberFormat": ",.1f"}}},
    )
    df = pd.DataFrame(
        {
            "label": ["ok", None, "z"],
            "amount": [19.75, float("nan"), float("inf")],
        }
    )

    result = processor.get_data(df, [GenericDataType.STRING, GenericDataType.NUMERIC])

    text = _csv_text(result)
    # The finite cell is formatted; the frame still has three data rows.
    assert "19.8" in text
    assert len(text.strip().splitlines()) == 1 + 3


# @AC-FR003-02
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_csv_export_unformattable_decimal_edge_values(app_context: None) -> None:
    # Fixed-point fallback over a column with no config: finite decimals become
    # exact text, non-finite decimals and None pass through without raising.
    processor = _make_processor(ChartDataResultFormat.CSV, {})
    df = pd.DataFrame(
        {"amount": [Decimal("19.7999992"), Decimal("NaN"), None]},
        dtype=object,
    )

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    assert "19.7999992" in text
    # No scientific notation leaked into the serialized decimal.
    assert "e+" not in text.lower()


# @AC-FR002-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_xlsx_export_keeps_configured_trailing_decimals(app_context: None) -> None:
    # A ",.2f" format renders 3.5 as "3.50"; the XLSX cell must stay text so the
    # trailing zero is not coerced back to the number 3.5 by apply_column_types.
    # (pd.read_excel would re-infer a numeric-looking string, so read the raw
    # cell via openpyxl to observe what was actually stored.)
    from openpyxl import load_workbook

    processor = _make_processor(
        ChartDataResultFormat.XLSX,
        {"column_config": {"amount": {"d3NumberFormat": ",.2f"}}},
    )
    df = pd.DataFrame({"amount": [3.5]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    assert isinstance(result, bytes)
    cell = load_workbook(io.BytesIO(result)).active["A2"]
    assert cell.data_type == "s"
    assert cell.value == "3.50"


# @AC-FR001-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_chart_config_format_wins_over_saved_datasource_format(
    app_context: None,
) -> None:
    # A chart's column_config override must win over the datasource's saved
    # per-metric format and currency, pinning the config.get(...) precedence in
    # apply_export_number_formats (a saved ",.2f"/USD would otherwise leak).
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {
            "column_config": {
                "amount": {
                    "d3NumberFormat": ",.1f",
                    "currencyFormat": {"symbol": "EUR", "symbolPosition": None},
                }
            }
        },
        datasource_data={
            "column_formats": {"amount": ",.2f"},
            "currency_formats": {"amount": {"symbol": "USD"}},
        },
    )
    df = pd.DataFrame({"amount": [1234.5]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    # The chart override (one decimal, EUR) wins over the saved format.
    assert "€" in text
    assert "1,234.5" in text
    assert "1,234.50" not in text
    assert "$" not in text


# @AC-FR001-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_small_number_format_forwarded_to_export(app_context: None) -> None:
    # The column's d3SmallNumberFormat is applied per cell: a sub-one value takes
    # it while larger values keep the column's normal format, matching the chart.
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {
            "column_config": {
                "amount": {
                    "d3NumberFormat": ",.0f",
                    "d3SmallNumberFormat": ",.1%",
                }
            }
        },
    )
    df = pd.DataFrame({"amount": [0.125, 5.0]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    # Sub-one value rendered by the small-number format, the other by the main.
    assert "12.5%" in text
    assert "5" in text


# @AC-FR001-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_post_processed_export_skips_pre_pivot_formatting(app_context: None) -> None:
    # A POST_PROCESSED export for a post-processor viz_type (table/pivot_table_v2)
    # is re-parsed and pivoted by apply_client_processing, so get_data must leave
    # the raw numbers here to avoid turning a formatted thousands string into NaN;
    # formatting happens after post-processing.
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {
            "viz_type": "pivot_table_v2",
            "column_config": {"amount": {"d3NumberFormat": ",.1f"}},
        },
        result_type=ChartDataResultType.POST_PROCESSED,
    )
    df = pd.DataFrame({"amount": [19.7999992]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    # Raw value survives: the pre-pivot formatting stage was skipped.
    assert "19.7999992" in text
    assert "19.8" not in text


# @AC-FR001-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_post_processed_export_without_post_processor_is_formatted(
    app_context: None,
) -> None:
    # A POST_PROCESSED export for a viz_type with no post-processor (e.g.
    # ag-grid-table, as scheduled reports/alerts request) is returned unchanged
    # by apply_client_processing, so get_data must still format it here.
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        {
            "viz_type": "ag-grid-table",
            "column_config": {"amount": {"d3NumberFormat": ",.1f"}},
        },
        result_type=ChartDataResultType.POST_PROCESSED,
    )
    df = pd.DataFrame({"amount": [19.7999992]})

    result = processor.get_data(df, [GenericDataType.NUMERIC])

    text = _csv_text(result)
    assert "19.8" in text
    assert "19.7999992" not in text


# @AC-FR001-01
@with_feature_flags(EXPORT_FORMATTED_NUMBERS=True)
def test_post_processed_export_formatted_by_client_processing(
    app_context: None,
) -> None:
    # Round trip: get_data skips the pre-pivot stage for a post-processor
    # viz_type, so the numbers must be formatted by apply_client_processing after
    # the pivot/table arithmetic. This fails if that post-processing formatting
    # branch regresses -- get_data alone would ship an unformatted aggregate.
    from superset.charts.client_processing import apply_client_processing

    form_data = {
        "viz_type": "table",
        "column_config": {"amount": {"d3NumberFormat": ",.2f"}},
    }
    processor = _make_processor(
        ChartDataResultFormat.CSV,
        form_data,
        result_type=ChartDataResultType.POST_PROCESSED,
    )
    df = pd.DataFrame({"amount": [2234.5]})

    raw = processor.get_data(df, [GenericDataType.NUMERIC])
    # Pre-pivot formatting was skipped: the aggregate is still unformatted here.
    assert "2,234.50" not in _csv_text(raw)

    result = {
        "queries": [{"result_format": ChartDataResultFormat.CSV, "data": raw}],
    }
    processed = apply_client_processing(result, form_data, None)

    assert "2,234.50" in processed["queries"][0]["data"]
