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
from __future__ import annotations

from typing import Literal, TypedDict

NumberFormatLocaleCode = Literal[
    "en_US",
    "en_GB",
    "de_DE",
    "es_ES",
    "fr_FR",
    "it_IT",
    "nl_NL",
    "pl_PL",
]


class NumberFormatLocale(TypedDict):
    code: NumberFormatLocaleCode
    decimal: str
    thousands: str
    csv_sep: str


def _locale(
    code: NumberFormatLocaleCode,
    decimal: str,
    thousands: str,
    csv_sep: str,
) -> NumberFormatLocale:
    return {
        "code": code,
        "decimal": decimal,
        "thousands": thousands,
        "csv_sep": csv_sep,
    }


# US/GB use comma CSV columns; continental locales use semicolon so Excel
# can parse decimal commas as numbers without a Convert dialog.
NUMBER_FORMAT_LOCALES: dict[str, NumberFormatLocale] = {
    "en_US": _locale("en_US", ".", ",", ","),
    "en_GB": _locale("en_GB", ".", ",", ","),
    "de_DE": _locale("de_DE", ",", ".", ";"),
    "es_ES": _locale("es_ES", ",", ".", ";"),
    "it_IT": _locale("it_IT", ",", ".", ";"),
    "nl_NL": _locale("nl_NL", ",", ".", ";"),
    "fr_FR": _locale("fr_FR", ",", ".", ";"),
    "pl_PL": _locale("pl_PL", ",", ".", ";"),
}


def normalize_number_format_locale(value: object) -> str | None:
    """Accept product locale codes such as ``en_GB`` and ``fr_FR``."""
    if not isinstance(value, str) or not value:
        return None
    raw = value.strip().replace("-", "_")
    if raw in NUMBER_FORMAT_LOCALES:
        return raw
    parts = raw.split("_")
    if len(parts) >= 2 and len(parts[1]) == 2:
        canonical = f"{parts[0].lower()}_{parts[1].upper()}"
        if canonical in NUMBER_FORMAT_LOCALES:
            return canonical
    return None


def resolve_number_format_locale(locale: str | None) -> NumberFormatLocale:
    """Map a URL/form_data locale code to export formatting rules."""
    if normalized := normalize_number_format_locale(locale):
        return NUMBER_FORMAT_LOCALES[normalized]
    return NUMBER_FORMAT_LOCALES["en_US"]


def get_csv_separator(locale_code: str | None) -> str:
    """Return the CSV column delimiter for a locale (``,`` or ``;``)."""
    if normalized := normalize_number_format_locale(locale_code):
        return NUMBER_FORMAT_LOCALES[normalized]["csv_sep"]
    return ","


def format_number_for_locale(value: float | int, locale: NumberFormatLocale) -> str:
    """
    Format a number with thousands separators matching the chart UI.

    en_US / en_GB → 1,234.56
    de_DE / es_ES / it_IT / nl_NL / fr_FR / pl_PL → 1.234,56
    """
    formatted = f"{float(value):,.2f}"
    if formatted.lower() in {"inf", "-inf", "nan"}:
        return formatted

    integer_part, _, decimal_part = formatted.partition(".")
    integer_part = integer_part.replace(",", locale["thousands"])
    if not decimal_part:
        return integer_part
    return f"{integer_part}{locale['decimal']}{decimal_part}"
