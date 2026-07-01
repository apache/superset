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

from superset.utils.number_format import format_number_with_config

# --- Helper behaviour the d3 parity matrix below cannot cover ----------------


@pytest.mark.parametrize(
    "d3_format,value,expected",
    [
        # SMART_NUMBER is a Superset formatter (adaptive SI, half-up), not raw d3
        ("SMART_NUMBER", 4725, "4.73k"),
        ("SMART_NUMBER", 80679663, "80.7M"),
        ("SMART_NUMBER", 1234567890, "1.23B"),
        ("SMART_NUMBER", 0, "0"),
        (".2~f", 1200.0, "1200"),
        (None, 42, "42"),
        ("not-a-real-format!!", 42, "42"),
    ],
)
def test_format_number(d3_format, value, expected):
    assert format_number_with_config(d3_format, None, value) == expected


@pytest.mark.parametrize(
    "currency,value,expected",
    [
        ({"symbol": "USD", "symbolPosition": "prefix"}, 1234.5, "$ 1,234.50"),
        ({"symbol": "EUR", "symbolPosition": "suffix"}, 1234.5, "1,234.50 €"),
        # unknown symbolPosition defaults to suffix, mirroring the frontend
        ({"symbol": "BRL", "symbolPosition": None}, 1234.5, "1,234.50 R$"),
    ],
)
def test_format_number_with_currency(currency, value, expected):
    assert format_number_with_config(",.2f", currency, value) == expected


def test_currency_defaults_to_smart_number_when_no_d3_format():
    assert (
        format_number_with_config(
            None, {"symbol": "USD", "symbolPosition": "prefix"}, 1234567
        )
        == "$ 1.23M"
    )


def test_auto_currency_formats_without_symbol():
    assert (
        format_number_with_config(
            ",.2f", {"symbol": "AUTO", "symbolPosition": "prefix"}, 1234.5
        )
        == "1,234.50"
    )


def test_non_numeric_value_is_returned_as_is():
    assert format_number_with_config(",.2f", None, "abc") == "abc"
    assert format_number_with_config(",.2f", None, None) == ""


# --- Parity with the frontend d3-format --------------------------------------
#
# EXPECTED is the authoritative output of the frontend's ``d3-format`` (the same
# library the Table/Pivot charts render with) for every number preset in
# ``D3_FORMAT_OPTIONS``. Regenerate from ``superset-frontend`` with::
#
#     node -e 'const {format}=require("d3-format");
#     const p=["~g",",d",".1s",".3s",",.1%",".2%",".3%",".4r",
#              ",.1f",",.2f",",.3f","+,","$,.2f"];
#     const v=[12345.432,0,4725,80679663,1234567890,-1234.5,0.0123,999.9];
#     const o={}; for(const f of p){o[f]={};
#       for(const x of v) o[f][x]=format(f)(x);}
#     console.log(JSON.stringify(o));'
#
# One intentional deviation: d3 emits a Unicode minus (U+2212); the Python helper
# emits an ASCII "-" for email/CSV safety, so the comparison normalizes it.

VALUES = [12345.432, 0, 4725, 80679663, 1234567890, -1234.5, 0.0123, 999.9]

EXPECTED = {
    "~g": [
        "12345.4",
        "0",
        "4725",
        "8.06797e+7",
        "1.23457e+9",
        "−1234.5",
        "0.0123",
        "999.9",
    ],  # noqa: E501
    ",d": [
        "12,345",
        "0",
        "4,725",
        "80,679,663",
        "1,234,567,890",
        "−1,235",
        "0",
        "1,000",
    ],  # noqa: E501
    ".1s": ["10k", "0", "5k", "80M", "1G", "−1k", "10m", "1k"],
    ".3s": ["12.3k", "0.00", "4.73k", "80.7M", "1.23G", "−1.23k", "12.3m", "1.00k"],
    ",.1%": [
        "1,234,543.2%",
        "0.0%",
        "472,500.0%",
        "8,067,966,300.0%",
        "123,456,789,000.0%",
        "−123,450.0%",
        "1.2%",
        "99,990.0%",
    ],  # noqa: E501
    ".2%": [
        "1234543.20%",
        "0.00%",
        "472500.00%",
        "8067966300.00%",
        "123456789000.00%",
        "−123450.00%",
        "1.23%",
        "99990.00%",
    ],  # noqa: E501
    ".3%": [
        "1234543.200%",
        "0.000%",
        "472500.000%",
        "8067966300.000%",
        "123456789000.000%",
        "−123450.000%",
        "1.230%",
        "99990.000%",
    ],  # noqa: E501
    ".4r": [
        "12350",
        "0.000",
        "4725",
        "80680000",
        "1235000000",
        "−1235",
        "0.01230",
        "999.9",
    ],  # noqa: E501
    ",.1f": [
        "12,345.4",
        "0.0",
        "4,725.0",
        "80,679,663.0",
        "1,234,567,890.0",
        "−1,234.5",
        "0.0",
        "999.9",
    ],  # noqa: E501
    ",.2f": [
        "12,345.43",
        "0.00",
        "4,725.00",
        "80,679,663.00",
        "1,234,567,890.00",
        "−1,234.50",
        "0.01",
        "999.90",
    ],  # noqa: E501
    ",.3f": [
        "12,345.432",
        "0.000",
        "4,725.000",
        "80,679,663.000",
        "1,234,567,890.000",
        "−1,234.500",
        "0.012",
        "999.900",
    ],  # noqa: E501
    "+,": [
        "+12,345.432",
        "+0",
        "+4,725",
        "+80,679,663",
        "+1,234,567,890",
        "−1,234.5",
        "+0.0123",
        "+999.9",
    ],  # noqa: E501
    "$,.2f": [
        "$12,345.43",
        "$0.00",
        "$4,725.00",
        "$80,679,663.00",
        "$1,234,567,890.00",
        "−$1,234.50",
        "$0.01",
        "$999.90",
    ],  # noqa: E501
    "(,.2f": [
        "12,345.43",
        "0.00",
        "4,725.00",
        "80,679,663.00",
        "1,234,567,890.00",
        "(1,234.50)",
        "0.01",
        "999.90",
    ],  # noqa: E501
    "($,.2f": [
        "$12,345.43",
        "$0.00",
        "$4,725.00",
        "$80,679,663.00",
        "$1,234,567,890.00",
        "($1,234.50)",
        "$0.01",
        "$999.90",
    ],  # noqa: E501
    " ,.2f": [
        " 12,345.43",
        " 0.00",
        " 4,725.00",
        " 80,679,663.00",
        " 1,234,567,890.00",
        "−1,234.50",
        " 0.01",
        " 999.90",
    ],  # noqa: E501
}


@pytest.mark.parametrize("d3_format", list(EXPECTED))
def test_matches_frontend_d3_format(d3_format):
    for value, expected in zip(VALUES, EXPECTED[d3_format], strict=True):
        result = format_number_with_config(d3_format, None, value)
        assert result == expected.replace("−", "-"), (
            f"{d3_format!r} of {value}: got {result!r}, expected {expected!r}"
        )


@pytest.mark.parametrize(
    "d3_format,value,expected",
    [
        (",", 4725.0, "4,725"),
        (",", 1000.0, "1,000"),
        (",", 12345.432, "12,345.432"),
        (",", 4725.5, "4,725.5"),
        (",", 0.00005, "0.00005"),
        (",", -1234.5, "-1,234.5"),
        ("+,", 4725.0, "+4,725"),
        ("+,", -1234.5, "-1,234.5"),
    ],
)
def test_default_format_matches_d3_for_floats(d3_format, value, expected):
    assert format_number_with_config(d3_format, None, value) == expected


@pytest.mark.parametrize(
    "d3_format,value,expected",
    [
        (".2f", 0.125, "0.13"),
        ("$,.2f", 0.125, "$0.13"),
        (".0f", 2.5, "3"),
        (".1f", 0.25, "0.3"),
        (".0%", 0.125, "13%"),
        (".3s", 2.675, "2.67"),
        (".4r", 0.12345, "0.1235"),
        (".2f", 1.005, "1.00"),
        (".1f", 0.35, "0.3"),
    ],
)
def test_rounding_matches_d3_binary_half_up(d3_format, value, expected):
    assert format_number_with_config(d3_format, None, value) == expected
