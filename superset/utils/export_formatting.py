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

import numbers
from decimal import Decimal
from typing import Any
from urllib.parse import parse_qs, urlparse

import pandas as pd

from superset.utils.core import GenericDataType
from superset.utils.number_format_locale import (
    format_number_for_locale,
    NUMBER_FORMAT_LOCALES,
    resolve_number_format_locale,
)


def _normalize_export_locale(locale: object) -> str | None:
    if isinstance(locale, str) and locale in NUMBER_FORMAT_LOCALES:
        return locale
    return None


def get_export_locale_from_form_data(form_data: dict[str, Any] | None) -> str | None:
    """
    Resolve export locale for CSV/XLSX downloads.

    Checks, in order:
    1. ``locale`` on chart ``form_data`` (set by the export request payload)
    2. ``locale`` query param on the export HTTP request
    3. ``locale`` query param on the Referer URL (dashboard/explore page)
    """
    if isinstance(form_data, dict):
        if locale := _normalize_export_locale(form_data.get("locale")):
            return locale

    try:
        from flask import has_request_context, request

        if not has_request_context():
            return None

        if locale := _normalize_export_locale(request.args.get("locale")):
            return locale

        referer = request.headers.get("Referer")
        if referer:
            referer_locale = parse_qs(urlparse(referer).query).get("locale", [None])[0]
            if locale := _normalize_export_locale(referer_locale):
                return locale
    except RuntimeError:
        return None

    return None


def _to_export_float(value: object) -> float:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, numbers.Real) and not isinstance(value, bool):
        return float(value)
    raise TypeError(f"Expected numeric export value, got {type(value)!r}")


def is_formattable_number(value: object) -> bool:
    """Return True when a value should receive locale number formatting."""
    if isinstance(value, bool):
        return False
    if isinstance(value, Decimal):
        return True
    return isinstance(value, numbers.Real)


def column_should_receive_locale_formatting(
    column_type: GenericDataType,
    series: pd.Series,
) -> bool:
    """
    Decide whether a column should be locale-formatted on export.

    Column metadata often marks computed metrics as STRING even when the query
    returns numeric values, so dtype and sample values are used as fallbacks.
    """
    if column_type in (GenericDataType.TEMPORAL, GenericDataType.BOOLEAN):
        return False
    if column_type == GenericDataType.NUMERIC:
        return True
    if pd.api.types.is_numeric_dtype(series):
        return True
    if series.dtype == object:
        sample = series.dropna().head(50)
        if len(sample) > 0 and all(is_formattable_number(value) for value in sample):
            return True
    return False


def format_export_cell_value(value: Any, locale_code: str | None) -> Any:
    """Format a single export cell value when it is numeric."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return value
    if pd.isna(value):
        return value
    if not is_formattable_number(value):
        return value

    locale = resolve_number_format_locale(locale_code)
    return format_number_for_locale(_to_export_float(value), locale)


def apply_locale_number_formatting(
    df: pd.DataFrame,
    coltypes: list[GenericDataType],
    locale_code: str | None,
) -> pd.DataFrame:
    """
    Format numeric columns as locale-aware strings for CSV/XLSX export.

    Numeric cells become display strings (Strategy A) so CSV downloads match chart UI.
    XLSX exports keep native numeric values so Excel can format them.
    """
    if not locale_code:
        return df

    locale = resolve_number_format_locale(locale_code)
    out = df.copy()
    for index, column in enumerate(out.columns):
        column_type = (
            coltypes[index] if index < len(coltypes) else GenericDataType.STRING
        )
        series = out[column]
        if not column_should_receive_locale_formatting(column_type, series):
            continue
        out[column] = series.map(
            lambda value: (
                format_number_for_locale(_to_export_float(value), locale)
                if is_formattable_number(value) and not pd.isna(value)
                else value
            )
        )
    return out
