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
    from superset.connectors.sqla.models import BaseDatasource

logger = logging.getLogger(__name__)


def detect_currency(
    datasource: BaseDatasource,
    filters: list[dict[str, Any]] | None = None,
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
    # Check if datasource has a currency code column configured
    currency_column = getattr(datasource, "currency_code_column", None)
    if not currency_column:
        return None

    try:
        # Build a minimal query to get distinct currency values
        query_obj: dict[str, Any] = {
            "granularity": granularity,
            "from_dttm": from_dttm,
            "to_dttm": to_dttm,
            "is_timeseries": False,
            "groupby": [currency_column],
            "metrics": [],
            "row_limit": 1000,  # Reasonable limit for distinct values
            "filter": filters or [],
            "extras": extras or {},
        }

        # Execute the query to get currency values
        result = datasource.query(query_obj)

        if result.status != QueryStatus.SUCCESS or result.df.empty:
            return None

        # Get unique non-null currency values
        if currency_column not in result.df.columns:
            return None

        unique_currencies = (
            result.df[currency_column].dropna().astype(str).str.upper().unique()
        )

        # Return single currency if only one exists, None otherwise
        if len(unique_currencies) == 1:
            return str(unique_currencies[0])

        return None

    except Exception:  # pylint: disable=broad-except
        # Currency detection should never block the main query
        logger.warning(
            "Failed to detect currency for datasource %s",
            getattr(datasource, "id", "unknown"),
            exc_info=True,
        )
        return None
