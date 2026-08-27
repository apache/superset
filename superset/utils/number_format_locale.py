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
    csv_sep: str | None


def _locale(
    code: NumberFormatLocaleCode, decimal: str, thousands: str
) -> NumberFormatLocale:
    return {
        "code": code,
        "decimal": decimal,
        "thousands": thousands,
        "csv_sep": None,
    }


# en_GB shares US separators; DE/ES/IT/NL/FR/PL share continental separators.
NUMBER_FORMAT_LOCALES: dict[str, NumberFormatLocale] = {
    "en_US": _locale("en_US", ".", ","),
    "en_GB": _locale("en_GB", ".", ","),
    "de_DE": _locale("de_DE", ",", "."),
    "es_ES": _locale("es_ES", ",", "."),
    "it_IT": _locale("it_IT", ",", "."),
    "nl_NL": _locale("nl_NL", ",", "."),
    "fr_FR": _locale("fr_FR", ",", "."),
    "pl_PL": _locale("pl_PL", ",", "."),
}


def resolve_number_format_locale(locale: str | None) -> NumberFormatLocale:
    """Map a URL/form_data locale code to export formatting rules."""
    if locale in NUMBER_FORMAT_LOCALES:
        return NUMBER_FORMAT_LOCALES[locale]
    return NUMBER_FORMAT_LOCALES["en_US"]


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
