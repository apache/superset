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
Shared helper functions for MCP chart tools.

This module contains reusable utility functions for common operations
across chart tools: chart lookup, cached form data retrieval, and
URL parameter extraction. Config mapping logic lives in chart_utils.py.
"""

from __future__ import annotations

import logging
from typing import Any, TYPE_CHECKING
from urllib.parse import parse_qs, urlparse

if TYPE_CHECKING:
    from superset.models.slice import Slice

logger = logging.getLogger(__name__)


def find_chart_by_identifier(identifier: int | str) -> Slice | None:
    """Find a chart by numeric ID or UUID string.

    Accepts an integer ID, a string that looks like a digit (e.g. "123"),
    or a UUID string. Returns the Slice model instance or None.
    """
    from superset.daos.chart import ChartDAO  # avoid circular import

    if isinstance(identifier, int) or (
        isinstance(identifier, str) and identifier.isdigit()
    ):
        chart_id = int(identifier) if isinstance(identifier, str) else identifier
        return ChartDAO.find_by_id(chart_id)
    return ChartDAO.find_by_id(identifier, id_column="uuid")


def get_cached_form_data(form_data_key: str) -> str | None:
    """Retrieve form_data from cache using form_data_key.

    Returns the JSON string of form_data if found, None otherwise.
    """
    # avoid circular import — commands depend on app initialization
    from superset.commands.exceptions import CommandException
    from superset.commands.explore.form_data.get import GetFormDataCommand
    from superset.commands.explore.form_data.parameters import CommandParameters

    try:
        cmd_params = CommandParameters(key=form_data_key)
        return GetFormDataCommand(cmd_params).run()
    except (KeyError, ValueError, CommandException) as e:
        logger.warning("Failed to retrieve form_data from cache: %s", e)
        return None


def resolve_datasource_engine(datasource_id: Any, datasource_type: str) -> str:
    """Return the datasource engine name, or ``"base"`` if it cannot be resolved."""
    if not isinstance(datasource_id, (int, str)):
        return "base"
    try:
        from superset.daos.datasource import DatasourceDAO
        from superset.utils.core import DatasourceType

        datasource = DatasourceDAO.get_datasource(
            datasource_type=DatasourceType(datasource_type),
            database_id_or_uuid=datasource_id,
        )
        return datasource.database.db_engine_spec.engine
    except Exception:  # noqa: BLE001
        logger.debug("Could not resolve engine for datasource %s", datasource_id)
        return "base"


def prepare_form_data_for_query(
    form_data: dict[str, Any],
    datasource_id: Any,
    datasource_type: str,
    extra_form_data: dict[str, Any] | None = None,
    datasource_engine: str | None = None,
) -> None:
    """Normalize form_data filters before building a QueryObject payload.

    Explore and legacy viz query construction merge dashboard/native filter payloads
    and split adhoc filters into the concrete ``filters``/``where``/``having``
    fields consumed by QueryObject. MCP tools that build query payloads directly
    must perform the same normalization before calling QueryContextFactory.

    Mutates ``form_data`` in place.
    """
    from superset.utils.core import (
        convert_legacy_filters_into_adhoc,
        form_data_to_adhoc,
        merge_extra_filters,
        simple_filter_to_adhoc,
        split_adhoc_filters_into_base_filters,
    )

    if isinstance(form_data.get("adhoc_filters"), list):
        adhoc_filters = [
            *(
                form_data_to_adhoc(form_data, clause)
                for clause in ("having", "where")
                if form_data.get(clause)
            ),
            *(
                simple_filter_to_adhoc(filter_, "where")
                for filter_ in form_data.get("filters") or []
                if filter_ is not None
            ),
            *form_data["adhoc_filters"],
        ]
        form_data["adhoc_filters"] = adhoc_filters

    if extra_form_data:
        form_data["extra_form_data"] = extra_form_data
    convert_legacy_filters_into_adhoc(form_data)
    merge_extra_filters(form_data)
    split_adhoc_filters_into_base_filters(
        form_data,
        datasource_engine or resolve_datasource_engine(datasource_id, datasource_type),
    )


def apply_form_data_filters_to_query(
    query: dict[str, Any],
    form_data: dict[str, Any],
) -> None:
    """Copy normalized form_data filter fields into a query payload."""
    if filters := form_data.get("filters"):
        query["filters"] = filters
    else:
        query.setdefault("filters", [])

    if time_range := form_data.get("time_range"):
        query["time_range"] = time_range
    if where := form_data.get("where"):
        query["where"] = where
    if having := form_data.get("having"):
        query["having"] = having


def _join_sql_clause(existing_clause: str, additional_clause: str) -> str:
    """AND two SQL filter clauses while preserving their original grouping."""
    return f"({existing_clause}) AND ({additional_clause})"


def merge_form_data_filters_into_query(
    query: dict[str, Any],
    form_data: dict[str, Any],
) -> None:
    """Merge normalized form_data filters into an existing query payload.

    Saved query contexts can contain query-specific filter, time, where, or
    having fields. This helper adds normalized predicates without replacing
    those query-level overrides.
    """
    if filters := form_data.get("filters"):
        query["filters"] = [
            *(query.get("filters") or []),
            *filters,
        ]

    if time_range := form_data.get("time_range"):
        query.setdefault("time_range", time_range)

    for clause in ("where", "having"):
        if additional_clause := form_data.get(clause):
            if existing_clause := query.get(clause):
                query[clause] = _join_sql_clause(existing_clause, additional_clause)
            else:
                query[clause] = additional_clause


def merge_extra_form_data_filters_into_query(
    query: dict[str, Any],
    extra_form_data: dict[str, Any],
    datasource_id: Any,
    datasource_type: str,
) -> None:
    """Merge request extra_form_data predicates into an existing query payload."""
    extra_query_form_data: dict[str, Any] = {"adhoc_filters": []}
    prepare_form_data_for_query(
        extra_query_form_data,
        datasource_id,
        datasource_type,
        extra_form_data,
    )
    merge_form_data_filters_into_query(query, extra_query_form_data)


def extract_form_data_key_from_url(url: str | None) -> str | None:
    """Extract the form_data_key query parameter from an explore URL.

    Returns the form_data_key value or None if not found or URL is empty.
    """
    if not url:
        return None
    parsed = urlparse(url)
    values = parse_qs(parsed.query).get("form_data_key", [])
    return values[0] if values else None
