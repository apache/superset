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
The duration, memory, and length formatters depend on separate frontend
factories and are explicitly rejected, causing the public wrapper to preserve
the raw value rather than silently misformat it. The fill/align/zero/width d3
flags are likewise rejected because report text has no equivalent of the
frontend's padding behavior. Accounting-parenthesis and space-sign modes are
supported.
"""

from __future__ import annotations

import math
import re
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
from typing import Any, Iterable

from babel.numbers import format_currency, get_currency_symbol
from flask import current_app
from flask_babel import get_locale

SMART_NUMBER: str = "SMART_NUMBER"
SMART_NUMBER_SIGNED: str = "SMART_NUMBER_SIGNED"
AUTO_CURRENCY: str = "AUTO"

UNSUPPORTED_FRONTEND_PRESETS: frozenset[str] = frozenset(
    {
        "DURATION",
        "DURATION_SUB",
        "DURATION_COL",
        "MEMORY_DECIMAL",
        "MEMORY_BINARY",
        "MEMORY_TRANSFER_RATE_DECIMAL",
        "MEMORY_TRANSFER_RATE_BINARY",
        "LENGTH",
        "LENGTH_CM_KM",
        "LENGTH_CM_M",
    }
)

DEFAULT_LOCALE: str = "en"
CURRENCY_SYMBOL_LOCALE: str = "en_US"

# SI prefixes keyed by their power-of-1000 exponent, mirroring d3-format.
SI_PREFIXES: dict[int, str] = {
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
D3_FORMAT_RE: re.Pattern[str] = re.compile(
    r"^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(?:\.(\d+))?(~)?([a-z%])?$",
    re.IGNORECASE,
)


def resolve_auto_currency(
    currency: dict[str, Any],
    detected_currency: str | None,
    currency_context: Iterable[Any] | float | None = None,
    fallback_to_detected: bool = True,
) -> dict[str, Any]:
    """
    Resolve an ``AUTO`` currency to the code detected from the data.

    Mirrors ``currency-format/utils.ts::resolveAutoCurrency`` and the per-cell
    handling in the Table and Pivot Table plugins. A single valid currency in
    ``currency_context`` takes precedence over the query-wide detection. Mixed
    cell currencies deliberately keep ``AUTO`` so the caller renders a neutral
    number. Empty cell context can use the detected fallback when the plugin's
    behavior allows it.

    :param currency_context: the currencies contributing to a cell. A dense
        pivot cell provides an iterable of codes, but a sparse 2D pivot passes a
        scalar ``NaN`` float for a missing cross-product cell (hence the ``float``
        arm); a missing/NaN/non-iterable context is treated as empty.
    :return: a copied config containing the detected code, or the input config
    """
    if currency.get("symbol") != AUTO_CURRENCY:
        return currency

    if currency_context is not None:
        # A dense pivot cell carries an iterable of currency codes, but a sparse
        # 2D pivot leaves missing cross-product cells as a scalar missing value
        # (``np.nan``; pandas never runs the union aggregator for them). Test
        # positively for an iterable so any non-iterable sentinel (``np.nan``,
        # ``pd.NA``, ``pd.NaT``) falls to the empty-context path instead of
        # raising and taking down the whole report.
        context_values: list[Any] = (
            list(currency_context) if isinstance(currency_context, Iterable) else []
        )
        normalized_currencies = {
            normalized
            for value in context_values
            if (normalized := normalize_currency(value)) is not None
        }
        if len(normalized_currencies) > 1:
            return currency
        if context_values and (cell_currency := normalize_currency(context_values[0])):
            return {**currency, "symbol": cell_currency}
        if not fallback_to_detected:
            return currency

    if detected_currency := normalize_currency(detected_currency):
        return {**currency, "symbol": detected_currency}
    return currency


def normalize_currency(value: Any) -> str | None:
    """
    Normalize a possible ISO-4217 code for AUTO currency resolution.

    Mirrors ``currency-format/CurrencyFormatter.ts::normalizeCurrency``:
    non-strings and values other than three ASCII letters are rejected, while
    valid strings are stripped and upper-cased.

    :return: the normalized three-letter code, or ``None``
    """
    if not isinstance(value, str):
        return None
    normalized = value.strip().upper()
    return normalized if re.fullmatch(r"[A-Z]{3}", normalized) else None


def format_number_with_config(
    d3_format: str | None,
    currency: dict[str, Any] | None,
    value: Any,
) -> Any:
    """
    Format ``value`` using a d3-format string and optional currency config.

    This is the report-side entry point corresponding to
    ``currency-format/CurrencyFormatter.ts::format`` and the formatter invoked
    by the Table and Pivot Table plugins.

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
            try:
                return apply_currency(formatted, currency)
            except Exception:  # pylint: disable=broad-except  # noqa: BLE001
                return formatted
        if not d3_format:
            return raw_string(value)
        return format_numeric(d3_format, value)
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        # never let an unexpected value break a whole report table
        return raw_string(value)


def format_numeric(d3_format: str, value: float) -> str:
    """
    Format ``value`` according to a d3 number format.

    Delegates to the port of ``createSmartNumberFormatter.ts`` for the two smart
    pseudo-formats and to the port of ``d3-format/src/locale.js`` for d3
    specifiers. Registered frontend-only factories are rejected explicitly.

    :return: a formatted number string
    """
    if d3_format in UNSUPPORTED_FRONTEND_PRESETS:
        raise ValueError(f"Frontend preset {d3_format!r} is not available in reports")
    if d3_format in (SMART_NUMBER, SMART_NUMBER_SIGNED):
        return format_smart_number(value, signed=d3_format == SMART_NUMBER_SIGNED)
    return format_d3(d3_format, value)


def format_d3(d3_format: str, value: float) -> str:
    """
    Format ``value`` with a d3-format specifier.

    Mirrors ``d3-format/src/locale.js`` and ``formatTypes.js``. Supports the
    subset of the specifier grammar the Table/Pivot plugins emit:
    the ``+ - ( space`` sign modes, the ``$`` currency prefix, the ``,`` group
    separator, ``.precision``, the ``~`` trim flag, and the ``s`` (SI), ``r``
    (significant), ``d`` (integer), ``f``/``e``/``g``/``%`` numeric types.
    Returns the formatted string and raises ``ValueError`` for an unparseable
    specifier. Padding flags are rejected because they cannot be represented by
    the report table path.

    :return: a d3-compatible formatted string
    """
    match = D3_FORMAT_RE.match(d3_format)
    if not match:
        raise ValueError(d3_format)
    if any(match.group(index) for index in (1, 2, 5, 6)):
        raise ValueError(f"d3 padding is not supported in reports: {d3_format!r}")

    sign_mode = match.group(3) or "-"
    currency_symbol = match.group(4) == "$"
    comma = "," if match.group(7) else ""
    precision = int(match.group(8)) if match.group(8) is not None else None
    trim = bool(match.group(9))
    type_ = (match.group(10) or "").lower()

    if type_ == "n":
        comma = ","
        type_ = "g"

    formatted = format_d3_magnitude(
        type_, abs(value), precision, trim, comma, d3_format
    )

    if currency_symbol:
        formatted = f"${formatted}"
    return apply_sign(formatted, value, sign_mode)


def format_d3_magnitude(
    type_: str,
    magnitude: float,
    precision: int | None,
    trim: bool,
    comma: str,
    d3_format: str,
) -> str:
    """
    Render the unsigned numeric portion of a parsed d3 specifier.

    Mirrors the formatter dispatch in ``d3-format/src/locale.js`` and
    ``formatTypes.js``. The result excludes sign and currency decoration.
    """
    if type_ == "s":
        return format_si(
            magnitude, max(1, precision if precision is not None else 6), trim
        )
    if type_ == "r":
        return format_significant(
            magnitude,
            max(1, precision if precision is not None else 6),
            trim,
            comma,
        )
    if type_ == "":
        return format_general(
            magnitude, precision if precision is not None else 12, True, comma
        )
    if type_ == "d":
        formatted = format(int(quantize_half_up(magnitude, 0)), f"{comma}d")
    elif type_ in ("f", "%"):
        precision = precision if precision is not None else 6
        scaled = magnitude * 100 if type_ == "%" else magnitude
        suffix = "%" if type_ == "%" else ""
        if scaled >= 1e21:
            formatted = normalize_exponent(repr(float(scaled))) + suffix
        else:
            rounded = quantize_half_up(scaled, precision)
            formatted = format(rounded, f"{comma}.{precision}f") + suffix
    elif type_ == "e":
        formatted = format_exponential(
            magnitude, precision if precision is not None else 6
        )
    elif type_ == "g":
        formatted = format_general(
            magnitude, precision if precision is not None else 6, trim, comma
        )
    else:
        raise ValueError(d3_format)
    return trim_trailing_zeros(formatted) if trim else formatted


def apply_sign(formatted: str, value: float, sign_mode: str) -> str:
    """
    Decorate a formatted magnitude with the d3 sign mode.

    Negative values get a leading ``-`` (or wrapping parentheses for the ``(``
    accounting mode); positive values get a ``+`` or a leading space only for the
    ``+`` and space modes respectively. Mirrors the sign decoration in
    ``d3-format/src/locale.js``.

    :return: the signed or accounting-decorated string
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

    d3 aliases an omitted type to ``.12~g``. This preserves fixed notation from
    ``1e-6`` through twelve significant integer digits, then uses exponent
    notation outside that range. Mirrors the omitted-type alias in
    ``d3-format/src/formatSpecifier.js``.

    :return: the ``.12~g`` representation
    """
    return format_general(value, 12, True, comma)


def format_general(value: float, precision: int, trim: bool, comma: str = "") -> str:
    """
    Format d3's ``g`` type with JavaScript ``toPrecision`` thresholds.

    Mirrors ``d3-format/src/formatTypes.js`` and returns fixed or exponential
    notation with the requested significant-digit precision.
    """
    precision = max(1, precision)
    rounded = round_to_significant(value, precision)
    exponent = decimal_exponent(rounded)
    if value and (exponent < -6 or exponent >= precision):
        formatted = format_exponential(value, precision - 1)
    else:
        formatted = format_significant(value, precision, False, comma)
    return trim_trailing_zeros(formatted) if trim else formatted


def format_exponential(value: float, precision: int) -> str:
    """
    Format d3's ``e`` type using binary-float, half-up rounding.

    Mirrors the ``e`` formatter in ``d3-format/src/formatTypes.js`` and returns
    an exponent without redundant leading zeros.
    """
    rounded = round_to_significant(value, precision + 1)
    exponent = decimal_exponent(rounded)
    mantissa = rounded / (10**exponent) if rounded else 0.0
    return f"{mantissa:.{precision}f}e{exponent:+d}"


def format_smart_number(value: float, signed: bool = False) -> str:
    """
    Format ``value`` the way the frontend ``SMART_NUMBER`` formatter does.

    The notation is chosen by magnitude: SI prefixes (with ``G`` shown as ``B``)
    for ``abs(value) >= 1000``, two decimals down to ``1``, four decimals down to
    ``0.001``, a micro (``µ``) suffix down to ``1e-6``, and SI prefixes again
    below that. When ``signed`` is set, positive values are prefixed with ``+``.
    Mirrors ``number-format/factories/createSmartNumberFormatter.ts``.

    :return: the adaptive frontend-compatible number string
    """
    if value == 0:
        body = "0"
    else:
        absolute = abs(value)
        if absolute >= 1000:
            body = format_si(value, 3, trim=True, billions=True)
        elif absolute >= 1:
            body = trim_trailing_zeros(format(quantize_half_up(value, 2), ".2f"))
        elif absolute >= 0.001:
            body = trim_trailing_zeros(format(quantize_half_up(value, 4), ".4f"))
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
    symbol is rendered as ``B``. Mirrors d3's
    ``formatPrefixAuto.js``/``formatRounded.js`` combination.

    :return: a significant-digit mantissa followed by its SI prefix
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
    notation Python's `g` would switch to. Mirrors the fixed representation
    produced by ``d3-format/src/formatRounded.js``.

    :return: a fixed-point significant-digit string
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
    half away from zero, matching d3-format's ``formatDecimalParts`` path.

    :return: the rounded binary-float value
    """
    if value == 0:
        return 0.0
    return float(quantize_half_up(value, precision - 1 - decimal_exponent(value)))


def quantize_half_up(value: float, decimals: int) -> Decimal:
    """
    Round to `decimals` places, half away from zero, matching d3-format.

    Quantizes the binary float value (not its decimal string) so the result
    matches d3, which rounds the IEEE-754 value: ``2.675`` is ``2.67`` because it
    is really ``2.67499...``, while an exact ``0.125`` rounds up to ``0.13``.
    This supplies the rounding semantics of ``d3-format/src/formatTypes.js``.

    :return: a ``Decimal`` rounded at the requested decimal place
    """
    return Decimal(value).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)


def decimals_for_significant(value: float, precision: int) -> int:
    """
    Return fixed-point decimal places needed for significant-digit formatting.

    This is the report-side equivalent of the exponent adjustment in
    ``d3-format/src/formatRounded.js``.
    """
    integer_digits = 1 if value == 0 else decimal_exponent(value) + 1
    return max(0, precision - integer_digits)


def decimal_exponent(value: float) -> int:
    """
    Return the base-10 exponent without ``log10`` boundary drift.

    Used where d3-format derives an exponent through ``formatDecimalParts``.
    """
    return Decimal(repr(value)).adjusted() if value else 0


def normalize_exponent(formatted: str) -> str:
    """
    Drop exponent leading zeros (``1e+07`` to ``1e+7``), as d3 does.

    :return: the exponent string style emitted by ``d3-format``
    """
    return re.sub(r"([eE][+-])0*(\d)", r"\1\2", formatted)


def get_currency_locale() -> str:
    """
    Return the request locale, or the configured default outside a request.

    Report tasks run with a Flask application context but without a request, so
    Flask-Babel can return ``None``. The config fallback keeps Celery-rendered
    reports aligned with the locale supplied to the frontend at bootstrap. The
    result feeds the locale argument used by ``currency-format/symbolPosition.ts``.

    :return: a Babel locale identifier, always with a safe default
    """
    try:
        if locale := get_locale():
            return str(locale)
    except RuntimeError:
        pass

    try:
        return str(current_app.config.get("BABEL_DEFAULT_LOCALE") or DEFAULT_LOCALE)
    except RuntimeError:
        return DEFAULT_LOCALE


@lru_cache(maxsize=None)
def resolve_symbol_position(code: str, locale: str) -> str:
    """
    Derive the symbol position from the locale's convention for the currency.

    Mirrors ``currency-format/symbolPosition.ts::resolveSymbolPosition`` and
    returns ``"prefix"`` on invalid locale/currency input.
    """
    try:
        sample = format_currency(1, code, locale=locale)
        first_digit = next(i for i, char in enumerate(sample) if char.isdigit())
        return "prefix" if first_digit > 0 else "suffix"
    except Exception:  # pylint: disable=broad-except  # noqa: BLE001
        return "prefix"


def apply_currency(formatted: str, currency: dict[str, Any]) -> str:
    """
    Add a localized currency symbol to an already formatted number.

    Mirrors ``currency-format/CurrencyFormatter.ts::format``: percentage signs
    are removed, explicit positions win, and an unset position is locale-driven.

    :return: the number with a prefix or suffix currency symbol
    """
    normalized = formatted.replace("%", "")
    code = currency["symbol"]
    symbol = get_currency_symbol(code, locale=CURRENCY_SYMBOL_LOCALE) or code
    position = currency.get("symbolPosition")
    if position not in ("prefix", "suffix"):
        position = resolve_symbol_position(code, get_currency_locale())
    if position == "prefix":
        return f"{symbol} {normalized}"
    return f"{normalized} {symbol}"


def trim_trailing_zeros(formatted: str) -> str:
    """
    Remove insignificant fractional zeros while preserving suffixes.

    Mirrors ``d3-format/src/formatTrim.js`` for decimal, exponent, and percent
    strings and returns the compact representation.
    """
    suffix = "%" if formatted.endswith("%") else ""
    body = formatted[: -len(suffix)] if suffix else formatted
    coefficient, separator, exponent = body.partition("e")
    if "." in coefficient:
        coefficient = coefficient.rstrip("0").rstrip(".")
    exponent_suffix = f"{separator}{exponent}" if separator else ""
    return coefficient + exponent_suffix + suffix


def raw_string(value: float) -> str:
    """
    Convert an unformatted number to the frontend-like neutral representation.

    Integral floats lose their Python-only ``.0`` suffix. The result is the
    safe fallback used by ``CurrencyFormatter.ts`` and invalid format handling.
    """
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)
