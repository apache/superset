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
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from flask import current_app

from superset.utils.number_format import (
    format_d3,
    format_default,
    format_number_with_config,
    format_numeric,
    get_currency_locale,
    resolve_auto_currency,
    resolve_symbol_position,
)

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
def test_format_number(d3_format: str | None, value: Any, expected: Any) -> None:
    assert format_number_with_config(d3_format, None, value) == expected


@pytest.mark.parametrize(
    "currency,value,expected",
    [
        ({"symbol": "USD", "symbolPosition": "prefix"}, 1234.5, "$ 1,234.50"),
        ({"symbol": "EUR", "symbolPosition": "suffix"}, 1234.5, "1,234.50 €"),
        ({"symbol": "BRL", "symbolPosition": None}, 1234.5, "R$ 1,234.50"),
        ({"symbol": "ZZZ", "symbolPosition": None}, 1234.5, "ZZZ 1,234.50"),
    ],
)
def test_format_number_with_currency(
    currency: dict[str, Any], value: float, expected: str
) -> None:
    assert format_number_with_config(",.2f", currency, value) == expected


def test_currency_defaults_to_smart_number_when_no_d3_format() -> None:
    assert (
        format_number_with_config(
            None, {"symbol": "USD", "symbolPosition": "prefix"}, 1234567
        )
        == "$ 1.23M"
    )


def test_auto_currency_formats_without_symbol() -> None:
    assert (
        format_number_with_config(
            ",.2f", {"symbol": "AUTO", "symbolPosition": "prefix"}, 1234.5
        )
        == "1,234.50"
    )


def test_resolve_auto_currency_uses_detected_single_currency() -> None:
    currency = {"symbol": "AUTO", "symbolPosition": "prefix"}
    assert resolve_auto_currency(currency, "USD") == {
        "symbol": "USD",
        "symbolPosition": "prefix",
    }
    assert resolve_auto_currency(currency, None) is currency
    explicit = {"symbol": "EUR", "symbolPosition": "suffix"}
    assert resolve_auto_currency(explicit, "USD") is explicit


def test_resolve_auto_currency_prefers_cell_context_and_detects_mixed() -> None:
    currency = {"symbol": "AUTO", "symbolPosition": "prefix"}

    assert resolve_auto_currency(
        currency, "GBP", currency_context=frozenset({" usd "})
    ) == {"symbol": "USD", "symbolPosition": "prefix"}
    assert (
        resolve_auto_currency(
            currency, "GBP", currency_context=frozenset({"USD", "EUR"})
        )
        is currency
    )
    assert resolve_auto_currency(currency, "GBP", currency_context=frozenset()) == {
        "symbol": "GBP",
        "symbolPosition": "prefix",
    }
    assert (
        resolve_auto_currency(
            currency,
            "GBP",
            currency_context=frozenset(),
            fallback_to_detected=False,
        )
        is currency
    )


@pytest.mark.parametrize("missing", [float("nan"), pd.NA, pd.NaT])
def test_resolve_auto_currency_coerces_non_iterable_context(missing: Any) -> None:
    """
    A sparse 2D pivot leaves missing cells as a scalar missing value rather than
    an empty tuple. AUTO resolution must treat any non-iterable context (the
    ``np.nan`` the live path produces, plus other pandas sentinels) as empty
    instead of raising ``TypeError`` on ``list(context)``. ``missing`` is typed
    ``Any`` on purpose: it pins the runtime guard without widening the narrow
    ``Iterable[Any] | float | None`` contract to cover these sentinels.
    """
    currency = {"symbol": "AUTO", "symbolPosition": "prefix"}

    # A missing context with fallback enabled behaves like an empty context and
    # uses the query-wide detected currency.
    assert resolve_auto_currency(currency, "GBP", currency_context=missing) == {
        "symbol": "GBP",
        "symbolPosition": "prefix",
    }

    # A missing context without fallback keeps AUTO, like the empty-context path.
    assert (
        resolve_auto_currency(
            currency,
            "GBP",
            currency_context=missing,
            fallback_to_detected=False,
        )
        is currency
    )


@pytest.mark.parametrize(
    "value,expected",
    [
        (5e-7, "5e-7"),
        (9.999999e-7, "9.999999e-7"),
        (1e-6, "0.000001"),
        (999_999_999_999, "999,999,999,999"),
        (1e12, "1e+12"),
        (1e20, "1e+20"),
        (999_999_999_999_999_900_000, "1e+21"),
        (1e21, "1e+21"),
    ],
)
def test_default_format_matches_d3_exponent_boundaries(
    value: float, expected: str
) -> None:
    assert format_number_with_config(",", None, value) == expected


def test_currency_position_uses_request_locale() -> None:
    with patch("superset.utils.number_format.get_locale", return_value="fr_FR"):
        assert (
            format_number_with_config(
                ",.2f", {"symbol": "EUR", "symbolPosition": None}, 1234.5
            )
            == "1,234.50 €"
        )


def test_currency_position_uses_configured_locale_without_request() -> None:
    with (
        patch("superset.utils.number_format.get_locale", return_value=None),
        patch.dict(current_app.config, {"BABEL_DEFAULT_LOCALE": "fr_FR"}),
    ):
        assert (
            format_number_with_config(
                ",.2f", {"symbol": "EUR", "symbolPosition": None}, 1234.5
            )
            == "1,234.50 €"
        )


@pytest.mark.parametrize(
    "code,locale,expected",
    [
        ("USD", "en_US", "prefix"),
        ("EUR", "fr_FR", "suffix"),
        ("ZZZ", "not_a_locale", "prefix"),
    ],
)
def test_resolve_symbol_position(code: str, locale: str, expected: str) -> None:
    resolve_symbol_position.cache_clear()
    assert resolve_symbol_position(code, locale) == expected


def test_get_currency_locale_handles_missing_babel_and_app_context() -> None:
    app = MagicMock()
    with (
        patch("superset.utils.number_format.get_locale", side_effect=RuntimeError),
        patch("superset.utils.number_format.current_app", app),
    ):
        app.config.get.return_value = "de_DE"
        assert get_currency_locale() == "de_DE"

        app.config.get.side_effect = RuntimeError
        assert get_currency_locale() == "en"


def test_non_numeric_value_is_returned_as_is() -> None:
    assert format_number_with_config(",.2f", None, "abc") == "abc"
    assert format_number_with_config(",.2f", None, None) == ""


def test_currency_error_keeps_formatted_number() -> None:
    assert (
        format_number_with_config(
            ",.2f", {"symbol": {"bad": 1}, "symbolPosition": "prefix"}, 1234.5
        )
        == "1,234.50"
    )


def test_decimal_values_are_formatted() -> None:
    assert format_number_with_config(",.2f", None, Decimal("1234.5")) == "1,234.50"
    assert (
        format_number_with_config(
            ",.2f", {"symbol": "USD", "symbolPosition": "prefix"}, Decimal("1234.5")
        )
        == "$ 1,234.50"
    )
    assert format_number_with_config(",.2f", None, Decimal("NaN")) == ""


# --- Parity with the frontend d3-format --------------------------------------
#
# EXPECTED is the authoritative output of the frontend's ``d3-format`` (the same
# library the Table/Pivot charts render with) for every number preset in
# ``D3_FORMAT_OPTIONS``. Regenerate from ``superset-frontend`` with::
#
#     node -e 'const {format}=require("d3-format");
#     const p=["~g",",d",".1s",".3s",",.1%",".2%",".3%",".4r",
#              ",.1f",",.2f",",.3f","+,","$,.2f"];
#     const v=[12345.432,0,4725.0,80679663,1234567890,-1234.5,
#              0.0123,999.9,1000.0];
#     const o={}; for(const f of p){o[f]={};
#       for(const x of v) o[f][x]=format(f)(x);}
#     console.log(JSON.stringify(o));'
#
# One intentional deviation: d3 emits a Unicode minus (U+2212); the Python helper
# emits an ASCII "-" for email/CSV safety, so the comparison normalizes it.

VALUES: list[float] = [
    12345.432,
    0,
    4725.0,
    80679663,
    1234567890,
    -1234.5,
    0.0123,
    999.9,
    1000.0,
]

EXPECTED: dict[str, list[str]] = {
    "~g": [
        "12345.4",
        "0",
        "4725",
        "8.06797e+7",
        "1.23457e+9",
        "−1234.5",
        "0.0123",
        "999.9",
        "1000",
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
        "1,000",
    ],  # noqa: E501
    ".1s": ["10k", "0", "5k", "80M", "1G", "−1k", "10m", "1k", "1k"],
    ".3s": [
        "12.3k",
        "0.00",
        "4.73k",
        "80.7M",
        "1.23G",
        "−1.23k",
        "12.3m",
        "1.00k",
        "1.00k",
    ],
    ",.1%": [
        "1,234,543.2%",
        "0.0%",
        "472,500.0%",
        "8,067,966,300.0%",
        "123,456,789,000.0%",
        "−123,450.0%",
        "1.2%",
        "99,990.0%",
        "100,000.0%",
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
        "100000.00%",
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
        "100000.000%",
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
        "1000",
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
        "1,000.0",
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
        "1,000.00",
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
        "1,000.000",
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
        "+1,000",
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
        "$1,000.00",
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
        "1,000.00",
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
        "$1,000.00",
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
        " 1,000.00",
    ],  # noqa: E501
}


@pytest.mark.parametrize("d3_format", list(EXPECTED))
def test_matches_frontend_d3_format(d3_format: str) -> None:
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
        ("+,", 1000.0, "+1,000"),
        ("+,", -1234.5, "-1,234.5"),
    ],
)
def test_default_format_matches_d3_for_floats(
    d3_format: str, value: float, expected: str
) -> None:
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
def test_rounding_matches_d3_binary_half_up(
    d3_format: str, value: float, expected: str
) -> None:
    assert format_number_with_config(d3_format, None, value) == expected


@pytest.mark.parametrize(
    "d3_format,value,expected",
    [
        ("~g", 0.00005, "0.00005"),
        ("~g", 0.000005, "0.000005"),
        (".0s", 4725, "5k"),
        (".0e", 2.5, "3e+0"),
        (".2~e", 1000, "1e+3"),
        (",.2f", 1e21, "1e+21"),
        (",.1%", 1e20, "1e+22%"),
    ],
)
def test_additional_d3_parity_cases(
    d3_format: str, value: float, expected: str
) -> None:
    assert format_number_with_config(d3_format, None, value) == expected


@pytest.mark.parametrize(
    "d3_format,value,expected",
    [
        ("SMART_NUMBER", 12.345, "12.35"),
        ("SMART_NUMBER", 0.12345, "0.1235"),
        ("SMART_NUMBER", 0.00005, "50µ"),
        ("SMART_NUMBER", 5e-7, "500n"),
        ("SMART_NUMBER_SIGNED", 12.345, "+12.35"),
        ("n", 1234.5, "1,234.50"),
        ("x", 12, "12"),
    ],
)
def test_number_format_branch_coverage(
    d3_format: str, value: float, expected: str
) -> None:
    assert format_number_with_config(d3_format, None, value) == expected


def test_default_helper_and_whole_float_fallback() -> None:
    assert format_default(1000, ",") == "1,000"
    assert format_number_with_config(None, None, 42.0) == "42"


@pytest.mark.parametrize(
    "preset",
    [
        "DURATION",
        "DURATION_SUB",
        "DURATION_COL",
        "MEMORY_DECIMAL",
        "MEMORY_BINARY",
        "MEMORY_TRANSFER_RATE_DECIMAL",
        "MEMORY_TRANSFER_RATE_BINARY",
    ],
)
def test_unported_frontend_presets_are_explicitly_rejected(preset: str) -> None:
    with pytest.raises(ValueError, match="not available"):
        format_numeric(preset, 66000)
    assert format_number_with_config(preset, None, 66000) == "66000"


@pytest.mark.parametrize("d3_format", ["08,.2f", "*>12,.2f"])
def test_unsupported_d3_padding_is_explicitly_rejected(d3_format: str) -> None:
    with pytest.raises(ValueError, match="padding"):
        format_d3(d3_format, 1234.5)
    assert format_number_with_config(d3_format, None, 1234.5) == "1234.5"
