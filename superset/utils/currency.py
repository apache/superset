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
"""Currency detection utilities for dynamic currency formatting."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, TYPE_CHECKING

from superset.common.db_query_status import QueryStatus

if TYPE_CHECKING:
    from superset.explorables.base import Explorable
    from superset.superset_typing import QueryObjectDict
    from superset.utils.core import QueryObjectFilterClause

logger = logging.getLogger(__name__)


def has_auto_currency_in_column_config(form_data: dict[str, Any] | None) -> bool:
    """
    Check if any column in column_config has AUTO currency format.

    Used by Table charts which configure currency per-column via column_config,
    rather than using top-level currency_format like other chart types.

    :param form_data: The form data containing column_config
    :return: True if any column has AUTO currency format
    """
    if not form_data:
        return False
    column_config = form_data.get("column_config", {})
    if not isinstance(column_config, dict):
        return False
    for config in column_config.values():
        if not isinstance(config, dict):
            continue
        currency_format = config.get("currencyFormat", {})
        if (
            isinstance(currency_format, dict)
            and currency_format.get("symbol") == "AUTO"
        ):
            return True
    return False


def detect_currency_from_df(
    df: Any,  # pd.DataFrame, but avoiding import for type checking
    currency_column: str,
) -> str | None:
    """
    Detect currency from an already-fetched dataframe.

    Returns the currency code if all data contains a single currency,
    or None if multiple currencies are present or column is missing.

    :param df: The pandas DataFrame to analyze
    :param currency_column: The name of the currency code column
    :return: ISO 4217 currency code (e.g., "USD", "EUR") or None
    """
    if df is None or df.empty:
        return None

    if currency_column not in df.columns:
        return None

    unique_currencies = df[currency_column].dropna().astype(str).str.upper().unique()

    if len(unique_currencies) == 1:
        return str(unique_currencies[0])

    return None


def detect_currency(
    datasource: Explorable,
    filters: list[QueryObjectFilterClause] | None = None,
    granularity: str | None = None,
    from_dttm: datetime | None = None,
    to_dttm: datetime | None = None,
    extras: dict[str, Any] | None = None,
) -> str | None:
    """
    Detect currency from filtered data for AUTO mode currency formatting.

    Executes a lightweight query to get distinct currency values using the
    provided filters. Returns the currency code if all filtered data contains
    a single currency, or None if multiple currencies are present.

    This utility is used by both the modern QueryContext API and the legacy
    viz API to provide consistent currency detection behavior.

    :param datasource: The datasource to query
    :param filters: List of filter dicts with 'col', 'op', 'val' keys
    :param granularity: Optional time granularity column
    :param from_dttm: Optional start datetime for time filtering
    :param to_dttm: Optional end datetime for time filtering
    :param extras: Optional extra query parameters (having, where clauses)
    :return: ISO 4217 currency code (e.g., "USD", "EUR") or None
    """
    currency_column = getattr(datasource, "currency_code_column", None)
    if not currency_column:
        return None

    datasource_id = getattr(datasource, "id", 0)

    query_method = getattr(datasource, "query", None)
    if not callable(query_method):
        return None

    try:
        query_obj: QueryObjectDict = {
            "granularity": granularity,
            "from_dttm": from_dttm,
            "to_dttm": to_dttm,
            "is_timeseries": False,
            "groupby": [currency_column],
            "metrics": [],
            "filter": filters or [],
            "extras": extras or {},
        }

        result = query_method(query_obj)

        if result.status != QueryStatus.SUCCESS or result.df.empty:
            return None
        if currency_column not in result.df.columns:
            return None

        unique_currencies = (
            result.df[currency_column].dropna().astype(str).str.upper().unique()
        )

        if len(unique_currencies) == 1:
            return str(unique_currencies[0])

        return None

    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Failed to detect currency for datasource %s",
            datasource_id,
            exc_info=True,
        )
        return None
