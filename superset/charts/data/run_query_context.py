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

"""Host implementations of the `superset_core.exports` chart-query functions."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

import pandas as pd
from flask import g
from marshmallow import ValidationError
from superset_core.exports.types import ChartQueryResult, GenericDataType

from superset import is_feature_enabled, security_manager
from superset.charts.client_processing import apply_client_processing
from superset.charts.data.form_data import set_form_data
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context_factory import QueryContextFactory
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.utils.core import extract_dataframe_dtypes

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

# Result types whose queries return rows; the rest return SQL or metadata.
ROW_RESULT_TYPES = frozenset(
    {
        ChartDataResultType.FULL,
        ChartDataResultType.RESULTS,
        ChartDataResultType.POST_PROCESSED,
        ChartDataResultType.SAMPLES,
        ChartDataResultType.DRILL_DETAIL,
    }
)

# Header of the row-label column; blank, like the unnamed index in a CSV export.
ROW_LABEL_COLUMN = ""

_UNSET = object()


def _requested_result_types(query_context: QueryContext) -> set[str]:
    """Collect the context-level and per-query result types after loading."""
    return {
        str(result_type)
        for result_type in (
            query_context.result_type,
            *(query.result_type for query in query_context.queries),
        )
        if result_type
    }


def _coltype(value: Any) -> GenericDataType:
    """Map a host column type to the core enum; unknown types read as strings."""
    try:
        return GenericDataType(value)
    except ValueError:
        return GenericDataType.STRING


def _flatten_label(label: Any) -> str:
    """Join a hierarchical label the way client processing flattens tuples."""
    if isinstance(label, tuple):
        return " ".join(str(part) for part in label).strip()
    return str(label)


def post_processed_rows(query: dict[str, Any], row_labels: bool) -> dict[str, Any]:
    """
    Return ``query`` with post-processed JSON data rebuilt as row records.

    Client processing serializes its frame as ``{column: {row label: value}}``
    and drops the index names, so with ``row_labels`` the labels become a
    leading ``ROW_LABEL_COLUMN``. ``colnames`` and ``coltypes`` are recomputed
    to describe the rows.
    """
    data = query.get("data")
    if not isinstance(data, dict):
        return query

    df = pd.DataFrame.from_dict(data)
    df.columns = [_flatten_label(column) for column in df.columns]
    if row_labels:
        df.insert(
            0,
            ROW_LABEL_COLUMN,
            [_flatten_label(label) for label in df.index],
            allow_duplicates=True,
        )
    df = df.reset_index(drop=True)

    rows = df.astype(object).where(df.notna(), None)
    return {
        **query,
        "colnames": list(df.columns),
        "coltypes": extract_dataframe_dtypes(df),
        "data": rows.to_dict("records"),
    }


def run_query_context(payload: dict[str, Any]) -> list[ChartQueryResult]:
    """
    Run a chart-data payload as the current user, always as JSON rows.

    :raises SupersetSecurityException: If the user may not access the datasource
    :raises ValidationError: If the payload is malformed
    :raises ValueError: If a result type carries no row data
    """
    # Rows are read from JSON results, whatever format the payload asks for.
    payload = {**payload, "result_format": ChartDataResultFormat.JSON}
    previous = g.get("form_data", _UNSET)
    # Jinja macros read the payload from ``g.form_data`` outside a request.
    set_form_data(payload)
    try:
        return _run(payload)
    finally:
        if previous is _UNSET:
            g.pop("form_data", None)
        else:
            g.form_data = previous


def _run(payload: dict[str, Any]) -> list[ChartQueryResult]:
    schema: ChartDataQueryContextSchema = ChartDataQueryContextSchema()
    schema.query_context_factory = QueryContextFactory(
        authorize_semantic_before_metadata=True
    )
    try:
        query_context = schema.load(payload)
    except KeyError as ex:
        raise ValidationError("Request is incorrect") from ex
    except ValueError as ex:
        raise ValidationError(str(ex)) from ex

    if unsupported := sorted(_requested_result_types(query_context) - ROW_RESULT_TYPES):
        raise ValueError(
            f"Result type {', '.join(unsupported)} returns no rows; use one of "
            f"{', '.join(sorted(ROW_RESULT_TYPES))}"
        )

    command = ChartDataCommand(query_context)
    command.validate()
    result = command.run()

    if query_context.result_type == ChartDataResultType.POST_PROCESSED:
        form_data = payload.get("form_data") or {}
        result = apply_client_processing(result, form_data, query_context.datasource)
        # Only the table processor keeps the default index, which CSV omits too.
        row_labels = form_data.get("viz_type") != "table"
        result = {
            **result,
            "queries": [
                post_processed_rows(query, row_labels) for query in result["queries"]
            ],
        }

    return [
        ChartQueryResult(
            colnames=query.get("colnames") or [],
            coltypes=[_coltype(t) for t in query.get("coltypes") or []],
            data=query.get("data") or [],
        )
        for query in result["queries"]
    ]


def can_export_data() -> bool:
    """Whether the current user may export chart data as a file."""
    if is_feature_enabled("GRANULAR_EXPORT_CONTROLS"):
        return security_manager.can_access("can_export_data", "Superset")
    return security_manager.can_access("can_csv", "Superset")


def can_export_dashboard(dashboard_id: int) -> bool:
    """Whether the current user may export the dashboard; False if it is missing."""
    dashboard = DashboardDAO.find_by_id(dashboard_id)
    if dashboard is None:
        return False
    try:
        security_manager.raise_for_access(dashboard=dashboard)
    except SupersetSecurityException:
        return False
    return security_manager.can_access("can_export", "Dashboard")
