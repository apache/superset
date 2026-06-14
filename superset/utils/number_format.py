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
"""
Server-side port of the d3-format based number and currency formatters used by
the Table and Pivot Table chart plugins.

Report notifications that embed a chart as text build the table in Python and
have no access to the frontend formatters, so chart number/currency format
configuration has to be reproduced here to render the same values an end user
sees in the browser.
"""

from __future__ import annotations

import math
import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from babel.numbers import get_currency_symbol

SMART_NUMBER = "SMART_NUMBER"
SMART_NUMBER_SIGNED = "SMART_NUMBER_SIGNED"

LOCALE = "en_US"

# SI prefixes keyed by their power-of-1000 exponent, mirroring d3-format.
SI_PREFIXES = {
    -8: "y",
    -7: "z",
    -6: "a",
    -5: "f",
    -4: "p",
    -3: "n",
    -2: "µ",
    -1: "m",
    0: "",
    1: "k",
    2: "M",
    3: "G",
    4: "T",
    5: "P",
    6: "E",
    7: "Z",
    8: "Y",
}

# d3-format specifier grammar:
# [[fill]align][sign][symbol][0][width][,][.precision][~][type]
D3_FORMAT_RE = re.compile(
    r"^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(?:\.(\d+))?(~)?([a-z%])?$",
    re.IGNORECASE,
)


def format_number_with_config(
    d3_format: str | None,
    currency: dict[str, Any] | None,
    value: Any,
) -> Any:
    """
    Format ``value`` using a d3-format string and optional currency config.

    :param d3_format: a d3-format specifier (e.g. ``",.2f"``) or ``SMART_NUMBER``
    :param currency: ``{"symbol": <ISO 4217>, "symbolPosition": "prefix"|"suffix"}``
    :param value: the raw value to format
    :return: the formatted string, or the value unchanged when it is not a
        number that can be formatted
    """
    if value is None:
        return ""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return value
    if math.isnan(value) or math.isinf(value):
        return ""

    try:
        if currency and currency.get("symbol"):
            # the frontend strips the currency symbol from the d3 format and
            # falls back to SMART_NUMBER when no explicit format is set
            number_format = (d3_format or SMART_NUMBER).replace("$", "")
            return apply_currency(format_numeric(number_format, value), currency)
        if not d3_format:
            return raw_string(value)
        return format_numeric(d3_format, value)
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        # never let an unexpected value break a whole report table
        return raw_string(value)


def format_numeric(d3_format: str, value: float) -> str:
    if d3_format in (SMART_NUMBER, SMART_NUMBER_SIGNED):
        return format_smart_number(value, signed=d3_format == SMART_NUMBER_SIGNED)
    return format_d3(d3_format, value)


def format_d3(d3_format: str, value: float) -> str:
    match = D3_FORMAT_RE.match(d3_format)
    if not match:
        raise ValueError(d3_format)

    sign = "+" if match.group(3) == "+" else ""
    currency_symbol = match.group(4) == "$"
    comma = "," if match.group(7) else ""
    precision = int(match.group(8)) if match.group(8) is not None else None
    trim = bool(match.group(9))
    type_ = (match.group(10) or "").lower()

    if type_ == "s":
        formatted = format_si(value, precision if precision is not None else 6, trim)
    elif type_ == "r":
        formatted = format_significant(
            value, precision if precision is not None else 6, trim, sign, comma
        )
    else:
        if type_ == "d":
            formatted = format(int(quantize_half_up(value, 0)), f"{sign}{comma}d")
        else:
            decimals = f".{precision}" if precision is not None else ""
            formatted = format(value, f"{sign}{comma}{decimals}{type_}")
            formatted = normalize_exponent(formatted)
        formatted = trim_trailing_zeros(formatted) if trim else formatted

    if currency_symbol:
        formatted = prepend_currency_symbol(formatted)
    return formatted


def format_smart_number(value: float, signed: bool = False) -> str:
    if value == 0:
        body = "0"
    else:
        absolute = abs(value)
        if absolute >= 1000:
            body = format_si(value, 3, trim=True, billions=True)
        elif absolute >= 1:
            body = trim_trailing_zeros(format(value, ".2f"))
        elif absolute >= 0.001:
            body = trim_trailing_zeros(format(value, ".4f"))
        elif absolute > 0.000001:
            body = format_si(value * 1000000, 3, trim=True) + "µ"
        else:
            body = format_si(value, 3, trim=True)
    prefix = "+" if signed and value > 0 else ""
    return prefix + body


def format_si(value: float, precision: int, trim: bool, billions: bool = False) -> str:
    if value == 0:
        return format_significant(0.0, precision, trim)

    exponent = max(-8, min(8, math.floor(math.log10(abs(value))) // 3))
    mantissa = value / (10 ** (exponent * 3))
    # rounding can push the mantissa up to the next SI bracket (e.g. 999.5k)
    if abs(round_to_significant(mantissa, precision)) >= 1000 and exponent < 8:
        exponent += 1
        mantissa = value / (10 ** (exponent * 3))

    symbol = SI_PREFIXES[exponent]
    if billions and symbol == "G":
        symbol = "B"

    return format_significant(mantissa, precision, trim) + symbol


def format_significant(
    value: float, precision: int, trim: bool, sign: str = "", comma: str = ""
) -> str:
    """
    Format to `precision` significant digits in fixed-point notation.

    Serves both the d3 `r` type and SI mantissas, and avoids the scientific
    notation Python's `g` would switch to.
    """
    rounded = round_to_significant(value, precision)
    decimals = decimals_for_significant(rounded, precision)
    formatted = format(rounded, f"{sign}{comma}.{decimals}f")
    return trim_trailing_zeros(formatted) if trim else formatted


def round_to_significant(value: float, precision: int) -> float:
    if value == 0:
        return 0.0
    return float(
        quantize_half_up(value, precision - 1 - math.floor(math.log10(abs(value))))
    )


def quantize_half_up(value: float, decimals: int) -> Decimal:
    """Round to `decimals` places, half away from zero, matching d3-format."""
    return Decimal(str(value)).quantize(
        Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP
    )


def decimals_for_significant(value: float, precision: int) -> int:
    integer_digits = 1 if value == 0 else math.floor(math.log10(abs(value))) + 1
    return max(0, precision - integer_digits)


def normalize_exponent(formatted: str) -> str:
    """Drop leading zeros in a scientific exponent (1e+07 -> 1e+7), as d3 does."""
    return re.sub(r"([eE][+-])0*(\d)", r"\1\2", formatted)


def prepend_currency_symbol(formatted: str) -> str:
    if formatted[:1] in "+-":
        return f"{formatted[0]}${formatted[1:]}"
    return f"${formatted}"


def apply_currency(formatted: str, currency: dict[str, Any]) -> str:
    normalized = formatted.replace("%", "")
    code = currency["symbol"]
    symbol = get_currency_symbol(code, locale=LOCALE) or code
    if currency.get("symbolPosition") == "prefix":
        return f"{symbol} {normalized}"
    return f"{normalized} {symbol}"


def trim_trailing_zeros(formatted: str) -> str:
    suffix = "%" if formatted.endswith("%") else ""
    body = formatted[: -len(suffix)] if suffix else formatted
    if "." in body:
        body = body.rstrip("0").rstrip(".")
    return body + suffix


def raw_string(value: float) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
