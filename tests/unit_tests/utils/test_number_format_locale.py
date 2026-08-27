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

from superset.utils.number_format_locale import (
    format_number_for_locale,
    NUMBER_FORMAT_LOCALES,
    resolve_number_format_locale,
)


def test_resolve_number_format_locale_defaults_to_en_us() -> None:
    locale = resolve_number_format_locale(None)
    assert locale["code"] == "en_US"
    assert locale["decimal"] == "."
    assert locale["thousands"] == ","

    assert resolve_number_format_locale("zh_CN")["code"] == "en_US"


@pytest.mark.parametrize(
    ("locale_code", "decimal", "thousands"),
    [
        ("en_US", ".", ","),
        ("en_GB", ".", ","),
        ("de_DE", ",", "."),
        ("es_ES", ",", "."),
        ("it_IT", ",", "."),
        ("nl_NL", ",", "."),
        ("fr_FR", ",", "."),
        ("pl_PL", ",", "."),
    ],
)
def test_resolve_number_format_locale_supported_codes(
    locale_code: str, decimal: str, thousands: str
) -> None:
    locale = resolve_number_format_locale(locale_code)
    assert locale["code"] == locale_code
    assert locale["decimal"] == decimal
    assert locale["thousands"] == thousands


@pytest.mark.parametrize(
    ("locale_code", "expected"),
    [
        ("en_US", "1,234.50"),
        ("en_GB", "1,234.50"),
        ("de_DE", "1.234,50"),
        ("es_ES", "1.234,50"),
        ("it_IT", "1.234,50"),
        ("nl_NL", "1.234,50"),
        ("fr_FR", "1.234,50"),
        ("pl_PL", "1.234,50"),
    ],
)
def test_format_number_for_locale_supported_codes(
    locale_code: str, expected: str
) -> None:
    locale = resolve_number_format_locale(locale_code)
    assert format_number_for_locale(1234.5, locale) == expected


def test_format_number_for_locale_en_us_zero() -> None:
    locale = resolve_number_format_locale("en_US")
    assert format_number_for_locale(0, locale) == "0.00"


def test_format_number_for_locale_non_finite_de_de() -> None:
    locale = resolve_number_format_locale("de_DE")
    assert format_number_for_locale(float("inf"), locale) == "inf"
    assert format_number_for_locale(float("nan"), locale) == "nan"


def test_number_format_locales_cover_product_codes() -> None:
    assert set(NUMBER_FORMAT_LOCALES) == {
        "en_US",
        "en_GB",
        "de_DE",
        "es_ES",
        "fr_FR",
        "it_IT",
        "nl_NL",
        "pl_PL",
    }
