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

Only d3-format specifiers (and the ``SMART_NUMBER`` pseudo-formats) are ported.
Non-d3 presets such as ``DURATION``, ``DURATION_SUB`` and the ``MEMORY_*``
formatters are not supported: they do not parse as a d3 specifier and fall back
to the raw value, so a column using one of those renders unformatted in reports.
"""

from __future__ import annotations

import math
import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from babel.numbers import get_currency_symbol

SMART_NUMBER = "SMART_NUMBER"
SMART_NUMBER_SIGNED = "SMART_NUMBER_SIGNED"
AUTO_CURRENCY = "AUTO"

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
    if isinstance(value, bool) or not isinstance(value, (int, float, Decimal)):
        return value
    if isinstance(value, Decimal):
        value = float(value)
    if math.isnan(value) or math.isinf(value):
        return ""

    try:
        if currency and currency.get("symbol"):
            # the frontend strips the currency symbol from the d3 format and
            # falls back to SMART_NUMBER when no explicit format is set
            number_format = (d3_format or SMART_NUMBER).replace("$", "")
            formatted = format_numeric(number_format, value)
            if currency["symbol"] == AUTO_CURRENCY:
                return formatted
            return apply_currency(formatted, currency)
        if not d3_format:
            return raw_string(value)
        return format_numeric(d3_format, value)
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        # never let an unexpected value break a whole report table
        return raw_string(value)


def format_numeric(d3_format: str, value: float) -> str:
    """
    Format ``value`` according to a d3 number format.

    Delegates to the smart-number formatter for the ``SMART_NUMBER`` and
    ``SMART_NUMBER_SIGNED`` pseudo-formats, and to the d3 specifier parser for
    every other format string.
    """
    if d3_format in (SMART_NUMBER, SMART_NUMBER_SIGNED):
        return format_smart_number(value, signed=d3_format == SMART_NUMBER_SIGNED)
    return format_d3(d3_format, value)


def format_d3(d3_format: str, value: float) -> str:
    """
    Format ``value`` with a d3-format specifier.

    Supports the subset of the specifier grammar the Table/Pivot plugins emit:
    the ``+ - ( space`` sign modes, the ``$`` currency prefix, the ``,`` group
    separator, ``.precision``, the ``~`` trim flag, and the ``s`` (SI), ``r``
    (significant), ``d`` (integer), ``f``/``e``/``g``/``%`` numeric types.
    Returns the formatted string and raises ``ValueError`` for an unparseable
    specifier.
    """
    match = D3_FORMAT_RE.match(d3_format)
    if not match:
        raise ValueError(d3_format)

    sign_mode = match.group(3) or "-"
    currency_symbol = match.group(4) == "$"
    comma = "," if match.group(7) else ""
    precision = int(match.group(8)) if match.group(8) is not None else None
    trim = bool(match.group(9))
    type_ = (match.group(10) or "").lower()

    magnitude = abs(value)
    if type_ == "s":
        formatted = format_si(
            magnitude, precision if precision is not None else 6, trim
        )
    elif type_ == "r":
        formatted = format_significant(
            magnitude, precision if precision is not None else 6, trim, comma
        )
    elif type_ == "" and precision is None:
        formatted = format_default(magnitude, comma)
    else:
        if type_ == "d":
            formatted = format(int(quantize_half_up(magnitude, 0)), f"{comma}d")
        elif type_ in ("f", "%") and precision is not None:
            scaled = magnitude * 100 if type_ == "%" else magnitude
            suffix = "%" if type_ == "%" else ""
            rounded = quantize_half_up(scaled, precision)
            formatted = format(rounded, f"{comma}.{precision}f") + suffix
        else:
            decimals = f".{precision}" if precision is not None else ""
            formatted = format(magnitude, f"{comma}{decimals}{type_}")
            formatted = normalize_exponent(formatted)
        formatted = trim_trailing_zeros(formatted) if trim else formatted

    if currency_symbol:
        formatted = f"${formatted}"
    return apply_sign(formatted, value, sign_mode)


def apply_sign(formatted: str, value: float, sign_mode: str) -> str:
    """
    Decorate a formatted magnitude with the d3 sign mode.

    Negative values get a leading ``-`` (or wrapping parentheses for the ``(``
    accounting mode); positive values get a ``+`` or a leading space only for the
    ``+`` and space modes respectively.
    """
    if value < 0:
        return f"({formatted})" if sign_mode == "(" else f"-{formatted}"
    if sign_mode == "+":
        return f"+{formatted}"
    if sign_mode == " ":
        return f" {formatted}"
    return formatted


def format_default(value: float, comma: str) -> str:
    """
    Format ``value`` the way d3's default (no-type) specifier does.

    Mirrors JavaScript's ``Number.toString``: the shortest decimal representation
    with optional grouping and no trailing zeros, so whole-valued floats render
    without a spurious ``.0`` (``4725.0`` -> ``4,725``) and small values stay in
    fixed-point notation (``0.00005`` rather than ``5e-5``).
    """
    formatted = format(Decimal(repr(value)), f"{comma}f")
    return trim_trailing_zeros(formatted)


def format_smart_number(value: float, signed: bool = False) -> str:
    """
    Format ``value`` the way the frontend ``SMART_NUMBER`` formatter does.

    The notation is chosen by magnitude: SI prefixes (with ``G`` shown as ``B``)
    for ``abs(value) >= 1000``, two decimals down to ``1``, four decimals down to
    ``0.001``, a micro (``µ``) suffix down to ``1e-6``, and SI prefixes again
    below that. When ``signed`` is set, positive values are prefixed with ``+``.
    """
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
    """
    Format ``value`` with an SI prefix to ``precision`` significant digits.

    Rounds to ``precision`` significant figures first, then scales into the
    nearest power-of-1000 bracket (clamped to the ``y``..``Y`` range) and appends
    the matching SI symbol. Rounding before the divide matches d3 and keeps
    ``4725`` at ``4.73k`` (the inexact ``4.725`` mantissa would round to
    ``4.72k``), and lets a value that rounds up into the next bracket pick the
    right symbol (``999.5k`` -> ``1M``). With ``billions`` set, the ``G`` (giga)
    symbol is rendered as ``B``.
    """
    if value == 0:
        return format_significant(0.0, precision, trim)

    rounded = round_to_significant(value, precision)
    exponent = max(-8, min(8, math.floor(math.log10(abs(rounded))) // 3))
    mantissa = rounded / (10 ** (exponent * 3))

    symbol = SI_PREFIXES[exponent]
    if billions and symbol == "G":
        symbol = "B"

    return format_significant(mantissa, precision, trim) + symbol


def format_significant(
    value: float, precision: int, trim: bool, comma: str = ""
) -> str:
    """
    Format to `precision` significant digits in fixed-point notation.

    Serves both the d3 `r` type and SI mantissas, and avoids the scientific
    notation Python's `g` would switch to.
    """
    rounded = round_to_significant(value, precision)
    decimals = decimals_for_significant(rounded, precision)
    formatted = format(rounded, f"{comma}.{decimals}f")
    return trim_trailing_zeros(formatted) if trim else formatted


def round_to_significant(value: float, precision: int) -> float:
    """
    Round ``value`` to ``precision`` significant digits.

    The number of decimal places to keep is derived from the value's order of
    magnitude (``precision - 1 - floor(log10(abs(value)))``) and the rounding is
    half away from zero, matching d3-format.
    """
    if value == 0:
        return 0.0
    return float(
        quantize_half_up(value, precision - 1 - math.floor(math.log10(abs(value))))
    )


def quantize_half_up(value: float, decimals: int) -> Decimal:
    """
    Round to `decimals` places, half away from zero, matching d3-format.

    Quantizes the binary float value (not its decimal string) so the result
    matches d3, which rounds the IEEE-754 value: ``2.675`` is ``2.67`` because it
    is really ``2.67499...``, while an exact ``0.125`` rounds up to ``0.13``.
    """
    return Decimal(value).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)


def decimals_for_significant(value: float, precision: int) -> int:
    integer_digits = 1 if value == 0 else math.floor(math.log10(abs(value))) + 1
    return max(0, precision - integer_digits)


def normalize_exponent(formatted: str) -> str:
    """Drop leading zeros in a scientific exponent (1e+07 -> 1e+7), as d3 does."""
    return re.sub(r"([eE][+-])0*(\d)", r"\1\2", formatted)


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
